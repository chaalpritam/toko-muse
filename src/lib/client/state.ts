"use client";

import { useCallback, useEffect, useState } from "react";
import type { Activity, Approval, Expense, MenuItem, Order, StockItem, daySummary } from "@/lib/store";
import type { Shop } from "@/lib/shop";

export interface CafeState {
  shop: Shop;
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

export function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis || !text) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.05;
  window.speechSynthesis.speak(u);
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
