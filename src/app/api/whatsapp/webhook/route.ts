import { after, type NextRequest } from "next/server";
import { handleIncoming, validSignature } from "@/lib/whatsapp";
import { log } from "@/lib/store";

// WhatsApp Cloud API webhook. Meta calls GET once to verify the URL, then POSTs each message.
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const ok = p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN;
  return ok ? new Response(p.get("hub.challenge")) : new Response("Forbidden", { status: 403 });
}

interface Payload {
  entry?: {
    changes?: {
      value?: {
        contacts?: { wa_id: string; profile?: { name?: string } }[];
        messages?: { from: string; type: string; text?: { body: string } }[];
      };
    }[];
  }[];
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  if (!validSignature(body, req.headers.get("x-hub-signature-256"))) return new Response("Bad signature", { status: 401 });
  const payload = JSON.parse(body) as Payload;
  const messages = (payload.entry ?? []).flatMap((e) => (e.changes ?? []).map((c) => c.value ?? {}));
  // Answer Meta straight away; reading the message with the model takes a few seconds.
  after(async () => {
    for (const v of messages) {
      for (const m of v.messages ?? []) {
        if (m.type !== "text" || !m.text) continue;
        const name = v.contacts?.find((c) => c.wa_id === m.from)?.profile?.name ?? "";
        try {
          await handleIncoming(m.from, name, m.text.body);
        } catch (err) {
          log("Orders", `Couldn't answer a WhatsApp message: ${(err as Error).message}`);
        }
      }
    }
  });
  return new Response("OK");
}
