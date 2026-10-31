import { db, slugify } from "./db";

// "new": straight out of the box. "setup": the owner is setting it up by voice. "live": the store is open.
export type ShopStage = "new" | "setup" | "live";

export interface Shop {
  name: string;
  slug: string;
  tagline: string;
  about: string;
  address: string;
  hours: string;
  phone: string;
  stage: ShopStage;
  launched_at: string | null;
}

export function getShop(): Shop {
  return db().prepare("SELECT * FROM shop WHERE id = 1").get() as unknown as Shop;
}

const FIELDS = ["name", "tagline", "about", "address", "hours", "phone"] as const;
export type ShopDetails = Partial<Record<(typeof FIELDS)[number], string>>;

export function updateShop(details: ShopDetails) {
  for (const f of FIELDS) {
    const v = details[f]?.trim();
    if (!v) continue;
    db().prepare(`UPDATE shop SET ${f} = ? WHERE id = 1`).run(v);
    if (f === "name") db().prepare("UPDATE shop SET slug = ? WHERE id = 1").run(slugify(v));
  }
  if (getShop().stage === "new") setStage("setup");
  return getShop();
}

export function setStage(stage: ShopStage) {
  db()
    .prepare(`UPDATE shop SET stage = ?, launched_at = CASE WHEN ? = 'live' THEN datetime('now') ELSE launched_at END WHERE id = 1`)
    .run(stage, stage);
}
