import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabase/server";

// POS catalog snapshot (prices + counter stock) for the offline IndexedDB cache.
export async function GET() {
  try { await requirePermission("pos.sell"); } catch { return NextResponse.json({ error: "forbidden" }, { status: 403 }); }
  const sb = supabaseAdmin();
  const { data: loc } = await sb.from("locations").select("id").eq("code", "COUNTER").single();
  const items: unknown[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("product_variants")
      .select("id, sku, barcode, grade, sale_price, min_price, is_serialized, attributes, products!inner(name, is_active), stock_levels(location_id, on_hand)")
      .eq("is_active", true).range(from, from + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const v of data ?? []) {
      const p = v.products as unknown as { name: string };
      const attrs = Object.values((v.attributes as Record<string, string>) ?? {}).join(" ");
      const name = `${p.name}${attrs ? ` · ${attrs}` : ""}`;
      items.push({
        id: v.id, sku: v.sku, barcode: v.barcode, name, grade: v.grade, price: Number(v.sale_price), min_price: Number(v.min_price),
        is_serialized: v.is_serialized,
        on_hand: ((v.stock_levels as { location_id: number; on_hand: number }[]) ?? []).find((s) => s.location_id === loc?.id)?.on_hand ?? 0,
        search: `${name} ${v.sku} ${v.barcode ?? ""}`.toLowerCase(),
      });
    }
    if (!data || data.length < 1000) break;
  }
  return NextResponse.json({ items, at: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
