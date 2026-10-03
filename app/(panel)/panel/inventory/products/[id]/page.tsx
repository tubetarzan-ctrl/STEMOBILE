import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabase/server";
import { PageHead } from "@/components/panel/ui";
import { ProductEditor, type EditorProduct } from "./ProductEditor";

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("inventory.edit", "redirect");
  const { id } = await params;
  const sb = supabaseAdmin();
  const [{ data: cats }, { data: brands }, { data: devices }] = await Promise.all([
    sb.from("categories").select("id, name").eq("is_active", true).order("sort"),
    sb.from("brands").select("id, name").order("name"),
    sb.from("devices").select("id, name, brands(name)").order("name"),
  ]);
  let product: EditorProduct | null = null;
  if (id !== "new") {
    const { data: p } = await sb.from("products")
      .select("id, name, category_id, brand_id, description, warranty_days, is_online, product_images(url, sort), product_variants(id, sku, barcode, grade, sale_price, min_price, reorder_level, is_active, part_compat(device_id))")
      .eq("id", id).maybeSingle();
    if (!p) notFound();
    const vs = (p.product_variants as unknown as { id: string; sku: string; barcode: string | null; grade: string; sale_price: number; min_price: number; reorder_level: number; is_active: boolean; part_compat: { device_id: string }[] }[]).filter((v) => v.is_active);
    product = {
      id: p.id, name: p.name, category_id: p.category_id, brand_id: p.brand_id, description: p.description ?? "", warranty_days: p.warranty_days, is_online: p.is_online,
      images: (p.product_images as { url: string; sort: number }[]).sort((a, b) => a.sort - b.sort).map((i) => i.url),
      devices: [...new Set(vs.flatMap((v) => v.part_compat.map((c) => c.device_id)))],
      variants: vs.map((v) => ({ id: v.id, sku: v.sku, barcode: v.barcode ?? "", grade: v.grade, sale_price: Number(v.sale_price), min_price: Number(v.min_price), reorder_level: v.reorder_level })),
    };
  }
  return (
    <div className="max-w-4xl space-y-4">
      <Link href="/panel/inventory/products" className="text-sm text-accent">← Products</Link>
      <PageHead title={product ? `Edit: ${product.name}` : "Add product"} sub="One product can have several price rows (e.g. OEM and Original grades). Photos upload straight to the website." />
      <ProductEditor product={product} categories={cats ?? []} brands={brands ?? []}
        devices={(devices ?? []).map((d) => ({ id: d.id, name: `${(d.brands as unknown as { name: string } | null)?.name ?? ""} ${d.name}`.trim() }))} />
    </div>
  );
}
