"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabase/server";
import { sendText } from "@/lib/whatsapp";

export async function setInquiryStatusAction(id: string, status: "open" | "waiting" | "closed") {
  const staff = await requirePermission("inbox.manage");
  await supabaseAdmin().from("inquiries").update({ status, assigned_to: staff.id }).eq("id", id);
  revalidatePath("/panel/inbox");
}

export async function replyWhatsAppAction(threadId: string, phone: string, text: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const staff = await requirePermission("inbox.manage");
  try {
    await sendText(phone, text.slice(0, 4000));
    const sb = supabaseAdmin();
    await sb.from("whatsapp_threads").update({ assigned_to: staff.id, unread: 0 }).eq("id", threadId);
    if (!process.env.WHATSAPP_CLOUD_API_TOKEN) await sb.from("whatsapp_messages").insert({ thread_id: threadId, direction: "out", body: text, status: "mock", sent_by: staff.id });
    revalidatePath("/panel/inbox");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
