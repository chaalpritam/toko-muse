import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { segment } from "@/lib/muse";
import { checkLowStock, listMenu, log, restock, setAvailable } from "@/lib/store";

// Display-case camera: SAM 3.1 counts each pastry, and the count becomes the stock level.
export async function POST(req: NextRequest) {
  const { image } = (await req.json()) as { image: string };
  const items = listMenu().filter((m) => m.in_case);
  try {
    const results = await Promise.all(
      items.map(async (m) => ({ item: m, boxes: await segment(image, m.name.toLowerCase()) })),
    );
    const notes: string[] = [];
    for (const { item, boxes } of results) {
      const count = boxes.length;
      db()
        .prepare("UPDATE menu_items SET case_count = ?, case_counted_at = datetime('now') WHERE id = ?")
        .run(count, item.id);
      // Pastries map 1:1 to a stock item, so the case count is the stock level.
      const recipe = db()
        .prepare("SELECT r.stock_item_id, s.qty FROM recipes r JOIN stock_items s ON s.id = r.stock_item_id WHERE r.menu_item_id = ?")
        .all(item.id) as { stock_item_id: number; qty: number }[];
      if (recipe.length === 1) {
        db().prepare("UPDATE stock_items SET qty = ? WHERE id = ?").run(count, recipe[0].stock_item_id);
        if (count > 0 && !item.available) restock(recipe[0].stock_item_id, 0);
      }
      if (count === 0 && item.available) {
        setAvailable(item.id, false);
        notes.push(`${item.name} sold out`);
      } else if (count > 0 && count <= 2) {
        notes.push(`only ${count} ${item.name} left`);
      }
    }
    log(
      "Case Watcher",
      `Counted the case: ${results.map((r) => `${r.boxes.length} ${r.item.name}`).join(", ")}.${notes.length ? ` ${notes.join("; ")}.` : ""}`,
    );
    checkLowStock();
    return Response.json({
      results: results.map((r) => ({ id: r.item.id, name: r.item.name, count: r.boxes.length, boxes: r.boxes })),
    });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
