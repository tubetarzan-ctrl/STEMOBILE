"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/permissions";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { SECTION_LIBRARY } from "@/lib/cms/sections";

type R = { ok: true } | { ok: false; error: string };
const done = (error?: { message: string } | null): R => (error ? { ok: false, error: error.message } : { ok: true });

export async function saveSectionAction(id: string, draft: Record<string, unknown>, patch: { visible?: boolean; starts_at?: string | null; ends_at?: string | null } = {}): Promise<R> {
  await requirePermission("content.edit");
  const sb = supabaseAdmin(); // table writes run as service role after the permission check
  const { error } = await sb.from("page_sections").update({ draft, ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/admin/website");
  return done(error);
}

export async function addSectionAction(pageId: string, type: string): Promise<R> {
  await requirePermission("content.edit");
  const tpl = SECTION_LIBRARY.find((s) => s.type === type);
  if (!tpl) return { ok: false, error: "Unknown section type" };
  const sb = supabaseAdmin(); // table writes run as service role after the permission check
  const { data: last } = await sb.from("page_sections").select("sort").eq("page_id", pageId).is("deleted_at", null).order("sort", { ascending: false }).limit(1).maybeSingle();
  const { error } = await sb.from("page_sections").insert({ page_id: pageId, type, sort: (last?.sort ?? 0) + 1, draft: tpl.defaults });
  revalidatePath("/admin/website");
  return done(error);
}

export async function duplicateSectionAction(id: string): Promise<R> {
  await requirePermission("content.edit");
  const sb = supabaseAdmin(); // table writes run as service role after the permission check
  const { data: s } = await sb.from("page_sections").select("page_id, type, sort, draft").eq("id", id).single();
  if (!s) return { ok: false, error: "Not found" };
  const { error } = await sb.from("page_sections").insert({ page_id: s.page_id, type: s.type, sort: s.sort + 1, draft: s.draft });
  revalidatePath("/admin/website");
  return done(error);
}

/** Soft delete → 30-day trash (purged by cron). */
export async function deleteSectionAction(id: string, restore = false): Promise<R> {
  await requirePermission("content.delete");
  const sb = supabaseAdmin(); // table writes run as service role after the permission check
  const { error } = await sb.from("page_sections").update({ deleted_at: restore ? null : new Date().toISOString() }).eq("id", id);
  revalidatePath("/admin/website");
  return done(error);
}

export async function reorderSectionsAction(ids: string[]): Promise<R> {
  await requirePermission("content.edit");
  const sb = supabaseAdmin(); // table writes run as service role after the permission check
  for (let i = 0; i < ids.length; i++) {
    const { error } = await sb.from("page_sections").update({ sort: i + 1 }).eq("id", ids[i]);
    if (error) return done(error);
  }
  revalidatePath("/admin/website");
  return { ok: true };
}

export async function publishPageAction(pageId: string, slug: string, note?: string): Promise<R> {
  await requirePermission("content.publish");
  const sb = await supabaseServer();
  const { error } = await sb.rpc("publish_page", { p_page: pageId, p_note: note ?? null });
  revalidatePath(slug ? `/p/${slug}` : "/"); // on-demand ISR revalidation
  revalidatePath("/admin/website");
  return done(error);
}

export async function rollbackAction(versionId: string, slug: string): Promise<R> {
  await requirePermission("content.publish");
  const sb = await supabaseServer();
  const { error } = await sb.rpc("rollback_page", { p_version: versionId });
  revalidatePath(slug ? `/p/${slug}` : "/");
  revalidatePath("/admin/website");
  return done(error);
}

export async function setHeroAction(mode: string, mediaUrl?: string, poster?: string, source = "upload"): Promise<R> {
  await requirePermission("content.publish");
  const sb = supabaseAdmin(); // table writes run as service role after the permission check
  let mediaId: string | null = null;
  if (mediaUrl) {
    const { data, error } = await sb.from("media_assets").insert({ type: mode === "image" ? "image" : "video", source, url: mediaUrl, poster, placements: ["hero"] }).select("id").single();
    if (error) return done(error);
    mediaId = data.id;
  }
  const { error } = await sb.from("hero_settings").update({ mode, ...(mediaId ? { media_id: mediaId } : {}), updated_at: new Date().toISOString() }).eq("id", 1);
  revalidatePath("/");
  return done(error);
}

/** Work out the platform and id from a pasted link. */
function parseSocial(url: string): { source: "youtube" | "instagram" | "tiktok" | "facebook"; id: string | null } | null {
  const u = url.trim();
  if (/youtu\.?be/.test(u)) return { source: "youtube", id: u.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([A-Za-z0-9_-]{11})/)?.[1] ?? null };
  if (/tiktok\.com/.test(u)) return { source: "tiktok", id: u.match(/\/video\/(\d+)/)?.[1] ?? null };
  if (/instagram\.com/.test(u)) return { source: "instagram", id: u.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/)?.[1] ?? null };
  if (/facebook\.com|fb\.watch/.test(u)) return { source: "facebook", id: null };
  return null;
}

/** TikTok thumbnails expire, so copy the oEmbed thumbnail to UploadThing once. */
async function tiktokPoster(url: string): Promise<{ poster: string | null; id: string | null; title: string | null }> {
  try {
    const r = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return { poster: null, id: null, title: null };
    const j = (await r.json()) as { thumbnail_url?: string; embed_product_id?: string; title?: string };
    let poster: string | null = null;
    if (j.thumbnail_url && process.env.UPLOADTHING_TOKEN) {
      const { UTApi } = await import("uploadthing/server");
      const up = await new UTApi().uploadFilesFromUrl(j.thumbnail_url).catch(() => null);
      poster = up?.data?.ufsUrl ?? null;
    }
    return { poster, id: j.embed_product_id ?? null, title: j.title ?? null };
  } catch { return { poster: null, id: null, title: null }; }
}

/**
 * Add a social video/post to the homepage strip ("From the bench").
 * - link: YouTube / TikTok / Instagram / Facebook post or reel
 * - upload: our own video (poster captured in the browser) or a photo
 */
export async function addSocialAction(input: { link?: string; upload?: { url: string; kind: "video" | "image"; poster?: string | null }; captions: string }): Promise<R> {
  await requirePermission("media.upload");
  const sb = supabaseAdmin(); // table writes run as service role after the permission check
  let row: Record<string, unknown>;
  if (input.upload) {
    row = { type: input.upload.kind === "image" ? "image" : "reel", source: "upload", url: input.upload.url, poster: input.upload.kind === "image" ? input.upload.url : input.upload.poster ?? null };
  } else {
    const link = (input.link ?? "").trim();
    const s = parseSocial(link);
    if (!s) return { ok: false, error: "Paste a YouTube, TikTok, Instagram or Facebook link." };
    let poster: string | null = null, id = s.id, caption = input.captions;
    if (s.source === "youtube") { if (!id) return { ok: false, error: "That YouTube link has no video id." }; poster = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`; }
    if (s.source === "tiktok") { const t = await tiktokPoster(link); poster = t.poster; id = id ?? t.id; caption = caption || (t.title ?? ""); if (!id) return { ok: false, error: "Open the TikTok video and copy its full link (…/video/123…)." }; }
    if (s.source === "instagram" && !id) return { ok: false, error: "Copy the link of the Instagram post or reel itself." };
    row = { type: "reel", source: s.source, url: link, external_id: id, poster, captions: caption };
  }
  const { data: last } = await sb.from("media_assets").select("sort").contains("placements", ["reel_strip"]).order("sort", { ascending: false }).limit(1).maybeSingle();
  const { error } = await sb.from("media_assets").insert({ captions: input.captions, ...row, placements: ["reel_strip"], sort: (last?.sort ?? 0) + 1 });
  revalidatePath("/"); revalidatePath("/admin/website");
  return done(error);
}

export async function removeSocialAction(id: string): Promise<R> {
  await requirePermission("media.upload");
  const { error } = await supabaseAdmin().from("media_assets").delete().eq("id", id);
  revalidatePath("/"); revalidatePath("/admin/website");
  return done(error);
}

export async function moveSocialAction(id: string, dir: -1 | 1): Promise<R> {
  await requirePermission("media.upload");
  const sb = supabaseAdmin();
  const { data } = await sb.from("media_assets").select("id, sort").contains("placements", ["reel_strip"]).order("sort");
  const list = data ?? [];
  const i = list.findIndex((x) => x.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return { ok: true };
  [list[i], list[j]] = [list[j], list[i]];
  for (let k = 0; k < list.length; k++) await sb.from("media_assets").update({ sort: k + 1 }).eq("id", list[k].id);
  revalidatePath("/"); revalidatePath("/admin/website");
  return { ok: true };
}

export async function activateThemeAction(key: string): Promise<R> {
  await requirePermission("appearance.manage");
  const sb = await supabaseServer();
  const { error } = await sb.rpc("activate_theme", { p_key: key });
  revalidatePath("/", "layout");
  return done(error);
}

export async function setFontAction(key: string): Promise<R> {
  await requirePermission("appearance.manage");
  const { FONTS } = await import("@/lib/fonts");
  if (!FONTS.some((f) => f.key === key)) return { ok: false, error: "Unknown font" };
  const sb = supabaseAdmin(); // table writes run as service role after the permission check
  const { error } = await sb.from("theme_overrides").update({ fonts: { key } }).eq("id", 1);
  revalidatePath("/", "layout");
  return done(error);
}

export async function saveFaqAction(faq: { id?: string; q_en: string; a_en: string; q_ur?: string; a_ur?: string; sort?: number; visible?: boolean }, del = false): Promise<R & { id?: string }> {
  await requirePermission(del ? "content.delete" : "content.edit");
  const sb = supabaseAdmin(); // table writes run as service role after the permission check
  if (del && faq.id) {
    const { error } = await sb.from("faqs").delete().eq("id", faq.id);
    revalidatePath("/"); revalidatePath("/admin/faq");
    return done(error);
  }
  const { data, error } = await sb.from("faqs").upsert(faq).select("id").single();
  revalidatePath("/"); revalidatePath("/admin/faq");
  return error ? done(error) : { ok: true, id: data.id };
}
