"use client";
import { useEffect, useState, useTransition } from "react";
import { consumePartAction, updateRepairDetailsAction, updateRepairStatusAction, type ActionResult } from "@/app/actions/panel";
import { formatPKR, rupeesToPaisa } from "@/lib/money";

const STEPS: [string, string][] = [
  ["received", "Checked in"], ["diagnosing", "Diagnosing"], ["awaiting_parts", "Waiting for parts"], ["in_repair", "Repairing"],
  ["quality_check", "Quality check"], ["ready", "Ready for pickup"], ["cancelled", "Cancelled"], ["returned_unrepaired", "Returned unrepaired"],
];
const rs = (paisa: number | null | undefined) => (paisa ? String(Number(paisa) / 100) : "");

type Job = { id: string; status: string; technician_id: string | null; labour: number; estimate: number; promised_at: string | null; imei: string | null; notes: string | null };

/** Technician, labour, estimate, promised time — and jump to any step. */
export function JobDetails({ job, techs }: { job: Job; techs: { id: string; full_name: string }[] }) {
  const [f, setF] = useState({
    technician_id: job.technician_id ?? "", labour: rs(job.labour), estimate: rs(job.estimate),
    promised_at: job.promised_at ? new Date(job.promised_at).toISOString().slice(0, 16) : "", imei: job.imei ?? "", notes: job.notes ?? "",
  });
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const run = (fn: () => Promise<ActionResult>, ok: string) => start(async () => { const r = await fn(); setMsg(r.ok ? ok : r.error); });

  return (
    <div className="card space-y-3 p-4">
      <h2 className="font-medium">Job details</h2>
      <label className="block text-sm">Technician
        <select className="input mt-1 h-10" value={f.technician_id} onChange={set("technician_id")}>
          <option value="">— Unassigned —</option>
          {techs.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm">Labour (Rs)<input className="input mt-1 h-10" inputMode="numeric" value={f.labour} onChange={set("labour")} /></label>
        <label className="block text-sm">Estimate (Rs)<input className="input mt-1 h-10" inputMode="numeric" value={f.estimate} onChange={set("estimate")} /></label>
      </div>
      <label className="block text-sm">Promised by<input type="datetime-local" className="input mt-1 h-10" value={f.promised_at} onChange={set("promised_at")} /></label>
      <label className="block text-sm">IMEI<input className="input mt-1 h-10 font-mono" value={f.imei} onChange={set("imei")} /></label>
      <label className="block text-sm">Notes (staff only)<textarea className="input mt-1" rows={2} value={f.notes} onChange={set("notes")} /></label>
      <button type="button" className="btn btn-primary btn-sm w-full" disabled={pending} onClick={() => run(() => updateRepairDetailsAction(job.id, {
        technician_id: f.technician_id, labour: rupeesToPaisa(f.labour || "0") ?? 0, estimate: rupeesToPaisa(f.estimate || "0") ?? 0,
        promised_at: f.promised_at ? new Date(f.promised_at).toISOString() : "", imei: f.imei, notes: f.notes,
      }), "Saved")}>Save details</button>

      <div className="border-t border-line pt-3">
        <label className="block text-sm">Move to any step (customer gets a WhatsApp)
          <select className="input mt-1 h-10" value="" disabled={pending} onChange={(e) => {
            const s = e.target.value;
            if (!s) return;
            if (["cancelled", "returned_unrepaired"].includes(s) && !confirm("Close this job?")) return;
            run(() => updateRepairStatusAction(job.id, s, "Updated from job page"), "Status updated");
          }}>
            <option value="">Choose…</option>
            {STEPS.filter(([s]) => s !== job.status).map(([s, l]) => <option key={s} value={s}>{l}</option>)}
          </select>
        </label>
      </div>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}

type Hit = { id: string; sku: string; grade: string; sale_price: number; products: { name: string } };

/** Search a part by name or SKU, set the price charged, and book it out of stock. */
export function PartPicker({ jobId }: { jobId: string }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [pick, setPick] = useState<Hit | null>(null);
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("1");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (q.length < 2 || pick) { setHits([]); return; }
    const t = setTimeout(() => { fetch(`/api/panel/variant?q=${encodeURIComponent(q)}`).then((r) => r.json()).then(setHits).catch(() => {}); }, 250);
    return () => clearTimeout(t);
  }, [q, pick]);

  return (
    <div className="card space-y-2 p-4">
      <h2 className="font-medium">Add a part from stock</h2>
      {!pick ? (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} className="input h-10" placeholder="Type part name or SKU, e.g. A54 screen" />
          {hits.length > 0 && <ul className="max-h-56 overflow-auto rounded-lg border border-line">{hits.map((h) => (
            <li key={h.id}><button type="button" className="flex w-full justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2" onClick={() => { setPick(h); setPrice(String(Number(h.sale_price) / 100)); }}>
              <span>{h.products?.name} <span className="font-mono text-xs text-ink-3">{h.sku}</span></span><span className="money">{formatPKR(h.sale_price)}</span>
            </button></li>
          ))}</ul>}
        </>
      ) : (
        <div className="space-y-2">
          <p className="text-sm">{pick.products?.name} <span className="font-mono text-xs text-ink-3">{pick.sku}</span> <button type="button" className="text-accent underline" onClick={() => { setPick(null); setQ(""); }}>change</button></p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">Qty<input className="input mt-1 h-10" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} /></label>
            <label className="text-sm">Price charged (Rs)<input className="input mt-1 h-10" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
          </div>
          <button type="button" className="btn btn-primary btn-sm w-full" disabled={pending} onClick={() => start(async () => {
            const r = await consumePartAction(jobId, pick.id, Math.max(1, parseInt(qty) || 1), rupeesToPaisa(price || "0") ?? undefined);
            setMsg(r.ok ? "Part added — stock reduced, cost posted." : r.error);
            if (r.ok) { setPick(null); setQ(""); }
          })}>Add part to job</button>
        </div>
      )}
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
