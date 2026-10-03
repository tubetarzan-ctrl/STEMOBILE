"use client";
import { useState, useTransition } from "react";
import { deleteReviewAction, moderateReviewAction, replyGoogleAction, type ActionResult } from "@/app/actions/panel";

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
