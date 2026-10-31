import type { NextRequest } from "next/server";
import { createOrder, getOrder, listMenu, log, markPaid } from "@/lib/store";
import { sourceOf, type Channel } from "@/lib/channels";
import { money } from "@/lib/format";
import { DELIVERY_APPS, deliveryOrder } from "@/lib/delivery";

const NAMES = ["Maya", "Leo", "Priya", "Sam", "Aiko", "Omar", "Lena", "Tom"];
const SIMULATED: Channel[] = ["online", "whatsapp", "delivery"];
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

// Demo helper: drops an order into the queue as if a customer just ordered on the website,
// over WhatsApp or through a delivery app.
export async function POST(req: NextRequest) {
  const { channel = "online" } = (await req.json().catch(() => ({}))) as { channel?: Channel };
  if (!SIMULATED.includes(channel)) return Response.json({ error: "Unknown channel" }, { status: 400 });
  if (channel === "delivery") {
    const order = deliveryOrder(pick(DELIVERY_APPS));
    return Response.json(order ?? { error: "Nothing on the menu to order" }, { status: order ? 200 : 400 });
  }
  const menu = listMenu().filter((m) => m.available);
  if (!menu.length) return Response.json({ error: "Nothing on the menu to order" }, { status: 400 });
  const picks = [...menu].sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 3));
  const order = createOrder({
    channel,
    label: pick(NAMES),
    status: "new",
    lines: picks.map((m) => ({ menu_item_id: m.id, qty: 1 + Math.floor(Math.random() * 2) })),
  });
  // Website orders are paid with Stripe, WhatsApp orders pay at pickup.
  if (channel === "online") markPaid(order, "online");
  const paid = channel === "whatsapp" ? "pay at pickup" : "paid";
  log("Orders", `New ${sourceOf(order)} order ${order.number} from ${order.label} — ${money(order.total_cents)}, ${paid}.`);
  return Response.json(getOrder(order.id));
}
