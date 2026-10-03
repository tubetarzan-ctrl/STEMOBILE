"use client";
import { useState, useTransition } from "react";
import {
  bookShipmentAction, cancelOrderAction, confirmCodManualAction, markDeliveredAction, markRtoAction, setOrderStatusAction, verifyPaymentAction,
  type ActionResult,
} from "@/app/actions/panel";
import { rupeesToPaisa } from "@/lib/money";

type O = { id: string; status: string; payment_method: string; delivery_method: string; pendingPaymentId?: string };

export function OrderActions({ order: o, canManage, canVerify }: { order: O; canManage: boolean; canVerify: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionResult>) => start(async () => { const r = await fn(); setMsg(r.ok ? null : r.error); });
  const Btn = ({ label, onClick, ghost }: { label: string; onClick: () => void; ghost?: boolean }) => (
    <button type="button" disabled={pending} onClick={onClick} className={`btn btn-sm ${ghost ? "btn-ghost" : "btn-primary"}`}>{label}</button>
  );

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1.5">
        {canVerify && o.pendingPaymentId && <>
          <Btn label="Verify payment" onClick={() => run(() => verifyPaymentAction(o.pendingPaymentId!, true))} />
          <Btn ghost label="Reject proof" onClick={() => run(() => verifyPaymentAction(o.pendingPaymentId!, false))} />
        </>}
        {canManage && o.status === "pending_payment" && o.payment_method === "cod" && <>
          <Btn label="Confirmed on call" onClick={() => run(() => confirmCodManualAction(o.id, true))} />
          <Btn ghost label="Customer cancelled" onClick={() => run(() => confirmCodManualAction(o.id, false))} />
        </>}
        {canManage && o.status === "confirmed" && <Btn label="Mark packed" onClick={() => run(() => setOrderStatusAction(o.id, "packed"))} />}
        {canManage && o.status === "packed" && (o.delivery_method === "courier"
          ? <Btn label="Book courier" onClick={() => run(() => bookShipmentAction(o.id))} />
          : <Btn label={o.delivery_method === "pickup" ? "Ready (notify)" : "Out with rider"} onClick={() => run(() => setOrderStatusAction(o.id, "dispatched"))} />)}
        {canManage && ["confirmed", "packed", "dispatched"].includes(o.status) && <Btn label="Delivered" onClick={() => run(() => markDeliveredAction(o.id))} />}
        {canManage && o.status === "dispatched" && <Btn ghost label="RTO" onClick={() => { const loss = prompt("Shipping loss (Rs)", "250"); if (loss !== null) run(() => markRtoAction(o.id, rupeesToPaisa(loss) ?? 0)); }} />}
        {canManage && ["pending_payment", "payment_submitted", "confirmed", "packed"].includes(o.status) && (
          <Btn ghost label="Cancel" onClick={() => { const r = prompt("Reason for cancelling?"); if (r) run(() => cancelOrderAction(o.id, r)); }} />
        )}
      </div>
      {msg && <p className="max-w-xs text-right text-xs text-danger">{msg}</p>}
    </div>
  );
}
