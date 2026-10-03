"use client";
import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { applyTradeAction } from "@/app/actions/store";

export function TradeForm() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  if (done) return <div className="card grid place-items-center gap-3 p-10 text-center"><CheckCircle2 className="size-10 text-trust" /><p className="font-display text-2xl font-semibold">Application received</p><p className="text-ink-2">We usually approve within one working day and will message you on WhatsApp.</p></div>;
  return (
    <form
      className="card space-y-4 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          const r = await applyTradeAction({ shopName: String(f.get("shop")), name: String(f.get("name")), phone: String(f.get("phone")), area: String(f.get("area")), cnicLast4: String(f.get("cnic") || ""), message: String(f.get("message") || "") });
          if (r.ok) setDone(true); else setError(r.error);
        });
      }}
    >
      <h2 className="font-display text-xl font-semibold">Apply for a trade account</h2>
      <label className="block space-y-1"><span className="label">Shop name</span><input name="shop" required className="input" /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1"><span className="label">Your name</span><input name="name" required className="input" /></label>
        <label className="space-y-1"><span className="label">WhatsApp number</span><input name="phone" required className="input" inputMode="tel" placeholder="03xx xxxxxxx" /></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1"><span className="label">Market / area</span><input name="area" required className="input" placeholder="e.g. Saddar, Karachi" /></label>
        <label className="space-y-1"><span className="label">CNIC last 4 digits (optional)</span><input name="cnic" className="input" inputMode="numeric" maxLength={4} /></label>
      </div>
      <label className="block space-y-1"><span className="label">What do you mostly buy?</span><textarea name="message" rows={3} className="input" /></label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Sending…" : "Apply"}</button>
    </form>
  );
}
