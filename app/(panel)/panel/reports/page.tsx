import { Fragment } from "react";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabase/server";
import { formatPKR } from "@/lib/money";
import { addDays, businessDate } from "@/lib/time";
import { PageHead } from "@/components/panel/ui";
import { cn } from "@/lib/utils";

const TABS = [["pl", "Profit & loss"], ["bs", "Balance sheet"], ["tb", "Trial balance"], ["cf", "Cash flow"], ["eq", "Changes in equity"], ["khata", "Khata aging"], ["payables", "Payables"]] as const;

type SP = Promise<{ r?: string; from?: string; to?: string }>;

export default async function ReportsPage({ searchParams }: { searchParams: SP }) {
  await requirePermission("reports.financial.view", "redirect");
  const sp = await searchParams;
  const r = sp.r ?? "pl";
  const to = sp.to ?? businessDate();
  const from = sp.from ?? `${to.slice(0, 7)}-01`;
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 864e5);
  const prevTo = addDays(from, -1), prevFrom = addDays(prevTo, -days);
  const sb = supabaseAdmin();
  const qs = (patch: Record<string, string>) => `/panel/reports?${new URLSearchParams({ r, from, to, ...patch })}`;

  return (
    <div className="space-y-6">
      <PageHead title="Reports" sub="Live from the ledger. Every figure drills down to journal lines.">
        <a href={`/api/panel/export?r=${r}&from=${from}&to=${to}`} className="btn btn-ghost btn-sm">Export CSV</a>
      </PageHead>
      <nav className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(([k, l]) => <Link key={k} href={qs({ r: k })} className={cn("whitespace-nowrap border-b-2 px-4 py-2 text-sm", r === k ? "border-accent" : "border-transparent text-ink-3 hover:text-ink")}>{l}</Link>)}
      </nav>
      <form className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="r" value={r} />
        {!["bs", "tb"].includes(r) && <label className="space-y-1"><span className="label">From</span><input type="date" name="from" defaultValue={from} className="input h-10" /></label>}
        <label className="space-y-1"><span className="label">{["bs", "tb"].includes(r) ? "As of" : "To"}</span><input type="date" name="to" defaultValue={to} className="input h-10" /></label>
        <button className="btn btn-ghost btn-sm">Apply</button>
      </form>

      {r === "pl" && <ProfitLoss sb={sb} from={from} to={to} prevFrom={prevFrom} prevTo={prevTo} />}
      {r === "bs" && <BalanceSheet sb={sb} asOf={to} />}
      {r === "tb" && <TrialBalance sb={sb} asOf={to} />}
      {r === "cf" && <CashFlow sb={sb} from={from} to={to} />}
      {r === "eq" && <Equity sb={sb} from={from} to={to} />}
      {r === "khata" && <Khata sb={sb} />}
      {r === "payables" && <Payables sb={sb} />}
    </div>
  );
}

type SB = ReturnType<typeof supabaseAdmin>;
const Num = ({ v, strong }: { v: number; strong?: boolean }) => <td className={cn("num", strong && "font-semibold", v < 0 && "text-danger")}>{formatPKR(v)}</td>;

async function ProfitLoss({ sb, from, to, prevFrom, prevTo }: { sb: SB; from: string; to: string; prevFrom: string; prevTo: string }) {
  const [{ data: cur }, { data: prev }] = await Promise.all([
    sb.rpc("report_profit_loss", { p_from: from, p_to: to }), sb.rpc("report_profit_loss", { p_from: prevFrom, p_to: prevTo }),
  ]);
  type R = { code: number; name: string; subtype: string; amount: number };
  const rows = (cur ?? []) as R[], prows = (prev ?? []) as R[];
  const pv = (code: number) => Number(prows.find((p) => p.code === code)?.amount ?? 0);
  const sum = (rs: R[], f: (r: R) => boolean) => rs.filter(f).reduce((a, r) => a + Number(r.amount), 0);
  const groups: [string, (r: R) => boolean][] = [
    ["Revenue", (r) => r.subtype === "revenue"], ["Cost of sales", (r) => r.subtype === "cogs"],
    ["Other income", (r) => r.subtype === "other_income"], ["Operating expenses", (r) => r.subtype === "opex"],
  ];
  const revenue = sum(rows, groups[0][1]), gp = revenue + sum(rows, groups[1][1]), net = sum(rows, () => true);
  const pRevenue = sum(prows, groups[0][1]), pGp = pRevenue + sum(prows, groups[1][1]), pNet = sum(prows, () => true);
  return (
    <div className="card overflow-x-auto"><table className="table">
      <thead><tr><th>Account</th><th className="num">{from} → {to}</th><th className="num">Previous period</th></tr></thead>
      <tbody>
        {groups.map(([label, f], gi) => (
          <Fragment key={label}>
            <tr><td colSpan={3} className="pt-5 eyebrow">{label}</td></tr>
            {rows.filter(f).map((r) => <tr key={r.code}><td><span className="font-mono text-xs text-ink-3">{r.code}</span> {r.name}</td><Num v={Number(r.amount)} /><Num v={pv(r.code)} /></tr>)}
            {gi === 1 && <tr><td className="font-semibold">Gross profit {revenue ? `(${Math.round((gp / revenue) * 100)}%)` : ""}</td><Num v={gp} strong /><Num v={pGp} strong /></tr>}
          </Fragment>
        ))}
        <tr><td className="font-display text-lg font-semibold">Net profit</td><Num v={net} strong /><Num v={pNet} strong /></tr>
      </tbody>
    </table></div>
  );
}
async function BalanceSheet({ sb, asOf }: { sb: SB; asOf: string }) {
  const { data } = await sb.rpc("report_balance_sheet", { p_as_of: asOf });
  type R = { section: string; code: number | null; name: string; amount: number };
  const rows = (data ?? []) as R[];
  const tot = (s: string) => rows.filter((r) => r.section === s).reduce((a, r) => a + Number(r.amount), 0);
  const A = tot("asset"), L = tot("liability"), E = tot("equity");
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {[["asset", "Assets", A], ["liability", "Liabilities", L], ["equity", "Equity", E]].map(([s, label, t]) => (
        <div key={s as string} className="card overflow-x-auto"><table className="table">
          <thead><tr><th>{label as string}</th><th className="num">{asOf}</th></tr></thead>
          <tbody>{rows.filter((r) => r.section === s).map((r, i) => <tr key={i}><td>{r.code && <span className="font-mono text-xs text-ink-3">{r.code} </span>}{r.name}</td><Num v={Number(r.amount)} /></tr>)}
            <tr><td className="font-semibold">Total {(label as string).toLowerCase()}</td><Num v={t as number} strong /></tr></tbody>
        </table></div>
      ))}
      <div className={cn("card grid place-items-center p-6 text-center", A === L + E ? "text-trust" : "text-danger")}>
        <p className="font-display text-2xl font-semibold">{A === L + E ? "Balanced" : "OUT OF BALANCE"}</p>
        <p className="text-sm text-ink-3">Assets {formatPKR(A)} = Liabilities + Equity {formatPKR(L + E)}</p>
      </div>
    </div>
  );
}

async function TrialBalance({ sb, asOf }: { sb: SB; asOf: string }) {
  const { data } = await sb.rpc("report_trial_balance", { p_as_of: asOf });
  type R = { code: number; name: string; type: string; debit: number; credit: number };
  const rows = (data ?? []) as R[];
  const dr = rows.reduce((a, r) => a + Math.max(Number(r.debit) - Number(r.credit), 0), 0);
  const cr = rows.reduce((a, r) => a + Math.max(Number(r.credit) - Number(r.debit), 0), 0);
  return (
    <div className="card overflow-x-auto"><table className="table">
      <thead><tr><th>Account</th><th>Type</th><th className="num">Debit</th><th className="num">Credit</th></tr></thead>
      <tbody>
        {rows.map((r) => { const net = Number(r.debit) - Number(r.credit); return <tr key={r.code}><td><span className="font-mono text-xs text-ink-3">{r.code}</span> {r.name}</td><td className="capitalize text-ink-3">{r.type}</td><td className="num">{net > 0 ? formatPKR(net) : ""}</td><td className="num">{net < 0 ? formatPKR(-net) : ""}</td></tr>; })}
        <tr><td colSpan={2} className={cn("font-semibold", dr === cr ? "text-trust" : "text-danger")}>{dr === cr ? "Balanced" : "OUT OF BALANCE"}</td><Num v={dr} strong /><Num v={cr} strong /></tr>
      </tbody>
    </table></div>
  );
}

async function CashFlow({ sb, from, to }: { sb: SB; from: string; to: string }) {
  const { data } = await sb.rpc("report_cash_flow", { p_from: from, p_to: to });
  const rows = (data ?? []) as { section: string; line: string; amount: number }[];
  return (
    <div className="card overflow-x-auto"><table className="table">
      <thead><tr><th>Cash flow (indirect)</th><th className="num">{from} → {to}</th></tr></thead>
      <tbody>{["operating", "investing", "financing", "net"].map((s) => (
        <Fragment key={s}>
          <tr><td colSpan={2} className="pt-5 eyebrow">{s === "net" ? "Reconciliation" : `${s} activities`}</td></tr>
          {rows.filter((r) => r.section === s).map((r) => <tr key={r.line}><td>{r.line}</td><Num v={Number(r.amount)} strong={s === "net"} /></tr>)}
        </Fragment>
      ))}</tbody>
    </table></div>
  );
}

async function Equity({ sb, from, to }: { sb: SB; from: string; to: string }) {
  const { data } = await sb.rpc("report_changes_in_equity", { p_from: from, p_to: to });
  const e = (data ?? {}) as Record<string, number>;
  const lines: [string, string][] = [["opening_equity", "Opening equity"], ["capital_introduced", "Capital introduced"], ["drawings", "Owner's drawings"], ["net_profit", "Net profit for the period"], ["other", "Other movements"], ["closing_equity", "Closing equity"]];
  return <div className="card max-w-xl"><table className="table"><tbody>{lines.map(([k, l]) => <tr key={k}><td className={k.includes("ing_") ? "font-semibold" : ""}>{l}</td><Num v={Number(e[k] ?? 0)} strong={k.includes("ing_")} /></tr>)}</tbody></table></div>;
}

async function Khata({ sb }: { sb: SB }) {
  const { data } = await sb.from("v_khata_aging").select("*").order("balance", { ascending: false });
  return (
    <div className="card overflow-x-auto"><table className="table">
      <thead><tr><th>Trade account</th><th className="num">Limit</th><th className="num">Balance</th><th className="num">0–30</th><th className="num">31–60</th><th className="num">60+</th><th>Last payment</th></tr></thead>
      <tbody>{(data ?? []).map((k) => <tr key={k.customer_id}><td>{k.shop_name ?? k.name} <span className="text-ink-3">{k.phone}</span></td><Num v={Number(k.credit_limit ?? 0)} /><Num v={Number(k.balance)} strong /><Num v={Number(k.d0_30 ?? 0)} /><Num v={Number(k.d31_60 ?? 0)} /><td className={cn("num", Number(k.d60_plus) > 0 && "text-danger")}>{formatPKR(k.d60_plus ?? 0)}</td><td className="text-ink-3">{k.last_payment ?? "—"}</td></tr>)}</tbody>
    </table></div>
  );
}

async function Payables({ sb }: { sb: SB }) {
  const { data } = await sb.from("v_payables_aging").select("*").order("outstanding", { ascending: false });
  return (
    <div className="card overflow-x-auto"><table className="table">
      <thead><tr><th>Supplier</th><th className="num">Outstanding</th><th className="num">Overdue</th></tr></thead>
      <tbody>{(data ?? []).map((p) => <tr key={p.supplier_id}><td>{p.name}</td><Num v={Number(p.outstanding)} strong /><td className={cn("num", Number(p.overdue) > 0 && "text-danger")}>{formatPKR(p.overdue ?? 0)}</td></tr>)}</tbody>
    </table></div>
  );
}
