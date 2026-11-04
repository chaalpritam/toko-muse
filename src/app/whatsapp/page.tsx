"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/state";
import { timeOf } from "@/lib/format";
import type { WaMessage } from "@/lib/whatsapp";
import { Icon } from "@/components/Icon";

// Plays a customer's phone messaging the café on WhatsApp, for demos without a WhatsApp Business number.
// Messages go through the same handling as the real WhatsApp webhook.
const PHONE = "15550142";

export default function WhatsAppSim() {
  const [name, setName] = useState("Maya");
  const [shop, setShop] = useState("");
  const [connected, setConnected] = useState(true);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Polling picks up the café's updates ("your order is ready") as the owner moves the order along.
    const load = () =>
      fetch(`/api/whatsapp/simulate?phone=${PHONE}`)
        .then((r) => r.json())
        .then((d) => {
          setShop(d.shop);
          setConnected(d.connected);
          setMessages(d.messages);
        });
    void load();
    const id = setInterval(load, 2500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setText("");
    setBusy(true);
    setError("");
    setMessages((m) => [...m, { id: -Date.now(), phone: PHONE, name, direction: "in", text: t, created_at: "" }]);
    try {
      const d = await api<{ messages: WaMessage[] }>("/api/whatsapp/simulate", { phone: PHONE, name, text: t });
      setMessages(d.messages);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#d9d3cb] p-4 dark:bg-[#0b0a09]">
      <div className="flex h-[min(760px,92vh)] w-full max-w-sm flex-col overflow-hidden rounded-[2rem] border-8 border-[#1b1b1b] bg-[#efe7de] shadow-2xl dark:bg-[#0b141a]">
        <header className="flex items-center gap-3 bg-[#075e54] px-4 py-3 text-white">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">
            {shop.slice(0, 1) || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{shop || "Café"}</div>
            <div className="text-xs text-white/70">{busy ? "typing…" : "Business account · simulated"}</div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-3 py-3 text-sm">
          {!connected && (
            <p className="mx-auto mb-3 max-w-[85%] rounded-lg bg-[#fff5c4] px-3 py-2 text-center text-xs text-[#54471b]">
              The café hasn’t connected WhatsApp yet. On the device, say “connect WhatsApp”.
            </p>
          )}
          {messages.length === 0 && connected && (
            <p className="mx-auto max-w-[85%] rounded-lg bg-white/70 px-3 py-2 text-center text-xs text-[#54656f] dark:bg-white/10 dark:text-[#8696a0]">
              Try “Hi! Can I get two oat lattes for pickup?”
            </p>
          )}
          <ul className="flex flex-col gap-1.5">
            {messages.map((m) => (
              <li
                key={m.id}
                className={`max-w-[80%] rounded-lg px-3 py-1.5 shadow-sm ${
                  m.direction === "in"
                    ? "self-end bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]"
                    : "self-start bg-white text-[#111b21] dark:bg-[#202c33] dark:text-[#e9edef]"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>
                {m.created_at && <p className="text-right text-[10px] opacity-60">{timeOf(m.created_at)}</p>}
              </li>
            ))}
          </ul>
          {error && <p className="mt-2 text-center text-xs text-[#b4532a]">{error}</p>}
          <div ref={bottom} />
        </div>
        <form
          className="flex items-center gap-2 bg-[#f0f2f5] px-2 py-2 dark:bg-[#202c33]"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            className="w-16 rounded-full bg-white px-3 py-2 text-xs text-[#111b21] dark:bg-[#2a3942] dark:text-[#e9edef]"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Your name"
          />
          <input
            className="min-w-0 flex-1 rounded-full bg-white px-4 py-2 text-sm text-[#111b21] dark:bg-[#2a3942] dark:text-[#e9edef]"
            placeholder="Message"
            aria-label="Message"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00a884] text-white disabled:opacity-50"
            disabled={busy || !text.trim()}
            aria-label="Send"
          >
            <Icon name="send" size={16} />
          </button>
        </form>
      </div>
    </main>
  );
}
