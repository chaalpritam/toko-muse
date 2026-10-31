import { db } from "./db";
import { CHANNELS, type Channel } from "./channels";

export type { Channel };
export type OrderStatus = "new" | "accepted" | "ready" | "done" | "cancelled";
export type PaymentStatus = "unpaid" | "pending" | "paid" | "refunded";
// "platform": a delivery app collected the money and pays the café out.
export type PaymentMethod = "cash" | "card" | "online" | "platform";

export interface MenuItem {
  id: number;
  name: string;
  category: string;
  price_cents: number;
  description: string;
  available: number;
  in_case: number;
  case_count: number | null;
  case_counted_at: string | null;
}

export interface StockItem {
  id: number;
  name: string;
  unit: string;
  qty: number;
  par: number;
  reorder_qty: number;
  unit_cost_cents: number;
  supplier_id: number | null;
  supplier_name: string | null;
}

export interface OrderItem {
  id: number;
  order_id: number;
  menu_item_id: number | null;
  name: string;
  qty: number;
  unit_cents: number;
  notes: string;
}

export interface Order {
  id: number;
  number: number;
  channel: Channel;
  source: string;
  label: string;
  note: string;
  ready_at: string | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  total_cents: number;
  stripe_session_id: string | null;
  stripe_url: string | null;
  stock_consumed: number;
  created_at: string;
  paid_at: string | null;
  items: OrderItem[];
}

export interface Approval {
  id: number;
  agent: string;
  kind: "supplier_order" | "refund";
  title: string;
  detail: string;
  payload: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  decided_at: string | null;
}

export interface Activity {
  id: number;
  agent: string;
  text: string;
  created_at: string;
}

export interface Expense {
  id: number;
  vendor: string;
  category: string;
  total_cents: number;
  items: string;
  note: string;
  created_at: string;
}

export function log(agent: string, text: string) {
  db().prepare("INSERT INTO activity (agent, text) VALUES (?, ?)").run(agent, text);
}

// ---------- menu ----------

export function listMenu(): MenuItem[] {
  return db()
    .prepare(
      `SELECT * FROM menu_items ORDER BY
         CASE category WHEN 'Coffee' THEN 0 WHEN 'Tea' THEN 1 WHEN 'Bakery' THEN 2 ELSE 3 END, id`,
    )
    .all() as unknown as MenuItem[];
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

// Spoken item names are loose ("an oat flat", "two lattes"); match on word overlap.
export function findByName<T extends { name: string }>(rows: T[], query: string): T | undefined {
  const q = normalize(query).replace(/s\b/g, "");
  const exact = rows.find((r) => normalize(r.name).replace(/s\b/g, "") === q);
  if (exact) return exact;
  const qWords = new Set(q.split(" "));
  let best: T | undefined;
  let bestScore = 0;
  for (const r of rows) {
    const words = normalize(r.name).replace(/s\b/g, "").split(" ");
    const hits = words.filter((w) => qWords.has(w)).length;
    const score = hits / Math.max(words.length, qWords.size);
    if (hits > 0 && score > bestScore) {
      best = r;
      bestScore = score;
    }
  }
  return best;
}

export function findMenuItem(query: string) {
  return findByName(listMenu(), query);
}

export function setAvailable(menuItemId: number, available: boolean) {
  db().prepare("UPDATE menu_items SET available = ? WHERE id = ?").run(available ? 1 : 0, menuItemId);
}

// ---------- stock ----------

export function listStock(): StockItem[] {
  return db()
    .prepare(
      `SELECT s.*, sup.name AS supplier_name FROM stock_items s
       LEFT JOIN suppliers sup ON sup.id = s.supplier_id ORDER BY s.name`,
    )
    .all() as unknown as StockItem[];
}

export function findStockItem(query: string) {
  return findByName(listStock(), query);
}

function menuItemsUsing(stockItemId: number) {
  return db()
    .prepare(
      `SELECT m.* FROM menu_items m JOIN recipes r ON r.menu_item_id = m.id WHERE r.stock_item_id = ?`,
    )
    .all(stockItemId) as unknown as MenuItem[];
}

function canMake(menuItemId: number) {
  const short = db()
    .prepare(
      `SELECT COUNT(*) AS n FROM recipes r JOIN stock_items s ON s.id = r.stock_item_id
       WHERE r.menu_item_id = ? AND s.qty < r.qty`,
    )
    .get(menuItemId) as { n: number };
  return short.n === 0;
}

// Any item whose ingredients ran out comes off the menu; anything back in stock goes back on.
export function syncAvailability(agent = "Stock") {
  const changed: string[] = [];
  for (const item of listMenu()) {
    const ok = canMake(item.id);
    if (!ok && item.available) {
      setAvailable(item.id, false);
      changed.push(`${item.name} sold out`);
    }
  }
  if (changed.length) log(agent, `${changed.join(", ")} — removed from the online menu.`);
  return changed;
}

export function ingredientOut(stockItemId: number) {
  db().prepare("UPDATE stock_items SET qty = 0 WHERE id = ?").run(stockItemId);
  const affected = menuItemsUsing(stockItemId);
  for (const m of affected) setAvailable(m.id, false);
  return affected.map((m) => m.name);
}

export function restock(stockItemId: number, qty: number) {
  db().prepare("UPDATE stock_items SET qty = qty + ? WHERE id = ?").run(qty, stockItemId);
  const back: string[] = [];
  for (const m of menuItemsUsing(stockItemId)) {
    if (!m.available && canMake(m.id)) {
      setAvailable(m.id, true);
      back.push(m.name);
    }
  }
  return back;
}

// Draft a reorder for anything at or below par, once per item while a draft is pending.
export function checkLowStock() {
  const drafted: string[] = [];
  for (const s of listStock()) {
    if (s.qty > s.par) continue;
    const pending = db()
      .prepare(
        `SELECT id FROM approvals WHERE kind = 'supplier_order' AND status = 'pending'
         AND json_extract(payload, '$.stock_item_id') = ?`,
      )
      .get(s.id);
    if (pending) continue;
    draftSupplierOrder(s, s.reorder_qty, "Stock");
    drafted.push(s.name);
  }
  return drafted;
}

export function draftSupplierOrder(s: StockItem, qty: number, agent: string) {
  const supplier = s.supplier_id
    ? (db().prepare("SELECT * FROM suppliers WHERE id = ?").get(s.supplier_id) as
        | { name: string; email: string }
        | undefined)
    : undefined;
  const message = `Hi ${supplier?.name ?? "there"}, please deliver ${qty} ${s.unit} of ${s.name} by tomorrow morning. Thanks!`;
  return createApproval({
    agent,
    kind: "supplier_order",
    title: `Reorder ${qty} ${s.unit} ${s.name}${supplier ? ` from ${supplier.name}` : ""}`,
    detail: `${s.qty} ${s.unit} left (par ${s.par}). Est. cost ${(qty * s.unit_cost_cents) / 100}. Message: "${message}"`,
    payload: { stock_item_id: s.id, qty, to: supplier?.email ?? null, message },
  });
}

// ---------- orders ----------

function nextNumber() {
  const row = db()
    .prepare("SELECT COALESCE(MAX(number), 0) + 1 AS n FROM orders WHERE date(created_at) = date('now')")
    .get() as { n: number };
  return row.n;
}

export interface NewLine {
  menu_item_id: number;
  qty: number;
  notes?: string;
}

export function createOrder(opts: {
  channel: Channel;
  source?: string;
  label?: string;
  note?: string;
  status: OrderStatus;
  lines: NewLine[];
}): Order {
  const menu = new Map(listMenu().map((m) => [m.id, m]));
  const lines = opts.lines.filter((l) => menu.has(l.menu_item_id) && l.qty > 0);
  if (!lines.length) throw new Error("Order has no valid items");
  const soldOut = lines.filter((l) => !menu.get(l.menu_item_id)!.available).map((l) => menu.get(l.menu_item_id)!.name);
  if (soldOut.length) throw new Error(`Sold out: ${soldOut.join(", ")}`);
  const total = lines.reduce((sum, l) => sum + menu.get(l.menu_item_id)!.price_cents * l.qty, 0);
  const number = nextNumber();
  const { lastInsertRowid } = db()
    .prepare("INSERT INTO orders (number, channel, source, label, note, status, total_cents) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(number, opts.channel, opts.source ?? "", opts.label ?? "", opts.note ?? "", opts.status, total);
  const ins = db().prepare(
    "INSERT INTO order_items (order_id, menu_item_id, name, qty, unit_cents, notes) VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const l of lines) {
    const m = menu.get(l.menu_item_id)!;
    ins.run(lastInsertRowid, m.id, m.name, l.qty, m.price_cents, l.notes ?? "");
  }
  const order = getOrder(Number(lastInsertRowid))!;
  if (order.status === "accepted") consumeStock(order);
  return order;
}

function withItems(rows: Omit<Order, "items">[]): Order[] {
  if (!rows.length) return [];
  const items = db()
    .prepare(`SELECT * FROM order_items WHERE order_id IN (${rows.map(() => "?").join(",")})`)
    .all(...rows.map((r) => r.id)) as unknown as OrderItem[];
  return rows.map((r) => ({ ...r, items: items.filter((i) => i.order_id === r.id) }));
}

export function getOrder(id: number): Order | undefined {
  const row = db().prepare("SELECT * FROM orders WHERE id = ?").get(id) as Omit<Order, "items"> | undefined;
  return row ? withItems([row])[0] : undefined;
}

export function getOrderByNumber(number: number): Order | undefined {
  const row = db()
    .prepare("SELECT * FROM orders WHERE number = ? ORDER BY id DESC LIMIT 1")
    .get(number) as Omit<Order, "items"> | undefined;
  return row ? withItems([row])[0] : undefined;
}

export function listTodayOrders(): Order[] {
  const rows = db()
    .prepare("SELECT * FROM orders WHERE date(created_at) = date('now') ORDER BY id DESC")
    .all() as unknown as Omit<Order, "items">[];
  return withItems(rows);
}

// Ingredients are used once an order is going to be made.
export function consumeStock(order: Order) {
  if (order.stock_consumed) return;
  const use = db().prepare(
    `UPDATE stock_items SET qty = MAX(0, qty - ?) WHERE id = ?`,
  );
  for (const item of order.items) {
    if (!item.menu_item_id) continue;
    const recipe = db()
      .prepare("SELECT stock_item_id, qty FROM recipes WHERE menu_item_id = ?")
      .all(item.menu_item_id) as { stock_item_id: number; qty: number }[];
    for (const r of recipe) use.run(r.qty * item.qty, r.stock_item_id);
  }
  db().prepare("UPDATE orders SET stock_consumed = 1 WHERE id = ?").run(order.id);
  syncAvailability();
  checkLowStock();
}

export function setStatus(order: Order, status: OrderStatus) {
  db().prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, order.id);
  if (status === "accepted" || status === "ready" || status === "done") consumeStock(getOrder(order.id)!);
}

// The time the café promised the order would be ready, e.g. when accepting a delivery order.
export function setPrepTime(order: Order, minutes: number) {
  db().prepare("UPDATE orders SET ready_at = datetime('now', ?) WHERE id = ?").run(`+${Math.round(minutes)} minutes`, order.id);
}

export function setNote(order: Order, note: string) {
  db().prepare("UPDATE orders SET note = ? WHERE id = ?").run(note, order.id);
}

// The order a spoken "accept the delivery order" means: the oldest one still waiting, optionally from one channel.
export function oldestWaiting(channel?: Channel): Order | undefined {
  return listTodayOrders()
    .filter((o) => o.status === "new" && (!channel || o.channel === channel))
    .at(-1);
}

export function markPaid(order: Order, method: PaymentMethod) {
  db()
    .prepare("UPDATE orders SET payment_status = 'paid', payment_method = ?, paid_at = datetime('now') WHERE id = ?")
    .run(method, order.id);
}

export function setStripeSession(order: Order, sessionId: string, url: string | null) {
  db()
    .prepare("UPDATE orders SET stripe_session_id = ?, stripe_url = ?, payment_status = 'pending' WHERE id = ?")
    .run(sessionId, url, order.id);
}

export function markRefunded(order: Order) {
  db().prepare("UPDATE orders SET payment_status = 'refunded' WHERE id = ?").run(order.id);
}

// ---------- approvals & activity ----------

export function createApproval(a: {
  agent: string;
  kind: Approval["kind"];
  title: string;
  detail: string;
  payload: object;
}) {
  const { lastInsertRowid } = db()
    .prepare("INSERT INTO approvals (agent, kind, title, detail, payload) VALUES (?, ?, ?, ?, ?)")
    .run(a.agent, a.kind, a.title, a.detail, JSON.stringify(a.payload));
  log(a.agent, `Needs your OK: ${a.title}`);
  return Number(lastInsertRowid);
}

export function getApproval(id: number) {
  return db().prepare("SELECT * FROM approvals WHERE id = ?").get(id) as Approval | undefined;
}

export function decideApproval(id: number, status: "approved" | "rejected") {
  db().prepare("UPDATE approvals SET status = ?, decided_at = datetime('now') WHERE id = ?").run(status, id);
}

export function listApprovals(): Approval[] {
  return db()
    .prepare("SELECT * FROM approvals WHERE status = 'pending' ORDER BY id DESC")
    .all() as unknown as Approval[];
}

export function listActivity(limit = 40): Activity[] {
  return db().prepare("SELECT * FROM activity ORDER BY id DESC LIMIT ?").all(limit) as unknown as Activity[];
}

// ---------- books ----------

export function addExpense(e: { vendor: string; category: string; total_cents: number; items: unknown[]; note?: string }) {
  db()
    .prepare("INSERT INTO expenses (vendor, category, total_cents, items, note) VALUES (?, ?, ?, ?, ?)")
    .run(e.vendor, e.category, e.total_cents, JSON.stringify(e.items), e.note ?? "");
}

export function listTodayExpenses(): Expense[] {
  return db()
    .prepare("SELECT * FROM expenses WHERE date(created_at) = date('now') ORDER BY id DESC")
    .all() as unknown as Expense[];
}

export function daySummary() {
  const orders = listTodayOrders().filter((o) => o.status !== "cancelled");
  const paid = orders.filter((o) => o.payment_status === "paid");
  const byMethod: Record<PaymentMethod, number> = { cash: 0, card: 0, online: 0, platform: 0 };
  for (const o of paid) byMethod[o.payment_method ?? "cash"] += o.total_cents;
  const unpaid = orders.filter((o) => o.payment_status !== "paid" && o.payment_status !== "refunded");
  const expenses = listTodayExpenses();
  const itemCounts = new Map<string, number>();
  for (const o of orders) for (const i of o.items) itemCounts.set(i.name, (itemCounts.get(i.name) ?? 0) + i.qty);
  const topItems = [...itemCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return {
    orders: orders.length,
    by_channel: Object.fromEntries(CHANNELS.map((c) => [c, orders.filter((o) => o.channel === c).length])) as Record<
      Channel,
      number
    >,
    revenue_cents: paid.reduce((s, o) => s + o.total_cents, 0),
    by_method_cents: byMethod,
    unpaid: unpaid.map((o) => ({ number: o.number, total_cents: o.total_cents, label: o.label })),
    expenses_cents: expenses.reduce((s, e) => s + e.total_cents, 0),
    top_items: topItems.map(([name, qty]) => ({ name, qty })),
    low_stock: listStock()
      .filter((s) => s.qty <= s.par)
      .map((s) => `${s.name} (${s.qty} ${s.unit})`),
    sold_out: listMenu()
      .filter((m) => !m.available)
      .map((m) => m.name),
  };
}
