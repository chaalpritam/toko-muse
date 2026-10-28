import type { NextRequest } from "next/server";
import { runManager } from "@/lib/agent";

export async function POST(req: NextRequest) {
  const { text } = (await req.json()) as { text: string };
  if (!text?.trim()) return Response.json({ error: "Say something first" }, { status: 400 });
  try {
    return Response.json(await runManager(text.trim(), { origin: req.nextUrl.origin }));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
