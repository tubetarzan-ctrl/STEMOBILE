import Link from "next/link";
import { requirePermission, can } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabase/server";
import { PageHead } from "@/components/panel/ui";
import { ProductsTable, type ProductRow } from "./ProductsTable";

export const metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; archived?: string }> }) {
  const staff = await requirePermission("inventory.view", "redirect");
  const { q = "", archived } = await searchParams;
  const sb = supabaseAdmin();
  let req = sb.from("products")
    .select("id, name, is_active, is_online, categories(name), brands(name), product_images(url, sort), product_variants(id, sku, grade, sale_price, avg_cost, stock_levels(on_hand))")
    .eq("is_active", !archived).order("name").limit(500);
  const s = q.replace(/[%,()]/g, "").trim();
  if (s) {
    const { data: bySku } = await sb.from("product_variants").select("product_id").ilike("sku", `%${s}%`).limit(200);
    const ids = (bySku ?? []).map((v) => v.product_id);
    req = ids.length ? req.or(`name.ilike.%${s}%,id.in.(${ids.join(",")})`) : req.ilike("name", `%${s}%`);
  }
  const { data } = await req;
  const rows: ProductRow[] = (data ?? []).map((p) => {
    const vs = p.product_variants as unknown as { id: string; sku: string; grade: string; sale_price: number; avg_cost: number; stock_levels: { on_hand: number }[] }[];
    const imgs = (p.product_images as { url: string; sort: number }[]).sort((a, b) => a.sort - b.sort);
    return {
      id: p.id, name: p.name, online: p.is_online, image: imgs[0]?.url ?? null,
      category: (p.categories as unknown as { name: string } | null)?.name ?? "",
      brand: (p.brands as unknown as { name: string } | null)?.name ?? "",
      skus: vs.map((v) => v.sku), variants: vs.length,
      price: vs.length ? Math.min(...vs.map((v) => Number(v.sale_price))) : 0,
      onHand: vs.reduce((a, v) => a + v.stock_levels.reduce((x, l) => x + l.on_hand, 0), 0),
      value: vs.reduce((a, v) => a + v.stock_levels.reduce((x, l) => x + l.on_hand, 0) * Number(v.avg_cost), 0),
    };
  });
  const edit = can(staff, "inventory.edit");
  return (
    <div className="space-y-4">
      <PageHead title="Products" sub="Add, edit or remove items. Prices and photos here; stock comes in through Receive goods or Import (opening stock).">
        {edit && <>
          <Link href="/panel/inventory/products/new" className="btn btn-primary btn-sm">+ Add product</Link>
          <Link href="/panel/inventory/import" className="btn btn-ghost btn-sm">Import (Excel / sheet) & bulk photos</Link>
        </>}
      </PageHead>
      <div className="flex flex-wrap items-center gap-3">
        <form className="flex flex-1 gap-2">
          <input name="q" defaultValue={q} className="input h-10 max-w-sm" placeholder="Search name or SKU" />
          {archived && <input type="hidden" name="archived" value="1" />}
          <button className="btn btn-ghost btn-sm">Search</button>
        </form>
        <Link href={archived ? "/panel/inventory/products" : "/panel/inventory/products?archived=1"} className="text-sm text-accent">{archived ? "← Active products" : "Archived products"}</Link>
      </div>
      <ProductsTable rows={rows} canEdit={edit} archived={!!archived} />
    </div>
  );
}
