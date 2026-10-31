import type { NextRequest } from "next/server";
import { resetDb } from "@/lib/db";
import { getShop } from "@/lib/shop";

// Factory reset from the device: "blank" waits to be set up by voice, "sample" restores the demo café.
export async function POST(req: NextRequest) {
  const { mode } = (await req.json().catch(() => ({}))) as { mode?: "blank" | "sample" };
  resetDb(mode === "sample" ? "sample" : "blank");
  return Response.json({ shop: getShop() });
}
