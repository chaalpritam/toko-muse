"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { OwnerShell } from "@/components/OwnerShell";
import { AgentTag } from "@/components/AgentTag";
import { api, speak, useCafeState, useCallOuts } from "@/lib/client/state";
import { usePushToTalk, type Turn } from "@/lib/client/push-to-talk";
import { money, timeOf } from "@/lib/format";
import type { Approval, Order } from "@/lib/store";

export default function Counter() {
  const { state, refresh } = useCafeState();
  const [muted, setMuted] = useState(false);
  useCallOuts(state, muted);

  const qrOrder = state?.orders.find((o) => o.channel === "counter" && o.payment_status === "pending" && o.stripe_url);

  return (
    <OwnerShell state={state}>
      <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
        <section className="min-w-0">
          <div className="mb-3 flex items-center gap-2">
            <h1 className="text-xl font-semibold">Orders</h1>
            <span className="text-sm text-muted">online and counter, one queue</span>
            <div className="ml-auto flex gap-2">
              <button className="btn" onClick={() => setMuted((m) => !m)}>
                {muted ? "🔇 Call-outs off" : "🔊 Call-outs on"}
              </button>
              <button className="btn" onClick={() => api("/api/orders").then(refresh)}>
                + Simulate online order
              </button>
            </div>
          </div>
          {state ? <Board orders={state.orders} stripe={state.stripe} refresh={refresh} /> : <p className="text-muted">Loading…</p>}
        </section>
        <aside className="flex flex-col gap-5">
          <Crew refresh={refresh} muted={muted} />
          <Approvals approvals={state?.approvals ?? []} refresh={refresh} />
          <section className="card p-4">
            <h2 className="mb-2 font-semibold">Crew activity</h2>
            <ul className="flex max-h-[360px] flex-col gap-2 overflow-y-auto text-sm">
              {state?.activity.map((a) => (
                <li key={a.id} className="flex gap-2">
                  <span className="w-11 shrink-0 tabular-nums text-xs leading-5 text-muted">{timeOf(a.created_at)}</span>
                  <AgentTag agent={a.agent} />
                  <span className="min-w-0">{a.text}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
      {qrOrder && <CardQr order={qrOrder} />}
    </OwnerShell>
  );
}

const COLUMNS: { title: string; match: (o: Order) => boolean }[] = [
  { title: "New", match: (o) => o.status === "new" },
  { title: "Making", match: (o) => o.status === "accepted" },
  { title: "Ready", match: (o) => o.status === "ready" },
  { title: "Done", match: (o) => o.status === "done" || o.status === "cancelled" },
];

function Board({ orders, stripe, refresh }: { orders: Order[]; stripe: boolean; refresh: () => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((c) => {
        const list = orders.filter(c.match);
        return (
          <div key={c.title} className="flex flex-col gap-2">
            <div className="flex items-center gap-2 px-1 text-sm font-medium text-muted">
              {c.title}
              <span className="pill bg-line text-foreground">{list.length}</span>
            </div>
            {list.slice(0, c.title === "Done" ? 8 : 50).map((o) => (
              <OrderCard key={o.id} order={o} stripe={stripe} refresh={refresh} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function OrderCard({ order: o, stripe, refresh }: { order: Order; stripe: boolean; refresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const act = async (body: object) => {
    setBusy(true);
    try {
      await api(`/api/orders/${o.number}`, body, "PATCH");
      refresh();
    } catch (err) {
      alertInline((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const next: Record<string, [string, string]> = {
    new: ["accepted", "Accept"],
    accepted: ["ready", "Ready"],
    ready: ["done", "Handed over"],
  };
  const done = o.status === "done" || o.status === "cancelled";
  return (
    <article className={`card p-3 ${done ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold tabular-nums">#{o.number}</span>
        <span className={`pill ${o.channel === "online" ? "bg-accent-soft text-accent" : "bg-line"}`}>
          {o.channel === "online" ? "Online" : "Counter"}
        </span>
        {o.label && <span className="truncate text-sm text-muted">{o.label}</span>}
        <span className="ml-auto text-xs text-muted">{timeOf(o.created_at)}</span>
      </div>
      <ul className="my-2 text-sm">
        {o.items.map((i) => (
          <li key={i.id}>
            <span className="font-medium tabular-nums">{i.qty}×</span> {i.name}
            {i.notes && <span className="text-muted"> — {i.notes}</span>}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-auto text-sm font-semibold tabular-nums">{money(o.total_cents)}</span>
        <PayBadge order={o} />
      </div>
      {!done && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {next[o.status] && (
            <button className="btn btn-primary" disabled={busy} onClick={() => act({ status: next[o.status][0] })}>
              {next[o.status][1]}
            </button>
          )}
          {o.payment_status === "unpaid" && (
            <>
              <button className="btn" disabled={busy} onClick={() => act({ pay: "cash" })}>
                Cash
              </button>
              {stripe && (
                <button className="btn" disabled={busy} onClick={() => act({ pay: "card" })}>
                  Card
                </button>
              )}
            </>
          )}
        </div>
      )}
    </article>
  );
}

function PayBadge({ order: o }: { order: Order }) {
  if (o.payment_status === "paid")
    return <span className="pill bg-ok-soft text-ok">Paid · {o.payment_method}</span>;
  if (o.payment_status === "pending") return <span className="pill bg-warn-soft text-warn">Awaiting payment</span>;
  if (o.payment_status === "refunded") return <span className="pill bg-line">Refunded</span>;
  return <span className="pill bg-warn-soft text-warn">Unpaid</span>;
}

function alertInline(message: string) {
  // Avoid blocking dialogs at a busy counter; surface errors in the console and the activity feed.
  console.error(message);
}

function Crew({ refresh, muted }: { refresh: () => void; muted: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const finish = (turn: Turn) => {
    setTurns((t) => [turn, ...t].slice(0, 10));
    if (turn.reply && !muted) speak(turn.reply);
    refresh();
  };
  const { devices, deviceId, setDeviceId, loadDevices, phase, start: startTalking, stop: stopTalking, sendText: send } =
    usePushToTalk(finish);
  const sendText = () => {
    if (phase !== "idle") return;
    setText("");
    void send(text);
  };

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-semibold">Talk to your crew</h2>
        <select
          className="ml-auto max-w-[180px] truncate rounded-md border border-line bg-surface px-2 py-1 text-xs"
          value={deviceId}
          onChange={(e) => setDeviceId(e.target.value)}
          onFocus={() => void loadDevices()}
        >
          <option value="">Default mic</option>
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || "Microphone"}
            </option>
          ))}
        </select>
      </div>
      <button
        className={`flex w-full select-none flex-col items-center justify-center rounded-xl border-2 py-5 transition ${
          phase === "listening"
            ? "border-accent bg-accent text-white"
            : phase === "thinking"
              ? "border-line bg-line text-muted"
              : "border-dashed border-accent/50 bg-accent-soft text-accent hover:border-accent"
        }`}
        onPointerDown={() => void startTalking()}
        onPointerUp={() => void stopTalking()}
        onPointerLeave={() => void stopTalking()}
      >
        <span className="text-base font-semibold">
          {phase === "listening" ? "Listening… release to send" : phase === "thinking" ? "Crew is on it…" : "Hold to talk"}
        </span>
        <span className="text-xs opacity-80">or hold Space</span>
      </button>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void sendText();
        }}
      >
        <input
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm"
          placeholder={`Try "two oat lattes for table 4, paid cash"`}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn" disabled={phase !== "idle"}>
          Send
        </button>
      </form>
      <ul className="mt-3 flex max-h-[300px] flex-col gap-3 overflow-y-auto">
        {turns.map((t, i) => (
          <li key={i} className="text-sm">
            <p className="text-muted">“{t.you}”</p>
            {t.actions?.map((a, j) => (
              <p key={j} className="mt-1 flex gap-2">
                <AgentTag agent={a.agent} />
                <span className="min-w-0 text-xs leading-5">{a.result.length > 160 ? `${a.tool} ✓` : a.result}</span>
              </p>
            ))}
            {t.reply && <p className="mt-1 font-medium">{t.reply}</p>}
            {t.error && <p className="mt-1 text-accent">{t.error}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Approvals({ approvals, refresh }: { approvals: Approval[]; refresh: () => void }) {
  const [busy, setBusy] = useState<number | null>(null);
  const decide = async (id: number, approve: boolean) => {
    setBusy(id);
    try {
      await api(`/api/approvals/${id}`, { approve });
    } catch (err) {
      alertInline((err as Error).message);
    }
    setBusy(null);
    refresh();
  };
  return (
    <section className="card p-4">
      <h2 className="mb-2 font-semibold">
        Needs your OK {approvals.length > 0 && <span className="pill bg-warn-soft text-warn">{approvals.length}</span>}
      </h2>
      {approvals.length === 0 && <p className="text-sm text-muted">Nothing waiting. Money and messages always stop here first.</p>}
      <ul className="flex flex-col gap-3">
        {approvals.map((a) => (
          <li key={a.id} className="rounded-lg border border-line p-3">
            <div className="flex items-center gap-2">
              <AgentTag agent={a.agent} />
              <span className="text-sm font-medium">{a.title}</span>
            </div>
            <p className="mt-1 text-xs text-muted">{a.detail}</p>
            <div className="mt-2 flex gap-2">
              <button className="btn btn-primary" disabled={busy === a.id} onClick={() => decide(a.id, true)}>
                Approve
              </button>
              <button className="btn" disabled={busy === a.id} onClick={() => decide(a.id, false)}>
                Decline
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CardQr({ order }: { order: Order }) {
  const [src, setSrc] = useState("");
  const [hidden, setHidden] = useState<number | null>(null);
  useEffect(() => {
    void QRCode.toDataURL(order.stripe_url!, { margin: 1, width: 320 }).then(setSrc);
  }, [order.stripe_url]);
  if (hidden === order.id) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card flex w-full max-w-sm flex-col items-center gap-3 p-6 text-center">
        <p className="text-sm text-muted">Order #{order.number} · scan to pay by card</p>
        <p className="text-3xl font-semibold tabular-nums">{money(order.total_cents)}</p>
        {src && <img src={src} alt="Stripe payment QR code" className="h-64 w-64 rounded-lg bg-white p-2" />}
        <p className="text-xs text-muted">Powered by Stripe · this closes by itself once paid</p>
        <div className="flex gap-2">
          <a className="btn" href={order.stripe_url!} target="_blank" rel="noreferrer">
            Open checkout
          </a>
          <button className="btn" onClick={() => setHidden(order.id)}>
            Hide
          </button>
        </div>
      </div>
    </div>
  );
}
