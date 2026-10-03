"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/permissions";
import { supabaseServer } from "@/lib/supabase/server";
import { SECTION_LIBRARY } from "@/lib/cms/sections";

type R = { ok: true } | { ok: false; error: string };
const done = (error?: { message: string } | null): R => (error ? { ok: false, error: error.message } : { ok: true });

export async function saveSectionAction(id: string, draft: Record<string, unknown>, patch: { visible?: boolean; starts_at?: string | null; ends_at?: string | null } = {}): Promise<R> {
  await requirePermission("content.edit");
  const sb = await supabaseServer();
  const { error } = await sb.from("page_sections").update({ draft, ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/admin/website");
  return done(error);
}

export async function addSectionAction(pageId: string, type: string): Promise<R> {
  await requirePermission("content.edit");
  const tpl = SECTION_LIBRARY.find((s) => s.type === type);
  if (!tpl) return { ok: false, error: "Unknown section type" };
  const sb = await supabaseServer();
  const { data: last } = await sb.from("page_sections").select("sort").eq("page_id", pageId).is("deleted_at", null).order("sort", { ascending: false }).limit(1).maybeSingle();
  const { error } = await sb.from("page_sections").insert({ page_id: pageId, type, sort: (last?.sort ?? 0) + 1, draft: tpl.defaults });
  revalidatePath("/admin/website");
  return done(error);
}

export async function duplicateSectionAction(id: string): Promise<R> {
  await requirePermission("content.edit");
  const sb = await supabaseServer();
  const { data: s } = await sb.from("page_sections").select("page_id, type, sort, draft").eq("id", id).single();
  if (!s) return { ok: false, error: "Not found" };
  const { error } = await sb.from("page_sections").insert({ page_id: s.page_id, type: s.type, sort: s.sort + 1, draft: s.draft });
  revalidatePath("/admin/website");
  return done(error);
}

/** Soft delete → 30-day trash (purged by cron). */
export async function deleteSectionAction(id: string, restore = false): Promise<R> {
  await requirePermission("content.delete");
  const sb = await supabaseServer();
  const { error } = await sb.from("page_sections").update({ deleted_at: restore ? null : new Date().toISOString() }).eq("id", id);
  revalidatePath("/admin/website");
  return done(error);
}

export async function reorderSectionsAction(ids: string[]): Promise<R> {
  await requirePermission("content.edit");
  const sb = await supabaseServer();
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
  const sb = await supabaseServer();
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

export async function addReelAction(source: "upload" | "youtube" | "instagram", url: string, poster: string | null, captions: string): Promise<R> {
  await requirePermission("media.upload");
  const sb = await supabaseServer();
  const yt = url.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([A-Za-z0-9_-]{11})/)?.[1] ?? null;
  const { error } = await sb.from("media_assets").insert({
    type: "reel", source, url, external_id: yt, poster: poster ?? (yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null), captions, placements: ["reel_strip"],
  });
  revalidatePath("/"); revalidatePath("/admin/website");
  return done(error);
}

export async function activateThemeAction(key: string): Promise<R> {
  await requirePermission("appearance.manage");
  const sb = await supabaseServer();
  const { error } = await sb.rpc("activate_theme", { p_key: key });
  revalidatePath("/", "layout");
  return done(error);
}

export async function saveFaqAction(faq: { id?: string; q_en: string; a_en: string; q_ur?: string; a_ur?: string; sort?: number; visible?: boolean }, del = false): Promise<R> {
  await requirePermission(del ? "content.delete" : "content.edit");
  const sb = await supabaseServer();
  const { error } = del && faq.id ? await sb.from("faqs").delete().eq("id", faq.id) : await sb.from("faqs").upsert(faq);
  revalidatePath("/"); revalidatePath("/admin/faq");
  return done(error);
}
