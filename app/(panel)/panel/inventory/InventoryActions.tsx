"use client";
import { useState, useTransition } from "react";
import { approveAdjustmentAction, requestAdjustmentAction } from "@/app/actions/panel";

export function AdjustmentButtons({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const act = (ok: boolean) => start(async () => { const r = await approveAdjustmentAction(id, ok); if (!r.ok) setErr(r.error); });
  return (
    <span className="flex items-center gap-1">
      <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => act(true)}>Approve</button>
      <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => act(false)}>Reject</button>
      {err && <span className="text-xs text-danger">{err}</span>}
    </span>
  );
}

/** Request a stock adjustment by SKU (needs approval before it posts). */
export function AdjustForm({ locations }: { locations: { id: number; code: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <details className="card p-4">
      <summary className="cursor-pointer text-sm font-medium">Request stock adjustment</summary>
      <form
        className="mt-3 grid gap-3 sm:grid-cols-[1fr_140px_100px_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          start(async () => {
            const res = await fetch(`/api/panel/variant?sku=${encodeURIComponent(String(f.get("sku")))}`).then((r) => r.json());
            if (!res.id) return setMsg("SKU not found");
            const r = await requestAdjustmentAction(res.id, Number(f.get("location")), Number(f.get("qty")), String(f.get("reason")));
            setMsg(r.ok ? "Requested — waiting for approval." : r.error);
          });
        }}
      >
        <input name="sku" required className="input" placeholder="SKU" />
        <select name="location" className="input">{locations.filter((l) => l.code !== "RESERVED").map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
        <input name="qty" required type="number" className="input" placeholder="±qty" />
        <input name="reason" required className="input" placeholder="Reason (damaged, found, count…)" />
        <button className="btn btn-primary" disabled={pending}>Request</button>
        {msg && <p className="text-sm text-ink-2 sm:col-span-5">{msg}</p>}
      </form>
    </details>
  );
}
