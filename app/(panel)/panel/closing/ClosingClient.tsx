"use client";
import { useState, useTransition } from "react";
import { closeDrawerAction, runDailyClosingAction, verifyDayAction } from "@/app/actions/panel";
import { formatPKR } from "@/lib/money";
import { cn } from "@/lib/utils";

const DENOMS = [5000, 1000, 500, 100, 50, 20, 10] as const; // notes; coins entered as a total

export function CloseDrawer({ session, expected }: { session: { id: string; name: string; openedAt: string; float: number }; expected: number | null }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [coins, setCoins] = useState(0);
  const [result, setResult] = useState<{ expected: number; counted: number; variance: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const counted = DENOMS.reduce((a, d) => a + (counts[d] ?? 0) * d * 100, 0) + coins * 100;

  if (result) {
    return (
      <div className="card p-5">
        <h3 className="font-display text-lg font-semibold">{session.name} closed</h3>
        <p className="mt-2 text-sm">Expected {formatPKR(result.expected)} · Counted {formatPKR(result.counted)}</p>
        <p className={cn("mt-1 font-display text-2xl font-semibold", result.variance === 0 ? "text-trust" : result.variance > 0 ? "text-warn" : "text-danger")}>
          {result.variance === 0 ? "Balanced" : `${result.variance > 0 ? "Over" : "Short"} ${formatPKR(Math.abs(result.variance))}`}
        </p>
      </div>
    );
  }
  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-baseline justify-between"><h3 className="font-display text-lg font-semibold">{session.name}</h3><span className="text-xs text-ink-3">opened {session.openedAt} · float {formatPKR(session.float)}</span></div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {DENOMS.map((d) => (
          <label key={d} className="space-y-1"><span className="label">Rs {d.toLocaleString()} ×</span>
            <input type="number" min={0} inputMode="numeric" className="input h-10" onChange={(e) => setCounts((c) => ({ ...c, [d]: Math.max(0, Number(e.target.value)) }))} />
          </label>
        ))}
        <label className="space-y-1"><span className="label">Coins (Rs total)</span><input type="number" min={0} className="input h-10" onChange={(e) => setCoins(Math.max(0, Number(e.target.value)))} /></label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">Counted <span className="money font-display text-xl font-semibold">{formatPKR(counted)}</span>{expected !== null && <span className="text-ink-3"> · expected {formatPKR(expected)}</span>}</p>
        <button className="btn btn-primary" disabled={pending} onClick={() => start(async () => {
          const r = await closeDrawerAction(session.id, counted, { ...Object.fromEntries(DENOMS.map((d) => [String(d), counts[d] ?? 0])), coins_rs: coins });
          if (r.ok) setResult(r.data); else setErr(r.error);
        })}>Close drawer</button>
      </div>
      {err && <p className="text-sm text-danger">{err}</p>}
    </div>
  );
}

export function DayActions({ date, status }: { date: string | null; status: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  if (!date) {
    return (
      <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); const d = String(new FormData(e.currentTarget).get("d")); start(async () => { const r = await runDailyClosingAction(d); setMsg(r.ok ? `Closed ${d}` : r.error); }); }}>
        <span className="text-sm text-ink-3">Run closing now for</span><input name="d" type="date" required className="input h-9 w-44" /><button className="btn btn-ghost btn-sm" disabled={pending}>Close day</button>{msg && <span className="text-sm">{msg}</span>}
      </form>
    );
  }
  if (status !== "closed") return null;
  return <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => start(async () => { const r = await verifyDayAction(date); setMsg(r.ok ? "Verified" : r.error); })}>{msg ?? "Mark verified"}</button>;
}
