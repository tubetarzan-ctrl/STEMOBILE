import { requirePermission, can } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabase/server";
import { formatPKR } from "@/lib/money";
import { PageHead, StatusPill } from "@/components/panel/ui";
import { ExpenseForm, JournalForm, PeriodTools, ReverseButton } from "./AccountsClient";
import { EasyEntry, OpeningBalances, ResetTestData } from "./EasyBooks";
import { businessDate } from "@/lib/time";
import { Kpi } from "@/components/panel/ui";

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ source?: string }> }) {
  const staff = await requirePermission("reports.financial.view", "redirect");
  const { source } = await searchParams;
  const sb = supabaseAdmin();
  let jq = sb.from("journal_entries").select("id, entry_no, entry_date, memo, source_type, source_id, reversal_of, reversed_by, journal_lines(account_code, debit, credit, party_type, accounts(name))").order("entry_no", { ascending: false }).limit(40);
  if (source) jq = jq.eq("source_type", source);
  const [{ data: entries }, { data: accounts }, { data: periods }, { data: assets }] = await Promise.all([
    jq, sb.from("accounts").select("code, name, subtype").eq("is_active", true).order("code"),
    sb.from("accounting_periods").select("kind, starts_on, ends_on, status").order("starts_on", { ascending: false }).limit(12),
    sb.from("fixed_assets").select("id, name, cost, acquired_on, life_months, status, depreciation_runs(amount)"),
  ]);
  const acc = accounts ?? [];
  const today = businessDate();
  const monthStart = `${today.slice(0, 7)}-01`;
  const [{ data: tb }, { data: pl }, { data: suppliers }, { data: khata }] = await Promise.all([
    sb.rpc("report_trial_balance", { p_as_of: null }),
    sb.rpc("report_profit_loss", { p_from: monthStart, p_to: today }),
    sb.from("suppliers").select("id, name").order("name"),
    sb.from("trade_accounts").select("customer_id, shop_name, customers(name, phone)").eq("status", "approved"),
  ]);
  const bal = (codes: number[]) => ((tb ?? []) as { code: number; balance: number }[]).filter((r) => codes.includes(r.code)).reduce((a, r) => a + Number(r.balance), 0);
  const plRows = (pl ?? []) as { code: number; amount: number }[];
  const income = plRows.filter((r) => r.code < 50000).reduce((a, r) => a + Number(r.amount), 0);
  const costs = -plRows.filter((r) => r.code >= 50000).reduce((a, r) => a + Number(r.amount), 0);

  return (
    <div className="space-y-10">
      <PageHead title="Accounts" sub="Everything from POS, repairs, orders, purchases and the daily closing posts here automatically. Use Easy Books for money that moved outside the POS." />

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Aaj tak ka hisaab (where the money is)</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Cash in shop" value={formatPKR(bal([10100, 10110]))} />
          <Kpi label="Bank + wallets" value={formatPKR(bal([10200, 10300, 10400]))} />
          <Kpi label="Customers owe us (khata)" value={formatPKR(bal([11000, 11100]))} />
          <Kpi label="We owe suppliers" value={formatPKR(bal([20100]))} />
          <Kpi label="Stock value (at cost)" value={formatPKR(bal([12000]))} />
          <Kpi label="This month: sales & income" value={formatPKR(income)} />
          <Kpi label="This month: costs & kharcha" value={formatPKR(costs)} />
          <Kpi label="This month: profit" value={formatPKR(income - costs)} hint={income - costs < 0 ? "loss" : undefined} />
        </div>
      </section>

      {can(staff, "accounts.expense") && (
        <EasyEntry
          expenses={acc.filter((a) => a.code >= 60000 && a.code < 70000).map((a) => ({ code: a.code, name: a.name }))}
          suppliers={(suppliers ?? []).map((x) => ({ id: x.id, name: x.name }))}
          customers={(khata ?? []).map((k) => { const c = k.customers as unknown as { name: string | null; phone: string } | null; return { id: k.customer_id, name: `${k.shop_name ?? c?.name ?? ""} · ${c?.phone ?? ""}` }; })}
        />
      )}
      {can(staff, "accounts.journal.create") && <OpeningBalances />}

      <details className="space-y-6">
        <summary className="cursor-pointer font-display text-xl font-semibold">Accountant tools (journal entry, month/year close)</summary>
      <div className="mt-4 grid gap-6 xl:grid-cols-2">
        {can(staff, "accounts.expense") && <ExpenseForm accounts={acc} />}
        {can(staff, "accounts.journal.create") && <JournalForm accounts={acc} />}
      </div>
      <div className="mt-6">{can(staff, "accounts.period.close") && <PeriodTools />}</div>
      </details>

      <section>
        <h2 className="font-display text-xl font-semibold">Journal (every entry)</h2>
        <p className="mb-3 text-sm text-ink-3">Wrong entry? Open it and press <b>Reverse</b> — that cancels it exactly and keeps the history. Entries are never deleted (that keeps the books honest).</p>
        <div className="space-y-2">
          {(entries ?? []).map((e) => (
            <details key={e.id} className="card p-4">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 text-sm">
                <span className="font-mono text-ink-3">#{e.entry_no}</span><span className="font-mono">{e.entry_date}</span>
                <span className="flex-1">{e.memo}</span><span className="badge">{e.source_type}</span>
                {e.reversed_by && <StatusPill status="reversed" />}{e.reversal_of && <span className="badge text-warn">reversal</span>}
                <span className="money font-semibold">{formatPKR((e.journal_lines as { debit: number }[]).reduce((a, l) => a + Number(l.debit), 0))}</span>
              </summary>
              <table className="table mt-3">
                <thead><tr><th>Account</th><th>Party</th><th className="num">Debit</th><th className="num">Credit</th></tr></thead>
                <tbody>{(e.journal_lines as unknown as { account_code: number; debit: number; credit: number; party_type: string | null; accounts: { name: string } }[]).map((l, i) => (
                  <tr key={i}><td><span className="font-mono text-xs text-ink-3">{l.account_code}</span> {l.accounts.name}</td><td className="text-ink-3">{l.party_type ?? ""}</td><td className="num">{Number(l.debit) ? formatPKR(l.debit) : ""}</td><td className="num">{Number(l.credit) ? formatPKR(l.credit) : ""}</td></tr>
                ))}</tbody>
              </table>
              {can(staff, "accounts.journal.create") && !e.reversed_by && !e.reversal_of && <div className="mt-3"><ReverseButton id={e.id} /></div>}
            </details>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-medium">Periods</h2>
          <table className="table"><tbody>{(periods ?? []).map((p) => <tr key={`${p.kind}${p.starts_on}`}><td className="capitalize">{p.kind}</td><td className="font-mono">{p.starts_on} → {p.ends_on}</td><td><StatusPill status={p.status} /></td></tr>)}</tbody></table>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-medium">Fixed assets</h2>
          <table className="table"><thead><tr><th>Asset</th><th className="num">Cost</th><th className="num">Depreciated</th><th className="num">Book value</th></tr></thead>
            <tbody>{(assets ?? []).map((a) => { const dep = (a.depreciation_runs as { amount: number }[]).reduce((x, r) => x + Number(r.amount), 0); return <tr key={a.id}><td>{a.name} <span className="text-xs text-ink-3">{a.life_months}m</span></td><td className="num">{formatPKR(a.cost)}</td><td className="num">{formatPKR(dep)}</td><td className="num font-semibold">{formatPKR(Number(a.cost) - dep)}</td></tr>; })}</tbody>
          </table>
        </section>
      </div>
      {staff.isOwner && <ResetTestData />}
    </div>
  );
}
