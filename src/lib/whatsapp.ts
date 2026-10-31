import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { askJson } from "./muse";
import { money } from "./format";
import { getShop } from "./shop";
import { createOrder, findMenuItem, listMenu, log, type Order, type OrderStatus } from "./store";

// WhatsApp ordering. With WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID set, messages go through the
// WhatsApp Cloud API; without them, the /whatsapp page plays the customer's phone. Every message is
// kept in wa_messages either way, so both paths behave the same.

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const API_VERSION = process.env.WHATSAPP_API_VERSION ?? "v21.0";

export function whatsappLive() {
  return Boolean(TOKEN && PHONE_NUMBER_ID);
}

export interface WaMessage {
  id: number;
  phone: string;
  name: string;
  direction: "in" | "out";
  text: string;
  created_at: string;
}

export function thread(phone: string): WaMessage[] {
  return db()
    .prepare("SELECT * FROM wa_messages WHERE phone = ? ORDER BY id DESC LIMIT 40")
    .all(phone)
    .reverse() as unknown as WaMessage[];
}

function save(phone: string, name: string, direction: "in" | "out", text: string) {
  db().prepare("INSERT INTO wa_messages (phone, name, direction, text) VALUES (?, ?, ?, ?)").run(phone, name, direction, text);
}

export async function sendWhatsApp(phone: string, text: string) {
  save(phone, "", "out", text);
  if (!whatsappLive()) return;
  const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: text } }),
  });
  if (!res.ok) log("Orders", `WhatsApp message to ${phone} failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
}

export function whatsappConnected() {
  return Boolean(db().prepare("SELECT id FROM connections WHERE id = 'whatsapp'").get());
}

export function connectWhatsApp() {
  const { changes } = db()
    .prepare("INSERT OR IGNORE INTO connections (id, name, kind) VALUES ('whatsapp', 'WhatsApp', 'whatsapp')")
    .run();
  if (changes) log("Orders", `WhatsApp connected${whatsappLive() ? "" : " (simulated)"}. Customers can order by message.`);
  return changes > 0;
}

// Meta signs webhook calls with the app secret; check it when one is configured.
export function validSignature(body: string, header: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true;
  if (!header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(body).digest("hex")}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

interface Reading {
  items: { item: string; qty: number; notes?: string }[];
  reply: string;
}

// A customer's message: answer questions about the café, or place the order they ask for.
export async function handleIncoming(phone: string, name: string, text: string) {
  save(phone, name, "in", text);
  if (!whatsappConnected()) return;
  const shop = getShop();
  const menu = listMenu();
  const history = thread(phone)
    .slice(-8)
    .map((m) => `${m.direction === "in" ? "Customer" : "Café"}: ${m.text}`)
    .join("\n");
  const reading = await askJson<Reading>(
    `You answer WhatsApp messages for ${shop.name}, a small café run by one person.
Hours: ${shop.hours || "not given"}. Address: ${shop.address || "not given"}.
Menu: ${menu.map((m) => `${m.name} ${money(m.price_cents)}${m.available ? "" : " (sold out today)"}`).join("; ")}.
Orders are for pickup and paid when collected.

Conversation so far:
${history}

Read the customer's latest message. If they clearly want to order now, list the items (menu names, quantities, any notes) in "items" and leave "reply" empty; the café will confirm the order itself. Otherwise leave "items" empty and write a short, friendly "reply" (one or two sentences, no markdown). Never take orders for sold-out items; offer something else.
Return {"items": [{"item": "", "qty": 1, "notes": ""}], "reply": ""}.`,
  );

  if (!reading.items?.length) {
    if (reading.reply) await sendWhatsApp(phone, reading.reply);
    return;
  }
  const lines = [];
  const problems: string[] = [];
  for (const i of reading.items) {
    const m = findMenuItem(i.item);
    if (!m) problems.push(`we don't have ${i.item}`);
    else if (!m.available) problems.push(`${m.name} is sold out today`);
    else lines.push({ menu_item_id: m.id, qty: Math.max(1, Math.round(i.qty || 1)), notes: i.notes });
  }
  if (problems.length || !lines.length) {
    await sendWhatsApp(phone, `Sorry, ${problems.join(" and ") || "I couldn't work out the order"}. Anything else I can get you?`);
    return;
  }
  const order = createOrder({ channel: "whatsapp", label: name || phone, contact: phone, status: "new", lines });
  const summary = order.items.map((i) => `${i.qty} ${i.name}`).join(", ");
  log("Orders", `New WhatsApp order ${order.number} from ${order.label}: ${summary} — ${money(order.total_cents)}, pay at pickup.`);
  await sendWhatsApp(
    phone,
    `Thanks${name ? ` ${name}` : ""}! Order #${order.number}: ${summary}, ${money(order.total_cents)}. Pay when you pick it up; we'll message you as soon as it's being made.`,
  );
}

// Keep WhatsApp customers posted as the owner moves their order along.
export async function notifyOrderUpdate(order: Order, status: OrderStatus, prepMinutes?: number) {
  if (order.channel !== "whatsapp" || !order.contact) return;
  const n = order.number;
  const text = {
    new: "",
    accepted: `Order #${n} is being made${prepMinutes ? `, ready in about ${prepMinutes} minutes` : ""}.`,
    ready: `Order #${n} is ready! Come and grab it at the counter.`,
    done: "",
    cancelled: `Sorry, we can't make order #${n} today${order.note ? ` (${order.note})` : ""}.`,
  }[status];
  if (text) await sendWhatsApp(order.contact, text);
}
