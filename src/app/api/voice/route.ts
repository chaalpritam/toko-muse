import type { NextRequest } from "next/server";
import { runManager } from "@/lib/agent";
import { runSetup } from "@/lib/setup";
import { getShop } from "@/lib/shop";
import { transcribe } from "@/lib/muse";
import { listMenu, listStock } from "@/lib/store";

// Push-to-talk from the counter mic (XVF3800): 16 kHz mono WAV in, transcript + the crew's reply out.
export async function POST(req: NextRequest) {
  const wav = await req.blob();
  try {
    const keywords = [...listMenu().map((m) => m.name), ...listStock().map((s) => s.name)];
    const transcript = await transcribe(wav, keywords);
    if (!transcript) return Response.json({ transcript: "", reply: "", actions: [] });
    const turn =
      getShop().stage === "live" ? await runManager(transcript, { origin: req.nextUrl.origin }) : await runSetup(transcript);
    return Response.json({ transcript, ...turn });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
