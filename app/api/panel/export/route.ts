import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabase/server";

// CSV export of any report (opens in Excel). Amounts in rupees with 2 decimals.
const csv = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
};
const MONEY = new Set(["amount", "debit", "credit", "balance", "d0_30", "d31_60", "d60_plus", "outstanding", "overdue", "credit_limit"]);

export async function GET(req: NextRequest) {
  try { await requirePermission("reports.financial.view"); } catch { return new NextResponse("forbidden", { status: 403 }); }
  const sp = req.nextUrl.searchParams;
  const r = sp.get("r") ?? "pl", from = sp.get("from")!, to = sp.get("to")!;
  const sb = supabaseAdmin();
  const q = {
    pl: () => sb.rpc("report_profit_loss", { p_from: from, p_to: to }),
    bs: () => sb.rpc("report_balance_sheet", { p_as_of: to }),
    tb: () => sb.rpc("report_trial_balance", { p_as_of: to }),
    cf: () => sb.rpc("report_cash_flow", { p_from: from, p_to: to }),
    khata: () => sb.from("v_khata_aging").select("*"),
    payables: () => sb.from("v_payables_aging").select("*"),
    gl: () => sb.from("v_general_ledger").select("*").gte("entry_date", from).lte("entry_date", to).order("entry_no").limit(50000),
  }[r];
  if (!q) return new NextResponse("unknown report", { status: 400 });
  const { data, error } = await q();
  if (error) return new NextResponse(error.message, { status: 500 });
  const rows = ((Array.isArray(data) ? data : [data]) as Record<string, unknown>[]).map((row) =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [k, MONEY.has(k) && v != null ? (Number(v) / 100).toFixed(2) : v])));
  return new NextResponse(csv(rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="startech-${r}-${from ?? ""}-${to}.csv"` },
  });
}
