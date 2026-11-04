"use client";

import { useState } from "react";
import { OwnerShell } from "@/components/OwnerShell";
import { api, fileToDataUrl, shrinkImage, speak, useCafeState } from "@/lib/client/state";
import { money, timeOf } from "@/lib/format";
import { CHANNELS, CHANNEL_LABEL, sourceOf } from "@/lib/channels";
import { Icon } from "@/components/Icon";

export default function MoneyPage() {
  const { state, refresh } = useCafeState();
  const s = state?.summary;
  const [briefing, setBriefing] = useState("");
  const [closing, setClosing] = useState(false);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [receiptMsg, setReceiptMsg] = useState("");

  const close = async () => {
    setClosing(true);
    try {
      const data = await api<{ briefing: string }>("/api/close");
      setBriefing(data.briefing);
      speak(data.briefing);
      refresh();
    } catch (e) {
      setBriefing((e as Error).message);
    } finally {
      setClosing(false);
    }
  };

  const upload = async (file: File) => {
    setReceiptBusy(true);
    setReceiptMsg("");
    try {
      const image = await shrinkImage(await fileToDataUrl(file), 1600);
      const data = await api<{ receipt: { vendor: string; total: number }; restocked: string[] }>("/api/expenses", { image });
      setReceiptMsg(
        `Logged ${data.receipt.vendor}, ${data.receipt.total}.${data.restocked.length ? ` Restocked ${data.restocked.join(", ")}.` : ""}`,
      );
      refresh();
    } catch (e) {
      setReceiptMsg((e as Error).message);
    } finally {
      setReceiptBusy(false);
    }
  };

  const paid = state?.orders.filter((o) => o.payment_status === "paid") ?? [];
  return (
    <OwnerShell state={state}>
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card p-4 lg:col-span-2">
          <h2 className="mb-4 font-semibold">Today’s takings</h2>
          {s && (
            <>
              <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                <Figure label="Taken" value={money(s.revenue_cents)} />
                <span className="pb-6 text-lg text-muted" aria-hidden>
                  −
                </span>
                <Figure label="Expenses" value={money(s.expenses_cents)} />
                <span className="pb-6 text-lg text-muted" aria-hidden>
                  =
                </span>
                <Figure
                  label="Net"
                  value={money(s.revenue_cents - s.expenses_cents)}
                  tone={s.revenue_cents - s.expenses_cents < 0 ? "text-danger" : "text-ok"}
                />
              </div>
              <p className="mt-2 text-sm text-muted">
                {s.orders === 0
                  ? "No orders yet today."
                  : `${s.orders} order${s.orders === 1 ? "" : "s"}: ${CHANNELS.filter((c) => s.by_channel[c] > 0)
                      .map((c) => `${s.by_channel[c]} ${CHANNEL_LABEL[c]}`)
                      .join(" · ")}`}
              </p>
              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 text-sm sm:grid-cols-4">
                <Method label="Card at the counter" value={s.by_method_cents.card} note="Stripe" />
                <Method label="Online" value={s.by_method_cents.online} note="Stripe" />
                <Method label="Cash" value={s.by_method_cents.cash} />
                <Method label="Delivery apps" value={s.by_method_cents.platform} note="paid in app" />
              </dl>
            </>
          )}
          {s && s.unpaid.length > 0 && (
            <p className="mt-4 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
              Unpaid: {s.unpaid.map((u) => `#${u.number} (${money(u.total_cents)})`).join(", ")}
            </p>
          )}
          <h3 className="mb-1 mt-6 text-sm font-medium">Payments</h3>
          <ul className="divide-y divide-line text-sm">
            {paid.map((o) => (
              <li key={o.id} className="flex gap-3 py-2">
                <span className="w-12 shrink-0 tabular-nums text-muted">{o.paid_at ? timeOf(o.paid_at) : ""}</span>
                <span className="flex-1">
                  #{o.number} {o.label && <span className="text-muted">{o.label}</span>}
                </span>
                <span className="capitalize text-muted">{o.payment_method === "platform" ? sourceOf(o) : o.payment_method}</span>
                <span className="w-20 text-right tabular-nums">{money(o.total_cents)}</span>
              </li>
            ))}
            {paid.length === 0 && <li className="py-2 text-muted">No payments yet today.</li>}
          </ul>
        </section>
        <div className="flex flex-col gap-5">
          <section className="card p-4">
            <h2 className="mb-1 font-semibold">Close the day</h2>
            <p className="mb-3 text-sm text-muted">The Books agent reads today’s numbers and briefs you, out loud.</p>
            <button className="btn btn-primary" disabled={closing} onClick={close}>
              {closing ? "Adding it up…" : "Close the day"}
            </button>
            {briefing && <p className="mt-3 text-sm leading-relaxed">{briefing}</p>}
          </section>
          <section className="card p-4">
            <h2 className="mb-1 font-semibold">Receipts & invoices</h2>
            <p className="mb-3 text-sm text-muted">
              Snap a supplier invoice or receipt. Muse Spark reads it, logs the expense and restocks delivered ingredients.
            </p>
            <label className={`btn ${receiptBusy ? "opacity-50" : "cursor-pointer"}`}>
              <Icon name="camera" size={15} />
              {receiptBusy ? "Reading…" : "Add photo"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={receiptBusy}
                onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
              />
            </label>
            {receiptMsg && <p className="mt-2 text-sm">{receiptMsg}</p>}
            {state && state.expenses.length === 0 && <p className="mt-3 text-sm text-muted">No expenses logged today.</p>}
            <ul className="mt-3 divide-y divide-line text-sm">
              {state?.expenses.map((e) => (
                <li key={e.id} className="flex gap-2 py-2">
                  <span className="flex-1">{e.vendor}</span>
                  <span className="text-muted">{e.category}</span>
                  <span className="tabular-nums">{money(e.total_cents)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </OwnerShell>
  );
}

function Figure({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className={`text-3xl font-semibold tracking-tight tabular-nums ${tone}`}>{value}</div>
      <div className="mt-0.5 text-sm text-muted">{label}</div>
    </div>
  );
}

function Method({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div>
      <dt className="text-muted">
        {label}
        {note && <span className="text-xs"> · {note}</span>}
      </dt>
      <dd className={`mt-0.5 text-base font-medium tabular-nums ${value ? "" : "text-muted"}`}>{money(value)}</dd>
    </div>
  );
}
