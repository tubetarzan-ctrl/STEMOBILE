import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Meta WhatsApp Cloud API (official). Without credentials every send is logged
// to the console (mock), so flows work in local dev.

export const TEMPLATES = {
  order_confirmation: "Order {{1}} confirmed — total Rs {{2}}. Track: {{3}}",
  cod_confirm: "Hi {{1}}, please confirm your COD order {{2}} (Rs {{3}}). [Confirm] [Cancel]",
  dispatch: "Your order {{1}} is on the way with {{2}}. Tracking: {{3}}",
  delivered: "Order {{1}} delivered. Thank you! Review us: {{2}}",
  repair_status: "Repair {{1}} update: {{2}}. Live tracker: {{3}}",
  estimate_approval: "Repair {{1}}: revised estimate Rs {{2}}. Approve or decline: {{3}}",
  ready_for_pickup: "Your {{1}} is ready for pickup at StarTech, Sarena Mobile Mall. Job {{2}}.",
  warranty_reminder: "Your warranty for {{1}} ends on {{2}}.",
  khata_reminder: "Khata statement for {{1}}: balance Rs {{2}}, due {{3}}. Pay via Raast: {{4}}",
  back_in_stock: "Good news — {{1}} is back in stock: {{2}}",
  abandoned_cart: "You left {{1}} in your cart. Complete your order: {{2}}",
  review_request: "Thanks for choosing StarTech! Share your experience: {{1}}",
} as const;
export type TemplateName = keyof typeof TEMPLATES;

const API = "https://graph.facebook.com/v21.0";
const configured = () => !!(process.env.WHATSAPP_CLOUD_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

async function post(body: Record<string, unknown>, attempt = 1): Promise<{ id?: string }> {
  const res = await fetch(`${API}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_CLOUD_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    if (attempt < 3 && res.status >= 500) {
      await new Promise((r) => setTimeout(r, 400 * attempt));
      return post(body, attempt + 1);
    }
    throw new Error(`whatsapp_send_failed ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  return { id: json.messages?.[0]?.id };
}

async function log(phone: string, direction: "out", body: string, template: string | null, waId: string | undefined, ref?: { ref_type?: string; ref_id?: string }) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const { supabaseAdmin } = await import("@/lib/supabase/server");
  const sb = supabaseAdmin();
  const { data: thread } = await sb.from("whatsapp_threads").upsert({ phone, last_message_at: new Date().toISOString() }, { onConflict: "phone" }).select("id").single();
  if (thread) await sb.from("whatsapp_messages").insert({ thread_id: thread.id, direction, body, template, wa_message_id: waId, status: "sent", ...ref });
}

/** Approved template message (works outside the 24h window). */
export async function sendTemplate(to: string, name: TemplateName, params: string[], ref?: { ref_type?: string; ref_id?: string }, buttons: string[] = []) {
  const preview = params.reduce<string>((s, p, i) => s.replace(`{{${i + 1}}}`, p), TEMPLATES[name]);
  if (!configured()) {
    console.info(`[whatsapp:mock] → ${to} [${name}] ${preview}`);
    return { id: `mock-${Date.now()}` };
  }
  const r = await post({
    to: to.replace("+", ""), type: "template",
    template: {
      name, language: { code: "en" },
      components: [
        { type: "body", parameters: params.map((text) => ({ type: "text", text })) },
        // quick-reply payloads come back to /api/webhooks/whatsapp (e.g. COD_CONFIRM:<order_id>)
        ...buttons.map((payload, index) => ({ type: "button", sub_type: "quick_reply", index: String(index), parameters: [{ type: "payload", payload }] })),
      ],
    },
  });
  await log(to, "out", preview, name, r.id, ref);
  return r;
}

/** Free-form text (only inside the 24h customer-service window). */
export async function sendText(to: string, text: string) {
  if (!configured()) { console.info(`[whatsapp:mock] → ${to}: ${text}`); return { id: `mock-${Date.now()}` }; }
  const r = await post({ to: to.replace("+", ""), type: "text", text: { body: text } });
  await log(to, "out", text, null, r.id);
  return r;
}

export async function notifyOwner(text: string) {
  const owner = process.env.OWNER_WHATSAPP;
  if (!owner) { console.info(`[owner-alert] ${text}`); return; }
  return sendText(owner, text);
}

/** Verify X-Hub-Signature-256 on inbound webhooks. */
export function verifyMetaSignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(header.slice(7)), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
