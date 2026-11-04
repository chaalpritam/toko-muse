"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// An example shift from the demo script: what the owner says, and what the crew does about it.
const EXCHANGES = [
  {
    said: "Two oat lattes and a butter croissant for table 4, card.",
    did: [
      { agent: "Orders", text: "order rung up for table 4" },
      { agent: "Payments", text: "Stripe QR on the counter screen" },
    ],
  },
  {
    said: "We’re out of oat milk.",
    did: [
      { agent: "Stock", text: "Oat Latte sold out on the store and delivery apps" },
      { agent: "Suppliers", text: "oat milk reorder waits for your OK", ok: true },
    ],
  },
  {
    said: "Accept the QuickBite order, ten minutes.",
    did: [{ agent: "Orders", text: "accepted, ready time promised to the customer" }],
  },
];

type Orb = "idle" | "listening" | "thinking" | "speaking";

// Each exchange plays like the device does: listen while the words come in, think, then the crew's actions land.
export function Shift() {
  const [words, setWords] = useState<number[]>(() => EXCHANGES.map(() => 0));
  const [done, setDone] = useState<number[]>(() => EXCHANGES.map(() => 0));
  const [orb, setOrb] = useState<Orb>("idle");
  const transcript = useRef<HTMLOListElement>(null);

  useEffect(() => {
    // With reduced motion the CSS shows everything at once and the orb stays still.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const play = () => {
      let t = 300;
      const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
      EXCHANGES.forEach((e, i) => {
        at(t, () => setOrb("listening"));
        e.said.split(" ").forEach((_, w) => {
          t += 150;
          at(t, () => setWords((all) => all.map((n, j) => (j === i ? w + 1 : n))));
        });
        t += 300;
        at(t, () => setOrb("thinking"));
        t += 700;
        at(t, () => setOrb("speaking"));
        e.did.forEach((_, d) => {
          at(t, () => setDone((all) => all.map((n, j) => (j === i ? d + 1 : n))));
          t += 350;
        });
        t += 700;
        at(t, () => setOrb("idle"));
        t += 500;
      });
    };
    // Play once the conversation is on screen, so phones (where it sits below the orb) don't miss it.
    const seen = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        seen.disconnect();
        play();
      },
      { threshold: 0.35 },
    );
    if (transcript.current) seen.observe(transcript.current);
    return () => {
      seen.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
      <div className="flex flex-col items-center gap-5">
        <Link
          href="/device"
          aria-label="Open the device and talk to Toko"
          className="orb block"
          data-state={orb}
          style={{ width: "clamp(180px, 30vw, 400px)" }}
        />
        <Link
          href="/device"
          className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-foreground"
        >
          This is Toko. Talk to it on the device
        </Link>
      </div>

      <div>
        <h1 className="font-display text-[clamp(2.5rem,5vw,4rem)] font-semibold leading-[1.04] tracking-tight text-balance">
          Run your café by talking to the counter.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted text-pretty">
          Toko Muse is a device on the counter with a crew of AI agents on Meta’s Muse models. You keep making the
          coffee. It keeps the shop running.
        </p>

        <ol ref={transcript} className="mt-9 flex flex-col gap-6" aria-label="An example shift">
          {EXCHANGES.map((e, i) => (
            <li key={e.said}>
              <p className="font-display text-xl leading-snug sm:text-2xl">
                <span className={`text-accent transition-opacity ${words[i] ? "opacity-100" : "opacity-0"} motion-reduce:opacity-100`}>“</span>
                {e.said.split(" ").map((w, j, all) => (
                  <span
                    key={j}
                    className={`transition-opacity duration-200 ${j < words[i] ? "opacity-100" : "opacity-0"} motion-reduce:opacity-100`}
                  >
                    {w}
                    {j < all.length - 1 ? " " : ""}
                  </span>
                ))}
                <span
                  className={`text-accent transition-opacity ${words[i] ? "opacity-100" : "opacity-0"} motion-reduce:opacity-100`}
                >
                  ”
                </span>
              </p>
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {e.did.map((d, j) => (
                  <li
                    key={d.text}
                    className={`flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-sm text-muted transition-[opacity,transform] duration-300 ease-out ${
                      j < done[i] ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
                    } motion-reduce:translate-y-0 motion-reduce:opacity-100`}
                  >
                    <span className={`font-medium ${d.ok ? "text-warn" : "text-accent"}`}>{d.agent}</span>
                    {d.text}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-muted">An example shift, from the demo script.</p>

        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/device" className="btn btn-primary px-5 py-3 text-base">
            Try the device
          </Link>
          <Link href="/counter" className="btn px-5 py-3 text-base">
            Open the counter
          </Link>
        </div>
      </div>
    </div>
  );
}
