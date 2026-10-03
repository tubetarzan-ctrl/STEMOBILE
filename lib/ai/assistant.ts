import "server-only";
import { getDevices, getFaqs, getProduct, getProducts, getRepairQuote } from "@/lib/data/store";
import { hasSupabase, supabasePublic } from "@/lib/supabase/server";
import { formatPKR } from "@/lib/money";
import { gradeLabel } from "@/lib/grades";
import { answerFromBank, needsLiveData } from "./answer-bank";
import { aiConfigured, logUsage, runWithTools, type Tool } from "./llm";

const SYSTEM = `You are the StarTech Electronics shop assistant (Shop # 1F, Sarena Family Market and Mobile Mall, Roundabout, Sakhi Hassan, Sector 15-A-1, Buffer Zone, Karachi — phone parts, accessories and repairs: iPhone and Android repairs, screen replacements, complex hardware faults such as Wi-Fi IC repair). Shop hours: Monday–Saturday 1:00 PM to 12:00 AM, closed Sunday. Phone/WhatsApp: +92 332 2142141.
Reply in the customer's language: English, Urdu script, or Roman Urdu — match how they wrote.
Rules:
- Prices, stock and order status come ONLY from tool results. Never guess a price or say something is in stock without a tool result.
- Always state the part grade (Original New / Original Pulled / OEM / Premium Copy / Standard Copy) next to a price.
- Prices are in PKR, formatted like "Rs 12,500".
- Keep replies short (2–5 lines), friendly, practical. Offer the product link when you have one.
- If tools can't answer, or the customer wants a person, a refund, or has a complaint, reply exactly: HANDOFF`;

const TOOLS: Tool[] = [
  {
    name: "search_products",
    description: "Search the live catalogue. Use for any price or availability question. Returns name, grades, from-price, stock and link.",
    input_schema: { type: "object", properties: { query: { type: "string", description: "e.g. 'iphone 12 display' or 'a54 battery'" } }, required: ["query"], additionalProperties: false },
  },
  {
    name: "product_details",
    description: "All variants (grade, price, stock, warranty) of one product by slug from search_products.",
    input_schema: { type: "object", properties: { slug: { type: "string" } }, required: ["slug"], additionalProperties: false },
  },
  {
    name: "repair_quote",
    description: "Repair price per grade for a phone model and issue (screen, battery, charging_port).",
    input_schema: {
      type: "object",
      properties: { model: { type: "string", description: "Phone model name, e.g. 'Galaxy A54'" }, issue: { type: "string", enum: ["screen", "battery", "charging_port"] } },
      required: ["model", "issue"], additionalProperties: false,
    },
  },
  {
    name: "order_status",
    description: "Status of an online order (order number like ST-000123) or repair (tracking ref).",
    input_schema: { type: "object", properties: { reference: { type: "string" } }, required: ["reference"], additionalProperties: false },
  },
];

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "";

const handlers = {
  search_products: async (i: Record<string, unknown>) => {
    const r = await getProducts({ q: String(i.query ?? ""), limit: 6 });
    return r.map((p) => ({ name: p.name, grades: p.grades.map(gradeLabel), from: formatPKR(p.from_price), stock: p.stock, link: `${SITE}/shop/${p.slug}`, slug: p.slug }));
  },
  product_details: async (i: Record<string, unknown>) => {
    const p = await getProduct(String(i.slug ?? ""));
    if (!p) return { error: "not found" };
    return { name: p.name, link: `${SITE}/shop/${p.slug}`, variants: p.variants.map((v) => ({ grade: gradeLabel(v.grade) || "—", price: formatPKR(v.sale_price), stock: v.stock, warranty_days: v.warranty_days })) };
  },
  repair_quote: async (i: Record<string, unknown>) => {
    const name = String(i.model ?? "").toLowerCase();
    const d = (await getDevices()).find((x) => `${x.brand} ${x.name}`.toLowerCase().includes(name) || x.name.toLowerCase() === name);
    if (!d) return { error: "model not in price list — suggest a free diagnosis at the shop" };
    const rows = await getRepairQuote(d.id, String(i.issue));
    return { device: d.name, options: rows.map((r) => ({ grade: gradeLabel(r.grade), total: formatPKR(r.total), minutes: r.est_minutes, warranty_days: r.warranty_days, part_in_stock: r.in_stock })) };
  },
  order_status: async (i: Record<string, unknown>) => {
    if (!hasSupabase) return { error: "tracking unavailable in demo" };
    const ref = String(i.reference ?? "").trim().toUpperCase();
    const { data } = await supabasePublic().rpc("track_repair", { p_ref: ref });
    if (data) return { kind: "repair", status: (data as { status: string }).status, link: `${SITE}/track/${ref}` };
    return { note: "For order status, open the tracking link from your WhatsApp confirmation", link: `${SITE}/track` };
  },
};

export type AssistantReply = { reply: string; handoff: boolean; source: "faq" | "model" | "handoff" | "fallback" };

export async function askAssistant(question: string, history: { role: "user" | "assistant"; content: string }[] = []): Promise<AssistantReply> {
  const q = question.trim().slice(0, 800);
  if (!q) return { reply: "", handoff: false, source: "fallback" };

  // 1) Answer bank (FAQ Manager) — free.
  if (!needsLiveData(q)) {
    const faqs = await getFaqs();
    const hit = answerFromBank(q, faqs.map((f) => ({ q: f.q_en, a: f.a_en })));
    if (hit) {
      await logUsage("assistant", "faq", q).catch(() => {});
      return { reply: hit.answer, handoff: false, source: "faq" };
    }
  }

  // 2) No model configured → deterministic search fallback.
  if (!aiConfigured()) {
    const results = await handlers.search_products({ query: q });
    if (results.length === 0) return { reply: "I couldn't find that — a team member will reply on WhatsApp shortly.", handoff: true, source: "handoff" };
    return {
      reply: results.slice(0, 3).map((r) => `• ${r.name} — ${r.from}${r.grades.length ? ` (${r.grades.join(", ")})` : ""} — ${r.stock === "out" ? "out of stock" : "in stock"}\n  ${r.link}`).join("\n"),
      handoff: false, source: "fallback",
    };
  }

  // 3) AI model with live-data tools.
  const run = await runWithTools({
    feature: "assistant", system: SYSTEM, tools: TOOLS, handlers,
    messages: [...history.slice(-8).map((m) => ({ role: m.role, content: m.content })), { role: "user", content: q }],
  });
  await logUsage("assistant", "model", q, run.usage).catch(() => {});
  if (run.refused || !run.text || run.text.includes("HANDOFF")) {
    await logUsage("assistant", "handoff", q).catch(() => {});
    return { reply: "Let me get a team member for you — we'll reply here shortly.", handoff: true, source: "handoff" };
  }
  return { reply: run.text, handoff: false, source: "model" };
}
