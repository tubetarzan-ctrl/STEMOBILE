"use client";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  closeMonthAction, closeYearAction, postExpenseAction, postManualJournalAction, reverseJournalAction, runDepreciationAction, type ActionResult,
} from "@/app/actions/panel";
import { formatPKR, rupeesToPaisa } from "@/lib/money";
import { businessDate } from "@/lib/time";

type Acc = { code: number; name: string; subtype: string };

function useRun() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionResult>, ok: string | ((d: unknown) => string)) =>
    start(async () => { const r = await fn(); setMsg(r.ok ? (typeof ok === "string" ? ok : ok(r.data)) : r.error); });
  return { pending, msg, run };
}

export function ExpenseForm({ accounts }: { accounts: Acc[] }) {
  const { pending, msg, run } = useRun();
  return (
    <form className="card space-y-3 p-5" onSubmit={(e) => {
      e.preventDefault(); const f = new FormData(e.currentTarget);
      run(() => postExpenseAction(Number(f.get("account")), rupeesToPaisa(String(f.get("amount"))) ?? 0, Number(f.get("from")), String(f.get("memo"))), "Expense posted");
    }}>
      <h2 className="font-medium">Record expense</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <select name="account" className="input">{accounts.filter((a) => a.subtype === "opex").map((a) => <option key={a.code} value={a.code}>{a.code} {a.name}</option>)}</select>
        <select name="from" className="input">{accounts.filter((a) => ["cash", "bank"].includes(a.subtype)).map((a) => <option key={a.code} value={a.code}>Paid from {a.name}</option>)}</select>
        <input name="amount" required className="input" placeholder="Amount (Rs)" inputMode="decimal" />
        <input name="memo" required className="input" placeholder="What for?" />
      </div>
      <button className="btn btn-primary btn-sm" disabled={pending}>Post</button>{msg && <span className="ml-3 text-sm">{msg}</span>}
    </form>
  );
}

export function JournalForm({ accounts }: { accounts: Acc[] }) {
  const { pending, msg, run } = useRun();
  const [lines, setLines] = useState([{ account: accounts[0]?.code ?? 10100, dr: 0, cr: 0 }, { account: accounts[1]?.code ?? 10200, dr: 0, cr: 0 }]);
  const dr = lines.reduce((a, l) => a + l.dr, 0), cr = lines.reduce((a, l) => a + l.cr, 0);
  return (
    <form className="card space-y-3 p-5" onSubmit={(e) => {
      e.preventDefault(); const f = new FormData(e.currentTarget);
      run(() => postManualJournalAction(String(f.get("date")), String(f.get("memo")), lines.map((l) => ({ account: l.account, debit: l.dr, credit: l.cr }))), "Journal posted");
    }}>
      <h2 className="font-medium">Manual journal</h2>
      <div className="grid gap-2 sm:grid-cols-[160px_1fr]"><input name="date" type="date" defaultValue={businessDate()} className="input" /><input name="memo" required className="input" placeholder="Memo (required)" /></div>
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-[1fr_110px_110px_24px] gap-2">
          <select value={l.account} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, account: Number(e.target.value) } : x)))} className="input h-10">{accounts.map((a) => <option key={a.code} value={a.code}>{a.code} {a.name}</option>)}</select>
          <input className="input h-10" placeholder="Debit" inputMode="decimal" onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, dr: rupeesToPaisa(e.target.value || "0") ?? 0 } : x)))} />
          <input className="input h-10" placeholder="Credit" inputMode="decimal" onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, cr: rupeesToPaisa(e.target.value || "0") ?? 0 } : x)))} />
          <button type="button" aria-label="Remove line" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="size-4 text-ink-3" /></button>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <button type="button" className="text-sm text-accent" onClick={() => setLines((ls) => [...ls, { account: accounts[0].code, dr: 0, cr: 0 }])}><Plus className="inline size-3.5" /> line</button>
        <span className={dr === cr && dr > 0 ? "text-sm text-trust" : "text-sm text-warn"}>Dr {formatPKR(dr)} · Cr {formatPKR(cr)}</span>
        <button className="btn btn-primary btn-sm ml-auto" disabled={pending || dr !== cr || dr === 0}>Post</button>
      </div>
      {msg && <p className="text-sm">{msg}</p>}
    </form>
  );
}

export function ReverseButton({ id }: { id: string }) {
  const { pending, msg, run } = useRun();
  return <span><button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => { const r = prompt("Reason for reversal?"); if (r) run(() => reverseJournalAction(id, r), "Reversed"); }}>Reverse</button>{msg && <span className="ml-2 text-sm">{msg}</span>}</span>;
}

export function PeriodTools() {
  const { pending, msg, run } = useRun();
  const today = businessDate();
  return (
    <section className="card flex flex-wrap items-end gap-4 p-5">
      <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); const m = String(new FormData(e.currentTarget).get("m")); run(() => closeMonthAction(`${m}-01`), (d) => { const r = d as { closed: boolean; checks: Record<string, unknown> }; return r.closed ? `Month ${m} closed` : `Not closed — checks: ${JSON.stringify(r.checks)}`; }); }}>
        <label className="space-y-1"><span className="label">Month-end close</span><input name="m" type="month" defaultValue={today.slice(0, 7)} className="input h-10" /></label>
        <button className="btn btn-ghost btn-sm" disabled={pending}>Close month</button>
      </form>
      <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); const m = String(new FormData(e.currentTarget).get("m")); run(() => runDepreciationAction(`${m}-01`), (n) => `Depreciation posted for ${n} assets`); }}>
        <label className="space-y-1"><span className="label">Depreciation</span><input name="m" type="month" defaultValue={today.slice(0, 7)} className="input h-10" /></label>
        <button className="btn btn-ghost btn-sm" disabled={pending}>Run</button>
      </form>
      <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); const d = String(new FormData(e.currentTarget).get("d")); if (confirm(`Close the year ending ${d}? Income & expenses move to Retained Earnings (reversible until finalised).`)) run(() => closeYearAction(d), "Year closed"); }}>
        <label className="space-y-1"><span className="label">Year-end close</span><input name="d" type="date" defaultValue={`${today.slice(0, 4)}-06-30`} className="input h-10" /></label>
        <button className="btn btn-ghost btn-sm" disabled={pending}>Close year</button>
      </form>
      {msg && <p className="w-full text-sm">{msg}</p>}
    </section>
  );
}
