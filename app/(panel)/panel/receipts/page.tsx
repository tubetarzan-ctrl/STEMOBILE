import Link from "next/link";
import { requirePermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabase/server";
import { formatPKR } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { normalizePhone } from "@/lib/utils";
import { Empty, PageHead } from "@/components/panel/ui";

export const metadata = { title: "Receipts" };

export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePermission("pos.sell", "redirect");
  const { q = "" } = await searchParams;
  const sb = supabaseAdmin();
  let query = sb.from("sales").select("id, sale_no, channel, total, sold_at, customers(name, phone)").order("sold_at", { ascending: false }).limit(50);
  const s = q.trim();
  if (/^#?\d{1,9}$/.test(s)) query = query.eq("sale_no", Number(s.replace("#", "")));
  else if (s.length >= 7) {
    const { data: c } = await sb.from("customers").select("id").eq("phone", normalizePhone(s)).maybeSingle();
    query = query.eq("customer_id", c?.id ?? "00000000-0000-0000-0000-000000000000");
  }
  const { data } = await query;
  return (
    <div className="max-w-4xl space-y-4">
      <PageHead title="Receipts" sub="Find any sale and print or WhatsApp its receipt again. Repair receipts are on each repair job." />
      <form className="flex gap-2"><input name="q" defaultValue={q} className="input h-10" placeholder="Receipt number (e.g. 1042) or customer phone" /><button className="btn btn-primary btn-sm">Find</button></form>
      {!data?.length ? <Empty>No sales found.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>#</th><th>When</th><th>Customer</th><th>Type</th><th className="num">Total</th><th /></tr></thead>
            <tbody>{data.map((r) => { const c = r.customers as unknown as { name: string | null; phone: string } | null; return (
              <tr key={r.id}>
                <td className="font-mono">{r.sale_no}</td><td>{formatDateTime(r.sold_at)}</td><td>{c?.name ?? c?.phone ?? "Walk-in"}</td>
                <td className="capitalize">{r.channel}</td><td className="num">{formatPKR(r.total)}</td>
                <td><Link className="text-accent" href={`/panel/receipts/${r.sale_no}`}>Open</Link></td>
              </tr>
            ); })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
