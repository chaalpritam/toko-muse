import type OpenAI from "openai";
import { db } from "./db";
import { MODELS, askJson, muse } from "./muse";
import { money } from "./format";
import { findMenuItem, listMenu, listStock, log } from "./store";
import { getShop, setStage, updateShop } from "./shop";
import type { AgentTurn } from "./agent";

// The Setup agent: the owner unboxes the device and builds their shop by talking to it.

const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "set_shop_details",
      description: "Save details about the café. Only pass what the owner said.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "The café's name" },
          tagline: { type: "string", description: "One line about the café" },
          about: { type: "string", description: "A short paragraph about the café, in the owner's words" },
          address: { type: "string" },
          hours: { type: "string", description: "Opening hours, e.g. 'Mon–Fri 7am–3pm, Sat 8am–2pm'" },
          phone: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_menu_items",
      description:
        "Add or update items on the menu. Saving an item that already exists updates it. Ingredients let the crew track stock; for pastries or anything sold whole from the display case, the item itself is the ingredient (1 pc).",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                category: { type: "string", description: "e.g. Coffee, Tea, Bakery, Kitchen, Drinks" },
                price: { type: "number", description: "Price in the café's currency, e.g. 4.5" },
                description: { type: "string", description: "Short menu description" },
                display_case: { type: "boolean", description: "Sold from the pastry/display case" },
                ingredients: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string", description: "e.g. oat milk" },
                      per_serving: { type: "number", description: "Amount used per item, e.g. 0.25" },
                      unit: { type: "string", description: "e.g. L, kg, g, pc, slice" },
                    },
                    required: ["name", "per_serving", "unit"],
                  },
                },
              },
              required: ["name", "category", "price"],
            },
          },
        },
        required: ["items"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remove_menu_item",
      description: "Take an item off the menu for good.",
      parameters: { type: "object", properties: { item: { type: "string" } }, required: ["item"] },
    },
  },
  {
    type: "function",
    function: {
      name: "set_stock",
      description: "Set how much of an ingredient the café has on hand right now.",
      parameters: {
        type: "object",
        properties: { ingredient: { type: "string" }, qty: { type: "number" }, unit: { type: "string" } },
        required: ["ingredient", "qty"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_supplier",
      description: "Save a supplier and which ingredients they deliver, so the crew can draft reorders to them.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          supplies: { type: "array", items: { type: "string" }, description: "Ingredient names" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "launch_store",
      description: "Publish the café's online store and switch the device to running the shop. Only when the owner agrees.",
      parameters: { type: "object", properties: {} },
    },
  },
];

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// New ingredients start with enough for about 40 servings until the owner gives real counts.
const STARTING_SERVINGS = 40;
const PAR_SERVINGS = 10;

function ensureStockItem(name: string, unit: string, perServing: number) {
  const existing = listStock().find((s) => same(s.name, name));
  if (existing) return existing.id;
  const { lastInsertRowid } = db()
    .prepare("INSERT INTO stock_items (name, unit, qty, par, reorder_qty) VALUES (?, ?, ?, ?, ?)")
    .run(name.trim().toLowerCase(), unit, perServing * STARTING_SERVINGS, perServing * PAR_SERVINGS, perServing * STARTING_SERVINGS);
  return Number(lastInsertRowid);
}

interface NewItem {
  name: string;
  category: string;
  price: number;
  description?: string;
  display_case?: boolean;
  ingredients?: { name: string; per_serving: number; unit: string }[];
}

function addMenuItems(items: NewItem[]) {
  const saved: string[] = [];
  for (const i of items) {
    const cents = Math.round(Number(i.price) * 100);
    if (!i.name?.trim() || !(cents > 0)) continue;
    const existing = listMenu().find((m) => same(m.name, i.name));
    let id: number;
    if (existing) {
      db()
        .prepare("UPDATE menu_items SET category = ?, price_cents = ?, description = ?, in_case = ?, available = 1 WHERE id = ?")
        .run(i.category, cents, i.description ?? existing.description, i.display_case ? 1 : 0, existing.id);
      id = existing.id;
    } else {
      const { lastInsertRowid } = db()
        .prepare("INSERT INTO menu_items (name, category, price_cents, description, in_case) VALUES (?, ?, ?, ?, ?)")
        .run(i.name.trim(), i.category, cents, i.description ?? "", i.display_case ? 1 : 0);
      id = Number(lastInsertRowid);
    }
    if (i.ingredients?.length) {
      db().prepare("DELETE FROM recipes WHERE menu_item_id = ?").run(id);
      const ins = db().prepare("INSERT OR REPLACE INTO recipes (menu_item_id, stock_item_id, qty) VALUES (?, ?, ?)");
      for (const g of i.ingredients) {
        if (!g.name?.trim() || !(g.per_serving > 0)) continue;
        ins.run(id, ensureStockItem(g.name, g.unit || "pc", g.per_serving), g.per_serving);
      }
    }
    saved.push(`${i.name.trim()} ${money(cents)}`);
  }
  return saved;
}

async function launchStore() {
  const shop = getShop();
  const menu = listMenu();
  if (!shop.name) return "Can't launch yet: the café has no name.";
  if (!menu.length) return "Can't launch yet: the menu is empty.";
  if (!shop.tagline || !shop.about) {
    // The store's front page copy, written from what the owner told us.
    const copy = await askJson<{ tagline: string; about: string }>(
      `Write the front page copy for an independent café's online store.
Café: ${shop.name}. ${shop.tagline} ${shop.about}
Address: ${shop.address || "unknown"}. Hours: ${shop.hours || "unknown"}.
Menu: ${menu.map((m) => `${m.name} (${m.category})`).join(", ")}.
Return {"tagline": "one warm line, max 10 words", "about": "two short sentences, plain and specific, no clichés"}.
Don't invent facts beyond what's given.`,
    );
    updateShop({ tagline: shop.tagline || copy.tagline, about: shop.about || copy.about });
  }
  setStage("live");
  log("Setup", `${shop.name} is open. The store is live at /s/${getShop().slug}.`);
  return `Store launched at /s/${getShop().slug}. The device now shows its QR code and runs the shop.`;
}

async function runTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "set_shop_details": {
      const shop = updateShop(args as Record<string, string>);
      const saved = Object.keys(args).filter((k) => args[k]);
      if (saved.length) log("Setup", `Saved ${saved.join(", ")}${args.name ? `: ${shop.name}` : ""}.`);
      return `Saved. Shop is now: ${JSON.stringify({ name: shop.name, tagline: shop.tagline, address: shop.address, hours: shop.hours })}`;
    }
    case "add_menu_items": {
      if (getShop().stage === "new") setStage("setup");
      const saved = addMenuItems((args.items as NewItem[]) ?? []);
      if (!saved.length) return "Nothing saved: every item needs a name and a price.";
      log("Setup", `Menu: ${saved.join(", ")}.`);
      return `Saved ${saved.join(", ")}. New ingredients start with stock for about ${STARTING_SERVINGS} servings until the owner gives real counts.`;
    }
    case "remove_menu_item": {
      const m = findMenuItem(String(args.item));
      if (!m) return `No menu item like "${args.item}".`;
      const used = db().prepare("SELECT COUNT(*) AS n FROM order_items WHERE menu_item_id = ?").get(m.id) as { n: number };
      db().prepare("DELETE FROM recipes WHERE menu_item_id = ?").run(m.id);
      if (used.n) db().prepare("UPDATE menu_items SET available = 0 WHERE id = ?").run(m.id);
      else db().prepare("DELETE FROM menu_items WHERE id = ?").run(m.id);
      log("Setup", `Removed ${m.name} from the menu.`);
      return `${m.name} removed.`;
    }
    case "set_stock": {
      const ingredient = String(args.ingredient);
      const qty = Number(args.qty);
      const s = listStock().find((x) => same(x.name, ingredient));
      if (s) db().prepare("UPDATE stock_items SET qty = ? WHERE id = ?").run(qty, s.id);
      else
        db()
          .prepare("INSERT INTO stock_items (name, unit, qty, par, reorder_qty) VALUES (?, ?, ?, ?, ?)")
          .run(ingredient.trim().toLowerCase(), String(args.unit ?? "pc"), qty, qty / 4, qty);
      log("Setup", `Stock: ${qty} ${s?.unit ?? args.unit ?? ""} ${ingredient}.`);
      return `${ingredient} set to ${qty} ${s?.unit ?? args.unit ?? ""}.`;
    }
    case "add_supplier": {
      const { lastInsertRowid } = db()
        .prepare("INSERT INTO suppliers (name, email, phone) VALUES (?, ?, ?)")
        .run(String(args.name), (args.email as string) ?? null, (args.phone as string) ?? null);
      const linked: string[] = [];
      for (const ing of (args.supplies as string[]) ?? []) {
        const s = listStock().find((x) => same(x.name, ing));
        if (!s) continue;
        db().prepare("UPDATE stock_items SET supplier_id = ? WHERE id = ?").run(lastInsertRowid, s.id);
        linked.push(s.name);
      }
      log("Setup", `Supplier ${args.name}${linked.length ? ` delivers ${linked.join(", ")}` : ""}.`);
      return `Supplier ${args.name} saved${linked.length ? `, linked to ${linked.join(", ")}` : ""}.`;
    }
    case "launch_store":
      return launchStore();
    default:
      return `Unknown tool ${name}`;
  }
}

function snapshot() {
  const shop = getShop();
  const recipes = db()
    .prepare(
      `SELECT r.menu_item_id, s.name, r.qty, s.unit FROM recipes r JOIN stock_items s ON s.id = r.stock_item_id`,
    )
    .all() as { menu_item_id: number; name: string; qty: number; unit: string }[];
  const menu = listMenu()
    .map((m) => {
      const uses = recipes.filter((r) => r.menu_item_id === m.id).map((r) => `${r.qty}${r.unit} ${r.name}`);
      return `${m.name} (${m.category}) ${money(m.price_cents)}${uses.length ? ` uses ${uses.join(", ")}` : ""}`;
    })
    .join("; ");
  const suppliers = (db().prepare("SELECT name FROM suppliers").all() as { name: string }[]).map((s) => s.name);
  const missing = [
    !shop.name && "café name",
    !listMenu().length && "menu items with prices",
    !shop.hours && "opening hours",
    !shop.address && "address",
  ].filter(Boolean);
  return `SHOP: ${JSON.stringify({ name: shop.name, tagline: shop.tagline, address: shop.address, hours: shop.hours, phone: shop.phone })}
MENU: ${menu || "empty"}
SUPPLIERS: ${suppliers.join(", ") || "none"}
STILL NEEDED BEFORE LAUNCH: ${missing.join(", ") || "nothing, ready to launch"}`;
}

const SYSTEM = `You are Toko, a voice assistant built into a small device on a café counter. The owner has just unboxed you and is setting up their shop by talking to you. Walk them through it, one topic at a time:
1. The café's name, and a line about it if they offer one.
2. What they sell and the prices. Save items as soon as you hear them. For drinks and food, briefly ask the main ingredients so you can track stock; skip it if they'd rather not.
3. Opening hours and address.
4. Optionally, who supplies their main ingredients.
Then offer to launch the online store, and launch it when they agree. They can say "launch" at any time once there's a name and a menu.
- Save everything with your tools right away. Never invent prices or details.
- Spoken input can mishear words; use common sense for café items.
- Your reply is spoken aloud: one or two short sentences, ending with the next question. No lists, no markdown, say prices naturally.`;

function history(): OpenAI.Chat.ChatCompletionMessageParam[] {
  const rows = db().prepare("SELECT role, text FROM conversation ORDER BY id DESC LIMIT 16").all() as {
    role: "user" | "assistant";
    text: string;
  }[];
  return rows.reverse().map((r) => ({ role: r.role, content: r.text }));
}

function remember(role: "user" | "assistant", text: string) {
  db().prepare("INSERT INTO conversation (role, text) VALUES (?, ?)").run(role, text);
}

export async function runSetup(text: string): Promise<AgentTurn> {
  log("Owner", text);
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: `${SYSTEM}\n\nWHAT'S SET UP SO FAR\n${snapshot()}` },
    ...history(),
    { role: "user", content: text },
  ];
  remember("user", text);
  const actions: AgentTurn["actions"] = [];
  for (let step = 0; step < 6; step++) {
    const res = await muse().chat.completions.create({ model: MODELS.spark, messages, tools });
    const msg = res.choices[0].message;
    const calls = (msg.tool_calls ?? []).filter((c) => c.type === "function");
    if (!calls.length) {
      const reply = (msg.content ?? "").trim() || "Got it.";
      remember("assistant", reply);
      return { reply, actions };
    }
    messages.push(msg);
    for (const call of calls) {
      let result: string;
      try {
        result = await runTool(call.function.name, JSON.parse(call.function.arguments || "{}"));
      } catch (err) {
        result = `Error: ${(err as Error).message}`;
      }
      actions.push({ agent: "Setup", tool: call.function.name, result });
      messages.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }
  return { reply: "I saved what I could. What's next?", actions };
}
