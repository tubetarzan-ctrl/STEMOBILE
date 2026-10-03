import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabase/server";
import { gradeLabel } from "@/lib/grades";
import { formatPKR } from "@/lib/money";
import { whatsappLink } from "@/lib/utils";
import { Receipt } from "@/components/receipt/Receipt";
import { PrintButton } from "@/components/receipt/PrintButton";

export default async function ReceiptPage({ params }: { params: Promise<{ no: string }> }) {
  await requirePermission("pos.sell", "redirect");
  const { no } = await params;
  if (!/^\d+$/.test(no)) notFound();
  const sb = supabaseAdmin();
  const { data: s } = await sb.from("sales")
    .select("id, sale_no, channel, subtotal, discount_total, delivery_fee, total, sold_at, customers(name, phone), sale_items(description, qty, unit_price, discount, grade_at_sale, product_variants(products(name))), payments(method, amount, status)")
    .eq("sale_no", Number(no)).maybeSingle();
  if (!s) notFound();
  const c = s.customers as unknown as { name: string | null; phone: string } | null;
  const items = (s.sale_items as unknown as { description: string | null; qty: number; unit_price: number; discount: number; grade_at_sale: string | null; product_variants: { products: { name: string } } | null }[]);
  const pays = (s.payments as { method: string; amount: number; status: string }[]).filter((p) => p.status !== "rejected");
  const text = `StarTech Electronics — receipt #${s.sale_no}\n${items.map((i) => `${i.qty} x ${i.product_variants?.products.name ?? i.description}  ${formatPKR(i.qty * Number(i.unit_price) - Number(i.discount))}`).join("\n")}\nTotal ${formatPKR(s.total)}\nThank you!`;
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex flex-wrap gap-2 print:hidden">
        <Link href="/panel/receipts" className="btn btn-ghost">← Receipts</Link>
        <PrintButton />
        {c?.phone && <a className="btn btn-ghost" target="_blank" rel="noopener" href={whatsappLink(c.phone, text)}>WhatsApp</a>}
      </div>
      <div className="card overflow-hidden p-2">
        <Receipt
          title={s.channel === "repair" ? "REPAIR INVOICE" : s.channel === "online" ? "ORDER INVOICE" : "SALES RECEIPT"} number={`#${s.sale_no}`} at={s.sold_at}
          customer={c ?? undefined}
          lines={items.map((i) => ({ name: i.product_variants?.products.name ?? i.description ?? "Item", note: i.grade_at_sale && i.grade_at_sale !== "NA" ? gradeLabel(i.grade_at_sale) : undefined, qty: i.qty, unit: Number(i.unit_price), discount: Number(i.discount) }))}
          totals={[
            ...(Number(s.discount_total) > 0 ? [["Discount", -Number(s.discount_total)] as [string, number]] : []),
            ...(Number(s.delivery_fee) > 0 ? [["Delivery", Number(s.delivery_fee)] as [string, number]] : []),
            ["TOTAL", Number(s.total), true],
          ]}
          payments={pays}
          note="Warranty is saved on your phone number — keep this receipt. Parts warranty does not cover physical or water damage."
          footnote="DUPLICATE COPY"
        />
      </div>
    </div>
  );
}
