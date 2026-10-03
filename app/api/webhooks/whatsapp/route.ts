import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { sendText, verifyMetaSignature } from "@/lib/whatsapp";
import { askAssistant } from "@/lib/ai/assistant";

// GET: Meta webhook verification handshake.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (sp.get("hub.mode") === "subscribe" && sp.get("hub.verify_token") === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(sp.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

type Msg = { from: string; id: string; type: string; text?: { body: string }; button?: { payload: string; text: string }; interactive?: { button_reply?: { id: string; title: string } } };

// POST: inbound messages + status updates. Always 200 quickly so Meta doesn't retry.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"))) return new NextResponse("bad signature", { status: 401 });
  const body = JSON.parse(raw);
  const sb = supabaseAdmin();

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value ?? {};
      for (const st of v.statuses ?? []) {
        await sb.from("whatsapp_messages").update({ status: st.status }).eq("wa_message_id", st.id);
      }
      for (const m of (v.messages ?? []) as Msg[]) {
        const phone = `+${m.from}`;
        const text = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? "";
        const { data: customer } = await sb.from("customers").select("id").eq("phone", phone).maybeSingle();
        const { data: thread } = await sb.from("whatsapp_threads").upsert({
          phone, customer_id: customer?.id ?? null, last_message_at: new Date().toISOString(),
          window_expires_at: new Date(Date.now() + 24 * 3600e3).toISOString(), status: "open",
        }, { onConflict: "phone" }).select("id, assigned_to, unread").single();
        const { error: dup } = await sb.from("whatsapp_messages").insert({ thread_id: thread!.id, direction: "in", wa_message_id: m.id, body: text, payload: m });
        if (dup) continue; // duplicate delivery (unique wa_message_id) — already handled
        await sb.from("whatsapp_threads").update({ unread: (thread!.unread ?? 0) + 1 }).eq("id", thread!.id);

        // COD Confirm / Cancel buttons — payload "COD_CONFIRM:<order_id>" / "COD_CANCEL:<order_id>"
        const payload = m.button?.payload ?? m.interactive?.button_reply?.id ?? "";
        const cod = payload.match(/^COD_(CONFIRM|CANCEL):([0-9a-f-]{36})$/);
        if (cod) {
          const { error } = await sb.rpc("confirm_cod", { p_order: cod[2], p_confirmed: cod[1] === "CONFIRM", p_channel: "whatsapp" });
          await sendText(phone, error ? "Thanks — this order was already updated." : cod[1] === "CONFIRM" ? "Confirmed ✅ We'll dispatch your order shortly." : "Your order has been cancelled.").catch(() => {});
          continue;
        }

        // Unassigned conversations get the AI assistant (answer-bank first); handoffs go to the inbox.
        if (!thread!.assigned_to && text) {
          const reply = await askAssistant(text).catch(() => null);
          if (reply?.reply) await sendText(phone, reply.reply).catch(() => {});
          if (!reply || reply.handoff) {
            await sb.from("notifications").insert({ kind: "whatsapp", title: `WhatsApp needs a human: ${phone}`, body: text.slice(0, 140), link: "/panel/inbox", priority: "high" });
          }
        }
      }
    }
  }
  return NextResponse.json({ ok: true });
}
