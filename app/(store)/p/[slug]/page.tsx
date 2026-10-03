import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { hasSupabase, supabasePublic } from "@/lib/supabase/server";
import { getLang, pick } from "@/lib/i18n";

// CMS pages (policies, landing & campaign pages) at /p/[slug].
async function load(slug: string) {
  if (!hasSupabase) return null;
  const sb = supabasePublic();
  const { data: page } = await sb.from("site_pages").select("id, title_en, title_ur, seo_title, seo_description").eq("slug", slug).maybeSingle();
  if (!page) return null;
  const { data: sections } = await sb.from("page_sections").select("id, type, published").eq("page_id", page.id).order("published_sort");
  return { page, sections: sections ?? [] };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const r = await load((await params).slug);
  return r ? { title: r.page.seo_title ?? r.page.title_en, description: r.page.seo_description ?? undefined } : {};
}

export const revalidate = 3600;

export default async function CmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const r = await load((await params).slug);
  if (!r) notFound();
  const lang = await getLang();
  return (
    <article className="mx-auto max-w-3xl px-4 py-14" lang={lang}>
      <h1 className="font-display text-4xl font-semibold">{pick(r.page, "title", lang)}</h1>
      {r.sections.map((s) => {
        const d = (s.published ?? {}) as Record<string, unknown>;
        return (
          <section key={s.id} className="mt-8 space-y-3">
            {pick(d, "title", lang) && pick(d, "title", lang) !== pick(r.page, "title", lang) && <h2 className="font-display text-2xl font-semibold">{pick(d, "title", lang)}</h2>}
            <div className="whitespace-pre-line text-ink-2 leading-relaxed">{pick(d, "body", lang)}</div>
          </section>
        );
      })}
    </article>
  );
}
