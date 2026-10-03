"use client";
import { useState, useTransition } from "react";
import { addReviewAction, deleteReviewAction, moderateReviewAction, replyGoogleAction, type ActionResult } from "@/app/actions/panel";
import { compressImage, useUploadThing } from "@/lib/client/upload";

export function ReviewControls({ review: r }: { review: { id: string; status: string; featured: boolean; owner_reply: string | null } }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [reply, setReply] = useState(r.owner_reply ?? "");
  const run = (fn: () => Promise<ActionResult>) => start(async () => { const x = await fn(); setMsg(x.ok ? "Saved" : x.error); });
  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        {r.status !== "published" && <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => run(() => moderateReviewAction(r.id, { status: "published" }))}>Approve</button>}
        {r.status === "pending" && <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(() => moderateReviewAction(r.id, { status: "rejected" }))}>Reject</button>}
        {r.status === "published" && <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(() => moderateReviewAction(r.id, { status: "hidden" }))}>Hide</button>}
        <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(() => moderateReviewAction(r.id, { featured: !r.featured }))}>{r.featured ? "Unfeature" : "Feature"}</button>
        <button className="btn btn-ghost btn-sm text-danger" disabled={pending} onClick={() => confirm("Delete permanently?") && run(() => deleteReviewAction(r.id))}>Delete</button>
      </div>
      <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} className="input text-sm" placeholder="Public reply from StarTech" />
      <button className="btn btn-ghost btn-sm self-start" disabled={pending} onClick={() => run(() => moderateReviewAction(r.id, { owner_reply: reply || null }))}>Save reply</button>
      {msg && <span className="text-xs">{msg}</span>}
    </div>
  );
}

export function GoogleReply({ id, existing }: { id: string; existing: string | null }) {
  const [text, setText] = useState(existing ?? "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex gap-2">
      <input value={text} onChange={(e) => setText(e.target.value)} className="input h-10 text-sm" placeholder="Reply on Google…" />
      <button className="btn btn-ghost btn-sm" disabled={pending || !text} onClick={() => start(async () => { const r = await replyGoogleAction(id, text); setMsg(r.ok ? "Posted to Google" : r.error); })}>Reply</button>
      {msg && <span className="text-xs">{msg}</span>}
    </div>
  );
}

/** Type in feedback a real customer gave at the counter or on WhatsApp. */
export function AddReview() {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ author_name: "", phone: "", rating: 5, text: "" });
  const [photos, setPhotos] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const { startUpload, isUploading } = useUploadThing("cmsImage");
  if (!open) return <button className="btn btn-primary" onClick={() => setOpen(true)}>+ Add a customer review</button>;
  return (
    <form className="card grid gap-3 p-4 sm:grid-cols-2" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await addReviewAction({ ...f, photos });
        if (!r.ok) return setMsg(r.error);
        setMsg("✓ Published"); setF({ author_name: "", phone: "", rating: 5, text: "" }); setPhotos([]);
      });
    }}>
      <p className="text-sm text-ink-3 sm:col-span-2">Only add what a real customer actually said (in shop, WhatsApp or phone) and with their OK to show it. It appears without the &quot;verified purchase&quot; tick.</p>
      <input className="input" placeholder="Customer name (e.g. Ahmed R.)" value={f.author_name} onChange={(e) => setF({ ...f, author_name: e.target.value })} required />
      <input className="input" placeholder="Phone (optional, not shown)" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      <div className="flex items-center gap-1 sm:col-span-2" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-label={`${n} stars`} className={n <= f.rating ? "text-2xl text-warn" : "text-2xl text-ink-3"} onClick={() => setF({ ...f, rating: n })}>★</button>
        ))}
      </div>
      <textarea className="input sm:col-span-2" rows={3} placeholder="What they said (Roman Urdu or English is fine)" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} required />
      <label className="btn btn-ghost btn-sm w-fit cursor-pointer">
        {isUploading ? "Uploading…" : "Add photos"}
        <input type="file" accept="image/*" multiple className="sr-only" onChange={async (e) => {
          const files = await Promise.all([...(e.target.files ?? [])].slice(0, 6).map((x) => compressImage(x)));
          const res = await startUpload(files);
          if (res) setPhotos((p) => [...p, ...res.map((x) => x.ufsUrl)]);
        }} />
      </label>
      <div className="flex gap-2">{photos.map((u) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={u} src={u} alt="" className="size-12 rounded-lg object-cover" />
      ))}</div>
      <div className="flex items-center gap-2 sm:col-span-2">
        <button className="btn btn-primary" disabled={pending || isUploading}>Publish review</button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Close</button>
        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </form>
  );
}
