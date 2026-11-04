"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client/state";
import { money } from "@/lib/format";
import type { MenuItem } from "@/lib/store";
import { Icon } from "@/components/Icon";

// The menu and cart on the café's store page. Polls the menu so sold-out items drop off live.
export function StoreMenu({ cafe }: { cafe: string }) {
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
  const count = lines.reduce((n, [, q]) => n + q, 0);
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
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-ok-soft text-ok">
          <Icon name="check" size={24} />
        </span>
        <p className="text-sm text-muted">{cafe}</p>
        <h1 className="font-display text-3xl font-semibold">Order #{placed} is in</h1>
        <p className="text-muted">Pay when you pick it up. We’ll call your name.</p>
      </div>
    );

  if (menu.length === 0)
    return (
      <div className="flex flex-col gap-3 pb-16" aria-busy>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-[14px] bg-sunken" />
        ))}
      </div>
    );

  return (
    <div className="pb-40">
      {categories.map((cat) => (
        <section key={cat} className="mb-8">
          <h3 className="mb-3 font-display text-xl font-semibold">{cat}</h3>
          <ul className="card divide-y divide-line">
            {menu
              .filter((m) => m.category === cat)
              .map((m) => (
                <li key={m.id} className={`flex items-center gap-3 px-4 py-3.5 ${m.available ? "" : "opacity-55"}`}>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{m.name}</div>
                    <div className="text-sm text-muted">{m.available ? m.description : "Sold out for today"}</div>
                  </div>
                  <span className="tabular-nums">{money(m.price_cents)}</span>
                  <div className="flex w-[6.75rem] shrink-0 items-center justify-end gap-1">
                    {m.available && cart[m.id] ? (
                      <>
                        <button
                          className="btn h-9 w-9 rounded-full p-0"
                          aria-label={`Remove ${m.name}`}
                          onClick={() => add(m.id, -1)}
                        >
                          <Icon name="minus" size={15} />
                        </button>
                        <span className="w-6 text-center font-medium tabular-nums" aria-live="polite">
                          {cart[m.id]}
                        </span>
                      </>
                    ) : null}
                    {m.available && (
                      <button
                        className={`btn h-9 w-9 rounded-full p-0 ${cart[m.id] ? "" : "border-transparent bg-accent-soft text-accent hover:bg-accent hover:text-white"}`}
                        aria-label={`Add ${m.name}`}
                        onClick={() => add(m.id, 1)}
                      >
                        <Icon name="plus" size={15} />
                      </button>
                    )}
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ))}
      {lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 shadow-[0_-8px_24px_rgb(0_0_0/0.08)] backdrop-blur">
          <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <p className="w-full text-sm text-muted">
              {count} item{count === 1 ? "" : "s"} · {money(total)}
            </p>
            <input
              aria-label="Your name for the order"
              autoComplete="given-name"
              className="field flex-1 py-2.5 text-base"
              placeholder="Your name for the order"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button
              className="btn btn-primary px-5 py-2.5 text-base"
              disabled={busy || !name.trim()}
              onClick={checkout}
            >
              {busy ? "Placing order…" : `Pay ${money(total)}`}
            </button>
            {error && (
              <p role="alert" className="w-full text-sm text-danger">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
