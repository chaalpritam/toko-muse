import { refund } from "./payments";
import { decideApproval, getApproval, getOrder, log, markRefunded } from "./store";

export async function decide(id: number, approve: boolean) {
  const a = getApproval(id);
  if (!a || a.status !== "pending") throw new Error("Approval not found or already decided");
  if (!approve) {
    decideApproval(id, "rejected");
    log(a.agent, `Owner declined: ${a.title}.`);
    return;
  }
  const payload = JSON.parse(a.payload);
  if (a.kind === "refund") {
    const order = getOrder(payload.order_id);
    if (!order) throw new Error("Order not found");
    await refund(order);
    markRefunded(order);
    log("Payments", `Order ${order.number} refunded.`);
  } else if (a.kind === "supplier_order") {
    // Sending is not wired to email/WhatsApp yet; the approved message is logged for the owner to forward.
    log("Suppliers", `Reorder approved → ${payload.to ?? "supplier"}: "${payload.message}"`);
  }
  decideApproval(id, "approved");
}
