import Link from "next/link";
import { requirePermission, can } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabase/server";
import { formatPKR } from "@/lib/money";
import { gradeLabel } from "@/lib/grades";
import { formatDateTime } from "@/lib/time";
import { Empty, PageHead } from "@/components/panel/ui";
import { cn } from "@/lib/utils";
import { AdjustmentButtons, AdjustForm } from "./InventoryActions";

const TABS = [["stock", "Stock"], ["alerts", "Alerts"], ["adjustments", "Adjustments"], ["reorder", "Smart reorder"], ["dead", "Dead stock"]] as const;

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const staff = await requirePermission("inventory.view", "redirect");
  const { tab = "stock", q } = await searchParams;
  const sb = supabaseAdmin();

  return (
    <div>
      <PageHead title="Inventory" sub="Stock is the sum of movements; cost is landed weighted average.">
        {can(staff, "inventory.receive") && <Link href="/panel/inventory/receive" className="btn btn-primary btn-sm">Receive goods</Link>}
      </PageHead>
      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-line" aria-label="Inventory views">
        {TABS.map(([k, l]) => <Link key={k} href={`/panel/inventory?tab=${k}`} className={cn("border-b-2 px-4 py-2 text-sm", tab === k ? "border-accent text-ink" : "border-transparent text-ink-3 hover:text-ink")}>{l}</Link>)}
      </nav>
      {tab === "stock" && <StockTab q={q} sb={sb} canAdjust={can(staff, "inventory.adjust")} />}
      {tab === "alerts" && <AlertsTab sb={sb} />}
      {tab === "adjustments" && <AdjustmentsTab sb={sb} canApprove={can(staff, "inventory.adjust.approve")} />}
      {tab === "reorder" && <ReorderTab sb={sb} />}
      {tab === "dead" && <DeadTab sb={sb} />}
    </div>
  );
}

type SB = ReturnType<typeof supabaseAdmin>;

async function StockTab({ q, sb, canAdjust }: { q?: string; sb: SB; canAdjust: boolean }) {
  let req = sb.from("v_stock_on_hand").select("*").order("name").limit(300);
  if (q) req = req.or(`name.ilike.%${q.replace(/[%,()]/g, "")}%,sku.ilike.%${q.replace(/[%,()]/g, "")}%`);
  const [{ data }, { data: locations }] = await Promise.all([req, sb.from("locations").select("id, code, name")]);
  const total = (data ?? []).reduce((a, r) => a + Number(r.value), 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <form className="flex-1"><input name="q" defaultValue={q} className="input max-w-sm" placeholder="Search name or SKU" /><input type="hidden" name="tab" value="stock" /></form>
        <p className="text-sm text-ink-3">Shown value at cost: <span className="money font-semibold text-ink">{formatPKR(total)}</span></p>
      </div>
      {canAdjust && <AdjustForm locations={locations ?? []} />}
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Item</th><th>SKU</th><th>Grade</th><th>Location</th><th className="num">On hand</th><th className="num">Avg cost</th><th className="num">Value</th></tr></thead>
          <tbody>
            {(data ?? []).map((r) => (
              <tr key={`${r.variant_id}-${r.location}`}>
                <td>{r.name}</td><td className="font-mono text-xs">{r.sku}</td><td>{gradeLabel(r.grade)}</td><td className="text-ink-3">{r.location}</td>
                <td className={cn("num", r.on_hand <= r.reorder_level && "text-warn", r.on_hand < 0 && "text-danger")}>{r.on_hand}</td>
                <td className="num">{formatPKR(r.avg_cost)}</td><td className="num">{formatPKR(r.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function AlertsTab({ sb }: { sb: SB }) {
  const { data } = await sb.from("stock_alerts").select("id, on_hand, reorder_level, is_critical, created_at, product_variants(sku, products(name))").eq("status", "open").order("is_critical", { ascending: false }).order("created_at");
  if (!data?.length) return <Empty>No open stock alerts.</Empty>;
  return (
    <div className="card overflow-x-auto"><table className="table">
      <thead><tr><th>Item</th><th className="num">On hand</th><th className="num">Reorder at</th><th>Since</th><th /></tr></thead>
      <tbody>{data.map((a) => { const v = a.product_variants as unknown as { sku: string; products: { name: string } }; return (
        <tr key={a.id}><td>{v.products.name} <span className="font-mono text-xs text-ink-3">{v.sku}</span></td><td className="num">{a.on_hand}</td><td className="num">{a.reorder_level}</td><td className="text-ink-3">{formatDateTime(a.created_at)}</td><td>{a.is_critical && <span className="badge text-danger">critical</span>}</td></tr>
      ); })}</tbody>
    </table></div>
  );
}

async function AdjustmentsTab({ sb, canApprove }: { sb: SB; canApprove: boolean }) {
  const { data } = await sb.from("stock_adjustments").select("id, qty, reason, status, requested_at, product_variants(sku, avg_cost, products(name)), locations(code)").order("requested_at", { ascending: false }).limit(100);
  if (!data?.length) return <Empty>No adjustments yet.</Empty>;
  return (
    <div className="card overflow-x-auto"><table className="table">
      <thead><tr><th>Item</th><th>Location</th><th className="num">Qty</th><th className="num">Value</th><th>Reason</th><th>Status</th><th /></tr></thead>
      <tbody>{data.map((a) => { const v = a.product_variants as unknown as { sku: string; avg_cost: number; products: { name: string } }; return (
        <tr key={a.id}>
          <td>{v.products.name} <span className="font-mono text-xs text-ink-3">{v.sku}</span></td><td>{(a.locations as unknown as { code: string }).code}</td>
          <td className={cn("num", a.qty < 0 ? "text-danger" : "text-trust")}>{a.qty > 0 ? "+" : ""}{a.qty}</td><td className="num">{formatPKR(Math.abs(a.qty) * v.avg_cost)}</td>
          <td>{a.reason}</td><td className="capitalize">{a.status}</td>
          <td>{a.status === "pending" && canApprove && <AdjustmentButtons id={a.id} />}</td>
        </tr>
      ); })}</tbody>
    </table></div>
  );
}

async function ReorderTab({ sb }: { sb: SB }) {
  const { data } = await sb.from("v_reorder_suggestions").select("*").order("suggested_qty", { ascending: false }).limit(200);
  if (!data?.length) return <Empty>Nothing needs reordering based on the last 30 days.</Empty>;
  return (
    <div className="card overflow-x-auto"><table className="table">
      <thead><tr><th>Item</th><th className="num">On hand</th><th className="num">Sold / day</th><th className="num">Lead time</th><th className="num">Suggested</th></tr></thead>
      <tbody>{data.map((r) => <tr key={r.variant_id}><td>{r.name} <span className="font-mono text-xs text-ink-3">{r.sku}</span></td><td className="num">{r.on_hand}</td><td className="num">{Number(r.per_day).toFixed(2)}</td><td className="num">{r.lead_time_days}d</td><td className="num font-semibold text-accent">{r.suggested_qty}</td></tr>)}</tbody>
    </table></div>
  );
}

async function DeadTab({ sb }: { sb: SB }) {
  const { data } = await sb.from("v_dead_stock").select("*").order("value_at_cost", { ascending: false }).limit(200);
  if (!data?.length) return <Empty>No dead stock — everything sold in the last 60 days.</Empty>;
  const total = data.reduce((a, r) => a + Number(r.value_at_cost), 0);
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-3">Tied up at cost: <span className="money font-semibold text-ink">{formatPKR(total)}</span>. Suggestion: bundle with fast movers or discount 10–20%.</p>
      <div className="card overflow-x-auto"><table className="table">
        <thead><tr><th>Item</th><th className="num">On hand</th><th className="num">Value at cost</th><th>Last sold</th><th>Bucket</th></tr></thead>
        <tbody>{data.map((r) => <tr key={r.variant_id}><td>{r.name} <span className="font-mono text-xs text-ink-3">{r.sku}</span></td><td className="num">{r.on_hand}</td><td className="num">{formatPKR(r.value_at_cost)}</td><td className="text-ink-3">{r.last_sold ? formatDateTime(r.last_sold) : "never"}</td><td>{r.bucket}</td></tr>)}</tbody>
      </table></div>
    </div>
  );
}
