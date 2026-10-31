import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data", "cafe.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS shop (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL DEFAULT '',
  tagline TEXT NOT NULL DEFAULT '',
  about TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  hours TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT 'new',
  launched_at TEXT
);
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT
);
CREATE TABLE IF NOT EXISTS stock_items (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  unit TEXT NOT NULL,
  qty REAL NOT NULL,
  par REAL NOT NULL,
  reorder_qty REAL NOT NULL,
  unit_cost_cents INTEGER NOT NULL DEFAULT 0,
  supplier_id INTEGER REFERENCES suppliers(id)
);
CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  available INTEGER NOT NULL DEFAULT 1,
  in_case INTEGER NOT NULL DEFAULT 0,
  case_count INTEGER,
  case_counted_at TEXT
);
CREATE TABLE IF NOT EXISTS recipes (
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
  stock_item_id INTEGER NOT NULL REFERENCES stock_items(id),
  qty REAL NOT NULL,
  PRIMARY KEY (menu_item_id, stock_item_id)
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  number INTEGER NOT NULL,
  channel TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  ready_at TEXT,
  status TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  payment_method TEXT,
  total_cents INTEGER NOT NULL,
  stripe_session_id TEXT,
  stripe_url TEXT,
  stock_consumed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at TEXT
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  menu_item_id INTEGER REFERENCES menu_items(id),
  name TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_cents INTEGER NOT NULL,
  notes TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS approvals (
  id INTEGER PRIMARY KEY,
  agent TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at TEXT
);
CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY,
  agent TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY,
  vendor TEXT NOT NULL,
  category TEXT NOT NULL,
  total_cents INTEGER NOT NULL,
  items TEXT NOT NULL DEFAULT '[]',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS conversation (
  id INTEGER PRIMARY KEY,
  role TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS promos (
  id INTEGER PRIMARY KEY,
  dish TEXT NOT NULL,
  caption TEXT NOT NULL,
  image TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

// A small independent café: what it sells, what goes into each item, who supplies it.
function seed(db: DatabaseSync) {
  const suppliers = [
    ["Greenfield Dairy", "orders@greenfield-dairy.example", "+1 555 0101"],
    ["Northside Roasters", "wholesale@northside.example", "+1 555 0102"],
    ["Corner Bakery Supply", "hello@cornerbakery.example", "+1 555 0103"],
  ];
  const insSupplier = db.prepare("INSERT INTO suppliers (name, email, phone) VALUES (?, ?, ?)");
  for (const s of suppliers) insSupplier.run(...s);

  // name, unit, qty, par, reorder_qty, unit_cost_cents, supplier_id
  const stock: [string, string, number, number, number, number, number][] = [
    ["whole milk", "L", 18, 6, 20, 120, 1],
    ["oat milk", "L", 5, 3, 12, 280, 1],
    ["espresso beans", "kg", 4, 1.5, 5, 2200, 2],
    ["cold brew concentrate", "L", 3, 1, 4, 900, 2],
    ["matcha powder", "g", 400, 100, 500, 12, 2],
    ["butter croissant", "pc", 14, 4, 24, 110, 3],
    ["almond croissant", "pc", 8, 3, 12, 150, 3],
    ["blueberry muffin", "pc", 10, 3, 12, 95, 3],
    ["sourdough bread", "slice", 30, 10, 40, 35, 3],
    ["avocado", "pc", 10, 4, 20, 90, 3],
    ["eggs", "pc", 30, 12, 60, 30, 1],
  ];
  const insStock = db.prepare(
    "INSERT INTO stock_items (name, unit, qty, par, reorder_qty, unit_cost_cents, supplier_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  for (const s of stock) insStock.run(...s);

  // name, category, price_cents, description, in_case, recipe [stock name, qty]
  const menu: [string, string, number, string, number, [string, number][]][] = [
    ["Espresso", "Coffee", 300, "Double shot, house blend", 0, [["espresso beans", 0.018]]],
    ["Cappuccino", "Coffee", 450, "Espresso, steamed milk, thick foam", 0, [["espresso beans", 0.018], ["whole milk", 0.15]]],
    ["Latte", "Coffee", 475, "Espresso and silky steamed milk", 0, [["espresso beans", 0.018], ["whole milk", 0.25]]],
    ["Oat Latte", "Coffee", 525, "Latte with oat milk", 0, [["espresso beans", 0.018], ["oat milk", 0.25]]],
    ["Cold Brew", "Coffee", 450, "18-hour steeped, served over ice", 0, [["cold brew concentrate", 0.2]]],
    ["Matcha Latte", "Tea", 525, "Ceremonial matcha with milk", 0, [["matcha powder", 4], ["whole milk", 0.25]]],
    ["Butter Croissant", "Bakery", 375, "Flaky, all-butter", 1, [["butter croissant", 1]]],
    ["Almond Croissant", "Bakery", 450, "Twice-baked with frangipane", 1, [["almond croissant", 1]]],
    ["Blueberry Muffin", "Bakery", 350, "Wild blueberries, crumb top", 1, [["blueberry muffin", 1]]],
    ["Avocado Toast", "Kitchen", 1050, "Sourdough, smashed avocado, chilli, lime", 0, [["sourdough bread", 2], ["avocado", 1]]],
    ["Eggs on Toast", "Kitchen", 900, "Two eggs your way on sourdough", 0, [["sourdough bread", 2], ["eggs", 2]]],
  ];
  const insMenu = db.prepare(
    "INSERT INTO menu_items (name, category, price_cents, description, in_case) VALUES (?, ?, ?, ?, ?)",
  );
  const stockId = db.prepare("SELECT id FROM stock_items WHERE name = ?");
  const insRecipe = db.prepare("INSERT INTO recipes (menu_item_id, stock_item_id, qty) VALUES (?, ?, ?)");
  for (const [name, category, price, desc, inCase, recipe] of menu) {
    const { lastInsertRowid } = insMenu.run(name, category, price, desc, inCase);
    for (const [stockName, qty] of recipe) {
      const row = stockId.get(stockName) as { id: number };
      insRecipe.run(lastInsertRowid, row.id, qty);
    }
  }
  db.prepare("INSERT INTO activity (agent, text) VALUES (?, ?)").run("Manager", "Café set up with the sample menu and stock.");
}

const SAMPLE = {
  name: "Muse Café",
  tagline: "Small-batch coffee and fresh bakes, made by one pair of hands.",
  address: "12 Harbour Lane",
  hours: "Mon–Sat 7am–4pm",
};

export const GREETING =
  "Hi, I'm Toko, your café's new crew. Let's get your shop set up, it only takes a few minutes. What's your café called?";

export function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "my-cafe"
  );
}

function seedSampleShop(db: DatabaseSync) {
  db.prepare(
    "INSERT INTO shop (id, name, slug, tagline, address, hours, stage, launched_at) VALUES (1, ?, ?, ?, ?, ?, 'live', datetime('now'))",
  ).run(SAMPLE.name, slugify(SAMPLE.name), SAMPLE.tagline, SAMPLE.address, SAMPLE.hours);
}

// Wipes the device. "blank" is a fresh-out-of-the-box device that waits to be set up by voice;
// "sample" brings back the demo café.
export function resetDb(mode: "blank" | "sample") {
  const d = db();
  d.exec(`BEGIN;
    DELETE FROM order_items; DELETE FROM orders; DELETE FROM recipes; DELETE FROM menu_items;
    DELETE FROM stock_items; DELETE FROM suppliers; DELETE FROM approvals; DELETE FROM activity;
    DELETE FROM expenses; DELETE FROM promos; DELETE FROM conversation; DELETE FROM shop;
    COMMIT;`);
  if (mode === "sample") {
    seed(d);
    seedSampleShop(d);
  } else {
    d.prepare("INSERT INTO shop (id) VALUES (1)").run();
    d.prepare("INSERT INTO conversation (role, text) VALUES ('assistant', ?)").run(GREETING);
  }
}

// Columns added after the first release, for databases created before them.
function migrate(db: DatabaseSync) {
  const cols = new Set((db.prepare("PRAGMA table_info(orders)").all() as { name: string }[]).map((c) => c.name));
  if (!cols.has("source")) db.exec("ALTER TABLE orders ADD COLUMN source TEXT NOT NULL DEFAULT ''");
  if (!cols.has("note")) db.exec("ALTER TABLE orders ADD COLUMN note TEXT NOT NULL DEFAULT ''");
  if (!cols.has("ready_at")) db.exec("ALTER TABLE orders ADD COLUMN ready_at TEXT");
}

function open(): DatabaseSync {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  migrate(db);
  if (!db.prepare("SELECT id FROM shop WHERE id = 1").get()) {
    // First run (or a database from before the shop profile existed): start as the sample café.
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM menu_items").get() as { n: number };
    if (n === 0) seed(db);
    seedSampleShop(db);
  }
  return db;
}

const globalForDb = globalThis as unknown as { cafeDb?: DatabaseSync };

export function db(): DatabaseSync {
  if (!globalForDb.cafeDb) globalForDb.cafeDb = open();
  return globalForDb.cafeDb;
}
