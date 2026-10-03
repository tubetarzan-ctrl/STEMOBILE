import type { MetadataRoute } from "next";
import { getCategories, getProducts } from "@/lib/data/store";
import { hasSupabase, supabasePublic } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const [products, cats] = await Promise.all([getProducts({ limit: 5000 }), getCategories()]);
  const pages: { slug: string; published_at: string | null }[] = [];
  const posts: { slug: string; published_at: string | null }[] = [];
  if (hasSupabase) {
    const sb = supabasePublic();
    const [p, b] = await Promise.all([sb.from("site_pages").select("slug, published_at").neq("slug", ""), sb.from("blog_posts").select("slug, published_at")]);
    pages.push(...(p.data ?? []));
    posts.push(...(b.data ?? []));
  }
  return [
    { url: site, changeFrequency: "daily", priority: 1 },
    ...["/shop", "/repair", "/verify", "/trade/apply", "/track"].map((p) => ({ url: `${site}${p}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...cats.map((c) => ({ url: `${site}/shop?category=${c.slug}`, changeFrequency: "daily" as const, priority: 0.7 })),
    ...products.map((p) => ({ url: `${site}/shop/${p.slug}`, changeFrequency: "daily" as const, priority: 0.6 })),
    ...pages.map((p) => ({ url: `${site}/p/${p.slug}`, lastModified: p.published_at ?? undefined, priority: 0.4 })),
    ...posts.map((p) => ({ url: `${site}/blog/${p.slug}`, lastModified: p.published_at ?? undefined, priority: 0.5 })),
  ];
}
