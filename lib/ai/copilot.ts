import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { businessDate, addDays } from "@/lib/time";
import { aiConfigured, logUsage, runWithTools, type Tool } from "./llm";

// Owner Copilot (§5.16). DECISION: instead of letting the model write SQL, it
// calls a whitelisted set of read-only report functions/views with typed
// parameters and a row cap. Same answers, no injection surface.

const VIEWS = {
  daily_summary: "v_daily_summary",
  dead_stock: "v_dead_stock",
  khata_aging: "v_khata_aging",
  payables_aging: "v_payables_aging",
  cashier_risk: "v_cashier_risk",
  stock_on_hand: "v_stock_on_hand",
  reorder_suggestions: "v_reorder_suggestions",
} as const;

const TOOLS: Tool[] = [
  {
    name: "query_view",
    description: `Read rows from a whitelisted reporting view. Views: ${Object.keys(VIEWS).join(", ")}. Money columns are in paisa (divide by 100 for Rs).`,
    input_schema: {
      type: "object",
      properties: {
        view: { type: "string", enum: Object.keys(VIEWS) },
        order_by: { type: "string", description: "column name, optional" },
        descending: { type: "boolean" },
        limit: { type: "integer", description: "max 50" },
      },
      required: ["view"], additionalProperties: false,
    },
  },
  {
    name: "profit_and_loss",
    description: "Profit & loss by account between two dates (YYYY-MM-DD, Asia/Karachi). Amount in paisa: income positive, expenses negative.",
    input_schema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" } }, required: ["from", "to"], additionalProperties: false },
  },
  {
    name: "sales_by",
    description: "Sales totals grouped by channel, cashier or product between two dates.",
    input_schema: {
      type: "object",
      properties: { group: { type: "string", enum: ["channel", "cashier", "product"] }, from: { type: "string" }, to: { type: "string" } },
      required: ["group", "from", "to"], additionalProperties: false,
    },
  },
];

const handlers = {
  query_view: async (i: Record<string, unknown>) => {
    const view = VIEWS[i.view as keyof typeof VIEWS];
    if (!view) throw new Error("view not allowed");
    let q = supabaseAdmin().from(view).select("*").limit(Math.min(Number(i.limit) || 20, 50));
    if (typeof i.order_by === "string" && /^[a-z_0-9]+$/.test(i.order_by)) q = q.order(i.order_by, { ascending: !i.descending });
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data;
  },
  profit_and_loss: async (i: Record<string, unknown>) => {
    const { data, error } = await supabaseAdmin().rpc("report_profit_loss", { p_from: String(i.from), p_to: String(i.to) });
    if (error) throw new Error(error.message);
    return data;
  },
  sales_by: async (i: Record<string, unknown>) => {
    const { data, error } = await supabaseAdmin()
      .from("sales").select("channel, cashier_id, total, cost_total, discount_total, sale_items(description, qty, line_total)")
      .gte("business_date", String(i.from)).lte("business_date", String(i.to)).limit(5000);
    if (error) throw new Error(error.message);
    const agg = new Map<string, { revenue: number; cost: number; discounts: number; count: number }>();
    for (const s of data ?? []) {
      const keys = i.group === "product" ? (s.sale_items ?? []).map((x: { description: string }) => x.description) : [i.group === "channel" ? s.channel : s.cashier_id ?? "unknown"];
      for (const k of keys) {
        const a = agg.get(k) ?? { revenue: 0, cost: 0, discounts: 0, count: 0 };
        a.revenue += Number(s.total); a.cost += Number(s.cost_total); a.discounts += Number(s.discount_total); a.count += 1;
        agg.set(k, a);
      }
    }
    return [...agg.entries()].map(([k, v]) => ({ key: k, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 30);
  },
};

export async function askCopilot(question: string): Promise<{ answer: string; tools: string[] }> {
  if (!aiConfigured()) return { answer: "Owner Copilot needs AI_PROVIDER_API_KEY. Reports are available under Reports meanwhile.", tools: [] };
  const today = businessDate();
  const system = `You are Owner Copilot for StarTech Electronics. Today is ${today} (Asia/Karachi); "this week" starts ${addDays(today, -6)}.
Answer the owner's question in the language they used (English or Roman Urdu) using ONLY numbers from tool results.
Money is stored in paisa: divide by 100 and format like "Rs 12,500". Lead with the answer in one line, then up to 5 bullet points.
Mention which report the numbers come from. If the data can't answer it, say so plainly.`;
  const run = await runWithTools({ feature: "copilot", system, tools: TOOLS, handlers, messages: [{ role: "user", content: question.slice(0, 1000) }], maxTurns: 8 });
  await logUsage("copilot", "model", question, run.usage).catch(() => {});
  return { answer: run.refused ? "I can't help with that one." : run.text || "No answer — try rephrasing.", tools: run.toolCalls };
}
