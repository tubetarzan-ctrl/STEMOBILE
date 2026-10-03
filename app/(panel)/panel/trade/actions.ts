"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/utils";

export async function createTradeFromInquiryAction(inquiryId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePermission("trade.manage");
  const sb = supabaseAdmin();
  const { data: inq } = await sb.from("inquiries").select("name, phone, meta").eq("id", inquiryId).single();
  if (!inq?.phone) return { ok: false, error: "Inquiry has no phone" };
  const meta = (inq.meta ?? {}) as { shop_name?: string; area?: string; cnic_last4?: string };
  const { data: cust, error: ce } = await sb.from("customers").upsert({ phone: normalizePhone(inq.phone), name: inq.name }, { onConflict: "phone" }).select("id").single();
  if (ce || !cust) return { ok: false, error: ce?.message ?? "customer" };
  const { error } = await sb.from("trade_accounts").upsert({
    customer_id: cust.id, shop_name: meta.shop_name ?? inq.name ?? "Shop", location: meta.area, city: "Karachi",
    cnic_masked: meta.cnic_last4 ? `*****-*******-${meta.cnic_last4}`.slice(-17) : null, status: "pending",
  }, { onConflict: "customer_id" });
  if (error) return { ok: false, error: error.message };
  await sb.from("inquiries").update({ status: "closed", customer_id: cust.id }).eq("id", inquiryId);
  revalidatePath("/panel/trade");
  return { ok: true };
}
