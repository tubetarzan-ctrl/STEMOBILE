"use client";
import { useState, useTransition } from "react";
import { approveTradeAction, tradePaymentAction } from "@/app/actions/panel";
import { createTradeFromInquiryAction } from "./actions";
import { rupeesToPaisa } from "@/lib/money";

export function ApproveTrade({ id, tiers, canLimit }: { id: string; tiers: { key: string; name: string }[]; canLimit: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget);
      start(async () => { const r = await approveTradeAction(id, true, canLimit ? rupeesToPaisa(String(f.get("limit") || "0")) ?? 0 : 0, String(f.get("tier"))); setMsg(r.ok ? "Approved" : r.error); }); }}>
      <select name="tier" className="input h-9 w-32">{tiers.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}</select>
      {canLimit && <input name="limit" className="input h-9 w-28" placeholder="Limit Rs" inputMode="decimal" />}
      <button className="btn btn-primary btn-sm" disabled={pending}>Approve</button>
      <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => start(async () => { const r = await approveTradeAction(id, false, 0, "retail"); setMsg(r.ok ? "Rejected" : r.error); })}>Reject</button>
      {msg && <span className="text-xs">{msg}</span>}
    </form>
  );
}

export function KhataPayment({ customerId }: { customerId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget);
      start(async () => { const r = await tradePaymentAction(customerId, rupeesToPaisa(String(f.get("amt"))) ?? 0, String(f.get("m")), String(f.get("ref") || "")); setMsg(r.ok ? "Received" : r.error); }); }}>
      <input name="amt" required className="input h-9 w-28" placeholder="Rs" inputMode="decimal" />
      <select name="m" className="input h-9 w-28"><option value="cash">Cash</option><option value="raast">Raast</option><option value="bank_transfer">Bank</option></select>
      <input name="ref" className="input h-9 w-28" placeholder="Ref" />
      <button className="btn btn-ghost btn-sm" disabled={pending}>Receive</button>{msg && <span className="text-xs">{msg}</span>}
    </form>
  );
}

export function CreateFromInquiry({ inquiryId }: { inquiryId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return <span><button className="btn btn-primary btn-sm" disabled={pending} onClick={() => start(async () => { const r = await createTradeFromInquiryAction(inquiryId); setMsg(r.ok ? "Account created (pending)" : r.error); })}>Create account</button>{msg && <span className="ml-2 text-xs">{msg}</span>}</span>;
}
