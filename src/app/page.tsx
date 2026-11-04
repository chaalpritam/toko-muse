"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { OwnerShell } from "@/components/OwnerShell";
import { AgentTag } from "@/components/AgentTag";
import { ChannelTag } from "@/components/ChannelTag";
import { Icon } from "@/components/Icon";
import { CHANNEL_LABEL } from "@/lib/channels";
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
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="flex items-baseline gap-2">
              <h1 className="text-xl font-semibold">Orders</h1>
              <span className="text-sm text-muted">every channel, one queue</span>
            </div>
            <button
              className={`btn ml-auto ${muted ? "" : "text-accent"}`}
              aria-pressed={!muted}
              onClick={() => setMuted((m) => !m)}
            >
              <Icon name={muted ? "volumeOff" : "volume"} size={15} />
              {muted ? "Call-outs off" : "Call-outs on"}
            </button>
            <div className="flex w-full flex-wrap items-center gap-1 rounded-xl border border-dashed border-line px-2 py-1 xl:w-auto">
              <span className="px-1 text-xs text-muted">Demo</span>
              {(["online", "whatsapp", "delivery"] as const).map((c) => (
                <button key={c} className="btn btn-quiet" onClick={() => api("/api/orders", { channel: c }).then(refresh)}>
                  <Icon name="plus" size={13} />
                  {CHANNEL_LABEL[c]}
                </button>
              ))}
              <a className="btn btn-quiet" href="/whatsapp" target="_blank">
                Customer’s phone <Icon name="external" size={13} />
              </a>
            </div>
          </div>
          {state ? <Board orders={state.orders} stripe={state.stripe} refresh={refresh} /> : <BoardSkeleton />}
        </section>
        <aside className="flex flex-col gap-5">
          <Crew refresh={refresh} muted={muted} />
          <Approvals approvals={state?.approvals ?? []} refresh={refresh} />
          <section className="card p-4">
            <h2 className="mb-3 font-semibold">Crew activity</h2>
            {state && state.activity.length === 0 && (
              <p className="text-sm text-muted">What the crew does shows up here as it happens.</p>
            )}
            <ul className="flex max-h-[360px] flex-col gap-2.5 overflow-y-auto text-sm">
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

const COLUMNS: { title: string; empty: string; match: (o: Order) => boolean }[] = [
  { title: "New", empty: "New orders from every channel land here.", match: (o) => o.status === "new" },
  { title: "Making", empty: "Accepted orders wait here while you make them.", match: (o) => o.status === "accepted" },
  { title: "Ready", empty: "Nothing waiting to be picked up.", match: (o) => o.status === "ready" },
  { title: "Done", empty: "Handed-over orders end up here.", match: (o) => o.status === "done" || o.status === "cancelled" },
];

function BoardSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-busy>
      {COLUMNS.map((c) => (
        <div key={c.title} className="h-48 animate-pulse rounded-xl bg-sunken" />
      ))}
    </div>
  );
}

function Board({ orders, stripe, refresh }: { orders: Order[]; stripe: boolean; refresh: () => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((c) => {
        const list = orders.filter(c.match);
        return (
          <div key={c.title} className="flex min-h-40 flex-col gap-2 rounded-xl bg-sunken p-2">
            <h2 className="flex items-center gap-2 px-1.5 pt-0.5 text-sm font-medium">
              {c.title}
              <span className={`pill tabular-nums ${list.length && c.title === "New" ? "bg-accent text-white" : "bg-line text-muted"}`}>
                {list.length}
              </span>
            </h2>
            {list.length === 0 && <p className="px-1.5 py-2 text-xs leading-relaxed text-muted">{c.empty}</p>}
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
  const [error, setError] = useState("");
  const act = async (body: object) => {
    setBusy(true);
    setError("");
    try {
      await api(`/api/orders/${o.number}`, body, "PATCH");
      refresh();
    } catch (err) {
      setError((err as Error).message);
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
    <article className={`card p-3 shadow-[0_1px_2px_rgb(0_0_0/0.06)] ${done ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-2">
        <span className={`text-lg font-semibold tabular-nums ${o.status === "cancelled" ? "line-through" : ""}`}>#{o.number}</span>
        <ChannelTag order={o} />
        {o.label && <span className="truncate text-sm text-muted">{o.label}</span>}
        <span className="ml-auto shrink-0 text-xs tabular-nums text-muted">{timeOf(o.created_at)}</span>
      </div>
      <ul className="my-2 space-y-0.5 text-sm">
        {o.items.map((i) => (
          <li key={i.id}>
            <span className="font-medium tabular-nums">{i.qty}×</span> {i.name}
            {i.notes && <span className="text-muted"> — {i.notes}</span>}
          </li>
        ))}
      </ul>
      {o.ready_at && !done && <p className="mb-1 text-xs font-medium text-accent">Ready by {timeOf(o.ready_at)}</p>}
      {o.note && <p className="mb-1 text-xs text-muted">{o.note}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-auto text-sm font-semibold tabular-nums">{money(o.total_cents)}</span>
        <PayBadge order={o} />
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}
      {!done && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-line pt-2.5">
          {next[o.status] && (
            <button className="btn btn-primary" disabled={busy} onClick={() => act({ status: next[o.status][0] })}>
              {next[o.status][1]}
            </button>
          )}
          {o.status === "new" && (
            <button className="btn" disabled={busy} onClick={() => act({ status: "cancelled" })}>
              Reject
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

const METHOD_LABEL: Record<string, string> = { cash: "cash", card: "card", online: "online", platform: "in app" };

function PayBadge({ order: o }: { order: Order }) {
  if (o.status === "cancelled" && o.payment_status !== "paid") return <span className="pill bg-line">Cancelled</span>;
  if (o.payment_status === "paid")
    return <span className="pill bg-ok-soft text-ok">Paid · {METHOD_LABEL[o.payment_method ?? ""] ?? o.payment_method}</span>;
  if (o.payment_status === "pending") return <span className="pill bg-warn-soft text-warn">Awaiting payment</span>;
  if (o.payment_status === "refunded") return <span className="pill bg-line">Refunded</span>;
  return <span className="pill bg-warn-soft text-warn">Unpaid</span>;
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
          aria-label="Microphone"
          className="field ml-auto w-auto max-w-[180px] truncate py-1 pl-2 text-xs"
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
        className={`flex w-full touch-none select-none items-center justify-center gap-3 rounded-xl py-5 transition ${
          phase === "listening"
            ? "scale-[0.99] bg-accent text-white shadow-[0_0_0_6px_color-mix(in_oklab,var(--accent)_25%,transparent)]"
            : phase === "thinking"
              ? "bg-line text-muted"
              : "bg-accent-soft text-accent hover:bg-[color-mix(in_oklab,var(--accent)_22%,var(--accent-soft))]"
        }`}
        onPointerDown={() => void startTalking()}
        onPointerUp={() => void stopTalking()}
        onPointerLeave={() => void stopTalking()}
      >
        <span className={`flex h-10 w-10 items-center justify-center rounded-full ${phase === "listening" ? "bg-white/20" : "bg-accent text-white"}`}>
          <Icon name="mic" size={18} className={phase === "listening" ? "animate-pulse" : ""} />
        </span>
        <span className="flex flex-col items-start leading-tight">
          <span className="text-base font-semibold">
            {phase === "listening" ? "Listening… release to send" : phase === "thinking" ? "Crew is on it…" : "Hold to talk"}
          </span>
          <span className="text-xs opacity-80">
            or hold <kbd className="rounded border border-current/30 px-1 font-sans">Space</kbd>
          </span>
        </span>
      </button>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void sendText();
        }}
      >
        <input
          aria-label="Type to your crew"
          className="field flex-1"
          placeholder={`Try "two oat lattes for table 4, paid cash"`}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn" disabled={phase !== "idle" || !text.trim()} aria-label="Send">
          <Icon name="send" size={15} />
        </button>
      </form>
      <ul className="mt-3 flex max-h-[300px] flex-col gap-3 overflow-y-auto">
        {turns.map((t, i) => (
          <li key={i} className="border-t border-line pt-3 text-sm first:border-0 first:pt-0">
            <p className="text-muted">“{t.you}”</p>
            {t.actions?.map((a, j) => (
              <p key={j} className="mt-1 flex gap-2">
                <AgentTag agent={a.agent} />
                <span className="min-w-0 text-xs leading-5">{a.result.length > 160 ? `${a.tool} ✓` : a.result}</span>
              </p>
            ))}
            {t.reply && <p className="mt-1 font-medium">{t.reply}</p>}
            {t.error && <p className="mt-1 text-danger">{t.error}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Approvals({ approvals, refresh }: { approvals: Approval[]; refresh: () => void }) {
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<{ id: number; message: string } | null>(null);
  const decide = async (id: number, approve: boolean) => {
    setBusy(id);
    setError(null);
    try {
      await api(`/api/approvals/${id}`, { approve });
    } catch (err) {
      setError({ id, message: (err as Error).message });
    }
    setBusy(null);
    refresh();
  };
  return (
    <section className="card p-4">
      <h2 className="mb-2 flex items-center gap-2 font-semibold">
        Needs your OK {approvals.length > 0 && <span className="pill bg-warn-soft tabular-nums text-warn">{approvals.length}</span>}
      </h2>
      {approvals.length === 0 && <p className="text-sm text-muted">Nothing waiting. Money and messages always stop here first.</p>}
      <ul className="flex flex-col gap-3">
        {approvals.map((a) => (
          <li key={a.id} className="rounded-lg border border-warn/30 bg-warn-soft/40 p-3">
            <div className="flex items-start gap-2">
              <AgentTag agent={a.agent} />
              <span className="text-sm font-medium leading-5">{a.title}</span>
            </div>
            <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-muted">{a.detail}</p>
            {error?.id === a.id && (
              <p role="alert" className="mt-2 text-xs text-danger">
                {error.message}
              </p>
            )}
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
