"use client";
import { useState, useTransition } from "react";
import { Printer } from "lucide-react";
import { consumePartAction, deliverRepairAction, saveChecklistAction, updateRepairStatusAction, type ActionResult } from "@/app/actions/panel";
import { formatPKR, rupeesToPaisa } from "@/lib/money";

const NEXT: Record<string, [string, string][]> = {
  booked: [["received", "Check in"]],
  received: [["diagnosing", "Start diagnosis"]],
  diagnosing: [["in_repair", "Start repair"], ["awaiting_parts", "Waiting for parts"], ["awaiting_approval", "Ask approval (new estimate)"]],
  awaiting_parts: [["in_repair", "Parts arrived — repair"]],
  awaiting_approval: [],
  in_repair: [["quality_check", "Send to QC"]],
  quality_check: [["ready", "Mark ready"]],
  ready: [],
};
const QC = ["touch", "display_true_tone", "face_id_fingerprint", "cameras", "speaker_mic", "charging", "wifi_bt", "buttons"];

export function JobActions({ job, sessionId, canManage, canDeliver }: { job: { id: string; status: string; total: number; advance: number; deviceId: string | null }; sessionId: string | null; canManage: boolean; canDeliver: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [qc, setQc] = useState<Record<string, string>>(Object.fromEntries(QC.map((k) => [k, "ok"])));
  const [sku, setSku] = useState("");
  const [method, setMethod] = useState("cash");
  const run = (fn: () => Promise<ActionResult>, ok?: string) => start(async () => { const r = await fn(); setMsg(r.ok ? ok ?? null : r.error); });
  const due = Math.max(0, job.total - job.advance);

  return (
    <div className="space-y-4">
      {canManage && (NEXT[job.status] ?? []).length > 0 && (
        <div className="card space-y-2 p-4">
          <h2 className="font-medium">Next step</h2>
          <div className="flex flex-wrap gap-2">
            {NEXT[job.status].map(([s, l]) => (
              <button key={s} type="button" disabled={pending} className="btn btn-primary btn-sm" onClick={() => {
                if (s === "awaiting_approval") { const v = prompt("New estimate (Rs)"); if (!v) return; return run(() => updateRepairStatusAction(job.id, s, "Revised estimate sent", rupeesToPaisa(v) ?? 0), "Sent to customer on WhatsApp"); }
                run(() => updateRepairStatusAction(job.id, s));
              }}>{l}</button>
            ))}
          </div>
        </div>
      )}

      {canManage && ["diagnosing", "in_repair", "awaiting_parts", "received"].includes(job.status) && (
        <div className="card space-y-2 p-4">
          <h2 className="font-medium">Use a part from stock</h2>
          <div className="flex gap-2">
            <input value={sku} onChange={(e) => setSku(e.target.value)} className="input h-10" placeholder="SKU / barcode" />
            <button type="button" className="btn btn-ghost btn-sm" disabled={pending || !sku} onClick={() => run(async () => {
              const v = await fetch(`/api/panel/variant?sku=${encodeURIComponent(sku)}`).then((r) => r.json());
              if (!v.id) return { ok: false, error: "SKU not found" } as ActionResult;
              const r = await consumePartAction(job.id, v.id, 1);
              if (r.ok) setSku("");
              return r;
            }, "Part booked out (COGS posted)")}>Use part</button>
          </div>
        </div>
      )}

      {canManage && job.status === "quality_check" && (
        <div className="card space-y-2 p-4">
          <h2 className="font-medium">QC checklist</h2>
          {QC.map((k) => (
            <label key={k} className="flex items-center justify-between text-sm capitalize">{k.replace(/_/g, " ")}
              <select value={qc[k]} onChange={(e) => setQc((s) => ({ ...s, [k]: e.target.value }))} className="input h-8 w-28"><option>ok</option><option>fail</option><option>n/a</option></select>
            </label>
          ))}
          <button type="button" className="btn btn-ghost btn-sm w-full" disabled={pending} onClick={() => run(() => saveChecklistAction(job.id, "qc", qc), "QC saved")}>Save QC</button>
        </div>
      )}

      {canDeliver && ["ready", "quality_check", "in_repair"].includes(job.status) && (
        <div className="card space-y-3 p-4">
          <h2 className="font-medium">Handover</h2>
          <p className="text-sm">Total {formatPKR(job.total)} · advance {formatPKR(job.advance)} · <strong>due {formatPKR(due)}</strong></p>
          {due > 0 && <select value={method} onChange={(e) => setMethod(e.target.value)} className="input h-10"><option value="cash">Cash</option><option value="card">Card</option><option value="raast">Raast</option><option value="jazzcash">JazzCash</option><option value="easypaisa">Easypaisa</option><option value="wallet">Store credit</option></select>}
          <button type="button" className="btn btn-primary w-full" disabled={pending} onClick={() => run(() => deliverRepairAction(job.id, due > 0 ? [{ method, amount: due }] : [], sessionId ?? undefined), "Delivered — warranty issued, passcode deleted.")}>Collect {formatPKR(due)} & hand over</button>
        </div>
      )}

      <button type="button" onClick={() => window.print()} className="btn btn-ghost w-full"><Printer className="size-4" />Print job card</button>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
