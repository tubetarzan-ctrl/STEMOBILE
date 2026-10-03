import "server-only";
import { findProductsForChat, getBusiness, getDevices, getFaqs, getProducts, getRepairQuote } from "@/lib/data/store";
import type { Product, Variant } from "@/lib/data/types";
import { hasSupabase, supabaseAdmin, supabasePublic } from "@/lib/supabase/server";
import { GRADES, gradeLabel, type Grade } from "@/lib/grades";
import { formatPKR } from "@/lib/money";
import { formatPhonePK, whatsappLink } from "@/lib/utils";
import { answerFromBank } from "@/lib/ai/answer-bank";
import { aiConfigured, completeOnce, logUsage } from "@/lib/ai/llm";
import {
  REPAIR_ISSUE, UNIVERSAL, detectBrand, detectGrade, detectPart, isGreeting, isRepairIntent, isShopInfo, isThanks,
  matchDevice, norm, orderRef, repairRef, wantsHuman,
} from "./parse";

// Website chat assistant. Order of answering (cheapest + most accurate first):
//  1. rules + live database (prices, stock, repair quotes, shop info, tracking)
//  2. FAQ answer bank
//  3. ONE short AI call with retrieved context (cached), only if nothing matched
//  4. hand-off: call / WhatsApp draft, saved to the staff inbox

export type ChatCtx = { deviceId?: string; deviceName?: string; category?: string; grade?: Grade; repair?: boolean };
export type ChatItem = { title: string; sub?: string; price?: number; stock?: "in" | "low" | "out"; href?: string };
export type ChatAction = { label: string; href: string; kind?: "call" | "whatsapp" | "link" };
export type ChatReply = { text: string; items?: ChatItem[]; actions?: ChatAction[]; chips?: string[]; ctx?: ChatCtx; source: "rules" | "faq" | "ai" | "handoff"; callbackId?: string };

const CAT_LABEL: Record<string, string> = {
  displays: "screen / LCD", batteries: "battery", "back-glass": "back glass", "charging-ports": "charging port", cameras: "camera",
  cases: "case", "screen-protectors": "tempered glass", chargers: "charger", cables: "cable", audio: "earphones", "power-banks": "power bank", tools: "tools",
};
const POPULAR = ["iPhone 13", "iPhone 14 Pro Max", "Galaxy A54", "Redmi Note 12"];

function stockText(v: Variant): string {
  return v.stock === "out" ? "out of stock" : v.stock === "low" ? `only ${v.low_qty || "a few"} left` : "in stock";
}

// --- AI answer cache + daily cap (keeps OpenAI usage minimal) ----------------
const aiCache = new Map<string, { at: number; reply: string }>();
let aiDay = "", aiCount = 0;
const AI_DAILY_LIMIT = Number(process.env.AI_CHAT_DAILY_LIMIT ?? 200);

export async function answerChat(message: string, ctxIn: ChatCtx = {}): Promise<ChatReply> {
  const text = message.trim().slice(0, 500);
  const biz = await getBusiness();
  const phone = formatPhonePK(biz.phone);

  const handoff = async (lead: string): Promise<ChatReply> => {
    let callbackId: string | undefined;
    if (hasSupabase && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { data } = await supabaseAdmin().from("inquiries").insert({ kind: "chat", message: text, meta: { source: "website_chat" } }).select("id").single();
      callbackId = data?.id;
    }
    return {
      text: `${lead} Please call or WhatsApp us on ${phone} — our team will answer right away. I've prepared a WhatsApp message for you.`,
      actions: [
        { label: `Call ${phone}`, href: `tel:${biz.phone}`, kind: "call" },
        { label: "Send on WhatsApp", href: whatsappLink(biz.whatsapp, `Hi StarTech, I have a question: ${text}`), kind: "whatsapp" },
      ],
      source: "handoff",
      callbackId,
    };
  };

  if (!text) return { text: "Tell me how I can help you — e.g. a part price, stock, or a repair quote.", chips: ["iPhone 13 screen price", "Repair quote", "Shop timing & location"], source: "rules" };
  if (isGreeting(text)) return { text: "Wa Alaikum Assalam! 👋 Tell me how I can help you. I can check live prices and stock, give repair quotes, or share our timing and location.", chips: ["iPhone 13 screen price", "Galaxy A54 battery in stock?", "Repair quote", "Shop timing & location"], source: "rules" };
  if (isThanks(text)) return { text: "You're welcome! Anything else I can check for you?", source: "rules" };
  if (wantsHuman(text)) return handoff("Sure — let me connect you with our team.");

  // Tracking
  const oref = orderRef(text);
  if (oref) return { text: `To see order ${oref}, open the tracking link we sent on WhatsApp after you ordered. If you can't find it, our team can check for you.`, actions: [{ label: "Ask on WhatsApp", href: whatsappLink(biz.whatsapp, `Hi StarTech, please share the status of my order ${oref}.`), kind: "whatsapp" }], source: "rules" };
  const rref = repairRef(text);
  if (rref && hasSupabase) {
    const { data } = await supabasePublic().rpc("track_repair", { p_ref: rref });
    const j = data as null | { job_no: string; device: string; status: string };
    if (j) return { text: `Repair ${j.job_no} (${j.device}) is currently: **${j.status.replace(/_/g, " ")}**.`, actions: [{ label: "Open live tracker", href: `/track/${rref}`, kind: "link" }], source: "rules" };
  }

  // Understand the question
  const devices = await getDevices();
  const dm = matchDevice(text, devices);
  // Short follow-up about the previous answer ("oem wala", "original?", "repair kitne ki?")
  const followUp = !dm.device && !dm.near && !detectPart(text) && !!ctxIn.deviceId && !!ctxIn.category &&
    (!!detectGrade(text) || isRepairIntent(text) || /\b(price|kitne|kitna|kitni|available|stock|hai|ha|and|aur|wala|wali)\b/.test(norm(text)));
  const part = detectPart(text) ?? (dm.device || dm.near || followUp ? ctxIn.category : undefined);
  const grade = detectGrade(text) ?? (part === ctxIn.category ? ctxIn.grade : undefined);
  const repair = isRepairIntent(text) || (!!ctxIn.repair && !detectPart(text) && (!!dm.device || followUp));
  const device = dm.device ?? (part && !dm.near && ctxIn.deviceId ? devices.find((d) => d.id === ctxIn.deviceId) : undefined);

  // Shop info (only when it's not a product question)
  if (!device && !part && isShopInfo(text)) {
    return {
      text: `📍 **${biz.name}**\n${biz.address}\n🕐 ${biz.hours}\n📞 ${phone}`,
      actions: [{ label: "Get directions", href: biz.map_url, kind: "link" }, { label: `Call ${phone}`, href: `tel:${biz.phone}`, kind: "call" }],
      source: "rules",
    };
  }

  // Model we don't list (e.g. "iPhone 15 Pro")
  if (dm.near && !dm.device) {
    const h = await handoff(`We don't have the **${dm.near}** listed in our online catalogue yet, so I can't confirm the price or stock.`);
    return { ...h, chips: dm.suggestions?.map((d) => `${d.name} ${CAT_LABEL[part ?? "displays"] ?? ""} price`.trim()), ctx: { category: part, grade, repair } };
  }

  // FAQ first when no phone model is involved
  if (!device) {
    const faqs = await getFaqs();
    const hit = answerFromBank(text, faqs.map((f) => ({ q: f.q_en, a: f.a_en })));
    if (hit && (!part || hit.score >= 0.9)) {
      await logUsage("chat", "faq", text).catch(() => {});
      return { text: hit.answer, source: "faq" };
    }
  }

  // Universal accessories need no model
  if (part && UNIVERSAL.has(part)) {
    const products = await findProductsForChat(part);
    if (!products.length) return handoff(`I couldn't find ${CAT_LABEL[part]}s in stock online right now.`);
    return productReply(products, `Here are our ${CAT_LABEL[part]}s:`, grade, { category: part });
  }

  // Part but no model → ask which phone
  if (part && !device) {
    const brand = detectBrand(text, devices);
    const chips = (brand ? devices.filter((d) => d.brand === brand).map((d) => d.name) : POPULAR).slice(0, 6);
    return { text: `Sure! Which phone model is the ${CAT_LABEL[part] ?? "part"} for?${brand ? "" : " e.g. iPhone 13 or Galaxy A54."}`, chips, ctx: { category: part, grade, repair }, source: "rules" };
  }

  if (device) {
    const ctx: ChatCtx = { deviceId: device.id, deviceName: device.name, category: part, grade, repair };

    // Repair quote
    if (repair) {
      const issue = part ? REPAIR_ISSUE[part] : undefined;
      if (!issue) return { text: `What needs fixing on your ${device.name}?`, chips: [`${device.name} screen repair`, `${device.name} battery change`, `${device.name} charging port repair`], ctx: { ...ctx, repair: true }, source: "rules" };
      const rows = await getRepairQuote(device.id, issue);
      if (!rows.length) return handoff(`I don't have a fixed price for a ${device.name} ${issue.replace("_", " ")} repair — it needs a quick check by our technician.`);
      const pick = grade ? rows.filter((r) => r.grade === grade) : rows;
      return {
        text: `${device.name} ${issue.replace("_", " ")} repair — price includes the part and fitting:${grade && !pick.length ? ` (we don't have ${gradeLabel(grade)} for this model; other grades below)` : ""}`,
        items: (pick.length ? pick : rows).map((r) => ({
          title: gradeLabel(r.grade) || "Repair", price: r.total,
          sub: `~${r.est_minutes} min · ${r.warranty_days}-day warranty · ${r.in_stock ? "part in stock" : "part arrives in 1–3 days"}`,
          stock: r.in_stock ? "in" : "out",
        })),
        actions: [{ label: "Book this repair", href: `/repair?device=${device.id}&issue=${issue}`, kind: "link" }],
        ctx, source: "rules",
      };
    }

    // Part price + live stock
    if (part) {
      const products = await findProductsForChat(part, device.id);
      if (!products.length) return handoff(`We don't currently list a ${CAT_LABEL[part]} for the ${device.name}.`);
      return productReply(products, "", grade, ctx, device.name);
    }

    // Model only → what we have for it
    const cards = (await getProducts({ device: device.id, limit: 40 })).filter((c) => c.fit === "exact" || c.fit === "check_version");
    if (!cards.length) return handoff(`I don't have parts listed for the ${device.name} yet.`);
    return {
      text: `Here's what we have for the **${device.name}**. Which part do you need?`,
      items: cards.slice(0, 6).map((c) => ({ title: c.name, price: c.from_price, sub: c.grades.length > 1 ? "from" : undefined, stock: c.stock, href: `/shop/${c.slug}` })),
      chips: [`${device.name} screen price`, `${device.name} battery price`, `${device.name} screen repair`],
      ctx, source: "rules",
    };
  }

  // Last resort: one short AI call with retrieved context (cached)
  if (aiConfigured()) {
    const key = norm(text);
    const cached = aiCache.get(key);
    if (cached && Date.now() - cached.at < 6 * 3600e3) return cached.reply === "HANDOFF" ? handoff("I'm not sure about that one.") : { text: cached.reply, source: "ai" };
    const today = new Date().toISOString().slice(0, 10);
    if (aiDay !== today) { aiDay = today; aiCount = 0; }
    if (aiCount < AI_DAILY_LIMIT) {
      aiCount++;
      try {
        const [faqs, hits] = await Promise.all([getFaqs(), getProducts({ q: text, limit: 5 })]);
        const context = [
          `SHOP: ${biz.name}, ${biz.address}. Hours: ${biz.hours}. Phone/WhatsApp: ${phone}. Services: iPhone & Android repairs, screen replacements, battery and charging-port fixes, complex hardware faults like Wi-Fi IC repair.`,
          ...faqs.map((f) => `FAQ: ${f.q_en} — ${f.a_en}`),
          ...hits.map((h) => `PRODUCT: ${h.name} — from ${formatPKR(h.from_price)} — ${h.stock === "out" ? "out of stock" : "in stock"}`),
        ].join("\n");
        const { text: out, usage } = await completeOnce(
          "You are StarTech Electronics' website assistant in Karachi. Answer ONLY from the CONTEXT. If the CONTEXT does not fully answer the question, reply with exactly: HANDOFF. Never invent prices, stock, models or policies. Reply in the user's language (English, Urdu or Roman Urdu) in at most 3 short sentences.",
          `CONTEXT:\n${context}\n\nQUESTION: ${text}`, 220,
        );
        await logUsage("chat", "model", text, usage).catch(() => {});
        const reply = !out || /HANDOFF/i.test(out) ? "HANDOFF" : out;
        aiCache.set(key, { at: Date.now(), reply });
        if (aiCache.size > 500) aiCache.delete(aiCache.keys().next().value!);
        if (reply !== "HANDOFF") return { text: reply, source: "ai" };
      } catch { /* fall through to hand-off */ }
    }
  }
  return handoff("I don't have an exact answer for that.");
}

function productReply(products: Product[], lead: string, grade: Grade | undefined, ctx: ChatCtx, deviceName?: string): ChatReply {
  const p = products[0];
  const rank = (v: Variant) => GRADES[v.grade as Exclude<Grade, "NA">]?.rank ?? 9;
  const variants = [...p.variants].sort((a, b) => rank(a) - rank(b) || a.sale_price - b.sale_price);
  const wanted = grade ? variants.filter((v) => v.grade === grade) : variants;
  const shown = wanted.length ? wanted : variants;

  let summary = lead;
  if (!lead) {
    if (grade && wanted.length) {
      const v = wanted[0];
      summary = v.stock === "out"
        ? `Sorry — the **${gradeLabel(v.grade)}** ${p.name} is **out of stock** right now (${formatPKR(v.sale_price)}).`
        : `Yes! The **${gradeLabel(v.grade)}** ${p.name} is **${stockText(v)}** — **${formatPKR(v.sale_price)}**${v.warranty_days ? ` with ${v.warranty_days}-day warranty` : ""}.`;
    } else if (grade) {
      summary = `We don't have a **${gradeLabel(grade)}** option for ${deviceName ? `the ${deviceName}` : "this"}. Here's what we do have:`;
    } else {
      const inStock = variants.filter((v) => v.stock !== "out").length;
      summary = `**${p.name}** — ${inStock ? `${inStock} option${inStock > 1 ? "s" : ""} in stock` : "currently out of stock"}:`;
    }
  }
  const items: ChatItem[] = shown.map((v) => ({
    title: gradeLabel(v.grade) || [p.name, ...Object.values(v.attributes)].join(" · "),
    sub: `${v.stock === "out" ? "Out of stock" : v.stock === "low" ? `Only ${v.low_qty || "a few"} left` : "In stock"}${v.warranty_days ? ` · ${v.warranty_days}-day warranty` : ""}`,
    price: v.sale_price, stock: v.stock, href: `/shop/${p.slug}`,
  }));
  // more products in the same category (e.g. several chargers)
  for (const other of products.slice(1, 5)) {
    const cheapest = [...other.variants].sort((a, b) => a.sale_price - b.sale_price)[0];
    items.push({ title: other.name, sub: cheapest.stock === "out" ? "Out of stock" : "In stock", price: cheapest.sale_price, stock: cheapest.stock, href: `/shop/${other.slug}` });
  }
  return {
    text: summary, items: items.slice(0, 8),
    actions: [{ label: "View & order", href: `/shop/${p.slug}`, kind: "link" }],
    chips: deviceName && ctx.category && REPAIR_ISSUE[ctx.category] ? [`${deviceName} ${CAT_LABEL[ctx.category]} repair price`] : undefined,
    ctx, source: "rules",
  };
}
