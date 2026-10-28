import type { NextRequest } from "next/server";
import { listMenu, log, setAvailable } from "@/lib/store";

export async function GET() {
  return Response.json(listMenu());
}

export async function PATCH(req: NextRequest) {
  const { id, available } = (await req.json()) as { id: number; available: boolean };
  setAvailable(id, available);
  const item = listMenu().find((m) => m.id === id);
  log("Stock", `${item?.name} ${available ? "back on" : "taken off"} the menu.`);
  return Response.json({ ok: true });
}
