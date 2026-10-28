import type { NextRequest } from "next/server";
import { startCheckout, stripeClient } from "@/lib/payments";
import { createOrder, log } from "@/lib/store";
import { money } from "@/lib/format";

// The public order page: Stripe Checkout when configured, otherwise pay at pickup.
export async function POST(req: NextRequest) {
  const { name, lines } = (await req.json()) as { name: string; lines: { menu_item_id: number; qty: number }[] };
  try {
    const order = createOrder({ channel: "online", label: name?.trim() || "Online", status: "new", lines });
    if (!stripeClient()) {
      log("Orders", `New online order ${order.number} from ${order.label} — ${money(order.total_cents)}, pay at pickup.`);
      return Response.json({ order_number: order.number });
    }
    const session = await startCheckout(order, req.nextUrl.origin, "online");
    log("Orders", `Online order ${order.number} from ${order.label} waiting for Stripe payment.`);
    return Response.json({ url: session.url });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
