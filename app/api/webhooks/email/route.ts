import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/server";
import { classifyEmail } from "@/lib/email/classify";
import { answerFromBank } from "@/lib/ai/answer-bank";
import { sendEmail } from "@/lib/email";
import { notifyOwner } from "@/lib/whatsapp";

// Resend inbound → classify (rules) → inbox. Auto-reply only to "general"
// questions, drafted from the FAQ answer bank; complaints/refunds go to the owner.
function verify(raw: string, sig: string | null) {
  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  if (!sig) return false;
  const exp = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(sig), b = Buffer.from(exp);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verify(raw, req.headers.get("x-webhook-signature"))) return new NextResponse("bad signature", { status: 401 });
  const j = JSON.parse(raw);
  const d = j.data ?? j;
  const from: string = d.from?.email ?? d.from ?? "";
  const subject: string = d.subject ?? "";
  const body: string = d.text ?? d.html?.replace(/<[^>]+>/g, " ") ?? "";
  const c = classifyEmail(from, subject, body);
  const sb = supabaseAdmin();

  let inquiryId: string | null = null;
  if (!["spam", "social", "notification"].includes(c.kind)) {
    const { data } = await sb.from("inquiries").insert({ kind: "email", email: from, message: `${subject}\n\n${body}`.slice(0, 5000), priority: c.priority, meta: { classification: c.kind } }).select("id").single();
    inquiryId = data?.id ?? null;
  }
  let reply: string | null = null;
  if (c.autoReply) {
    const { data: faqs } = await sb.from("faqs").select("q_en, a_en, keywords").eq("visible", true);
    const hit = answerFromBank(`${subject} ${body}`, (faqs ?? []).map((f) => ({ q: f.q_en, a: f.a_en, keywords: f.keywords })));
    if (hit) {
      reply = `${hit.answer}\n\nIf this doesn't answer your question, reply here or WhatsApp us — a team member will help.\n\n— StarTech Electronics`;
      await sendEmail({ to: from, subject: `Re: ${subject}`, html: reply.replace(/\n/g, "<br>") }).catch(() => {});
    }
  }
  await sb.from("email_threads").insert({ from_address: from, subject, body: body.slice(0, 20000), classification: c.kind, auto_replied: !!reply, reply_draft: reply, inquiry_id: inquiryId });
  if (c.priority === "high") await notifyOwner(`📧 ${c.kind.toUpperCase()} email from ${from}: ${subject}`).catch(() => {});
  return NextResponse.json({ ok: true, classification: c.kind });
}
