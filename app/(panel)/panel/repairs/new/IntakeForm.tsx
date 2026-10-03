"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRepairJobAction } from "@/app/actions/panel";
import { ISSUES } from "@/lib/grades";
import { rupeesToPaisa } from "@/lib/money";
import { cn } from "@/lib/utils";

const CHECKS = ["screen", "body", "buttons", "cameras", "face_id_fingerprint", "charging", "speaker_mic", "water_damage"] as const;

export function IntakeForm({ devices, techs, sessionId }: { devices: { id: string; name: string }[]; techs: { id: string; name: string }[]; sessionId: string | null }) {
  const [issues, setIssues] = useState<string[]>([]);
  const [cond, setCond] = useState<Record<string, string>>(Object.fromEntries(CHECKS.map((c) => [c, "ok"])));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        if (!issues.length) return setError("Pick at least one issue");
        start(async () => {
          const r = await createRepairJobAction({
            phone: String(f.get("phone")), name: String(f.get("name")), device_id: String(f.get("device") || "") || null,
            device_label: String(f.get("device_label") || "") || devices.find((d) => d.id === f.get("device"))?.name, imei: String(f.get("imei") || "") || null,
            issues, condition: cond, passcode: String(f.get("passcode") || "") || undefined,
            estimate: rupeesToPaisa(String(f.get("estimate") || "0")) ?? 0, labour: rupeesToPaisa(String(f.get("labour") || "0")) ?? 0,
            advance: rupeesToPaisa(String(f.get("advance") || "0")) ?? 0, advance_method: String(f.get("advance_method")),
            drawer_session_id: sessionId, technician_id: String(f.get("tech") || "") || null,
            promised_at: f.get("promised") ? new Date(String(f.get("promised"))).toISOString() : null, status: "received", notes: String(f.get("notes") || ""),
          });
          if (!r.ok) return setError(r.error);
          router.push(`/panel/repairs/${r.data.job_id}`);
        });
      }}
    >
      <section className="card grid gap-3 p-5 sm:grid-cols-2">
        <label className="space-y-1"><span className="label">Customer mobile</span><input name="phone" required className="input" inputMode="tel" /></label>
        <label className="space-y-1"><span className="label">Customer name</span><input name="name" required className="input" /></label>
        <label className="space-y-1"><span className="label">Device</span><select name="device" className="input"><option value="">Other…</option>{devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <label className="space-y-1"><span className="label">If other / variant</span><input name="device_label" className="input" /></label>
        <label className="space-y-1"><span className="label">IMEI</span><input name="imei" className="input font-mono" inputMode="numeric" maxLength={17} /></label>
        <label className="space-y-1"><span className="label">Passcode (optional · encrypted)</span><input name="passcode" type="password" autoComplete="off" className="input" /></label>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-medium">Issues</h2>
        <div className="flex flex-wrap gap-2">
          {[...ISSUES.map((i) => [i.key, i.label] as const), ["water_damage", "Water damage"] as const, ["software", "Software"] as const, ["other", "Other"] as const].map(([k, l]) => (
            <button key={k} type="button" aria-pressed={issues.includes(k)} onClick={() => setIssues((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))} className={cn("badge px-3 py-1.5 text-sm", issues.includes(k) && "border-accent bg-accent text-accent-ink")}>{l}</button>
          ))}
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-medium">Condition checklist (at check-in)</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {CHECKS.map((c) => (
            <div key={c} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-sm">
              <span className="capitalize">{c.replace(/_/g, " ")}</span>
              <div className="flex gap-1" role="radiogroup" aria-label={c}>
                {(c === "water_damage" ? ["no", "yes", "unknown"] : ["ok", "faulty", "untestable"]).map((v) => (
                  <button key={v} type="button" role="radio" aria-checked={cond[c] === v} onClick={() => setCond((s) => ({ ...s, [c]: v }))} className={cn("rounded-md px-2 py-0.5 text-xs", cond[c] === v ? "bg-accent text-accent-ink" : "text-ink-3")}>{v}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-ink-3">Check-in photos are added on the job page (stored privately).</p>
      </section>

      <section className="card grid gap-3 p-5 sm:grid-cols-3">
        <label className="space-y-1"><span className="label">Estimate (Rs)</span><input name="estimate" className="input" inputMode="decimal" /></label>
        <label className="space-y-1"><span className="label">Labour (Rs)</span><input name="labour" className="input" inputMode="decimal" /></label>
        <label className="space-y-1"><span className="label">Promised by</span><input name="promised" type="datetime-local" className="input" /></label>
        <label className="space-y-1"><span className="label">Advance (Rs)</span><input name="advance" className="input" inputMode="decimal" /></label>
        <label className="space-y-1"><span className="label">Advance paid by</span><select name="advance_method" className="input"><option value="cash">Cash</option><option value="raast">Raast</option><option value="card">Card</option><option value="jazzcash">JazzCash</option><option value="easypaisa">Easypaisa</option></select></label>
        <label className="space-y-1"><span className="label">Technician</span><select name="tech" className="input"><option value="">Unassigned</option>{techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label className="space-y-1 sm:col-span-3"><span className="label">Notes</span><textarea name="notes" rows={2} className="input" /></label>
      </section>
      {!sessionId && <p className="text-sm text-warn">No cash drawer is open — cash advances will post to Counter 1 without a drawer session.</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button className="btn btn-primary" disabled={pending}>{pending ? "Creating…" : "Create job & print job card"}</button>
    </form>
  );
}
