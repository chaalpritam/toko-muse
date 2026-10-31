import type { NextRequest } from "next/server";
import { syncCheckout } from "@/lib/payments";
import { getShop } from "@/lib/shop";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("session_id");
  if (!id) return Response.json({ error: "session_id required" }, { status: 400 });
  const order = await syncCheckout(id);
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  return Response.json({ shop: getShop().name, number: order.number, payment_status: order.payment_status, total_cents: order.total_cents });
}
