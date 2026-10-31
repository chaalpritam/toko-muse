import type { NextRequest } from "next/server";
import { runManager } from "@/lib/agent";
import { runSetup } from "@/lib/setup";
import { getShop } from "@/lib/shop";

export async function POST(req: NextRequest) {
  const { text } = (await req.json()) as { text: string };
  if (!text?.trim()) return Response.json({ error: "Say something first" }, { status: 400 });
  try {
    // Until the store is live, everything the owner says goes to the Setup agent.
    const turn =
      getShop().stage === "live" ? await runManager(text.trim(), { origin: req.nextUrl.origin }) : await runSetup(text.trim());
    return Response.json(turn);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
