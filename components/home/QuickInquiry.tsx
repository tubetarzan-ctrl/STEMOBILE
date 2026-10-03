"use client";
import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { submitInquiryAction } from "@/app/actions/store";

export function QuickInquiry({ kind = "quick", title = "Quick question?" }: { kind?: "quick" | "special_order" | "contact"; title?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  if (done) {
    return <div className="grid place-items-center rounded-2xl bg-surface-2 p-8 text-center"><CheckCircle2 className="size-8 text-trust" /><p className="mt-3 font-medium">Thanks — we&apos;ll reply on WhatsApp shortly.</p></div>;
  }
  return (
    <form
      className="space-y-3 rounded-2xl bg-surface-2 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          const r = await submitInquiryAction({ kind, name: String(f.get("name")), phone: String(f.get("phone")), message: String(f.get("message")), deviceText: String(f.get("device") || "") || undefined });
          if (r.ok) setDone(true); else setError(r.error);
        });
      }}
    >
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1"><span className="label">Name</span><input name="name" required className="input" autoComplete="name" /></label>
        <label className="space-y-1"><span className="label">WhatsApp number</span><input name="phone" required className="input" inputMode="tel" placeholder="03xx xxxxxxx" autoComplete="tel" /></label>
      </div>
      <label className="block space-y-1"><span className="label">Phone model (optional)</span><input name="device" className="input" /></label>
      <label className="block space-y-1"><span className="label">Message</span><textarea name="message" required rows={3} className="input" /></label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Sending…" : "Send"}</button>
    </form>
  );
}
