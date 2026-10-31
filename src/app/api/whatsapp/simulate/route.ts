import type { NextRequest } from "next/server";
import { handleIncoming, thread, whatsappConnected } from "@/lib/whatsapp";
import { getShop } from "@/lib/shop";

// The /whatsapp page plays a customer's phone: same handling as the real webhook, minus Meta.
export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get("phone") ?? "";
  return Response.json({ shop: getShop().name, connected: whatsappConnected(), messages: thread(phone) });
}

export async function POST(req: NextRequest) {
  const { phone, name, text } = (await req.json()) as { phone: string; name: string; text: string };
  if (!phone || !text?.trim()) return Response.json({ error: "phone and text required" }, { status: 400 });
  try {
    await handleIncoming(phone, name ?? "", text.trim());
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
  return Response.json({ messages: thread(phone) });
}
