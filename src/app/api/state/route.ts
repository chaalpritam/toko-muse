import { syncCheckout, stripeClient } from "@/lib/payments";
import { daySummary, listActivity, listApprovals, listMenu, listStock, listTodayExpenses, listTodayOrders } from "@/lib/store";

export async function GET() {
  // Card/online payments are confirmed by polling Stripe for any order still pending.
  const pending = listTodayOrders().filter((o) => o.payment_status === "pending" && o.stripe_session_id);
  await Promise.allSettled(pending.map((o) => syncCheckout(o.stripe_session_id!)));
  return Response.json({
    orders: listTodayOrders(),
    approvals: listApprovals(),
    activity: listActivity(),
    summary: daySummary(),
    menu: listMenu(),
    stock: listStock(),
    expenses: listTodayExpenses(),
    stripe: Boolean(stripeClient()),
  });
}
