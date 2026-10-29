import Stripe from "stripe";
import { getOrder, log, markPaid, setStripeSession, type Order, type PaymentMethod } from "./store";

export const CURRENCY = (process.env.NEXT_PUBLIC_CURRENCY ?? "usd").toLowerCase();

let stripe: Stripe | undefined;
export function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  // The .env.example placeholder ("sk_test_...") counts as unset.
  if (!key || key.endsWith("...")) return null;
  stripe ??= new Stripe(key);
  return stripe;
}

// One Checkout Session per order: the online order page redirects to it, the counter shows it as a QR code.
export async function startCheckout(order: Order, origin: string, method: PaymentMethod) {
  const s = stripeClient();
  if (!s) throw new Error("Stripe is not configured (set STRIPE_SECRET_KEY in .env.local)");
  const session = await s.checkout.sessions.create({
    mode: "payment",
    line_items: order.items.map((i) => ({
      quantity: i.qty,
      price_data: { currency: CURRENCY, unit_amount: i.unit_cents, product_data: { name: i.name } },
    })),
    metadata: { order_id: String(order.id), method },
    success_url: `${origin}/order/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/order?cancelled=1`,
  });
  setStripeSession(order, session.id, session.url);
  return session;
}

// Polled by the console and the success page, so no webhook endpoint is needed for the demo.
export async function syncCheckout(sessionId: string): Promise<Order | undefined> {
  const s = stripeClient();
  if (!s) return undefined;
  const session = await s.checkout.sessions.retrieve(sessionId);
  const order = getOrder(Number(session.metadata?.order_id));
  if (!order) return undefined;
  if (session.payment_status === "paid" && order.payment_status !== "paid") {
    const method = (session.metadata?.method as PaymentMethod) ?? "online";
    markPaid(order, method);
    log("Payments", `Order ${order.number} paid by ${method === "card" ? "card at the counter" : "Stripe online"}.`);
  }
  return getOrder(order.id);
}

export async function refund(order: Order) {
  const s = stripeClient();
  if (order.stripe_session_id && s) {
    const session = await s.checkout.sessions.retrieve(order.stripe_session_id);
    if (typeof session.payment_intent === "string") {
      await s.refunds.create({ payment_intent: session.payment_intent });
    }
  }
}
