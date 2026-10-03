"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { replyWhatsAppAction, setInquiryStatusAction } from "./actions";
import { whatsappLink } from "@/lib/utils";

export function InquiryStatus({ id, phone }: { id: string; phone: string | null }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-1">
      {phone && <a href={whatsappLink(phone)} target="_blank" rel="noopener" className="btn btn-ghost btn-sm">WhatsApp</a>}
      <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => start(async () => { await setInquiryStatusAction(id, "closed"); })}>Close</button>
    </div>
  );
}

export function WhatsAppReply({ threadId, phone, windowOpen }: { threadId: string; phone: string; windowOpen: boolean }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!windowOpen) return <p className="border-t border-line p-3 text-xs text-ink-3">The 24-hour reply window has closed — only approved templates can be sent now.</p>;
  return (
    <form className="flex gap-2 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await replyWhatsAppAction(threadId, phone, text); if (r.ok) { setText(""); router.refresh(); } else setErr(r.error); }); }}>
      <input value={text} onChange={(e) => setText(e.target.value)} className="input" placeholder="Reply…" aria-label="Reply" />
      <button className="btn btn-primary" disabled={pending || !text.trim()}>Send</button>
      {err && <span className="text-xs text-danger">{err}</span>}
    </form>
  );
}
