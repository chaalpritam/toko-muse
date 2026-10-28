import type { NextRequest } from "next/server";
import { checkLowStock, listStock, log, restock } from "@/lib/store";

export async function POST(req: NextRequest) {
  const { id, qty } = (await req.json()) as { id: number; qty: number };
  const item = listStock().find((s) => s.id === id);
  if (!item) return Response.json({ error: "Not found" }, { status: 404 });
  const back = restock(id, qty);
  log("Stock", `Received ${qty} ${item.unit} ${item.name}.${back.length ? ` Back on the menu: ${back.join(", ")}.` : ""}`);
  checkLowStock();
  return Response.json({ ok: true });
}
