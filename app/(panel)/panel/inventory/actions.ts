"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/permissions";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

type R<T = null> = { ok: true; data: T } | { ok: false; error: string };
const PATHS = ["/panel/inventory", "/panel/inventory/products", "/shop", "/"];
const refresh = () => PATHS.forEach((p) => revalidatePath(p));

function friendly(msg: string): string {
  const m = msg.match(/row_(\d+): (\w+)\s*(.*)/);
  if (m) return `Row ${m[1]}: ${m[2] === "unknown_category" ? `unknown category "${m[3]}" — use one from the list` : m[2].replace(/_/g, " ")}`;
  if (msg.includes("product_variants_sku_key")) return "That SKU is already used by another item.";
  if (msg.includes("product_variants_barcode_key")) return "That barcode is already used by another item.";
  if (msg.includes("invalid input value for enum")) return "Unknown grade — use ORIG_NEW, ORIG_PULL, OEM, PREMIUM, STANDARD or NA.";
  if (msg.includes("permission_denied")) return "You don't have permission for this.";
  return msg;
}

/** Delete items with no history; archive the rest (books stay correct). */
export async function deleteProductsAction(ids: string[]): Promise<R<{ deleted: number; archived: number }>> {
  try {
    await requirePermission("inventory.edit");
    const { data, error } = await (await supabaseServer()).rpc("delete_products", { p_ids: ids });
    if (error) return { ok: false, error: friendly(error.message) };
    refresh();
    return { ok: true, data: data as { deleted: number; archived: number } };
  } catch (e) { return { ok: false, error: friendly((e as Error).message) }; }
}

export async function restoreProductAction(id: string): Promise<R> {
  await requirePermission("inventory.edit");
  const sb = supabaseAdmin();
  await sb.from("products").update({ is_active: true, is_online: true }).eq("id", id);
  await sb.from("product_variants").update({ is_active: true }).eq("product_id", id);
  refresh();
  return { ok: true, data: null };
}

export type ImportRow = { name: string; category: string; brand?: string; sku?: string; grade?: string; price: number; min_price?: number; cost?: number; qty?: number; barcode?: string; image?: string };

/** Sheet / Excel / CSV rows → products + opening stock, in one database transaction. */
export async function importProductsAction(rows: ImportRow[]): Promise<R<{ created: number; updated: number; stocked: number }>> {
  try {
    await requirePermission("inventory.edit");
    if (!rows.length) return { ok: false, error: "No rows to import." };
    if (rows.length > 2000) return { ok: false, error: "Import at most 2000 rows at a time." };
    const { data, error } = await (await supabaseServer()).rpc("import_products", { p_rows: rows });
    if (error) return { ok: false, error: friendly(error.message) };
    refresh();
    return { ok: true, data: data as { created: number; updated: number; stocked: number } };
  } catch (e) { return { ok: false, error: friendly((e as Error).message) }; }
}

export type ProductInput = {
  id?: string; name: string; category_id: string; brand_id?: string | null; description?: string; warranty_days: number; is_online: boolean;
  variants: { id?: string; sku: string; barcode?: string; grade: string; sale_price: number; min_price: number; reorder_level: number; opening_qty?: number; opening_cost?: number }[];
  images: string[]; devices: string[];
};

/** Create or edit a product (catalogue data only — stock moves through the opening-stock RPC). */
export async function saveProductAction(p: ProductInput): Promise<R<{ id: string }>> {
  try {
    await requirePermission("inventory.edit");
    if (!p.name.trim() || !p.category_id) return { ok: false, error: "Name and category are required." };
    if (!p.variants.length) return { ok: false, error: "Add at least one price row." };
    const sb = supabaseAdmin();
    const row = { name: p.name.trim(), category_id: p.category_id, brand_id: p.brand_id || null, description: p.description || null, warranty_days: p.warranty_days || 0, is_online: p.is_online, is_active: true };
    let id = p.id;
    if (id) {
      const { error } = await sb.from("products").update(row).eq("id", id);
      if (error) return { ok: false, error: friendly(error.message) };
    } else {
      let slug = p.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const { data: clash } = await sb.from("products").select("id").eq("slug", slug).maybeSingle();
      if (clash) slug = `${slug}-${Math.random().toString(36).slice(2, 7)}`;
      const { data, error } = await sb.from("products").insert({ ...row, slug }).select("id").single();
      if (error) return { ok: false, error: friendly(error.message) };
      id = data.id;
    }

    const opening: { variant_id: string; qty: number; unit_cost: number }[] = [];
    const variantIds: string[] = [];
    for (const v of p.variants) {
      const vr = { product_id: id, sku: v.sku.trim().toUpperCase(), barcode: v.barcode?.trim() || null, grade: v.grade, sale_price: v.sale_price, min_price: v.min_price, reorder_level: v.reorder_level, is_active: true };
      if (!vr.sku) return { ok: false, error: "Every price row needs a SKU." };
      const { data, error } = v.id
        ? await sb.from("product_variants").update(vr).eq("id", v.id).select("id").single()
        : await sb.from("product_variants").insert(vr).select("id").single();
      if (error) return { ok: false, error: friendly(error.message) };
      variantIds.push(data.id);
      if (!v.id && (v.opening_qty ?? 0) > 0) opening.push({ variant_id: data.id, qty: v.opening_qty!, unit_cost: v.opening_cost ?? 0 });
    }

    await sb.from("product_images").delete().eq("product_id", id);
    if (p.images.length) await sb.from("product_images").insert(p.images.map((url, i) => ({ product_id: id, url, sort: i, alt: p.name })));

    await sb.from("part_compat").delete().in("variant_id", variantIds);
    if (p.devices.length) await sb.from("part_compat").insert(variantIds.flatMap((variant_id) => p.devices.map((device_id) => ({ variant_id, device_id, confidence: "exact" }))));

    if (opening.length) {
      const { error } = await (await supabaseServer()).rpc("post_opening_stock", { p_lines: opening });
      if (error) return { ok: false, error: `Saved, but opening stock failed: ${friendly(error.message)}` };
    }
    refresh();
    return { ok: true, data: { id: id! } };
  } catch (e) { return { ok: false, error: friendly((e as Error).message) }; }
}

/** Bulk photos: file names are SKUs ("A54-LCD-OEM.jpg", "A54-LCD-OEM-2.jpg"). */
export async function attachPhotosAction(files: { name: string; url: string }[]): Promise<R<{ matched: number; unmatched: string[] }>> {
  await requirePermission("inventory.edit");
  const sb = supabaseAdmin();
  const unmatched: string[] = [];
  let matched = 0;
  for (const f of files) {
    const base = f.name.replace(/\.[a-z0-9]+$/i, "").toUpperCase();
    const candidates = [base, base.replace(/[-_ ]\d{1,2}$/, "")];
    const { data: v } = await sb.from("product_variants").select("product_id, products(name)").in("sku", candidates).limit(1).maybeSingle();
    if (!v) { unmatched.push(f.name); continue; }
    const { count } = await sb.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", v.product_id);
    await sb.from("product_images").insert({ product_id: v.product_id, url: f.url, sort: count ?? 0, alt: (v.products as unknown as { name: string } | null)?.name ?? null });
    matched++;
  }
  refresh();
  return { ok: true, data: { matched, unmatched } };
}
