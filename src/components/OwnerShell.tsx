"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CafeState } from "@/lib/client/state";
import { money } from "@/lib/format";

const CAFE = process.env.NEXT_PUBLIC_CAFE_NAME ?? "Muse Café";

const NAV = [
  { href: "/", label: "Counter" },
  { href: "/stock", label: "Stock" },
  { href: "/money", label: "Money" },
  { href: "/promo", label: "Promo" },
];

export function OwnerShell({ state, children }: { state: CafeState | null; children: React.ReactNode }) {
  const path = usePathname();
  const s = state?.summary;
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold">{CAFE}</span>
            <span className="text-xs text-muted">Toko Muse back office</span>
          </div>
          <nav className="flex gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  path === n.href ? "bg-accent-soft font-medium text-accent" : "text-muted hover:text-foreground"
                }`}
              >
                {n.label}
              </Link>
            ))}
            <a href="/order" target="_blank" className="rounded-lg px-3 py-1.5 text-sm text-muted hover:text-foreground">
              Order page ↗
            </a>
          </nav>
          {s && (
            <div className="ml-auto flex gap-5 text-sm">
              <Stat label="Taken today" value={money(s.revenue_cents)} />
              <Stat label="Orders" value={`${s.orders}`} />
              <Stat label="Unpaid" value={`${s.unpaid.length}`} warn={s.unpaid.length > 0} />
              <Stat label="Needs OK" value={`${state.approvals.length}`} warn={state.approvals.length > 0} />
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5">{children}</main>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[11px] uppercase tracking-wide text-muted">{label}</span>
      <span className={`font-semibold tabular-nums ${warn ? "text-warn" : ""}`}>{value}</span>
    </div>
  );
}
