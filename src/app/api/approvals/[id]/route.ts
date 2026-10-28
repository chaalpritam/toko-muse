import type { NextRequest } from "next/server";
import { decide } from "@/lib/approvals";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/approvals/[id]">) {
  const { id } = await ctx.params;
  const { approve } = (await req.json()) as { approve: boolean };
  try {
    await decide(Number(id), approve);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
