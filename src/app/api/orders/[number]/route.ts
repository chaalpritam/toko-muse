import type { NextRequest } from "next/server";
import { startCheckout } from "@/lib/payments";
import { getOrderByNumber, log, markPaid, setStatus, type OrderStatus } from "@/lib/store";
import { money } from "@/lib/format";

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/orders/[number]">) {
  const { number } = await ctx.params;
  const order = getOrderByNumber(Number(number));
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  const body = (await req.json()) as { status?: OrderStatus; pay?: "cash" | "card" };
  try {
    if (body.status) {
      setStatus(order, body.status);
      log("Orders", `Order ${order.number} → ${body.status}.`);
    }
    if (body.pay === "cash") {
      markPaid(order, "cash");
      log("Payments", `Order ${order.number}: ${money(order.total_cents)} cash received.`);
    }
    if (body.pay === "card") {
      await startCheckout(order, req.nextUrl.origin, "card");
      log("Payments", `Order ${order.number}: card payment QR shown for ${money(order.total_cents)}.`);
    }
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
  return Response.json(getOrderByNumber(order.number));
}
