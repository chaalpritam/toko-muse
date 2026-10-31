import { db } from "./db";
import { money } from "./format";
import { createOrder, listMenu, log, markPaid, type Order } from "./store";
import { DELIVERY_APPS } from "./delivery-apps";

export { DELIVERY_APPS };

// The simulated delivery apps: the café's menu is published to them, sold-out items drop off
// (they only order what's available), and their customers' orders land in the queue already paid.

const CUSTOMERS = ["Maya", "Leo", "Priya", "Sam", "Aiko", "Omar", "Lena", "Tom", "Ines", "Kofi"];
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

// How often a connected app sends an order, on average. Short by default so it shows up in a demo.
const EVERY_SECONDS = Number(process.env.DELIVERY_EVERY_SECONDS ?? 90);
const nextDelay = () => `+${Math.round(EVERY_SECONDS * (0.6 + Math.random() * 0.8))} seconds`;

export interface Connection {
  id: string;
  name: string;
  kind: string;
  connected_at: string;
  next_order_at: string | null;
}

export function listConnections(): Connection[] {
  return db().prepare("SELECT * FROM connections ORDER BY connected_at").all() as unknown as Connection[];
}

export function connectedDeliveryApps() {
  return listConnections().filter((c) => c.kind === "delivery");
}

export function connectDeliveryApps() {
  const added: string[] = [];
  for (const app of DELIVERY_APPS) {
    const { changes } = db()
      .prepare("INSERT OR IGNORE INTO connections (id, name, kind, next_order_at) VALUES (?, ?, 'delivery', datetime('now', ?))")
      .run(app.id, app.name, nextDelay());
    if (changes) added.push(app.name);
  }
  const items = listMenu().filter((m) => m.available).length;
  if (added.length) log("Orders", `Connected to ${added.join(" and ")}. Menu of ${items} items published.`);
  return { added, items };
}

export function disconnectDeliveryApps() {
  const names = connectedDeliveryApps().map((c) => c.name);
  db().prepare("DELETE FROM connections WHERE kind = 'delivery'").run();
  if (names.length) log("Orders", `Disconnected from ${names.join(" and ")}.`);
  return names;
}

// An order from one of the delivery apps, using only what's on the menu right now.
export function deliveryOrder(app: { id: string; name: string }): Order | undefined {
  const menu = listMenu().filter((m) => m.available);
  if (!menu.length) return undefined;
  const picks = [...menu].sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 3));
  const order = createOrder({
    channel: "delivery",
    source: app.name,
    label: pick(CUSTOMERS),
    status: "new",
    lines: picks.map((m) => ({ menu_item_id: m.id, qty: 1 + Math.floor(Math.random() * 2) })),
  });
  // The app has already charged the customer and pays the café out later.
  markPaid(order, "platform");
  log("Orders", `New ${app.name} order ${order.number} from ${order.label} — ${money(order.total_cents)}, paid in the app.`);
  return order;
}

// Called on every state poll: any connected app whose next order is due sends one.
export function deliveryTick() {
  const due = db()
    .prepare("SELECT * FROM connections WHERE kind = 'delivery' AND next_order_at <= datetime('now')")
    .all() as unknown as Connection[];
  for (const app of due) {
    db().prepare("UPDATE connections SET next_order_at = datetime('now', ?) WHERE id = ?").run(nextDelay(), app.id);
    deliveryOrder(app);
  }
}

// Appended to sold-out replies so the owner hears that the delivery apps were updated too.
export function deliveryNote() {
  const apps = connectedDeliveryApps().map((c) => c.name);
  return apps.length ? ` Also updated on ${apps.join(" and ")}.` : "";
}
