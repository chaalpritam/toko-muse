"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Activity, Approval, Expense, MenuItem, Order, StockItem, daySummary } from "@/lib/store";
import type { Shop } from "@/lib/shop";

export interface CafeState {
  shop: Shop;
  lastSetupLine: string | null;
  orders: Order[];
  approvals: Approval[];
  activity: Activity[];
  summary: ReturnType<typeof daySummary>;
  menu: MenuItem[];
  stock: StockItem[];
  expenses: Expense[];
  stripe: boolean;
}

export function useCafeState(intervalMs = 2500) {
  const [state, setState] = useState<CafeState | null>(null);
  const refresh = useCallback(async () => {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (res.ok) setState(await res.json());
  }, []);
  useEffect(() => {
    // Polling keeps every screen (and Stripe payments) in sync without a socket.
    const tick = () => void refresh();
    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);
  return { state, refresh };
}

export async function api<T = unknown>(url: string, body?: unknown, method = "POST"): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export function speak(text: string, onEnd?: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis || !text) return onEnd?.();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.05;
  if (onEnd) u.onend = u.onerror = () => onEnd();
  window.speechSynthesis.speak(u);
}

// Call-outs: speak new online orders and completed card payments, like a kitchen printer that talks.
export function useCallOuts(state: CafeState | null, muted: boolean) {
  const seen = useRef<Map<number, string> | null>(null);
  useEffect(() => {
    if (!state) return;
    const prev = seen.current;
    const next = new Map(state.orders.map((o) => [o.id, o.payment_status]));
    if (prev && !muted) {
      for (const o of state.orders) {
        const before = prev.get(o.id);
        const items = o.items.map((i) => `${i.qty} ${i.name}`).join(", ");
        if (before === undefined && o.channel === "online" && o.payment_status !== "pending") {
          speak(`New online order ${o.number}${o.label ? ` for ${o.label}` : ""}: ${items}.`);
        } else if (before === "pending" && o.payment_status === "paid") {
          speak(
            o.channel === "online"
              ? `New online order ${o.number}${o.label ? ` for ${o.label}` : ""}, paid: ${items}.`
              : `Order ${o.number} paid by card.`,
          );
        }
      }
    }
    seen.current = next;
  }, [state, muted]);
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Phone photos are large; shrink before sending to the vision models.
export async function shrinkImage(dataUrl: string, max = 1280, quality = 0.85): Promise<string> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}
