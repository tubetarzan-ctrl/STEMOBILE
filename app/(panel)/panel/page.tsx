import Link from "next/link";
import { AlertTriangle, ArrowRight, BadgeAlert, PhoneCall, Wrench } from "lucide-react";
import { can, requireStaff } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabase/server";
import { addDays, businessDate } from "@/lib/time";
import { formatPKR } from "@/lib/money";
import { Kpi, PageHead } from "@/components/panel/ui";
import { RevenueChart, type DayPoint } from "@/components/panel/RevenueChart";
import { CopilotBox } from "./copilot/CopilotBox";

export default async function Cockpit() {
  const staff = await requireStaff();
  const fin = can(staff, "reports.financial.view");
  const sb = supabaseAdmin(); // staff verified above; financial tiles gated by `fin`
  const today = businessDate();
  const from = addDays(today, -13);

  const [sales, alerts, cod, proofs, repairs, khata, dead, days, reviews] = await Promise.all([
    sb.from("sales").select("business_date, total, cost_total, delivery_fee, channel, discount_total").gte("business_date", from),
    sb.from("stock_alerts").select("id, on_hand, is_critical, product_variants(sku, products(name))").eq("status", "open").order("is_critical", { ascending: false }).limit(6),
    sb.from("cod_confirmations").select("order_id", { count: "exact", head: true }).eq("call_queue", true).is("response", null),
    sb.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending"),
    sb.from("repair_jobs").select("id, job_no, device_label, status, promised_at").not("status", "in", "(delivered,cancelled,returned_unrepaired)").order("promised_at"),
    fin ? sb.from("v_khata_aging").select("balance, d60_plus") : Promise.resolve({ data: [] as { balance: number; d60_plus: number }[] }),
    fin ? sb.from("v_dead_stock").select("value_at_cost") : Promise.resolve({ data: [] as { value_at_cost: number }[] }),
    sb.from("business_days").select("date, status, summary").order("date", { ascending: false }).limit(1),
    sb.from("v_review_stats").select("*").maybeSingle(),
  ]);

  const byDay = new Map<string, DayPoint>();
  for (let i = 0; i < 14; i++) { const d = addDays(from, i); byDay.set(d, { date: d, revenue: 0, gross: 0 }); }
  for (const s of sales.data ?? []) {
    const p = byDay.get(s.business_date);
    if (p) { p.revenue += Number(s.total); p.gross += Number(s.total) - Number(s.delivery_fee) - Number(s.cost_total); }
  }
  const series = [...byDay.values()];
  const t = byDay.get(today) ?? { revenue: 0, gross: 0 };
  const yesterday = byDay.get(addDays(today, -1)) ?? { revenue: 0, gross: 0 };
  const todaySales = (sales.data ?? []).filter((s) => s.business_date === today);
  const overdue = (repairs.data ?? []).filter((r) => r.promised_at && new Date(r.promised_at) < new Date());
  const khataTotal = (khata.data ?? []).reduce((a, r) => a + Number(r.balance), 0);
  const khataOverdue = (khata.data ?? []).reduce((a, r) => a + Number(r.d60_plus ?? 0), 0);
  const deadValue = (dead.data ?? []).reduce((a, r) => a + Number(r.value_at_cost), 0);
  const lastDay = days.data?.[0];
  const rs = reviews.data as null | { onsite_avg: number | null; onsite_count: number; google_avg: number | null; google_count: number };

  return (
    <div className="space-y-8">
      <PageHead title={`Salaam, ${staff.fullName.split(" ")[0]}`} sub={`Business day ${today} · Asia/Karachi`}>
        {can(staff, "pos.sell") && <Link href="/panel/pos" className="btn btn-primary btn-sm">Open POS</Link>}
        {can(staff, "repairs.manage") && <Link href="/panel/repairs/new" className="btn btn-ghost btn-sm">New repair</Link>}
      </PageHead>

      {fin && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi label="Revenue today" paisa={t.revenue} hint={`Yesterday ${formatPKR(yesterday.revenue)}`} />
          <Kpi label="Gross profit today" paisa={t.gross} hint={t.revenue ? `${Math.round((t.gross / t.revenue) * 100)}% margin` : "—"} tone="trust" />
          <Kpi label="Sales today" value={todaySales.length} hint={`${todaySales.filter((s) => s.channel === "online").length} online · ${todaySales.filter((s) => s.channel === "repair").length} repairs`} />
          <Kpi label="Khata outstanding" paisa={khataTotal} hint={khataOverdue ? `${formatPKR(khataOverdue)} over 60 days` : "Nothing overdue"} tone={khataOverdue ? "warn" : undefined} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        {fin ? <RevenueChart data={series} /> : <div className="card p-5 text-ink-3">Financial charts are visible to the owner and accountant.</div>}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-3 font-display text-lg font-semibold">Needs attention</h2>
            <ul className="space-y-2 text-sm">
              <Attn href="/panel/orders?filter=call" icon={PhoneCall} n={cod.count ?? 0} label="COD orders to call (unconfirmed)" />
              <Attn href="/panel/orders?filter=payment_submitted" icon={BadgeAlert} n={proofs.count ?? 0} label="Payment proofs to verify" />
              <Attn href="/panel/repairs" icon={Wrench} n={overdue.length} label="Repairs past promised time" />
              <Attn href="/panel/inventory?tab=alerts" icon={AlertTriangle} n={alerts.data?.length ?? 0} label="Low-stock alerts" />
            </ul>
          </div>
          {lastDay && (
            <div className="card p-5 text-sm">
              <p className="flex items-center justify-between"><span className="font-medium">Last closing · {lastDay.date}</span><span className={lastDay.status === "verified" ? "badge text-trust" : "badge text-warn"}>{lastDay.status}</span></p>
              {fin && <p className="mt-2 text-ink-3">Revenue {formatPKR((lastDay.summary as { revenue?: number })?.revenue ?? 0)}</p>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            {fin && <Kpi label="Dead stock (60d+)" paisa={deadValue} />}
            <Kpi label="Rating" value={rs?.google_avg ? `${Number(rs.google_avg).toFixed(1)}★ Google` : rs?.onsite_avg ? `${Number(rs.onsite_avg).toFixed(1)}★` : "—"} hint={`${(rs?.google_count ?? 0) + (rs?.onsite_count ?? 0)} reviews`} />
          </div>
        </div>
      </div>

      {(alerts.data?.length ?? 0) > 0 && (
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-lg font-semibold">Low stock</h2><Link href="/panel/inventory?tab=alerts" className="text-sm text-accent">All alerts</Link></div>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {alerts.data!.map((a) => { const v = a.product_variants as unknown as { sku: string; products: { name: string } }; return (
              <li key={a.id} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-sm"><span className="truncate">{v.products.name}</span><span className={a.is_critical ? "text-danger" : "text-warn"}>{a.on_hand} left</span></li>
            ); })}
          </ul>
        </section>
      )}

      {fin && <CopilotBox />}
    </div>
  );
}

function Attn({ href, icon: Icon, n, label }: { href: string; icon: typeof Wrench; n: number; label: string }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface-2">
        <Icon className={n ? "size-4 text-warn" : "size-4 text-ink-3"} />
        <span className="flex-1">{label}</span>
        <span className={n ? "font-semibold tabular" : "text-ink-3 tabular"}>{n}</span>
        <ArrowRight className="size-3.5 text-ink-3" />
      </Link>
    </li>
  );
}
