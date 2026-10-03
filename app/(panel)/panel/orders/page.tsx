import Link from "next/link";
import { requirePermission, can } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabase/server";
import { formatPKR } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { Empty, PageHead, StatusPill } from "@/components/panel/ui";
import { cn } from "@/lib/utils";
import { OrderActions } from "./OrderActions";

const FILTERS = [["open", "Open"], ["call", "COD call queue"], ["payment_submitted", "Payment to verify"], ["confirmed", "To pack"], ["packed", "To dispatch"], ["dispatched", "In transit"], ["closed", "Closed"]] as const;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const staff = await requirePermission("orders.view", "redirect");
  const { filter = "open" } = await searchParams;
  const sb = supabaseAdmin();
  let q = sb.from("orders").select("id, order_no, status, payment_method, delivery_method, total, paid_amount, risk_score, risk_flags, city, created_at, address, customers(name, phone), cod_confirmations(call_queue, response), payments(id, status, amount, proof_path, reference), shipments(tracking_no, provider, status)")
    .order("created_at", { ascending: false }).limit(100);
  if (filter === "open") q = q.not("status", "in", "(delivered,cancelled,rto,returned)");
  else if (filter === "closed") q = q.in("status", ["delivered", "cancelled", "rto", "returned"]);
  else if (filter !== "call") q = q.eq("status", filter);
  let { data } = await q;
  if (filter === "call") data = (data ?? []).filter((o) => (o.cod_confirmations as unknown as { call_queue: boolean }[])?.[0]?.call_queue);

  // short-lived signed URLs for payment proofs (private bucket)
  const proofUrls = new Map<string, string>();
  for (const o of data ?? []) for (const p of (o.payments as { id: string; status: string; proof_path: string | null }[]) ?? []) {
    if (p.status === "pending" && p.proof_path) {
      const { data: s } = await sb.storage.from("payment-proofs").createSignedUrl(p.proof_path.replace(/^payment-proofs\//, ""), 600);
      if (s) proofUrls.set(p.id, s.signedUrl);
    }
  }

  return (
    <div>
      <PageHead title="Online orders" sub="Stock is reserved at checkout; revenue posts on delivery." />
      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
        {FILTERS.map(([k, l]) => <Link key={k} href={`/panel/orders?filter=${k}`} className={cn("whitespace-nowrap border-b-2 px-4 py-2 text-sm", filter === k ? "border-accent" : "border-transparent text-ink-3 hover:text-ink")}>{l}</Link>)}
      </nav>
      {!data?.length ? <Empty>No orders here.</Empty> : (
        <div className="space-y-3">
          {data.map((o) => {
            const c = o.customers as unknown as { name: string; phone: string };
            const pays = (o.payments as { id: string; status: string; amount: number; reference: string | null }[]) ?? [];
            const ship = (o.shipments as { tracking_no: string; provider: string; status: string }[])?.[0];
            return (
              <div key={o.id} className="card grid gap-4 p-4 lg:grid-cols-[1fr_auto]">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold">{o.order_no}</span><StatusPill status={o.status} />
                    <span className="badge">{o.payment_method.replace("_", " ")}</span><span className="badge">{o.delivery_method}</span>
                    {o.risk_score >= 40 && <span className="badge text-warn" title={(o.risk_flags as string[]).join(", ")}>COD risk {o.risk_score}</span>}
                  </div>
                  <p className="text-sm">{c?.name} · <a className="text-accent" href={`tel:${c?.phone}`}>{c?.phone}</a> · {o.city} <span className="text-ink-3">· {formatDateTime(o.created_at)}</span></p>
                  {(o.address as { line1?: string })?.line1 && <p className="text-sm text-ink-3">{(o.address as { line1: string }).line1}</p>}
                  {ship && <p className="text-sm text-ink-3">Courier {ship.provider} · <span className="font-mono">{ship.tracking_no}</span> · {ship.status}</p>}
                  {pays.filter((p) => p.status === "pending").map((p) => (
                    <p key={p.id} className="text-sm">Proof: {formatPKR(p.amount)} {p.reference && <span className="text-ink-3">ref {p.reference}</span>} {proofUrls.get(p.id) && <a href={proofUrls.get(p.id)} target="_blank" rel="noopener" className="text-accent underline">view receipt</a>}</p>
                  ))}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <p className="money font-display text-xl font-semibold">{formatPKR(o.total)}</p>
                  {Number(o.paid_amount) > 0 && <p className="text-xs text-trust">paid {formatPKR(o.paid_amount)}</p>}
                  <OrderActions order={{ id: o.id, status: o.status, payment_method: o.payment_method, delivery_method: o.delivery_method, pendingPaymentId: pays.find((p) => p.status === "pending")?.id }}
                    canManage={can(staff, "orders.manage")} canVerify={can(staff, "orders.verify_payment")} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
