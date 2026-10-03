import { NextResponse, type NextRequest } from "next/server";
import { getPaymentProvider } from "@/lib/payments";
import { supabaseAdmin } from "@/lib/supabase/server";
import { sendTemplate } from "@/lib/whatsapp";

// Signature verified here; the RPC is idempotent per (provider, event_id) and
// logs every payload, including rejected ones.
export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const raw = await req.text();
  const p = getPaymentProvider(provider);
  if (p.name !== provider) return NextResponse.json({ error: "unknown provider" }, { status: 404 });

  const event = await p.parseWebhook(raw, req.headers);
  const sb = supabaseAdmin();
  const payload = event ? { status: event.status, order_no: event.orderNo, amount: event.amount, method: event.method, transaction_id: event.transactionId } : { raw };
  const { data, error } = await sb.rpc("handle_gateway_webhook", {
    p_provider: provider, p_event_id: event?.eventId ?? `invalid-${Date.now()}`, p_payload: payload, p_signature_ok: !!event,
  });
  if (error) {
    console.error("[payments] webhook error", error.message);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 }); // gateway retries
  }
  if (!event) return NextResponse.json({ error: "bad signature" }, { status: 401 });

  if ((data as { status: string }).status === "ok") {
    const { data: o } = await sb.from("orders").select("order_no, total, tracking_token, customers(phone)").eq("order_no", event.orderNo).maybeSingle();
    const phone = (o?.customers as unknown as { phone: string } | null)?.phone;
    if (o && phone) {
      await sendTemplate(phone, "order_confirmation", [o.order_no, String(Number(o.total) / 100), `${process.env.NEXT_PUBLIC_SITE_URL}/track/${o.order_no}?t=${o.tracking_token}`]).catch(() => {});
    }
  }
  return NextResponse.json(data);
}
