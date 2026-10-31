"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { api, speak, useCafeState, useCallOuts, type CafeState } from "@/lib/client/state";
import { usePushToTalk, type Turn } from "@/lib/client/push-to-talk";
import { money } from "@/lib/format";
import { sourceOf } from "@/lib/channels";

// What the café's counter device shows: one orb you hold to talk to, and what it's doing.
// On a new device it walks the owner through setting up the shop; once live it runs the counter.
export default function Device() {
  const { state, refresh } = useCafeState(2000);
  const [awake, setAwake] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [text, setText] = useState("");

  const say = (line: string) => {
    setSpeaking(true);
    speak(line, () => setSpeaking(false));
  };
  const ptt = usePushToTalk((t) => {
    setTurn(t);
    if (t.reply) say(t.reply);
    refresh();
  });
  useCallOuts(state, !awake);

  const shop = state?.shop;
  const live = shop?.stage === "live";

  // Browsers only let a page speak after a tap, so the device wakes on the first touch.
  const wake = () => {
    if (awake || !shop) return;
    setAwake(true);
    const line = live
      ? `${shop.name} is open. Hold me and talk whenever you need the crew.`
      : (state?.lastSetupLine ?? "Hi, I'm Toko. Let's set up your café. What's it called?");
    setTurn({ you: "", reply: line });
    say(line);
  };

  const reset = async (mode: "blank" | "sample") => {
    window.speechSynthesis?.cancel();
    await api("/api/device/reset", { mode });
    setAwake(false);
    setTurn(null);
    refresh();
  };

  const orb = ptt.phase === "listening" ? "listening" : ptt.phase === "thinking" ? "thinking" : speaking ? "speaking" : "idle";
  const status = {
    listening: "Listening… let go when you're done",
    thinking: live ? "The crew is on it…" : "Setting that up…",
    speaking: "Speaking",
    idle: "Hold to talk · or hold Space",
  }[orb];

  return (
    <main className="fixed inset-0 flex flex-col overflow-y-auto bg-[#0f0c0a] text-[#f3ebe1]" onPointerDown={wake}>
      <header className="flex items-center gap-3 px-5 py-4">
        <span className="text-lg font-semibold tracking-tight">toko</span>
        {shop?.name && <span className="truncate text-sm text-[#b3a291]">{shop.name}</span>}
        <StageChip state={state} />
        <div className="ml-auto flex items-center gap-2">
          <select
            className="max-w-[160px] truncate rounded-md border border-[#3a2f26] bg-[#1a1511] px-2 py-1 text-xs text-[#b3a291]"
            value={ptt.deviceId}
            onChange={(e) => ptt.setDeviceId(e.target.value)}
            onFocus={() => void ptt.loadDevices()}
            aria-label="Microphone"
          >
            <option value="">Default mic</option>
            {ptt.devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || "Microphone"}
              </option>
            ))}
          </select>
          <Settings onReset={reset} />
        </div>
      </header>

      <div className="grid flex-1 items-center gap-8 px-5 pb-8 lg:grid-cols-[1fr_380px] lg:px-10">
        <section className="flex flex-col items-center gap-6 text-center">
          <button
            className="orb select-none"
            data-state={orb}
            aria-label="Hold to talk"
            onPointerDown={(e) => {
              if (!awake) return;
              e.stopPropagation();
              void ptt.start();
            }}
            onPointerUp={() => void ptt.stop()}
            onPointerLeave={() => void ptt.stop()}
          />
          <p className="text-sm text-[#b3a291]">{awake ? status : "Tap anywhere to wake Toko"}</p>
          <div className="min-h-[7rem] max-w-2xl">
            {turn?.you && <p className="mb-2 text-[#b3a291]">“{turn.you}”</p>}
            {turn?.reply && <p className="text-2xl font-medium leading-snug text-balance md:text-3xl">{turn.reply}</p>}
            {turn?.error && <p className="text-lg text-[#e0814f]">{turn.error}</p>}
            {turn?.actions && turn.actions.length > 0 && (
              <ul className="mt-3 flex flex-wrap justify-center gap-1.5">
                {turn.actions.map((a, i) => (
                  <li key={i} className="rounded-full bg-[#211a14] px-2.5 py-0.5 text-xs text-[#b3a291]">
                    {a.agent} · {a.tool.replaceAll("_", " ")}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <form
            className="flex w-full max-w-md gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (ptt.phase !== "idle") return;
              setText("");
              void ptt.sendText(text);
            }}
          >
            <input
              className="min-w-0 flex-1 rounded-lg border border-[#3a2f26] bg-[#1a1511] px-3 py-2 text-sm placeholder:text-[#7a6a5c]"
              placeholder="Or type to Toko"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button className="rounded-lg border border-[#3a2f26] px-3 text-sm text-[#b3a291]" disabled={!awake}>
              Send
            </button>
          </form>
        </section>

        <aside className="w-full">{state && (live ? <LivePanel state={state} /> : <SetupPanel state={state} />)}</aside>
      </div>
    </main>
  );
}

function StageChip({ state }: { state: CafeState | null }) {
  if (!state) return null;
  const label = { new: "New device", setup: "Setting up", live: "Live" }[state.shop.stage];
  const live = state.shop.stage === "live";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${live ? "bg-[#1c3326] text-[#6fc490]" : "bg-[#3a2d12] text-[#e5b04a]"}`}>
      {label}
    </span>
  );
}

function SetupPanel({ state }: { state: CafeState }) {
  const { shop, menu } = state;
  const steps = [
    { label: "Café name", done: !!shop.name, detail: shop.name },
    { label: "Menu and prices", done: menu.length > 0, detail: menu.length ? `${menu.length} items` : "" },
    { label: "Opening hours", done: !!shop.hours, detail: shop.hours },
    { label: "Address", done: !!shop.address, detail: shop.address },
    { label: "Store live", done: false, detail: "say “launch the store”" },
  ];
  return (
    <div className="rounded-2xl border border-[#3a2f26] bg-[#17120e] p-5">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-[#b3a291]">Setting up your shop</h2>
      <ol className="flex flex-col gap-3">
        {steps.map((s) => (
          <li key={s.label} className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                s.done ? "bg-[#6fc490] text-[#0f0c0a]" : "border border-[#3a2f26]"
              }`}
            >
              {s.done ? "✓" : ""}
            </span>
            <div className="min-w-0">
              <div className={s.done ? "" : "text-[#b3a291]"}>{s.label}</div>
              {s.detail && <div className="truncate text-sm text-[#7a6a5c]">{s.detail}</div>}
            </div>
          </li>
        ))}
      </ol>
      {menu.length > 0 && (
        <ul className="mt-5 max-h-64 overflow-y-auto border-t border-[#3a2f26] pt-3 text-sm">
          {menu.map((m) => (
            <li key={m.id} className="flex justify-between gap-3 py-1">
              <span className="truncate">{m.name}</span>
              <span className="tabular-nums text-[#b3a291]">{money(m.price_cents)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LivePanel({ state }: { state: CafeState }) {
  const [qr, setQr] = useState("");
  // Only rendered after the first state fetch, so this always runs in the browser.
  // A phone can't reach "localhost", so the QR can point at a tunnel or LAN address instead.
  const url = `${process.env.NEXT_PUBLIC_STORE_ORIGIN || window.location.origin}/s/${state.shop.slug}`;
  useEffect(() => {
    void QRCode.toDataURL(url, { margin: 1, width: 280 }).then(setQr);
  }, [url]);
  const open = state.orders.filter((o) => o.status !== "done" && o.status !== "cancelled");
  const waiting = state.orders.filter((o) => o.status === "new").reverse();
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[#3a2f26] bg-[#17120e] p-5">
      <h2 className="text-sm font-medium uppercase tracking-wide text-[#b3a291]">Your store is live</h2>
      {qr && <img src={qr} alt={`QR code for ${url}`} className="mx-auto h-48 w-48 rounded-lg bg-white p-2" />}
      <a href={url} target="_blank" rel="noreferrer" className="break-all text-center text-sm text-[#e0814f] underline">
        {url}
      </a>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Open orders" value={`${open.length}`} />
        <Stat label="Taken today" value={money(state.summary.revenue_cents)} />
        <Stat label="Needs OK" value={`${state.approvals.length}`} />
      </div>
      {waiting.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-[#b3a291]">Waiting for you</h3>
          <ul className="flex flex-col gap-1.5 text-sm">
            {waiting.slice(0, 5).map((o) => (
              <li key={o.id} className="flex items-center gap-2 rounded-lg bg-[#211a14] px-3 py-2">
                <span className="font-semibold tabular-nums">#{o.number}</span>
                <span className="rounded-full bg-[#3a2f26] px-2 text-xs">{sourceOf(o)}</span>
                <span className="min-w-0 truncate text-[#b3a291]">{o.items.map((i) => `${i.qty} ${i.name}`).join(", ")}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-[#7a6a5c]">Say “accept the {sourceOf(waiting[0])} order, ten minutes”</p>
        </div>
      )}
      <Link href="/" className="text-center text-sm text-[#b3a291] underline">
        Open the back office
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#211a14] px-2 py-2">
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-[#7a6a5c]">{label}</div>
    </div>
  );
}

// Factory reset lives behind a menu and asks twice: it wipes the shop.
function Settings({ onReset }: { onReset: (mode: "blank" | "sample") => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<"blank" | "sample" | null>(null);
  const pick = async (mode: "blank" | "sample") => {
    if (confirm !== mode) return setConfirm(mode);
    await onReset(mode);
    setConfirm(null);
    setOpen(false);
  };
  return (
    <div className="relative" onPointerDown={(e) => e.stopPropagation()}>
      <button
        className="rounded-md border border-[#3a2f26] px-2 py-1 text-xs text-[#b3a291]"
        onClick={() => {
          setOpen((o) => !o);
          setConfirm(null);
        }}
        aria-expanded={open}
      >
        Device ⋯
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 flex w-60 flex-col gap-1 rounded-xl border border-[#3a2f26] bg-[#17120e] p-2 text-sm">
          <button className="rounded-lg px-3 py-2 text-left hover:bg-[#211a14]" onClick={() => void pick("blank")}>
            {confirm === "blank" ? "Tap again: wipe everything" : "Reset to a new device"}
          </button>
          <button className="rounded-lg px-3 py-2 text-left hover:bg-[#211a14]" onClick={() => void pick("sample")}>
            {confirm === "sample" ? "Tap again: replace with sample" : "Load the sample café"}
          </button>
        </div>
      )}
    </div>
  );
}
