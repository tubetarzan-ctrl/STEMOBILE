"use client";
import { useState, useTransition } from "react";
import { Copy, ImagePlus, Star, Video, X } from "lucide-react";
import { googlePromptClickedAction, submitReviewAction } from "@/app/actions/store";
import { compressImage, useUploadThing, videoDuration } from "@/lib/client/upload";
import { checkReviewText } from "@/lib/reviews/filter";
import { cn } from "@/lib/utils";

type Media = { type: "image" | "video"; url: string; key?: string };

export function ReviewForm({ productId, requestToken, googleUrl }: { productId?: string; requestToken?: string; googleUrl: string | null }) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [media, setMedia] = useState<Media[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ id: string; status: string } | null>(null);
  const [pending, start] = useTransition();
  const { startUpload, isUploading } = useUploadThing("reviewMedia");

  const addFiles = async (files: FileList | null, kind: "image" | "video") => {
    if (!files?.length) return;
    setError(null);
    try {
      let list = [...files];
      if (kind === "image") {
        list = list.slice(0, 6 - media.filter((m) => m.type === "image").length);
        list = await Promise.all(list.map((f) => compressImage(f)));
      } else {
        if (media.some((m) => m.type === "video")) return setError("Only one video per review");
        const f = list[0];
        if (f.size > 100 * 1024 * 1024) return setError("Video must be under 100 MB");
        if ((await videoDuration(f)) > 61) return setError("Video must be 60 seconds or shorter");
        list = [f];
      }
      const res = await startUpload(list);
      setMedia((m) => [...m, ...(res ?? []).map((r) => ({ type: kind, url: r.ufsUrl, key: r.key }))]);
    } catch {
      setError("Upload failed — you can still submit without media.");
    }
  };

  if (submitted) {
    return (
      <div className="card mt-8 space-y-4 p-8 text-center">
        <p className="font-display text-2xl font-semibold">Thank you!</p>
        <p className="text-ink-2">{submitted.status === "published" ? "Your review is live." : "Your review will appear after a quick check."}</p>
        {googleUrl && rating >= 4 && (
          <div className="rounded-2xl bg-surface-2 p-5 text-left">
            <p className="font-medium">Would you also share this on Google?</p>
            <p className="mt-1 text-sm text-ink-3">Google doesn&apos;t let us post for you — copy your words and paste them there.</p>
            {text && <button type="button" className="btn btn-ghost btn-sm mt-3" onClick={() => navigator.clipboard.writeText(text)}><Copy className="size-4" />Copy my review</button>}
            <a href={googleUrl} target="_blank" rel="noopener" onClick={() => googlePromptClickedAction(submitted.id)} className="btn btn-primary mt-3 ml-2">Open Google reviews</a>
          </div>
        )}
      </div>
    );
  }

  return (
    <form
      className="mt-8 space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!rating) return setError("Tap a star rating");
        const f = new FormData(e.currentTarget);
        start(async () => {
          const r = await submitReviewAction({ name: String(f.get("name")), phone: String(f.get("phone")), rating, text: text || undefined, productId, requestToken, media });
          if (r.ok) setSubmitted(r.data); else setError(r.error);
        });
      }}
    >
      <fieldset>
        <legend className="label mb-2">Your rating</legend>
        <div className="flex gap-1" role="radiogroup">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setRating(n)}>
              <Star className={cn("size-9 transition-colors", n <= rating ? "fill-warn text-warn" : "text-line")} />
            </button>
          ))}
        </div>
      </fieldset>
      <label className="block space-y-1">
        <span className="label">Your review</span>
        <textarea rows={4} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} className="input" placeholder="What did we fix or sell you? How was it?" />
        {checkReviewText(text) === "contains_link" && <span className="text-xs text-warn">Links will send your review for a manual check.</span>}
      </label>
      <div className="space-y-2">
        <span className="label">Photos (up to 6) and one video (≤ 60s)</span>
        <div className="flex flex-wrap gap-2">
          {media.map((m, i) => (
            <div key={m.url} className="relative size-20 overflow-hidden rounded-xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {m.type === "image" ? <img src={m.url} alt="" className="size-full object-cover" /> : <video src={m.url} muted className="size-full object-cover" />}
              <button type="button" aria-label="Remove" onClick={() => setMedia((x) => x.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"><X className="size-3" /></button>
            </div>
          ))}
          <label className="grid size-20 cursor-pointer place-items-center rounded-xl border border-dashed border-line text-ink-3 hover:border-accent">
            <ImagePlus className="size-5" /><span className="sr-only">Add photos</span>
            <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addFiles(e.target.files, "image")} />
          </label>
          <label className="grid size-20 cursor-pointer place-items-center rounded-xl border border-dashed border-line text-ink-3 hover:border-accent">
            <Video className="size-5" /><span className="sr-only">Add a video</span>
            <input type="file" accept="video/*" className="sr-only" onChange={(e) => addFiles(e.target.files, "video")} />
          </label>
        </div>
        {isUploading && <p className="text-xs text-ink-3">Uploading…</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1"><span className="label">Name shown</span><input name="name" required className="input" /></label>
        <label className="space-y-1"><span className="label">Mobile (not shown)</span><input name="phone" required className="input" inputMode="tel" placeholder="03xx xxxxxxx" /></label>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button className="btn btn-primary" disabled={pending || isUploading}>{pending ? "Submitting…" : "Submit review"}</button>
    </form>
  );
}
