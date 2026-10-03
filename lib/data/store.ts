import "server-only";
import { cache } from "react";
import { SHOP } from "./shop";
import { hasSupabase, supabasePublic } from "@/lib/supabase/server";
import type { Grade } from "@/lib/grades";
import {
  defaultHomeSections, mockCategories, mockDevices, mockFaqs, mockProducts, mockStories, mockThemes,
} from "./mock";
import type {
  BusinessSettings, Category, Device, Faq, Fit, HeroSettings, Product, ProductCard, RepairQuoteRow,
  RepairStory, Review, Section, StockStatus, Theme,
} from "./types";

// Storefront reads. Supabase (anon + RLS, column-limited) when configured,
// otherwise the deterministic demo catalogue in ./mock.

const DEFAULT_BUSINESS: BusinessSettings = {
  name: SHOP.name, tagline: SHOP.tagline, address: SHOP.address, phone: SHOP.phone, whatsapp: SHOP.whatsapp,
  email: SHOP.email, hours: SHOP.hours, years: SHOP.years, map_url: SHOP.map_url,
};

export const getBusiness = cache(async (): Promise<BusinessSettings> => {
  // settings is staff-only under RLS; public business profile is mirrored into content_blocks
  if (!hasSupabase) return DEFAULT_BUSINESS;
  const { data } = await supabasePublic().from("content_blocks").select("key, en").like("key", "business.%");
  const merged: Record<string, unknown> = { ...DEFAULT_BUSINESS };
  for (const row of data ?? []) merged[row.key.replace("business.", "")] = row.key === "business.years" ? Number(row.en) : row.en;
  return merged as BusinessSettings;
});

export const getCategories = cache(async (): Promise<Category[]> => {
  if (!hasSupabase) return mockCategories;
  const { data } = await supabasePublic().from("categories").select("id, name, name_ur, slug, kind, sort").order("sort");
  return (data as Category[]) ?? [];
});

export const getDevices = cache(async (): Promise<Device[]> => {
  if (!hasSupabase) return mockDevices;
  const { data } = await supabasePublic()
    .from("devices").select("id, brand_id, name, slug, model_numbers, release_year, brands(name, sort)").order("name");
  return ((data ?? []) as unknown as (Device & { brands: { name: string } })[]).map((d) => ({ ...d, brand: d.brands?.name }));
});

function bestStock(statuses: StockStatus[]): StockStatus {
  return statuses.includes("in") ? "in" : statuses.includes("low") ? "low" : "out";
}
function fitFor(p: Product, deviceId?: string | null): Fit {
  if (!deviceId) return null;
  const fits = p.variants.flatMap((v) => v.fits);
  if (fits.length === 0) return null; // universal accessory
  const f = fits.filter((x) => x.device_id === deviceId);
  if (f.some((x) => x.confidence === "exact")) return "exact";
  if (f.some((x) => x.confidence === "check_version")) return "check_version";
  return "no";
}
function toCard(p: Product, deviceId?: string | null): ProductCard {
  return {
    id: p.id, name: p.name, slug: p.slug, category_slug: p.category.slug, category_kind: p.category.kind,
    from_price: Math.min(...p.variants.map((v) => v.sale_price)),
    grades: [...new Set(p.variants.map((v) => v.grade).filter((g) => g !== "NA"))] as Grade[],
    stock: bestStock(p.variants.map((v) => v.stock)), fit: fitFor(p, deviceId), image: p.images[0]?.url,
  };
}

const PRODUCT_SELECT =
  "id, name, slug, description, warranty_days, brands(name), categories(id, name, name_ur, slug, kind, sort), product_images(url, alt, sort), product_variants(id, sku, grade, attributes, sale_price, warranty_days, is_active, part_compat(device_id, confidence))";

type Row = {
  id: string; name: string; slug: string; description: string | null; warranty_days: number; brands: { name: string } | null;
  categories: Category; product_images: { url: string; alt: string | null; sort: number }[];
  product_variants: { id: string; sku: string; grade: Grade; attributes: Record<string, string>; sale_price: number; warranty_days: number | null; is_active: boolean; part_compat: { device_id: string; confidence: "exact" | "check_version" | "no" }[] }[];
};

async function hydrate(rows: Row[]): Promise<Product[]> {
  const ids = rows.flatMap((r) => r.product_variants.map((v) => v.id));
  const stock = new Map<string, { status: StockStatus; low_qty: number }>();
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await supabasePublic().from("v_public_stock").select("variant_id, status, low_qty").in("variant_id", ids.slice(i, i + 300));
    for (const s of data ?? []) stock.set(s.variant_id, { status: s.status, low_qty: s.low_qty });
  }
  return rows.map((r) => ({
    id: r.id, name: r.name, slug: r.slug, description: r.description, warranty_days: r.warranty_days, brand: r.brands?.name,
    category: r.categories,
    images: [...(r.product_images ?? [])].sort((a, b) => a.sort - b.sort).map(({ url, alt }) => ({ url, alt })),
    variants: r.product_variants.filter((v) => v.is_active).map((v) => ({
      id: v.id, sku: v.sku, grade: v.grade, attributes: v.attributes ?? {}, sale_price: Number(v.sale_price), warranty_days: v.warranty_days,
      stock: stock.get(v.id)?.status ?? "out", low_qty: stock.get(v.id)?.low_qty ?? 0, fits: v.part_compat ?? [],
    })),
  })).filter((p) => p.variants.length > 0);
}

export type ProductQuery = { category?: string; device?: string | null; q?: string; grade?: string; inStock?: boolean; hideNonFitting?: boolean; limit?: number };

export async function getProducts(query: ProductQuery = {}): Promise<ProductCard[]> {
  let products: Product[];
  if (!hasSupabase) {
    products = mockProducts;
    if (query.q) {
      const words = expandQuery(query.q);
      products = products.filter((p) => words.every((w) => `${p.name} ${p.category.name} ${p.description}`.toLowerCase().includes(w)));
    }
  } else {
    const sb = supabasePublic();
    let ids: string[] | null = null;
    if (query.q) {
      const { data } = await sb.rpc("search_products", { p_q: query.q, p_device: query.device ?? null, p_limit: 60 });
      ids = (data ?? []).map((r: { product_id: string }) => r.product_id);
      if (ids!.length === 0) return [];
    }
    let req = sb.from("products").select(PRODUCT_SELECT).limit(query.limit ?? 200);
    if (ids) req = req.in("id", ids);
    const { data } = await req;
    products = await hydrate((data ?? []) as unknown as Row[]);
  }
  if (query.category) products = products.filter((p) => p.category.slug === query.category);
  if (query.grade) products = products.filter((p) => p.variants.some((v) => v.grade === query.grade));
  let cards = products.map((p) => toCard(p, query.device));
  if (query.inStock) cards = cards.filter((c) => c.stock !== "out");
  if (query.device && query.hideNonFitting !== false) cards = cards.filter((c) => c.fit !== "no");
  if (query.device) cards.sort((a, b) => rankFit(a.fit) - rankFit(b.fit));
  return cards.slice(0, query.limit ?? 200);
}
const rankFit = (f: Fit) => (f === "exact" ? 0 : f === "check_version" ? 1 : f === null ? 2 : 3);

// Roman Urdu / misspelling tolerance for the demo catalogue (DB uses search_synonyms).
const SYN: Record<string, string> = {
  pannel: "display", panal: "display", panel: "display", lcd: "display", screen: "display", screan: "display",
  bettery: "battery", betry: "battery", battry: "battery", charjer: "charger", cover: "case", glas: "glass", protector: "glass",
};
function expandQuery(q: string): string[] {
  return q.toLowerCase().split(/\s+/).filter(Boolean).map((w) => SYN[w] ?? w);
}

export async function getProduct(slug: string): Promise<Product | null> {
  if (!hasSupabase) return mockProducts.find((p) => p.slug === slug) ?? null;
  const { data } = await supabasePublic().from("products").select(PRODUCT_SELECT).eq("slug", slug).maybeSingle();
  if (!data) return null;
  return (await hydrate([data as unknown as Row]))[0] ?? null;
}

/**
 * Exact lookup for the chat assistant: products in one category that fit one
 * device (or all products of a universal category). Always hits the database
 * live (no ISR cache) so stock answers are current.
 */
export async function findProductsForChat(category: string, deviceId?: string | null): Promise<Product[]> {
  if (!hasSupabase) {
    return mockProducts.filter((p) => p.category.slug === category && (!deviceId || p.variants.some((v) => v.fits.some((f) => f.device_id === deviceId && f.confidence !== "no"))));
  }
  let select = PRODUCT_SELECT.replace("categories(", "categories!inner(");
  if (deviceId) select = select.replace("product_variants(", "product_variants!inner(").replace("part_compat(", "part_compat!inner(");
  let q = supabasePublic().from("products").select(select).eq("categories.slug", category).limit(20);
  if (deviceId) q = q.eq("product_variants.part_compat.device_id", deviceId).neq("product_variants.part_compat.confidence", "no");
  const { data } = await q;
  return hydrate((data ?? []) as unknown as Row[]);
}

export async function getRelated(product: Product, device?: string | null): Promise<ProductCard[]> {
  // "Frequently bought together": screen -> glass + case for the same device; else same category.
  const deviceIds = new Set(product.variants.flatMap((v) => v.fits.map((f) => f.device_id)));
  const all = await getProducts({ device: device ?? [...deviceIds][0] ?? null, limit: 400 });
  const pair = all.filter((c) => c.id !== product.id && (c.category_slug === "screen-protectors" || c.category_slug === "cases" || c.category_slug === "batteries"));
  return pair.slice(0, 4);
}

export const getHomeSections = cache(async (): Promise<Section[]> => {
  if (!hasSupabase) return defaultHomeSections;
  const sb = supabasePublic();
  const { data: page } = await sb.from("site_pages").select("id").eq("slug", "").maybeSingle();
  if (!page) return defaultHomeSections;
  const { data } = await sb.from("page_sections").select("id, type, published, published_sort").eq("page_id", page.id).order("published_sort");
  if (!data?.length) return defaultHomeSections;
  return data.map((s) => ({ id: s.id, type: s.type, data: (s.published ?? {}) as Record<string, unknown> }));
});

export const getFaqs = cache(async (pageSlug = ""): Promise<Faq[]> => {
  if (!hasSupabase) return mockFaqs;
  const { data } = await supabasePublic().from("faqs").select("id, q_en, q_ur, a_en, a_ur").eq("page_slug", pageSlug).order("sort");
  return (data as Faq[]) ?? [];
});

export const getStories = cache(async (): Promise<RepairStory[]> => {
  if (!hasSupabase) return mockStories;
  const { data } = await supabasePublic().from("repair_stories").select("*").order("sort").limit(6);
  return (data as RepairStory[]) ?? [];
});

export const getReviews = cache(async (opts: { productId?: string; featured?: boolean; limit?: number } = {}): Promise<Review[]> => {
  if (!hasSupabase) return [];
  let q = supabasePublic()
    .from("reviews").select("id, rating, text, author_name, verified, owner_reply, created_at, source, review_media(type, url, poster, sort)")
    .order("featured", { ascending: false }).order("sort").order("created_at", { ascending: false }).limit(opts.limit ?? 12);
  if (opts.productId) q = q.eq("product_id", opts.productId);
  if (opts.featured) q = q.eq("featured", true);
  const { data } = await q;
  return ((data ?? []) as unknown as (Review & { review_media: Review["media"] })[]).map((r) => ({ ...r, media: r.review_media ?? [] }));
});

export const getThemes = cache(async (): Promise<Theme[]> => {
  if (!hasSupabase) return mockThemes;
  const { data } = await supabasePublic().from("site_themes").select("key, name, tokens, is_dark, is_active").order("sort");
  return (data as Theme[])?.length ? (data as Theme[]) : mockThemes;
});

/** Website font chosen in Super Admin → Appearance (theme_overrides.fonts.key). */
export const getFontKey = cache(async (): Promise<string> => {
  if (!hasSupabase) return "startech";
  const { data } = await supabasePublic().from("theme_overrides").select("fonts").maybeSingle();
  return ((data?.fonts as { key?: string } | null)?.key) ?? "startech";
});

export const getActiveTheme = cache(async (): Promise<Theme> => {
  const themes = await getThemes();
  const active = themes.find((t) => t.is_active) ?? themes[0];
  if (!hasSupabase) return active;
  const { data: ov } = await supabasePublic().from("theme_overrides").select("tokens").maybeSingle();
  return { ...active, tokens: { ...active.tokens, ...((ov?.tokens as Record<string, string>) ?? {}) } };
});

export const getHero = cache(async (): Promise<HeroSettings> => {
  if (!hasSupabase) return { mode: "3d", settings: {} };
  const sb = supabasePublic();
  const { data } = await sb.from("hero_settings").select("mode, media_id, settings").maybeSingle();
  let media: HeroSettings["media"] = null;
  if (data?.media_id) {
    const { data: m } = await sb.from("media_assets").select("url, poster, source, external_id").eq("id", data.media_id).maybeSingle();
    media = m;
  }
  return { mode: (data?.mode ?? "3d") as HeroSettings["mode"], media, settings: (data?.settings ?? {}) as Record<string, unknown> };
});

export const getAnnouncement = cache(async (): Promise<{ text_en: string; text_ur?: string | null; link?: string | null } | null> => {
  if (!hasSupabase) return { text_en: "Free fitting on all Original & OEM displays this week", link: "/shop" };
  const { data } = await supabasePublic().from("announcements").select("text_en, text_ur, link").order("sort").limit(1).maybeSingle();
  return data;
});

export const getReels = cache(async () => {
  if (!hasSupabase) return [] as { id: string; source: string; url: string; poster: string | null; external_id: string | null; captions: string | null }[];
  const { data } = await supabasePublic().from("media_assets").select("id, source, url, poster, external_id, captions")
    .contains("placements", ["reel_strip"]).order("sort").limit(12);
  return data ?? [];
});

export async function getRepairQuote(deviceId: string, issue: string): Promise<RepairQuoteRow[]> {
  if (!hasSupabase) {
    const d = mockDevices.find((x) => x.id === deviceId);
    if (!d) return [];
    const map: Record<string, [string, number, number, number]> = {
      screen: ["display", 300000, 60, 0], battery: ["battery", 150000, 30, 0], charging_port: ["charging-port", 100000, 45, 0],
    };
    const m = map[issue];
    if (!m) return [];
    const p = mockProducts.find((x) => x.slug === `${d.slug}-${m[0]}`);
    return (p?.variants ?? []).map((v) => ({
      grade: v.grade, labour: m[1], part_price: v.sale_price, total: m[1] + v.sale_price, est_minutes: m[2],
      warranty_days: v.warranty_days ?? 30, in_stock: v.stock !== "out",
    }));
  }
  const { data } = await supabasePublic().rpc("repair_quote", { p_device: deviceId, p_issue: issue });
  return ((data ?? []) as RepairQuoteRow[]).map((r) => ({ ...r, total: Number(r.total), labour: Number(r.labour), part_price: Number(r.part_price) }));
}
