import Link from "next/link";
import { ShieldCheck, Wallet } from "lucide-react";
import { hasSupabase, supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { formatDate } from "@/lib/time";
import { formatPKR } from "@/lib/money";

export const metadata = { title: "Warranty wallet", robots: { index: false } };
export const dynamic = "force-dynamic";

type W = { id: string; title: string; starts_on: string; ends_on: string; is_active: boolean; days_left: number; status: string; proof_code: string | null; source_type: string };

export default async function WarrantyPage() {
  if (!hasSupabase) return <Gate text="The warranty wallet needs Supabase configured." />;
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return <Gate text="Sign in with your phone number to see every warranty and store credit on your account." login />;

  // RLS lets a customer read only their own rows; the wallet view is assembled server-side for this customer id.
  const { data: me } = await sb.from("customers").select("id, name, phone").maybeSingle();
  if (!me) return <Gate text="No purchases on this number yet." />;
  const admin = supabaseAdmin();
  const [{ data: rows }, { data: wallet }, { data: points }] = await Promise.all([
    admin.from("v_warranty_wallet").select("id, title, starts_on, ends_on, is_active, days_left, status, proof_code, source_type").eq("customer_id", me.id).order("ends_on", { ascending: false }),
    admin.rpc("wallet_balance", { p_customer: me.id }),
    admin.from("loyalty_ledger").select("points").eq("customer_id", me.id),
  ]);
  const pts = (points ?? []).reduce((a, r) => a + r.points, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-14">
      <p className="eyebrow mb-2">{me.phone}</p>
      <h1 className="font-display text-4xl font-semibold">Warranty wallet</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="card flex items-center gap-4 p-5"><Wallet className="size-6 text-accent" /><div><p className="text-sm text-ink-3">Store credit</p><p className="money font-display text-2xl font-semibold">{formatPKR(Number(wallet ?? 0))}</p></div></div>
        <div className="card flex items-center gap-4 p-5"><ShieldCheck className="size-6 text-trust" /><div><p className="text-sm text-ink-3">Loyalty points</p><p className="font-display text-2xl font-semibold tabular">{pts}</p></div></div>
      </div>
      <ul className="mt-8 space-y-3">
        {(rows as W[] | null)?.length ? (rows as W[]).map((w) => (
          <li key={w.id} className="card flex flex-wrap items-center justify-between gap-4 p-5">
            <div><p className="font-medium">{w.title}</p><p className="text-sm text-ink-3">{formatDate(w.starts_on)} → {formatDate(w.ends_on)}{w.proof_code && <> · <Link className="font-mono text-accent" href={`/verify/${w.proof_code}`}>{w.proof_code}</Link></>}</p></div>
            {w.is_active ? (
              <div className="flex items-center gap-3"><span className="badge text-trust">{w.days_left} days left</span><Link href={`/repair?warranty=${w.id}#book`} className="btn btn-ghost btn-sm">Claim</Link></div>
            ) : <span className="badge text-ink-3">{w.status === "claimed" ? "Claimed" : "Expired"}</span>}
          </li>
        )) : <li className="card p-8 text-center text-ink-3">No warranties yet.</li>}
      </ul>
    </div>
  );
}

function Gate({ text, login }: { text: string; login?: boolean }) {
  return <div className="mx-auto max-w-md px-4 py-20 text-center"><ShieldCheck className="mx-auto size-10 text-trust" /><h1 className="mt-4 font-display text-3xl font-semibold">Warranty wallet</h1><p className="mt-3 text-ink-2">{text}</p>{login && <Link href="/login?next=/warranty" className="btn btn-primary mt-6">Sign in with phone</Link>}</div>;
}
