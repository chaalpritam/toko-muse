import type { NextRequest } from "next/server";
import { segment } from "@/lib/muse";

export async function POST(req: NextRequest) {
  const { image, prompt } = (await req.json()) as { image: string; prompt: string };
  try {
    return Response.json({ boxes: await segment(image, prompt) });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
