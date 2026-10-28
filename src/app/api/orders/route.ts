import { createOrder, getOrder, listMenu, log, markPaid } from "@/lib/store";
import { money } from "@/lib/format";

const NAMES = ["Maya", "Leo", "Priya", "Sam", "Aiko", "Omar", "Lena", "Tom"];

// Demo helper: drops a paid online order into the queue as if a customer just checked out.
export async function POST() {
  const menu = listMenu().filter((m) => m.available);
  const picks = [...menu].sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 3));
  const order = createOrder({
    channel: "online",
    label: NAMES[Math.floor(Math.random() * NAMES.length)],
    status: "new",
    lines: picks.map((m) => ({ menu_item_id: m.id, qty: 1 + Math.floor(Math.random() * 2) })),
  });
  markPaid(order, "online");
  log("Orders", `New online order ${order.number} from ${order.label} — ${money(order.total_cents)}, paid.`);
  return Response.json(getOrder(order.id));
}
