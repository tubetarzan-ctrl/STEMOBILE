import { NextResponse, type NextRequest } from "next/server";
import { cronGuard } from "@/lib/cron";
import { supabaseAdmin } from "@/lib/supabase/server";
import { businessDate } from "@/lib/time";
import { formatPKR } from "@/lib/money";
import { sendEmail } from "@/lib/email";
import { notifyOwner } from "@/lib/whatsapp";
import { closingReportHtml, type DailySummary } from "@/lib/reports/closing";

// 23:59 PKT (vercel.json). pg_cron also runs run_daily_closing; this route is
// idempotent and additionally sends the report email + WhatsApp brief.
export async function GET(req: NextRequest) {
  const denied = cronGuard(req);
  if (denied) return denied;
  const date = req.nextUrl.searchParams.get("date") ?? businessDate();
  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("run_daily_closing", { p_date: date });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const s = data as DailySummary;

  const { data: setting } = await sb.from("settings").select("value").eq("key", "closing").maybeSingle();
  const to = [...((setting?.value?.email_to as string[]) ?? []), setting?.value?.accountant].filter(Boolean) as string[];
  if (to.length) await sendEmail({ to, subject: `Daily closing — ${date}`, html: closingReportHtml(s) }).catch((e) => console.error(e));

  const variance = (s.drawers ?? []).reduce((a, d) => a + Number(d.variance ?? 0), 0);
  await notifyOwner(
    `🌙 StarTech ${date}\nSales ${formatPKR(s.revenue)} · GP ${formatPKR(s.gross_profit)}\n${s.sales_count} sales · ${s.repairs_delivered} repairs delivered\nExpenses ${formatPKR(s.expenses)} · Cash variance ${formatPKR(variance)}${(s.drawers ?? []).some((d) => d.not_counted) ? " ⚠️ drawer not counted" : ""}\nStock alerts: ${s.open_stock_alerts}`,
  ).catch(() => {});
  return NextResponse.json({ ok: true, date });
}
