import { NextResponse, type NextRequest } from "next/server";
import { getStaff } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabase/server";

// Staff lookup by SKU / barcode / name (GRN lines, adjustments, repair parts).
export async function GET(req: NextRequest) {
  if (!(await getStaff())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const sb = supabaseAdmin();
  const sku = sp.get("sku");
  if (sku) {
    const { data } = await sb.from("product_variants").select("id, sku, grade, sale_price, avg_cost, products(name)").or(`sku.eq.${sku.replace(/[,()]/g, "")},barcode.eq.${sku.replace(/[,()]/g, "")}`).maybeSingle();
    return NextResponse.json(data ?? {});
  }
  const q = (sp.get("q") ?? "").replace(/[%,()]/g, "");
  if (q.length < 2) return NextResponse.json([]);
  const [{ data: bySku }, { data: byName }] = await Promise.all([
    sb.from("product_variants").select("id, sku, grade, sale_price, avg_cost, products(name)").ilike("sku", `%${q}%`).limit(10),
    sb.from("products").select("name, product_variants(id, sku, grade, sale_price, avg_cost)").ilike("name", `%${q}%`).limit(10),
  ]);
  const flat = (byName ?? []).flatMap((p) => (p.product_variants as { id: string; sku: string; grade: string; sale_price: number; avg_cost: number }[]).map((v) => ({ ...v, products: { name: p.name } })));
  const data = bySku ?? [];
  return NextResponse.json([...(data ?? []), ...flat].slice(0, 20));
}
