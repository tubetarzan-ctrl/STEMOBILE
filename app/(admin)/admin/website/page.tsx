import Link from "next/link";
import { requirePermission, can } from "@/lib/auth/permissions";
import { supabaseServer } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { PageHead } from "@/components/panel/ui";
import { SECTION_LIBRARY } from "@/lib/cms/sections";
import { cn } from "@/lib/utils";
import { HeroMediaPanel, PageToolbar, ReelsPanel, RollbackButton, SectionList } from "./WebsiteClient";

export default async function WebsiteManager({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const staff = await requirePermission("content.edit", "redirect");
  const sb = await supabaseServer();
  const { data: pages } = await sb.from("site_pages").select("id, slug, title_en, status, published_at").is("deleted_at", null).order("slug");
  const sp = await searchParams;
  const page = pages?.find((p) => p.id === sp.page) ?? pages?.find((p) => p.slug === "") ?? pages?.[0];
  if (!page) return <p>No pages.</p>;
  const [{ data: sections }, { data: versions }, { data: hero }, { data: reels }] = await Promise.all([
    sb.from("page_sections").select("id, type, sort, visible, draft, published, starts_at, ends_at, deleted_at, updated_at").eq("page_id", page.id).order("sort"),
    sb.from("content_versions").select("id, note, published_at").eq("page_id", page.id).order("published_at", { ascending: false }).limit(10),
    sb.from("hero_settings").select("mode").maybeSingle(),
    sb.from("media_assets").select("id, source, url, poster, captions").contains("placements", ["reel_strip"]).order("sort"),
  ]);
  const live = (sections ?? []).filter((s) => !s.deleted_at);
  const trash = (sections ?? []).filter((s) => s.deleted_at);
  const dirty = live.some((s) => JSON.stringify(s.draft) !== JSON.stringify(s.published));

  return (
    <div className="space-y-8">
      <PageHead title="Website" sub="Edit any text, image or section. Changes are drafts until you publish.">
        <Link href={page.slug ? `/p/${page.slug}` : "/"} target="_blank" className="btn btn-ghost btn-sm">View live</Link>
      </PageHead>
      <nav className="flex flex-wrap gap-1">
        {(pages ?? []).map((p) => <Link key={p.id} href={`/admin/website?page=${p.id}`} className={cn("badge px-3 py-1.5 text-sm", p.id === page.id && "border-accent text-accent")}>{p.slug === "" ? "Homepage" : p.title_en}</Link>)}
      </nav>
      <PageToolbar pageId={page.id} slug={page.slug} dirty={dirty} canPublish={can(staff, "content.publish")} library={SECTION_LIBRARY.map((s) => ({ type: s.type, label: s.label }))} />
      <SectionList sections={live} trash={trash} canDelete={can(staff, "content.delete")} />
      {page.slug === "" && (
        <div className="grid gap-6 xl:grid-cols-2">
          {can(staff, "content.publish") && <HeroMediaPanel mode={hero?.mode ?? "3d"} />}
          <ReelsPanel reels={reels ?? []} />
        </div>
      )}
      <section className="card p-5">
        <h2 className="mb-3 font-medium">Version history</h2>
        <ul className="space-y-1 text-sm">{(versions ?? []).map((v, i) => (
          <li key={v.id} className="flex items-center gap-3"><span className="w-40 text-ink-3">{formatDateTime(v.published_at)}</span><span className="flex-1">{v.note ?? "Published"}{i === 0 && <span className="badge ml-2 text-trust">live</span>}</span>
            {i > 0 && can(staff, "content.publish") && <RollbackButton versionId={v.id} slug={page.slug} />}</li>
        ))}</ul>
      </section>
    </div>
  );
}
