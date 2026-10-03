import { requirePermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabase/server";
import { formatPKR } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { PageHead } from "@/components/panel/ui";
import { GrnForm } from "./GrnForm";

export default async function ReceivePage() {
  await requirePermission("inventory.receive", "redirect");
  const sb = supabaseAdmin();
  const [{ data: suppliers }, { data: locations }, { data: recent }] = await Promise.all([
    sb.from("suppliers").select("id, name, currency").eq("is_active", true).order("name"),
    sb.from("locations").select("id, code, name").neq("code", "RESERVED"),
    sb.from("grns").select("id, grn_no, received_at, currency, base_total, charges_total, supplier_bill_no, suppliers(name)").order("received_at", { ascending: false }).limit(10),
  ]);
  return (
    <div className="space-y-10">
      <PageHead title="Receive goods (GRN)" sub="Foreign-currency invoices, freight/customs/clearing allocated into landed cost. Posts Inventory / AP in one transaction." />
      <GrnForm suppliers={suppliers ?? []} locations={locations ?? []} />
      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Recent receipts</h2>
        <div className="card overflow-x-auto"><table className="table">
          <thead><tr><th>GRN</th><th>Supplier</th><th>Bill</th><th>Received</th><th className="num">Goods</th><th className="num">Charges</th><th className="num">Landed</th></tr></thead>
          <tbody>{(recent ?? []).map((g) => <tr key={g.id}><td className="font-mono">#{g.grn_no}</td><td>{(g.suppliers as unknown as { name: string }).name}</td><td>{g.supplier_bill_no} <span className="text-ink-3">{g.currency}</span></td><td className="text-ink-3">{formatDateTime(g.received_at)}</td><td className="num">{formatPKR(g.base_total)}</td><td className="num">{formatPKR(g.charges_total)}</td><td className="num font-semibold">{formatPKR(Number(g.base_total) + Number(g.charges_total))}</td></tr>)}</tbody>
        </table></div>
      </section>
    </div>
  );
}
