"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CafeState } from "@/lib/client/state";
import { money } from "@/lib/format";
import { Icon } from "@/components/Icon";

const NAV = [
  { href: "/counter", label: "Counter" },
  { href: "/stock", label: "Stock" },
  { href: "/money", label: "Money" },
  { href: "/promo", label: "Promo" },
  { href: "/device", label: "Device" },
];

export function OwnerShell({ state, children }: { state: CafeState | null; children: React.ReactNode }) {
  const path = usePathname();
  const s = state?.summary;
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-xl font-semibold tracking-tight">{state?.shop.name || "Your café"}</span>
            <span className="hidden text-xs text-muted sm:inline">back office</span>
          </div>
          <nav className="-mx-1 flex gap-0.5 overflow-x-auto">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={path === n.href ? "page" : undefined}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  path === n.href ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-line/60 hover:text-foreground"
                }`}
              >
                {n.label}
              </Link>
            ))}
            <a
              href={state?.shop.slug ? `/s/${state.shop.slug}` : "/order"}
              target="_blank"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-line/60 hover:text-foreground"
            >
              Store <Icon name="external" size={13} />
            </a>
          </nav>
          {s && (
            <div className="ml-auto flex gap-5 text-sm sm:gap-6">
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
      <span className={`text-base font-semibold tabular-nums ${warn ? "text-warn" : ""}`}>{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}
