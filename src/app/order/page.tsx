"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client/state";
import { money } from "@/lib/format";
import type { MenuItem } from "@/lib/store";

const CAFE = process.env.NEXT_PUBLIC_CAFE_NAME ?? "Muse Café";

// The café's own online ordering page (what a customer opens from a link or QR on the table).
export default function OrderPage() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = () => fetch("/api/menu").then((r) => r.json()).then(setMenu);
    void load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  const categories = useMemo(() => [...new Set(menu.map((m) => m.category))], [menu]);
  const lines = Object.entries(cart).filter(([, q]) => q > 0);
  const total = lines.reduce((s, [id, q]) => s + (menu.find((m) => m.id === +id)?.price_cents ?? 0) * q, 0);
  const add = (id: number, d: number) => setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + d) }));

  const checkout = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await api<{ url?: string; order_number?: number }>("/api/checkout", {
        name,
        lines: lines.map(([id, qty]) => ({ menu_item_id: +id, qty })),
      });
      if (data.url) window.location.assign(data.url);
      else {
        setPlaced(data.order_number ?? null);
        setCart({});
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (placed)
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="text-sm text-muted">{CAFE}</p>
        <h1 className="text-2xl font-semibold">Order #{placed} is in</h1>
        <p className="text-muted">Pay when you pick it up. We’ll call your name.</p>
      </main>
    );

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-40 pt-8">
      <h1 className="text-2xl font-semibold">{CAFE}</h1>
      <p className="mb-6 text-muted">Order ahead, skip the queue.</p>
      {categories.map((cat) => (
        <section key={cat} className="mb-6">
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted">{cat}</h2>
          <ul className="card divide-y divide-line">
            {menu
              .filter((m) => m.category === cat)
              .map((m) => (
                <li key={m.id} className={`flex items-center gap-3 p-3 ${m.available ? "" : "opacity-50"}`}>
                  <div className="flex-1">
                    <div className="font-medium">{m.name}</div>
                    <div className="text-sm text-muted">{m.available ? m.description : "Sold out for today"}</div>
                  </div>
                  <span className="tabular-nums">{money(m.price_cents)}</span>
                  {m.available && (
                    <div className="flex items-center gap-1">
                      {cart[m.id] ? (
                        <>
                          <button className="btn h-8 w-8 p-0" aria-label={`Remove ${m.name}`} onClick={() => add(m.id, -1)}>
                            −
                          </button>
                          <span className="w-5 text-center tabular-nums">{cart[m.id]}</span>
                        </>
                      ) : null}
                      <button className="btn h-8 w-8 p-0" aria-label={`Add ${m.name}`} onClick={() => add(m.id, 1)}>
                        +
                      </button>
                    </div>
                  )}
                </li>
              ))}
          </ul>
        </section>
      ))}
      {lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-surface">
          <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-3 px-4 py-3">
            <input
              className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2"
              placeholder="Your name for the order"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="btn btn-primary px-5 py-2" disabled={busy || !name.trim()} onClick={checkout}>
              {busy ? "…" : `Pay ${money(total)}`}
            </button>
            {error && <p className="w-full text-sm text-accent">{error}</p>}
          </div>
        </div>
      )}
    </main>
  );
}
