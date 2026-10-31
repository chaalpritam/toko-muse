"use client";

import { useState } from "react";
import { OwnerShell } from "@/components/OwnerShell";
import { api, fileToDataUrl, shrinkImage, speak, useCafeState } from "@/lib/client/state";
import { money, timeOf } from "@/lib/format";
import { CHANNELS, CHANNEL_LABEL, sourceOf } from "@/lib/channels";

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
          <h2 className="mb-3 font-semibold">Today’s takings</h2>
          {s && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tile label="Total" value={money(s.revenue_cents)} strong />
              <Tile label="Card (Stripe)" value={money(s.by_method_cents.card)} />
              <Tile label="Online (Stripe)" value={money(s.by_method_cents.online)} />
              <Tile label="Cash" value={money(s.by_method_cents.cash)} />
              <Tile label="Delivery apps" value={money(s.by_method_cents.platform)} />
              <Tile label="Expenses" value={money(s.expenses_cents)} />
              <Tile label="Net" value={money(s.revenue_cents - s.expenses_cents)} strong />
              <Tile label="Orders" value={`${s.orders}`} />
            </div>
          )}
          {s && s.orders > 0 && (
            <p className="mt-3 text-sm text-muted">
              {CHANNELS.filter((c) => s.by_channel[c] > 0)
                .map((c) => `${s.by_channel[c]} ${CHANNEL_LABEL[c]}`)
                .join(" · ")}
            </p>
          )}
          {s && s.unpaid.length > 0 && (
            <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
              Unpaid: {s.unpaid.map((u) => `#${u.number} (${money(u.total_cents)})`).join(", ")}
            </p>
          )}
          <h3 className="mb-2 mt-5 text-sm font-medium text-muted">Payments</h3>
          <ul className="divide-y divide-line text-sm">
            {paid.map((o) => (
              <li key={o.id} className="flex gap-3 py-2">
                <span className="w-12 tabular-nums text-muted">{o.paid_at ? timeOf(o.paid_at) : ""}</span>
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
              {receiptBusy ? "Reading…" : "📷 Add photo"}
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

function Tile({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg border border-line p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={`tabular-nums ${strong ? "text-xl font-semibold" : "text-lg"}`}>{value}</div>
    </div>
  );
}
