"use client";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { easyEntryAction, openingBalancesAction, resetTestDataAction, type ActionResult } from "@/app/actions/panel";
import { rupeesToPaisa } from "@/lib/money";
import { businessDate } from "@/lib/time";

type Opt = { id: string; name: string };
type Kind = "expense" | "owner_took" | "owner_added" | "supplier_paid" | "customer_paid" | "cash_to_bank";

const KINDS: [Kind, string, string][] = [
  ["expense", "Kharcha (expense paid)", "Rent, salary, bills, tea, transport…"],
  ["customer_paid", "Customer ne khata diya", "A customer paid what they owed"],
  ["supplier_paid", "Supplier ko payment ki", "We paid a supplier"],
  ["owner_took", "Owner ne paise nikale", "Owner took money for home/personal"],
  ["owner_added", "Owner ne paise dalay", "Owner put money into the business"],
  ["cash_to_bank", "Cash bank mein jama", "Moved counter cash to the bank"],
];

function useRun() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionResult>, ok: string, after?: () => void) =>
    start(async () => { const r = await fn(); setMsg(r.ok ? ok : r.error); if (r.ok) after?.(); });
  return { pending, msg, run };
}

/** Plain-language money entries. Each one posts a balanced journal automatically. */
export function EasyEntry({ expenses, suppliers, customers }: { expenses: { code: number; name: string }[]; suppliers: Opt[]; customers: Opt[] }) {
  const [kind, setKind] = useState<Kind>("expense");
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState("10100");
  const [account, setAccount] = useState(String(expenses[0]?.code ?? 69900));
  const [party, setParty] = useState("");
  const [memo, setMemo] = useState("");
  const [date, setDate] = useState(businessDate());
  const { pending, msg, run } = useRun();
  const needsParty = kind === "supplier_paid" || kind === "customer_paid";
  const list = kind === "supplier_paid" ? suppliers : customers;

  return (
    <section className="card space-y-4 p-5">
      <div>
        <h2 className="font-display text-xl font-semibold">Easy Books — what happened?</h2>
        <p className="text-sm text-ink-3">Pick one, type the amount, press Save. Sales, repairs, purchases and the daily closing post automatically — enter only money that moved outside the POS.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {KINDS.map(([k, l, sub]) => (
          <button key={k} type="button" onClick={() => { setKind(k); setParty(""); }}
            className={kind === k ? "card glow border-transparent p-3 text-left" : "card p-3 text-left hover:bg-surface-2"}>
            <span className="block font-medium">{l}</span><span className="text-xs text-ink-3">{sub}</span>
          </button>
        ))}
      </div>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
        e.preventDefault();
        const amt = rupeesToPaisa(amount || "0") ?? 0;
        run(() => easyEntryAction({ kind, amount: amt, from: Number(from), account: Number(account), party, memo, date }), "✓ Saved — balance sheet and ledgers updated.", () => { setAmount(""); setMemo(""); });
      }}>
        {kind === "expense" && (
          <label className="space-y-1"><span className="label">Kharcha type</span>
            <select className="input" value={account} onChange={(e) => setAccount(e.target.value)}>{expenses.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}</select>
          </label>
        )}
        {needsParty && (
          <label className="space-y-1"><span className="label">{kind === "supplier_paid" ? "Supplier" : "Customer"}</span>
            <select className="input" value={party} onChange={(e) => setParty(e.target.value)} required>
              <option value="">Choose…</option>{list.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            {list.length === 0 && <span className="text-xs text-ink-3">None yet — add them in Opening balances below.</span>}
          </label>
        )}
        <label className="space-y-1"><span className="label">Amount (Rs)</span><input className="input text-lg" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required /></label>
        {kind !== "cash_to_bank" && (
          <label className="space-y-1"><span className="label">{kind === "owner_added" || kind === "customer_paid" ? "Money came into" : "Paid from"}</span>
            <select className="input" value={from} onChange={(e) => setFrom(e.target.value)}><option value="10100">Cash (counter)</option><option value="10200">Bank</option><option value="10400">JazzCash / Easypaisa</option></select>
          </label>
        )}
        <label className="space-y-1"><span className="label">Date</span><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="space-y-1 sm:col-span-2"><span className="label">Note (optional)</span><input className="input" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="e.g. October rent" /></label>
        <div className="flex items-center gap-3 sm:col-span-2"><button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>{msg && <span className="text-sm">{msg}</span>}</div>
      </form>
    </section>
  );
}

type Row = { name: string; phone: string; amount: string };

/** Move the owner's old books in: cash, bank, who owes us, whom we owe. */
export function OpeningBalances() {
  const [cash, setCash] = useState("");
  const [bank, setBank] = useState("");
  const [date, setDate] = useState(businessDate());
  const [cust, setCust] = useState<Row[]>([{ name: "", phone: "", amount: "" }]);
  const [sup, setSup] = useState<Row[]>([{ name: "", phone: "", amount: "" }]);
  const { pending, msg, run } = useRun();
  const rows = (list: Row[], set: (r: Row[]) => void, withPhone: boolean, title: string) => (
    <div className="space-y-2">
      <p className="label">{title}</p>
      {list.map((r, i) => (
        <div key={i} className="flex gap-2">
          <input className="input h-10 flex-1" placeholder="Name" value={r.name} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
          {withPhone && <input className="input h-10 w-36" placeholder="03XX…" inputMode="tel" value={r.phone} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} />}
          <input className="input h-10 w-28 text-right" placeholder="Rs" inputMode="decimal" value={r.amount} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
          <button type="button" aria-label="Remove row" onClick={() => set(list.filter((_, j) => j !== i))}><Trash2 className="size-4 text-ink-3" /></button>
        </div>
      ))}
      <button type="button" className="text-sm text-accent" onClick={() => set([...list, { name: "", phone: "", amount: "" }])}><Plus className="inline size-3.5" /> Add row</button>
    </div>
  );
  const p = (s: string) => rupeesToPaisa(s || "0") ?? 0;
  return (
    <details className="card p-5">
      <summary className="cursor-pointer font-display text-xl font-semibold">Opening balances (move old books in)</summary>
      <p className="mt-2 text-sm text-ink-3">Do this once, on the day you start using this system. Stock is entered in Inventory → Import (opening stock). Everything else from the old register goes here; the difference becomes the owner&apos;s starting capital.</p>
      <form className="mt-4 space-y-4" onSubmit={(e) => {
        e.preventDefault();
        if (!confirm("Post opening balances? (Check the figures — you can reverse it later from the Journal.)")) return;
        run(() => openingBalancesAction({
          date, cash: p(cash), bank: p(bank),
          customers: cust.filter((r) => r.name && p(r.amount) > 0).map((r) => ({ name: r.name, phone: r.phone, amount: p(r.amount) })),
          suppliers: sup.filter((r) => r.name && p(r.amount) > 0).map((r) => ({ name: r.name, amount: p(r.amount) })),
        }), "✓ Opening balances posted.");
      }}>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1"><span className="label">Start date</span><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="space-y-1"><span className="label">Cash in shop (Rs)</span><input className="input" inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} /></label>
          <label className="space-y-1"><span className="label">Bank balance (Rs)</span><input className="input" inputMode="decimal" value={bank} onChange={(e) => setBank(e.target.value)} /></label>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {rows(cust, setCust, true, "Customers who owe us (khata / receivable) — phone required")}
          {rows(sup, setSup, false, "Suppliers we owe (payable)")}
        </div>
        <div className="flex items-center gap-3"><button className="btn btn-primary" disabled={pending}>Post opening balances</button>{msg && <span className="text-sm">{msg}</span>}</div>
      </form>
    </details>
  );
}

/** Owner only: wipe all test transactions so real books start from zero. */
export function ResetTestData() {
  const [text, setText] = useState("");
  const [keep, setKeep] = useState(true);
  const { pending, msg, run } = useRun();
  return (
    <details className="card border-danger/40 p-5">
      <summary className="cursor-pointer font-medium text-danger">Delete all test / dummy data (owner only)</summary>
      <div className="mt-3 space-y-3 text-sm">
        <p>Deletes <b>every</b> sale, repair, online order, journal, stock movement, customer, review and closing — the books go back to zero. Keeps staff, settings, website, FAQs and phone models. Use this <b>once</b>, before real business starts. It cannot be undone.</p>
        <label className="flex items-center gap-2"><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /> Keep products &amp; suppliers (stock goes to 0)</label>
        <label className="block space-y-1"><span className="label">Type DELETE ALL TEST DATA to confirm</span><input className="input font-mono" value={text} onChange={(e) => setText(e.target.value)} /></label>
        <div className="flex items-center gap-3">
          <button type="button" className="btn btn-sm bg-danger text-white" disabled={pending || text !== "DELETE ALL TEST DATA"} onClick={() => run(() => resetTestDataAction(keep, text), "✓ All test data deleted. Books are at zero.", () => setText(""))}>Delete everything</button>
          {msg && <span>{msg}</span>}
        </div>
      </div>
    </details>
  );
}
