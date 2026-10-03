import { NextResponse, type NextRequest } from "next/server";
import { cronGuard } from "@/lib/cron";
import { supabaseAdmin } from "@/lib/supabase/server";
import { notifyOwner } from "@/lib/whatsapp";
import { syncBusinessProfileReviews } from "@/lib/reviews/google";
import { businessDate } from "@/lib/time";
import { formatPKR } from "@/lib/money";
import { GET as runFrequent } from "../frequent/route";

// 21:00 PKT: stock-alert digest, anomaly watch (owner only), Google reviews sync.
// DECISION: Vercel Hobby allows daily crons only, so this also runs the "frequent" tasks once a day.
// Order expiry / COD call-queue already run every 15 min inside the database (pg_cron). For
// frequent courier polling and instant critical-stock alerts, point a free pinger (e.g. cron-job.org)
// at /api/cron/frequent with header "Authorization: Bearer <CRON_SECRET>", or upgrade to Vercel Pro.
export async function GET(req: NextRequest) {
  const denied = cronGuard(req);
  if (denied) return denied;
  const frequent = await (await runFrequent(req)).json().catch(() => null);
  const sb = supabaseAdmin();
  const today = businessDate();
  const msgs: string[] = [];

  const { count: openAlerts } = await sb.from("stock_alerts").select("id", { count: "exact", head: true }).eq("status", "open");
  if (openAlerts) msgs.push(`📦 ${openAlerts} items at/below reorder level — see Inventory → Alerts.`);

  // Anomaly watch: discounts, returns, cash variance per cashier vs settings thresholds.
  const { data: setting } = await sb.from("settings").select("value").eq("key", "alerts").maybeSingle();
  const maxDiscPct = Number(setting?.value?.discount_pct ?? 15);
  const maxVar = Number(setting?.value?.cash_variance_paisa ?? 100000);
  const { data: risk } = await sb.from("v_cashier_risk").select("*").eq("business_date", today);
  for (const r of risk ?? []) {
    if (Number(r.discount_pct) > maxDiscPct) msgs.push(`🔎 ${r.full_name ?? "A cashier"} gave ${r.discount_pct}% discounts today (${formatPKR(r.discounts)}).`);
    if (Math.abs(Number(r.cash_variance)) > maxVar) msgs.push(`🔎 Cash variance ${formatPKR(r.cash_variance)} on ${r.full_name ?? "a drawer"}.`);
    if (Number(r.returns) >= 3) msgs.push(`🔎 ${r.returns} refunds by ${r.full_name ?? "a cashier"} today.`);
  }
  if (msgs.length) await notifyOwner(msgs.join("\n")).catch(() => {});

  let synced = 0;
  try { synced = await syncBusinessProfileReviews(); } catch (e) { console.error("[reviews] sync failed", e); }
  return NextResponse.json({ messages: msgs.length, reviews_synced: synced, frequent });
}
