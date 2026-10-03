"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatPKR } from "@/lib/money";
import { respondEstimateAction, uploadProofAction } from "./actions";
import type { BankAccount } from "@/lib/data/bank";
import { BankDetails } from "@/components/store/BankDetails";

export function ApproveEstimate({ token, estimate }: { token: string; estimate: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  const act = (approve: boolean) => start(async () => {
    const r = await respondEstimateAction(token, approve);
    setMsg(r.ok ? (approve ? "Approved — we're continuing the repair." : "Declined — your phone is ready to collect.") : r.error);
    router.refresh();
  });
  return (
    <div className="card space-y-3 p-5" style={{ borderColor: "var(--warn)" }}>
      <p className="font-medium">Revised estimate: <span className="money">{formatPKR(estimate)}</span></p>
      {msg ? <p className="text-sm text-ink-2">{msg}</p> : (
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1" disabled={pending} onClick={() => act(true)}>Approve</button>
          <button className="btn btn-ghost flex-1" disabled={pending} onClick={() => act(false)}>Decline</button>
        </div>
      )}
    </div>
  );
}

export function ProofUpload({ orderNo, token, amount, bank }: { orderNo: string; token: string; amount: number; bank: BankAccount | null }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  return (
    <form
      className="card mt-8 space-y-3 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        f.set("orderNo", orderNo); f.set("token", token); f.set("amount", String(amount));
        start(async () => { const r = await uploadProofAction(f); setMsg(r.ok ? "Received — we'll verify it shortly." : r.error); if (r.ok) router.refresh(); });
      }}
    >
      <h2 className="font-display text-lg font-semibold">Upload your transfer receipt</h2>
      <p className="text-sm text-ink-2">Transfer <span className="money font-semibold">{formatPKR(amount)}</span> to the account below, then upload the screenshot or receipt.</p>
      <BankDetails bank={bank} amount={amount} reference={orderNo} />
      <input type="file" name="file" accept="image/*,application/pdf" required className="input pt-2" />
      <input name="reference" className="input" placeholder="Transaction reference (optional)" />
      {msg && <p className="text-sm text-ink-2">{msg}</p>}
      <button className="btn btn-primary" disabled={pending}>{pending ? "Uploading…" : "Submit receipt"}</button>
    </form>
  );
}
