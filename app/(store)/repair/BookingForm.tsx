"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { bookRepairAction } from "@/app/actions/store";
import { saveTracking } from "@/lib/client/my-tracking";
import { ISSUES } from "@/lib/grades";
import { cn } from "@/lib/utils";

export function BookingForm({ devices, initial }: { devices: { id: string; name: string }[]; initial: { device?: string; issue?: string } }) {
  const [issues, setIssues] = useState<string[]>(initial.issue ? [initial.issue] : []);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ jobNo: string; trackingRef: string } | null>(null);

  if (done) {
    return (
      <div className="card grid place-items-center gap-3 p-10 text-center">
        <CheckCircle2 className="size-10 text-trust" />
        <p className="font-display text-2xl font-semibold">Booked — {done.jobNo}</p>
        <p className="text-ink-2">We&apos;ve sent the details on WhatsApp. Bring your phone and charger.</p>
        <Link href={`/track/${done.trackingRef}`} className="btn btn-primary mt-2">Open live tracker</Link>
        <p className="text-sm text-ink-3">Later, tap <b>Track</b> at the top of the website and enter <b className="font-mono">{done.jobNo}</b> + your mobile number.</p>
      </div>
    );
  }
  return (
    <form
      className="card space-y-4 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        if (issues.length === 0) { setError("Pick at least one problem"); return; }
        start(async () => {
          const r = await bookRepairAction({
            name: String(f.get("name")), phone: String(f.get("phone")), deviceId: String(f.get("device") || "") || undefined,
            deviceLabel: String(f.get("other") || "") || undefined, issues, notes: String(f.get("notes") || "") || undefined,
            preferredAt: f.get("when") ? new Date(String(f.get("when"))).toISOString() : undefined,
          });
          if (r.ok) { setDone(r.data); saveTracking({ no: r.data.jobNo, url: `/track/${r.data.trackingRef}`, kind: "repair" }); } else setError(r.error);
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1"><span className="label">Name</span><input name="name" required className="input" autoComplete="name" /></label>
        <label className="space-y-1"><span className="label">WhatsApp number</span><input name="phone" required className="input" inputMode="tel" placeholder="03xx xxxxxxx" /></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1"><span className="label">Phone model</span>
          <select name="device" defaultValue={initial.device ?? ""} className="input">
            <option value="">Other / not listed</option>
            {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label className="space-y-1"><span className="label">If not listed</span><input name="other" className="input" placeholder="e.g. Honor X9b" /></label>
      </div>
      <fieldset>
        <legend className="label mb-2">What&apos;s wrong?</legend>
        <div className="flex flex-wrap gap-2">
          {ISSUES.map((i) => (
            <button key={i.key} type="button" aria-pressed={issues.includes(i.key)} onClick={() => setIssues((s) => (s.includes(i.key) ? s.filter((x) => x !== i.key) : [...s, i.key]))}
              className={cn("badge px-3 py-1.5 text-sm", issues.includes(i.key) && "border-accent bg-accent text-accent-ink")}>{i.label}</button>
          ))}
          {["water_damage", "software", "other"].map((k) => (
            <button key={k} type="button" aria-pressed={issues.includes(k)} onClick={() => setIssues((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))}
              className={cn("badge px-3 py-1.5 text-sm capitalize", issues.includes(k) && "border-accent bg-accent text-accent-ink")}>{k.replace("_", " ")}</button>
          ))}
        </div>
      </fieldset>
      <label className="block space-y-1"><span className="label">Preferred drop-off time</span><input type="datetime-local" name="when" className="input" /></label>
      <label className="block space-y-1"><span className="label">Notes</span><textarea name="notes" rows={2} className="input" /></label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Booking…" : "Book repair"}</button>
    </form>
  );
}
