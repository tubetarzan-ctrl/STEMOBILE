import Link from "next/link";
import { Check, CircleDashed } from "lucide-react";
import { hasSupabase, supabasePublic } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { formatPKR } from "@/lib/money";
import { formatDateTime, formatDate } from "@/lib/time";
import { gradeLabel } from "@/lib/grades";
import { cn } from "@/lib/utils";
import { ApproveEstimate, ProofUpload } from "./TrackActions";
import { getBankAccount } from "@/lib/data/bank";

export const metadata = { title: "Live tracker", robots: { index: false } };
export const dynamic = "force-dynamic";

const REPAIR_STEPS = [
  ["booked", "Booked"], ["received", "Checked in"], ["diagnosing", "Diagnosing"], ["awaiting_approval", "Awaiting your approval"],
  ["awaiting_parts", "Waiting for parts"], ["in_repair", "Repairing"], ["quality_check", "Quality check"], ["ready", "Ready for pickup"], ["delivered", "Handed over"],
] as const;
const ORDER_STEPS = [
  ["pending_payment", "Order placed"], ["payment_submitted", "Payment submitted"], ["confirmed", "Confirmed"], ["packed", "Packed"],
  ["dispatched", "On the way"], ["delivered", "Delivered"],
] as const;

function Timeline({ steps, current, history }: { steps: readonly (readonly [string, string])[]; current: string; history: { status: string; at: string }[] }) {
  const idx = steps.findIndex(([k]) => k === current);
  return (
    <ol className="relative space-y-6 border-l border-line pl-8">
      {steps.map(([k, label], i) => {
        const done = i < idx || current === "delivered";
        const now = i === idx && current !== "delivered";
        const at = history.filter((h) => h.status === k).at(-1)?.at;
        if (k === "awaiting_approval" && !at && !now) return null;
        if (k === "awaiting_parts" && !at && !now) return null;
        if (k === "payment_submitted" && !at && !now) return null;
        return (
          <li key={k} className="relative">
            <span className={cn("absolute -left-[41px] grid size-5 place-items-center rounded-full border-2", done ? "border-trust bg-trust text-bg" : now ? "border-accent bg-accent pulse-dot" : "border-line bg-surface-1")}>
              {done ? <Check className="size-3" /> : !now ? <CircleDashed className="size-3 text-ink-3" /> : null}
            </span>
            <p className={cn("font-medium", !done && !now && "text-ink-3")}>{label}</p>
            {at && <p className="text-xs text-ink-3">{formatDateTime(at)}</p>}
          </li>
        );
      })}
    </ol>
  );
}

export default async function TrackRefPage({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<{ t?: string; approve?: string }> }) {
  const ref = decodeURIComponent((await params).ref).toUpperCase();
  const { t, approve } = await searchParams;
  if (!(await rateLimit("track", 30, 60_000))) return <p className="p-20 text-center">Too many lookups — please wait a minute.</p>;
  if (!hasSupabase) {
    return <div className="mx-auto max-w-xl px-4 py-20 text-center"><h1 className="font-display text-3xl font-semibold">Demo mode</h1><p className="mt-3 text-ink-2">Connect Supabase to see live order and repair tracking.</p></div>;
  }
  const sb = supabasePublic();

  if (ref.startsWith("ST-")) {
    const { data } = await sb.rpc("track_order", { p_order_no: ref, p_token: t ?? "" });
    const o = data as null | { order_no: string; status: string; payment_method: string; total: number; paid: number; delivery_fee: number; items: { name: string; grade: string; qty: number; line_total: number }[]; events: { status: string; at: string; note: string }[]; shipment: { provider: string; tracking_no: string } | null };
    if (!o) return <NotFound />;
    return (
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-14 md:grid-cols-[1fr_340px]">
        <div>
          <p className="eyebrow mb-2">Order</p>
          <h1 className="mb-8 font-display text-4xl font-semibold">{o.order_no}</h1>
          {["cancelled", "rto", "returned"].includes(o.status)
            ? <p className="card p-5 text-danger">This order was {o.status === "rto" ? "returned to us" : o.status}.</p>
            : <Timeline steps={ORDER_STEPS} current={o.status} history={o.events ?? []} />}
          {o.shipment && <p className="mt-6 text-sm text-ink-2">Courier: {o.shipment.provider} · <span className="font-mono">{o.shipment.tracking_no}</span></p>}
          {o.payment_method === "bank_transfer" && o.status === "pending_payment" && <ProofUpload orderNo={o.order_no} token={t ?? ""} amount={Number(o.total)} bank={getBankAccount()} />}
        </div>
        <aside className="card h-fit space-y-3 p-5 text-sm">
          {o.items?.map((i, k) => <div key={k} className="flex justify-between gap-3"><span className="text-ink-2">{i.qty} × {i.name}{i.grade !== "NA" && ` (${gradeLabel(i.grade)})`}</span><span className="money">{formatPKR(i.line_total)}</span></div>)}
          <div className="flex justify-between border-t border-line pt-3"><span>Delivery</span><span className="money">{formatPKR(o.delivery_fee)}</span></div>
          <div className="flex justify-between font-semibold"><span>Total</span><span className="money">{formatPKR(o.total)}</span></div>
          {Number(o.paid) > 0 && <div className="flex justify-between text-trust"><span>Paid</span><span className="money">{formatPKR(o.paid)}</span></div>}
        </aside>
      </div>
    );
  }

  const { data } = await sb.rpc("track_repair", { p_ref: ref });
  const j = data as null | { job_no: string; device: string; status: string; issues: string[]; promised_at: string | null; estimate: number; awaiting_approval: boolean; history: { status: string; at: string }[]; warranty_ends: string | null };
  if (!j) return <NotFound />;
  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-14 md:grid-cols-[1fr_320px]">
      <div>
        <p className="eyebrow mb-2">Repair {j.job_no}</p>
        <h1 className="mb-8 font-display text-4xl font-semibold">{j.device}</h1>
        {["cancelled", "returned_unrepaired"].includes(j.status) ? <p className="card p-5">This job was closed without repair. Your device is ready to collect.</p>
          : <Timeline steps={REPAIR_STEPS} current={j.status} history={j.history ?? []} />}
      </div>
      <aside className="space-y-4">
        <div className="card space-y-2 p-5 text-sm">
          <p className="flex justify-between"><span className="text-ink-3">Problem</span><span className="capitalize">{j.issues.join(", ").replace(/_/g, " ")}</span></p>
          <p className="flex justify-between"><span className="text-ink-3">Estimate</span><span className="money">{formatPKR(j.estimate)}</span></p>
          {j.promised_at && <p className="flex justify-between"><span className="text-ink-3">Promised</span><span>{formatDateTime(j.promised_at)}</span></p>}
          {j.warranty_ends && <p className="flex justify-between"><span className="text-ink-3">Warranty to</span><span className="text-trust">{formatDate(j.warranty_ends)}</span></p>}
        </div>
        {j.awaiting_approval && approve && <ApproveEstimate token={approve} estimate={Number(j.estimate)} />}
        {j.status === "delivered" && <Link href="/reviews/new" className="btn btn-primary w-full">Review your repair</Link>}
      </aside>
    </div>
  );
}

function NotFound() {
  return <div className="mx-auto max-w-xl px-4 py-20 text-center"><h1 className="font-display text-3xl font-semibold">Not found</h1><p className="mt-3 text-ink-2">Check the code or open the link from your WhatsApp message.</p><Link href="/track" className="btn btn-ghost mt-6">Try again</Link></div>;
}
