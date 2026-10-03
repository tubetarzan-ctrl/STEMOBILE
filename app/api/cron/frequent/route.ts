import { NextResponse, type NextRequest } from "next/server";
import { cronGuard } from "@/lib/cron";
import { supabaseAdmin } from "@/lib/supabase/server";
import { notifyOwner } from "@/lib/whatsapp";
import { getCourier } from "@/lib/courier";

// Every 15 minutes: expire unpaid orders, push unconfirmed COD to the call
// queue, send critical stock alerts instantly, flag stale payment proofs, poll couriers.
export async function GET(req: NextRequest) {
  const denied = cronGuard(req);
  if (denied) return denied;
  const sb = supabaseAdmin();
  const out: Record<string, unknown> = {};

  const { data: exp } = await sb.rpc("expire_unpaid_orders");
  out.orders = exp;

  // Critical stock alerts → instant WhatsApp (others go in the 9 PM digest).
  const { data: alerts } = await sb.from("stock_alerts")
    .select("id, on_hand, reorder_level, product_variants(sku, products(name))").eq("status", "open").eq("is_critical", true).is("notified_at", null).limit(20);
  if (alerts?.length) {
    const lines = alerts.map((a) => { const v = a.product_variants as unknown as { sku: string; products: { name: string } }; return `• ${v.products.name} (${v.sku}) — ${a.on_hand} left`; });
    await notifyOwner(`⚠️ Critical stock low:\n${lines.join("\n")}`).catch(() => {});
    await sb.from("stock_alerts").update({ notified_at: new Date().toISOString() }).in("id", alerts.map((a) => a.id));
  }

  // Payment proofs awaiting verification > 2h
  const { count } = await sb.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending").lt("created_at", new Date(Date.now() - 2 * 3600e3).toISOString());
  if (count) await sb.from("notifications").insert({ kind: "payment_proof", title: `${count} payment proof(s) waiting > 2h`, link: "/panel/orders?filter=payment_submitted", priority: "high" });
  out.stale_proofs = count ?? 0;

  // Courier polling for shipments without webhooks
  const courier = getCourier();
  const { data: ships } = await sb.from("shipments").select("id, tracking_no, status").not("status", "in", "(delivered,returned)").limit(25);
  for (const s of ships ?? []) {
    try {
      const events = await courier.track(s.tracking_no);
      const last = events.at(-1);
      if (last && last.status !== s.status) await sb.from("shipments").update({ status: last.status, events, last_polled_at: new Date().toISOString() }).eq("id", s.id);
    } catch { /* keep polling next run */ }
  }
  return NextResponse.json(out);
}
