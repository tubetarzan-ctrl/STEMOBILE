import { requirePermission, can } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabase/server";
import { formatPKR } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { PageHead, StatusPill } from "@/components/panel/ui";
import { CloseDrawer, DayActions } from "./ClosingClient";

export default async function ClosingPage() {
  const staff = await requirePermission("pos.drawer", "redirect");
  const sb = supabaseAdmin();
  const [{ data: open }, { data: days }] = await Promise.all([
    sb.from("drawer_sessions").select("id, opened_at, opening_float, business_date, cash_drawers(name)").eq("status", "open"),
    sb.from("business_days").select("date, status, summary, closed_at, verified_at").order("date", { ascending: false }).limit(14),
  ]);
  const expected = await Promise.all((open ?? []).map(async (s) => (await sb.rpc("drawer_expected", { p_session: s.id })).data as number));
  const fin = can(staff, "reports.financial.view");

  return (
    <div className="space-y-10">
      <PageHead title="Daily closing" sub="Count each drawer; variance posts to Cash Over / Cash Short automatically. The day locks at 23:59 PKT." />
      <section className="grid gap-4 lg:grid-cols-2">
        {(open ?? []).length === 0 && <p className="text-ink-3">No open drawers.</p>}
        {(open ?? []).map((s, i) => (
          <CloseDrawer key={s.id} session={{ id: s.id, name: (s.cash_drawers as unknown as { name: string }).name, openedAt: formatDateTime(s.opened_at), float: Number(s.opening_float) }} expected={fin ? Number(expected[i] ?? 0) : null} />
        ))}
      </section>
      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Closed days</h2>
        <div className="card overflow-x-auto"><table className="table">
          <thead><tr><th>Date</th><th>Status</th>{fin && <th className="num">Revenue</th>}{fin && <th className="num">Gross profit</th>}<th className="num">Sales</th><th>Drawers</th><th /></tr></thead>
          <tbody>{(days ?? []).map((d) => {
            const s = (d.summary ?? {}) as { revenue?: number; gross_profit?: number; sales_count?: number; drawers?: { drawer: string; variance: number | null; not_counted: boolean }[] };
            return (
              <tr key={d.date}>
                <td className="font-mono">{d.date}</td><td><StatusPill status={d.status} /></td>
                {fin && <td className="num">{formatPKR(s.revenue ?? 0)}</td>}{fin && <td className="num">{formatPKR(s.gross_profit ?? 0)}</td>}
                <td className="num">{s.sales_count ?? 0}</td>
                <td className="text-xs">{(s.drawers ?? []).map((x) => <span key={x.drawer} className={x.not_counted ? "text-danger" : Math.abs(x.variance ?? 0) > 0 ? "text-warn" : "text-ink-3"}>{x.drawer}: {x.not_counted ? "not counted" : formatPKR(x.variance ?? 0)} </span>)}</td>
                <td>{can(staff, "accounts.period.close") && <DayActions date={d.date} status={d.status} />}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
        {can(staff, "accounts.period.close") && <div className="mt-4"><DayActions date={null} status="open" /></div>}
      </section>
    </div>
  );
}
