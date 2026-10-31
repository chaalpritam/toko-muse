import type OpenAI from "openai";
import { MODELS, muse } from "./muse";
import { money } from "./format";
import { startCheckout } from "./payments";
import { CHANNEL_LABEL, sourceOf, type Channel } from "./channels";
import {
  createApproval,
  createOrder,
  daySummary,
  draftSupplierOrder,
  findMenuItem,
  findStockItem,
  getOrderByNumber,
  ingredientOut,
  oldestWaiting,
  listMenu,
  listStock,
  listTodayOrders,
  log,
  markPaid,
  restock,
  setAvailable,
  setNote,
  setPrepTime,
  setStatus,
  type OrderStatus,
} from "./store";

type ToolResult = { agent: string; result: string };
interface Ctx {
  origin: string;
}

const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_counter_order",
      description: "Ring up a walk-in or table order the owner is taking at the counter.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                item: { type: "string", description: "Menu item name as spoken" },
                qty: { type: "integer" },
                notes: { type: "string", description: "e.g. extra hot, no sugar" },
              },
              required: ["item", "qty"],
            },
          },
          label: { type: "string", description: "Table number or customer name, if given" },
          paid_with: { type: "string", enum: ["cash", "card", "not_yet"], description: "If the owner says how it was paid" },
        },
        required: ["items"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_order",
      description:
        "Move an order along: accept it (optionally promising a prep time), mark it ready, done (handed over), or cancel/reject it. Without a number, it picks the oldest order still waiting, optionally from one channel, e.g. 'accept the delivery order'.",
      parameters: {
        type: "object",
        properties: {
          number: { type: "integer" },
          channel: {
            type: "string",
            enum: ["counter", "online", "whatsapp", "delivery"],
            description: "When no number is given: which channel's waiting order. 'online' is the café's website.",
          },
          status: { type: "string", enum: ["accepted", "ready", "done", "cancelled"] },
          prep_minutes: { type: "integer", description: "When accepting: minutes until it's ready, if the owner says" },
          reason: { type: "string", description: "When cancelling or rejecting: why, if the owner says" },
        },
        required: ["status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "take_payment",
      description: "Record payment for an order. Cash is marked paid. Card shows a Stripe QR on the counter screen.",
      parameters: {
        type: "object",
        properties: {
          number: { type: "integer" },
          method: { type: "string", enum: ["cash", "card"] },
        },
        required: ["number", "method"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "request_refund",
      description: "Ask the owner to approve refunding an order.",
      parameters: {
        type: "object",
        properties: { number: { type: "integer" }, reason: { type: "string" } },
        required: ["number", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_item_available",
      description: "Take a menu item off (sold out) or put it back on the menu, online and at the counter.",
      parameters: {
        type: "object",
        properties: { item: { type: "string" }, available: { type: "boolean" } },
        required: ["item", "available"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ingredient_out",
      description: "An ingredient has run out (e.g. 'out of oat milk'). Marks every item using it sold out and drafts a reorder.",
      parameters: { type: "object", properties: { ingredient: { type: "string" } }, required: ["ingredient"] },
    },
  },
  {
    type: "function",
    function: {
      name: "restock",
      description: "Record a delivery or restock of an ingredient.",
      parameters: {
        type: "object",
        properties: { ingredient: { type: "string" }, qty: { type: "number" } },
        required: ["ingredient", "qty"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_supplier_order",
      description: "Draft a reorder to the ingredient's supplier; the owner approves before it is sent.",
      parameters: {
        type: "object",
        properties: { ingredient: { type: "string" }, qty: { type: "number" } },
        required: ["ingredient"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "day_summary",
      description: "Today's numbers: orders, revenue by payment method, unpaid orders, expenses, top sellers, low stock.",
      parameters: { type: "object", properties: {} },
    },
  },
];

async function runTool(name: string, args: Record<string, unknown>, ctx: Ctx): Promise<ToolResult> {
  switch (name) {
    case "create_counter_order": {
      const items = (args.items as { item: string; qty: number; notes?: string }[]) ?? [];
      const lines = [];
      const missing: string[] = [];
      const soldOut: string[] = [];
      for (const i of items) {
        const m = findMenuItem(i.item);
        if (!m) missing.push(i.item);
        else if (!m.available) soldOut.push(m.name);
        else lines.push({ menu_item_id: m.id, qty: i.qty, notes: i.notes });
      }
      if (missing.length || soldOut.length || !lines.length) {
        return {
          agent: "Orders",
          result: `Not created. ${missing.length ? `Not on the menu: ${missing.join(", ")}. ` : ""}${
            soldOut.length ? `Sold out: ${soldOut.join(", ")}. ` : ""
          }Menu: ${listMenu()
            .filter((m) => m.available)
            .map((m) => m.name)
            .join(", ")}`,
        };
      }
      const order = createOrder({ channel: "counter", label: String(args.label ?? ""), status: "accepted", lines });
      if (args.paid_with === "cash") markPaid(order, "cash");
      let payNote = "";
      if (args.paid_with === "card") {
        await startCheckout(order, ctx.origin, "card");
        payNote = " Card QR is on the screen.";
      }
      const summary = order.items.map((i) => `${i.qty} ${i.name}`).join(", ");
      log("Orders", `Counter order ${order.number}${order.label ? ` (${order.label})` : ""}: ${summary} — ${money(order.total_cents)}.`);
      return {
        agent: "Orders",
        result: `Order ${order.number} created: ${summary}, total ${money(order.total_cents)}, ${
          args.paid_with === "cash" ? "paid cash" : "unpaid"
        }.${payNote}`,
      };
    }
    case "update_order": {
      const channel = args.channel as Channel | undefined;
      const order = args.number ? getOrderByNumber(Number(args.number)) : oldestWaiting(channel);
      if (!order)
        return {
          agent: "Orders",
          result: args.number
            ? `No order ${args.number} today.`
            : `No ${channel ? `${CHANNEL_LABEL[channel]} ` : ""}orders waiting.`,
        };
      setStatus(order, args.status as OrderStatus);
      const prep = Number(args.prep_minutes);
      if (args.status === "accepted" && prep > 0) setPrepTime(order, prep);
      if (args.status === "cancelled" && args.reason) setNote(order, String(args.reason));
      const what = `${sourceOf(order)} order ${order.number}`;
      const detail =
        args.status === "accepted" && prep > 0
          ? `accepted, ready in ${prep} minutes`
          : args.status === "cancelled"
            ? `rejected${args.reason ? ` (${args.reason})` : ""}`
            : `now ${args.status}`;
      log("Orders", `${what} ${detail}.`);
      return { agent: "Orders", result: `${what} ${detail}.` };
    }
    case "take_payment": {
      const order = getOrderByNumber(Number(args.number));
      if (!order) return { agent: "Payments", result: `No order ${args.number} today.` };
      if (order.payment_status === "paid") return { agent: "Payments", result: `Order ${order.number} is already paid.` };
      if (args.method === "cash") {
        markPaid(order, "cash");
        log("Payments", `Order ${order.number}: ${money(order.total_cents)} cash received.`);
        return { agent: "Payments", result: `Order ${order.number} marked paid, ${money(order.total_cents)} cash.` };
      }
      await startCheckout(order, ctx.origin, "card");
      log("Payments", `Order ${order.number}: card payment QR shown for ${money(order.total_cents)}.`);
      return { agent: "Payments", result: `Card QR for ${money(order.total_cents)} is on the screen.` };
    }
    case "request_refund": {
      const order = getOrderByNumber(Number(args.number));
      if (!order) return { agent: "Payments", result: `No order ${args.number} today.` };
      if (order.payment_status !== "paid") return { agent: "Payments", result: `Order ${order.number} isn't paid, nothing to refund.` };
      createApproval({
        agent: "Payments",
        kind: "refund",
        title: `Refund order ${order.number} (${money(order.total_cents)})`,
        detail: `Reason: ${args.reason}. Paid by ${order.payment_method}.`,
        payload: { order_id: order.id },
      });
      return { agent: "Payments", result: `Refund for order ${order.number} is waiting for your approval.` };
    }
    case "set_item_available": {
      const m = findMenuItem(String(args.item));
      if (!m) return { agent: "Stock", result: `No menu item like "${args.item}".` };
      setAvailable(m.id, Boolean(args.available));
      log("Stock", `${m.name} ${args.available ? "back on" : "taken off"} the menu.`);
      return { agent: "Stock", result: `${m.name} is ${args.available ? "back on" : "off"} the menu everywhere.` };
    }
    case "ingredient_out": {
      const s = findStockItem(String(args.ingredient));
      if (!s) return { agent: "Stock", result: `I don't track "${args.ingredient}". Tracked: ${listStock().map((x) => x.name).join(", ")}` };
      const off = ingredientOut(s.id);
      log("Stock", `Out of ${s.name}. Sold out: ${off.join(", ") || "nothing on the menu uses it"}.`);
      draftSupplierOrder({ ...s, qty: 0 }, s.reorder_qty, "Suppliers");
      return {
        agent: "Stock",
        result: `Out of ${s.name}: ${off.join(", ") || "no items"} marked sold out. Reorder of ${s.reorder_qty} ${s.unit} drafted for approval.`,
      };
    }
    case "restock": {
      const s = findStockItem(String(args.ingredient));
      if (!s) return { agent: "Stock", result: `I don't track "${args.ingredient}".` };
      const back = restock(s.id, Number(args.qty));
      log("Stock", `Received ${args.qty} ${s.unit} ${s.name}.${back.length ? ` Back on the menu: ${back.join(", ")}.` : ""}`);
      return { agent: "Stock", result: `Added ${args.qty} ${s.unit} of ${s.name}.${back.length ? ` ${back.join(", ")} back on.` : ""}` };
    }
    case "draft_supplier_order": {
      const s = findStockItem(String(args.ingredient));
      if (!s) return { agent: "Suppliers", result: `I don't track "${args.ingredient}".` };
      draftSupplierOrder(s, Number(args.qty ?? s.reorder_qty), "Suppliers");
      return { agent: "Suppliers", result: `Reorder for ${s.name} drafted and waiting for your approval.` };
    }
    case "day_summary":
      return { agent: "Books", result: JSON.stringify(daySummary()) };
    default:
      return { agent: "Manager", result: `Unknown tool ${name}` };
  }
}

function snapshot() {
  const menu = listMenu()
    .map((m) => `${m.name} ${money(m.price_cents)}${m.available ? "" : " (SOLD OUT)"}`)
    .join("; ");
  const open = listTodayOrders()
    .filter((o) => o.status !== "done" && o.status !== "cancelled")
    .map(
      (o) =>
        `#${o.number} ${o.channel}${o.source ? ` via ${o.source}` : ""}${o.label ? ` ${o.label}` : ""} ${o.status} ${o.payment_status}: ${o.items
          .map((i) => `${i.qty} ${i.name}`)
          .join(", ")}`,
    )
    .join("\n");
  const low = listStock()
    .filter((s) => s.qty <= s.par)
    .map((s) => `${s.name} ${s.qty}${s.unit}`)
    .join(", ");
  return `MENU: ${menu}\nOPEN ORDERS:\n${open || "none"}\nLOW STOCK: ${low || "none"}`;
}

const SYSTEM = `You are the back-office crew of a small café run by one owner. You are the Manager: the owner talks to you hands-free while making coffee, and you act through your team's tools (Orders, Payments, Stock, Suppliers, Books).
- Orders come in from the counter, the café's website ("online"), WhatsApp and delivery apps; new ones wait in status "new" until the owner accepts or rejects them.
- Act immediately on clear instructions; don't ask for confirmation, the tools already hold anything risky for approval.
- Spoken input can mishear item names; map them to the closest menu item.
- Your reply is spoken aloud: one or two short sentences, no lists, no markdown, say amounts naturally.`;

export interface AgentTurn {
  reply: string;
  actions: { agent: string; tool: string; result: string }[];
}

export async function runManager(text: string, ctx: Ctx): Promise<AgentTurn> {
  log("Owner", text);
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: `${SYSTEM}\n\nCURRENT STATE\n${snapshot()}` },
    { role: "user", content: text },
  ];
  const actions: AgentTurn["actions"] = [];
  for (let step = 0; step < 6; step++) {
    const res = await muse().chat.completions.create({ model: MODELS.spark, messages, tools });
    const msg = res.choices[0].message;
    const calls = (msg.tool_calls ?? []).filter((c) => c.type === "function");
    if (!calls.length) {
      const reply = (msg.content ?? "").trim() || "Done.";
      log("Manager", reply);
      return { reply, actions };
    }
    messages.push(msg);
    for (const call of calls) {
      let out: ToolResult;
      try {
        out = await runTool(call.function.name, JSON.parse(call.function.arguments || "{}"), ctx);
      } catch (err) {
        out = { agent: "Manager", result: `Error: ${(err as Error).message}` };
      }
      actions.push({ agent: out.agent, tool: call.function.name, result: out.result });
      messages.push({ role: "tool", tool_call_id: call.id, content: out.result });
    }
  }
  return { reply: "I did what I could, check the screen.", actions };
}
