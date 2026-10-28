import type { NextRequest } from "next/server";
import { askJson } from "@/lib/muse";
import { addExpense, findStockItem, log, restock } from "@/lib/store";
import { money } from "@/lib/format";

interface Receipt {
  vendor: string;
  category: "ingredients" | "supplies" | "utilities" | "rent" | "wages" | "other";
  total: number;
  items: { name: string; qty: number; unit: string; amount: number }[];
}

// Books: a photo of a supplier invoice or receipt becomes an expense, and delivered ingredients restock automatically.
export async function POST(req: NextRequest) {
  const { image } = (await req.json()) as { image: string };
  try {
    const r = await askJson<Receipt>(
      `Read this café receipt or supplier invoice. Return JSON: {"vendor": string, "category": "ingredients"|"supplies"|"utilities"|"rent"|"wages"|"other", "total": number (in major currency units, e.g. 12.50), "items": [{"name": string, "qty": number, "unit": string, "amount": number}]}. Use the quantity actually delivered.`,
      image,
    );
    const total_cents = Math.round(r.total * 100);
    addExpense({ vendor: r.vendor, category: r.category, total_cents, items: r.items });
    const restocked: string[] = [];
    if (r.category === "ingredients") {
      for (const line of r.items ?? []) {
        const s = findStockItem(line.name);
        if (s && line.qty > 0) {
          restock(s.id, line.qty);
          restocked.push(`${line.qty} ${s.unit} ${s.name}`);
        }
      }
    }
    log(
      "Books",
      `Logged ${money(total_cents)} from ${r.vendor} (${r.category}).${restocked.length ? ` Restocked ${restocked.join(", ")}.` : ""}`,
    );
    return Response.json({ receipt: r, restocked });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
