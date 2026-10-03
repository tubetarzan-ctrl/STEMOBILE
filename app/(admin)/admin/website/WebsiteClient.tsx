"use client";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Pencil, RotateCcw, Trash2, Upload } from "lucide-react";
import {
  addSocialAction, moveSocialAction, removeSocialAction, addSectionAction, deleteSectionAction, duplicateSectionAction, publishPageAction, reorderSectionsAction, rollbackAction,
  saveSectionAction, setHeroAction,
} from "./actions";
import { limitFor } from "@/lib/cms/sections";
import { compressImage, useUploadThing, videoDuration } from "@/lib/client/upload";
import { cn } from "@/lib/utils";

type Section = { id: string; type: string; sort: number; visible: boolean; draft: Record<string, unknown>; published: Record<string, unknown> | null; starts_at: string | null; ends_at: string | null };

function useAct() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) => start(async () => { const r = await fn(); setMsg(r.ok ? ok ?? null : r.error ?? "Failed"); });
  return { pending, msg, act };
}

export function PageToolbar({ pageId, slug, dirty, canPublish, library }: { pageId: string; slug: string; dirty: boolean; canPublish: boolean; library: { type: string; label: string }[] }) {
  const { pending, msg, act } = useAct();
  const [type, setType] = useState(library[0]?.type);
  return (
    <div className="card flex flex-wrap items-center gap-3 p-4">
      <select value={type} onChange={(e) => setType(e.target.value)} className="input h-10 w-64" aria-label="Section type">{library.map((l) => <option key={l.type} value={l.type}>{l.label}</option>)}</select>
      <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => act(() => addSectionAction(pageId, type!), "Section added (draft)")}>Add section</button>
      <span className={cn("ml-auto text-sm", dirty ? "text-warn" : "text-ink-3")}>{dirty ? "Unpublished changes" : "Live matches draft"}</span>
      {canPublish && <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => { const note = prompt("Version note (optional)") ?? undefined; act(() => publishPageAction(pageId, slug, note), "Published — site refreshed"); }}>Publish</button>}
      {msg && <p className="w-full text-sm">{msg}</p>}
    </div>
  );
}

export function RollbackButton({ versionId, slug }: { versionId: string; slug: string }) {
  const { pending, msg, act } = useAct();
  return <span><button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => confirm("Restore this version and make it live?") && act(() => rollbackAction(versionId, slug), "Restored")}><RotateCcw className="size-3.5" />Restore</button>{msg && <span className="ml-2 text-xs">{msg}</span>}</span>;
}

export function SectionList({ sections, trash, canDelete }: { sections: Section[]; trash: Section[]; canDelete: boolean }) {
  const [order, setOrder] = useState(sections.map((s) => s.id));
  const [open, setOpen] = useState<string | null>(null);
  const { pending, act } = useAct();
  const byId = new Map(sections.map((s) => [s.id, s]));
  const move = (i: number, d: -1 | 1) => {
    const next = [...order];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setOrder(next);
    act(() => reorderSectionsAction(next));
  };
  return (
    <div className="space-y-2">
      {order.map((id, i) => {
        const s = byId.get(id);
        if (!s) return null;
        const changed = JSON.stringify(s.draft) !== JSON.stringify(s.published);
        return (
          <div key={id} className={cn("card", !s.visible && "opacity-60")}>
            <div className="flex flex-wrap items-center gap-2 p-3">
              <span className="font-mono text-xs text-ink-3">{String(i + 1).padStart(2, "0")}</span>
              <span className="font-medium capitalize">{s.type.replace(/_/g, " ")}</span>
              <span className="truncate text-sm text-ink-3">{String(s.draft.title_en ?? s.draft.headline_en ?? "")}</span>
              {changed && <span className="badge text-warn">draft</span>}
              {(s.starts_at || s.ends_at) && <span className="badge text-accent">scheduled</span>}
              <span className="ml-auto flex items-center gap-1">
                <IconBtn label="Move up" disabled={i === 0 || pending} onClick={() => move(i, -1)}><ArrowUp className="size-4" /></IconBtn>
                <IconBtn label="Move down" disabled={i === order.length - 1 || pending} onClick={() => move(i, 1)}><ArrowDown className="size-4" /></IconBtn>
                <IconBtn label={s.visible ? "Hide" : "Show"} onClick={() => act(() => saveSectionAction(s.id, s.draft, { visible: !s.visible }))}>{s.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}</IconBtn>
                <IconBtn label="Duplicate" onClick={() => act(() => duplicateSectionAction(s.id))}><Copy className="size-4" /></IconBtn>
                <IconBtn label="Edit" onClick={() => setOpen(open === id ? null : id)}><Pencil className="size-4" /></IconBtn>
                {canDelete && <IconBtn label="Delete" onClick={() => confirm("Move this section to trash (30 days)?") && act(() => deleteSectionAction(s.id))}><Trash2 className="size-4" /></IconBtn>}
              </span>
            </div>
            {open === id && <SectionEditor section={s} />}
          </div>
        );
      })}
      {trash.length > 0 && (
        <details className="card p-3 text-sm">
          <summary className="cursor-pointer text-ink-3">Trash ({trash.length}) — removed permanently after 30 days</summary>
          <ul className="mt-2 space-y-1">{trash.map((t) => <li key={t.id} className="flex items-center justify-between"><span className="capitalize">{t.type.replace(/_/g, " ")} · {String(t.draft.title_en ?? "")}</span><button className="btn btn-ghost btn-sm" onClick={() => act(() => deleteSectionAction(t.id, true))}>Restore</button></li>)}</ul>
        </details>
      )}
    </div>
  );
}

function IconBtn({ label, children, onClick, disabled }: { label: string; children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="grid size-8 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 disabled:opacity-30">{children}</button>;
}

/** Generic editor: English + Urdu side by side, char limits, JSON for lists, image upload. */
function SectionEditor({ section }: { section: Section }) {
  const [draft, setDraft] = useState<Record<string, unknown>>(section.draft);
  const [json, setJson] = useState<Record<string, string>>({});
  const [badJson, setBadJson] = useState<string | null>(null);
  const [sched, setSched] = useState({ starts_at: section.starts_at?.slice(0, 16) ?? "", ends_at: section.ends_at?.slice(0, 16) ?? "" });
  const { pending, msg, act } = useAct();
  const { startUpload, isUploading } = useUploadThing("cmsImage");
  const keys = Object.keys(draft);
  const bases = [...new Set(keys.filter((k) => /_(en|ur)$/.test(k)).map((k) => k.replace(/_(en|ur)$/, "")))];
  const others = keys.filter((k) => !/_(en|ur)$/.test(k));

  return (
    <div className="space-y-4 border-t border-line p-4">
      {bases.map((b) => {
        const lim = limitFor(section.type, `${b}_en`);
        const long = /body|sub|text/.test(b);
        return (
          <div key={b} className="grid gap-3 md:grid-cols-2">
            {(["en", "ur"] as const).map((l) => {
              const k = `${b}_${l}`, v = String(draft[k] ?? "");
              const Field = long ? "textarea" : "input";
              return (
                <label key={k} className="space-y-1">
                  <span className="label flex justify-between capitalize"><span>{b.replace(/_/g, " ")} · {l === "en" ? "English" : "اردو"}</span><span className={v.length > lim ? "text-danger" : "text-ink-3"}>{v.length}/{lim}</span></span>
                  <Field dir={l === "ur" ? "rtl" : undefined} lang={l} className={cn("input", l === "ur" && "urdu")} rows={long ? 3 : undefined} maxLength={lim} value={v}
                    placeholder={l === "ur" && !v ? "Falls back to English" : undefined}
                    onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft((d) => ({ ...d, [k]: e.target.value }))} />
                </label>
              );
            })}
          </div>
        );
      })}
      {others.map((k) => {
        const v = draft[k];
        if (typeof v === "boolean") return <label key={k} className="flex items-center gap-2 text-sm capitalize"><input type="checkbox" checked={v} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.checked }))} />{k.replace(/_/g, " ")}</label>;
        if (typeof v === "string") {
          const isImage = /image|_url$|^poster$/.test(k);
          return (
            <label key={k} className="block space-y-1"><span className="label capitalize">{k.replace(/_/g, " ")}</span>
              <span className="flex gap-2">
                <input className="input" value={v} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} />
                {isImage && <label className="btn btn-ghost btn-sm cursor-pointer"><Upload className="size-4" />{isUploading ? "…" : "Upload"}
                  <input type="file" accept="image/*" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const r = await startUpload([await compressImage(f, 2000)]); if (r?.[0]) setDraft((d) => ({ ...d, [k]: r[0].ufsUrl })); }} />
                </label>}
              </span>
            </label>
          );
        }
        return (
          <label key={k} className="block space-y-1"><span className="label capitalize">{k.replace(/_/g, " ")} (list — edit as JSON)</span>
            <textarea className="input font-mono text-xs" rows={6} defaultValue={JSON.stringify(v, null, 2)} onChange={(e) => setJson((j) => ({ ...j, [k]: e.target.value }))} />
          </label>
        );
      })}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1"><span className="label">Show from (optional)</span><input type="datetime-local" className="input" value={sched.starts_at} onChange={(e) => setSched((s) => ({ ...s, starts_at: e.target.value }))} /></label>
        <label className="space-y-1"><span className="label">Show until (optional)</span><input type="datetime-local" className="input" value={sched.ends_at} onChange={(e) => setSched((s) => ({ ...s, ends_at: e.target.value }))} /></label>
      </div>
      {badJson && <p className="text-sm text-danger">{badJson}</p>}
      <div className="flex items-center gap-3">
        <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => {
          const merged = { ...draft };
          for (const [k, s] of Object.entries(json)) { try { merged[k] = JSON.parse(s); } catch { return setBadJson(`“${k}” is not valid JSON`); } }
          setBadJson(null);
          act(() => saveSectionAction(section.id, merged, { starts_at: sched.starts_at ? new Date(sched.starts_at).toISOString() : null, ends_at: sched.ends_at ? new Date(sched.ends_at).toISOString() : null }), "Draft saved — publish to go live");
        }}>Save draft</button>
        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </div>
  );
}

export function HeroMediaPanel({ mode }: { mode: string }) {
  const [m, setM] = useState(mode);
  const [url, setUrl] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const { pending, msg, act } = useAct();
  const { startUpload, isUploading } = useUploadThing("heroVideo");
  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-medium">Hero media</h2>
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        {[["3d", "3D phone"], ["3d_video", "3D phone + video screen"], ["video", "Full video"], ["image", "Image"], ["offers", "Offer carousel"]].map(([k, l]) => (
          <button key={k} type="button" aria-pressed={m === k} onClick={() => setM(k)} className={cn("card px-3 py-2 text-left", m === k && "glow border-transparent")}>{l}</button>
        ))}
      </div>
      {m !== "3d" && m !== "offers" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input value={url} onChange={(e) => setUrl(e.target.value)} className="input" placeholder={m === "image" ? "Image URL" : "Video URL (uploaded MP4 or YouTube link)"} />
            <label className="btn btn-ghost btn-sm cursor-pointer"><Upload className="size-4" />{isUploading ? "…" : "Upload"}
              <input type="file" accept={m === "image" ? "image/*" : "video/mp4,video/webm"} className="sr-only" onChange={async (e) => {
                const f = e.target.files?.[0]; if (!f) return; setErr(null);
                if (m !== "image") { if (f.size > 6 * 1024 * 1024) return setErr("Hero video must be ≤ 6 MB"); if ((await videoDuration(f)) > 31) return setErr("Hero video must be ≤ 30 s"); }
                const r = await startUpload([m === "image" ? await compressImage(f, 2400) : f]); if (r?.[0]) setUrl(r[0].ufsUrl);
              }} />
            </label>
          </div>
          <p className="text-xs text-ink-3">Videos autoplay muted and loop, with a sound button. 720p H.264 MP4, ≤ 30 s, ≤ 6 MB.</p>
        </div>
      )}
      {err && <p className="text-sm text-danger">{err}</p>}
      <button className="btn btn-primary btn-sm" disabled={pending || (m !== "3d" && m !== "offers" && !url)} onClick={() => act(() => setHeroAction(m, url || undefined, undefined, /youtu/.test(url) ? "youtube" : "upload"), "Hero updated")}>Apply to site</button>
      {msg && <span className="ml-3 text-sm">{msg}</span>}
    </section>
  );
}

/** First frame (at ~1s) of a local video file as a WebP poster. */
async function videoPoster(file: File): Promise<File | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.preload = "auto";
    v.src = URL.createObjectURL(file);
    v.onloadeddata = () => { v.currentTime = Math.min(1, (v.duration || 2) / 2); };
    v.onseeked = () => {
      const c = document.createElement("canvas");
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext("2d")!.drawImage(v, 0, 0);
      c.toBlob((b) => { URL.revokeObjectURL(v.src); resolve(b ? new File([b], "poster.webp", { type: "image/webp" }) : null); }, "image/webp", 0.8);
    };
    v.onerror = () => resolve(null);
  });
}

type SocialItem = { id: string; source: string; url: string; poster: string | null; captions: string | null; type?: string };

export function ReelsPanel({ reels }: { reels: SocialItem[] }) {
  const [link, setLink] = useState("");
  const [cap, setCap] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const { pending, msg, act } = useAct();
  const { startUpload, isUploading } = useUploadThing("reel");
  const { startUpload: startImage, isUploading: imgUploading } = useUploadThing("cmsImage");
  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-medium">Social videos &amp; posts ({reels.length})</h2>
      <p className="text-xs text-ink-3">
        Shows on the homepage in the <b>&quot;From the bench&quot;</b> strip. Paste a link from YouTube, TikTok, Instagram or Facebook, or upload your own video / photo.
        Uploaded videos, YouTube and TikTok autoplay (muted) with an automatic thumbnail. Instagram and Facebook show their own player — for guaranteed autoplay, upload the video file.
      </p>
      <div className="flex gap-2">
        <input value={link} onChange={(e) => setLink(e.target.value)} className="input" placeholder="https://www.tiktok.com/@startech/video/… or instagram.com/reel/…" />
        <button className="btn btn-primary btn-sm" disabled={pending || !link} onClick={() => act(async () => { const r = await addSocialAction({ link, captions: cap }); if (r.ok) { setLink(""); setCap(""); } return r; }, "Added — live on the homepage")}>Add link</button>
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="btn btn-ghost btn-sm cursor-pointer"><Upload className="size-4" />{isUploading ? "Uploading video…" : "Upload video (≤ 60 s)"}
          <input type="file" accept="video/*" className="sr-only" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return; setErr(null);
            if ((await videoDuration(f)) > 61) return setErr("Videos must be 60 seconds or shorter.");
            const poster = await videoPoster(f);
            const r = await startUpload(poster ? [f, poster] : [f]).catch((x: Error) => { setErr(x.message); return null; });
            const vid = r?.find((x) => x.type?.startsWith("video") || /\.(mp4|mov|webm)$/i.test(x.name));
            const img = r?.find((x) => x !== vid);
            if (vid) act(() => addSocialAction({ upload: { url: vid.ufsUrl, kind: "video", poster: img?.ufsUrl ?? null }, captions: cap }), "Video added");
            e.target.value = "";
          }} />
        </label>
        <label className="btn btn-ghost btn-sm cursor-pointer"><Upload className="size-4" />{imgUploading ? "Uploading photo…" : "Upload photo post"}
          <input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            const r = await startImage([await compressImage(f)]).catch((x: Error) => { setErr(x.message); return null; });
            if (r?.[0]) act(() => addSocialAction({ upload: { url: r[0].ufsUrl, kind: "image" }, captions: cap }), "Photo added");
            e.target.value = "";
          }} />
        </label>
      </div>
      <input value={cap} onChange={(e) => setCap(e.target.value)} className="input" placeholder="Caption (optional) — e.g. iPhone 15 Pro screen replaced in 40 min" />
      {err && <p className="text-sm text-danger">{err}</p>}
      {msg && <p className="text-sm">{msg}</p>}
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">{reels.map((r, i) => (
        <li key={r.id} className="relative aspect-[9/16] overflow-hidden rounded-lg bg-surface-2 text-[10px]">
          {r.poster
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={r.poster} alt={r.captions ?? ""} className="size-full object-cover" />
            : <span className="grid size-full place-items-center p-1 text-center capitalize">{r.source}</span>}
          <span className="absolute left-1 top-1 rounded bg-black/60 px-1 capitalize text-white">{r.type === "image" ? "photo" : r.source}</span>
          <div className="absolute inset-x-1 bottom-1 flex justify-between">
            <button type="button" aria-label="Move earlier" disabled={pending || i === 0} className="rounded bg-black/60 px-1.5 text-white" onClick={() => act(() => moveSocialAction(r.id, -1), "Moved")}>◀</button>
            <button type="button" aria-label="Remove" disabled={pending} className="rounded bg-danger px-1.5 text-white" onClick={() => confirm("Remove from the website?") && act(() => removeSocialAction(r.id), "Removed")}>✕</button>
            <button type="button" aria-label="Move later" disabled={pending || i === reels.length - 1} className="rounded bg-black/60 px-1.5 text-white" onClick={() => act(() => moveSocialAction(r.id, 1), "Moved")}>▶</button>
          </div>
        </li>
      ))}</ul>
    </section>
  );
}
