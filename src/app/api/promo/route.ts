import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { askText, editImage } from "@/lib/muse";
import { log } from "@/lib/store";
import { getShop } from "@/lib/shop";

export async function GET() {
  return Response.json(db().prepare("SELECT * FROM promos ORDER BY id DESC LIMIT 12").all());
}

// Promoter: the dish cut out by SAM becomes a poster (Muse Image) with a caption (Muse Spark).
export async function POST(req: NextRequest) {
  const { image, dish, price, note } = (await req.json()) as { image: string; dish: string; price?: string; note?: string };
  const CAFE = getShop().name || "our café";
  try {
    const [poster, caption] = await Promise.all([
      editImage(
        `Turn this photo of ${dish} into a bright, appetising square social media poster for ${CAFE}. Keep the real dish exactly as it looks, place it on a clean styled café table with soft natural light. Add the headline "${dish}"${price ? ` and the price "${price}"` : ""} in elegant lettering. ${note ?? ""}`,
        image,
      ),
      askText(
        `You write short, warm Instagram captions for ${CAFE}, an independent café. Two sentences max, then 3 hashtags. No emojis spam, at most one.`,
        `Today's special: ${dish}${price ? ` (${price})` : ""}. ${note ?? ""}`,
      ),
    ]);
    db().prepare("INSERT INTO promos (dish, caption, image) VALUES (?, ?, ?)").run(dish, caption, poster);
    log("Promoter", `Made a poster and caption for ${dish}.`);
    return Response.json({ image: poster, caption });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
