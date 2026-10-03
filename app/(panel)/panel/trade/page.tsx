import { requirePermission, can } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabase/server";
import { formatPKR } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { Empty, PageHead, StatusPill } from "@/components/panel/ui";
import { ApproveTrade, CreateFromInquiry, KhataPayment } from "./TradeClient";

export default async function TradePage() {
  const staff = await requirePermission("trade.manage", "redirect");
  const sb = supabaseAdmin();
  const [{ data: accounts }, { data: apps }, { data: tiers }] = await Promise.all([
    sb.from("trade_accounts").select("id, shop_name, location, status, credit_limit, terms_days, customer_id, customers(name, phone), price_tiers(key, name)").order("created_at", { ascending: false }),
    sb.from("inquiries").select("id, name, phone, message, meta, created_at, status").eq("kind", "trade").neq("status", "closed").order("created_at", { ascending: false }),
    sb.from("price_tiers").select("key, name"),
  ]);
  const balances = await Promise.all((accounts ?? []).map(async (a) => Number((await sb.rpc("khata_balance", { p_customer: a.customer_id })).data ?? 0)));

  return (
    <div className="space-y-10">
      <PageHead title="Trade accounts (Technician Pro)" sub="Tiered pricing, credit limits and digital khata." />
      {!!apps?.length && (
        <section>
          <h2 className="mb-3 font-display text-xl font-semibold">New applications</h2>
          <div className="space-y-2">{apps.map((a) => (
            <div key={a.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div><p className="font-medium">{(a.meta as { shop_name?: string }).shop_name ?? a.name} <span className="text-ink-3">· {a.name} · {a.phone}</span></p><p className="text-sm text-ink-3">{a.message} · {formatDateTime(a.created_at)}</p></div>
              <CreateFromInquiry inquiryId={a.id} />
            </div>
          ))}</div>
        </section>
      )}
      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Accounts</h2>
        {!accounts?.length ? <Empty>No trade accounts yet.</Empty> : (
          <div className="card overflow-x-auto"><table className="table">
            <thead><tr><th>Shop</th><th>Status</th><th>Tier</th><th className="num">Limit</th><th className="num">Khata balance</th><th /></tr></thead>
            <tbody>{accounts.map((a, i) => { const c = a.customers as unknown as { name: string; phone: string }; const t = a.price_tiers as unknown as { name: string } | null; return (
              <tr key={a.id}>
                <td>{a.shop_name}<p className="text-xs text-ink-3">{c.phone} · {a.location}</p></td><td><StatusPill status={a.status} /></td><td>{t?.name ?? "—"}</td>
                <td className="num">{formatPKR(a.credit_limit)}</td><td className={balances[i] > Number(a.credit_limit) ? "num text-danger" : "num font-semibold"}>{formatPKR(balances[i])}</td>
                <td className="space-y-2">
                  {a.status === "pending" && <ApproveTrade id={a.id} tiers={tiers ?? []} canLimit={can(staff, "trade.credit_limit.edit")} />}
                  {a.status === "approved" && balances[i] > 0 && <KhataPayment customerId={a.customer_id} />}
                </td>
              </tr>
            ); })}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
