"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasSupabase, supabaseAdmin, supabasePublic } from "@/lib/supabase/server";
import { getRepairQuote } from "@/lib/data/store";
import { mockDevices } from "@/lib/data/mock";
import { rateLimit } from "@/lib/rate-limit";
import { isValidPKMobile, normalizePhone } from "@/lib/utils";
import { checkReviewText } from "@/lib/reviews/filter";
import { notifyOwner, sendTemplate } from "@/lib/whatsapp";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

function friendly(msg: string): string {
  if (msg.includes("insufficient_stock")) return "Sorry — one of the items just sold out. Please update your cart.";
  if (msg.includes("invalid_discount_code")) return "That discount code isn't valid.";
  if (msg.includes("discount_min_order_not_met")) return "Your order doesn't meet the minimum for that code.";
  if (msg.includes("discount_code_expired")) return "That discount code has expired.";
  if (msg.includes("customer_blocked")) return "We couldn't place this order. Please contact us on WhatsApp.";
  return "Something went wrong. Please try again or message us on WhatsApp.";
}

// --- Instant Quote ------------------------------------------------------------
export async function getQuoteAction(deviceId: string, issue: string) {
  if (!z.string().min(1).max(64).safeParse(deviceId).success) return [];
  return getRepairQuote(deviceId, issue);
}

// --- Checkout --------------------------------------------------------------------
const OrderSchema = z.object({
  idempotencyKey: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  phone: z.string().refine(isValidPKMobile, "Enter a valid Pakistani mobile number"),
  city: z.string().trim().min(2).max(60),
  address: z.string().trim().max(240).optional(),
  paymentMethod: z.enum(["cod", "gateway", "bank_transfer", "pay_at_pickup"]),
  deliveryMethod: z.enum(["pickup", "rider", "courier"]),
  discountCode: z.string().trim().max(40).optional(),
  notes: z.string().max(500).optional(),
  items: z.array(z.object({ variantId: z.string().min(1), qty: z.number().int().min(1).max(20) })).min(1).max(50),
});

export async function placeOrderAction(input: z.infer<typeof OrderSchema>): Promise<Result<{ orderNo: string; token: string; total: number; payUrl?: string }>> {
  const parsed = OrderSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check your details");
  const o = parsed.data;
  if (o.deliveryMethod !== "pickup" && !o.address) return fail("Please enter your delivery address");
  if (!(await rateLimit("order", 10, 60_000))) return fail("Too many attempts — please wait a minute.");

  if (!hasSupabase) {
    return { ok: true, data: { orderNo: "ST-DEMO01", token: "demo", total: 0 } };
  }
  const { data, error } = await supabasePublic().rpc("place_online_order", {
    p: {
      idempotency_key: o.idempotencyKey, phone: o.phone, name: o.name, city: o.city,
      address: o.address ? { line1: o.address } : null, payment_method: o.paymentMethod, delivery_method: o.deliveryMethod,
      discount_code: o.discountCode || null, notes: o.notes,
      items: o.items.map((i) => ({ variant_id: i.variantId, qty: i.qty })),
    },
  });
  if (error) return fail(friendly(error.message));
  const r = data as { order_no: string; tracking_token: string; total: number; order_id: string };

  let payUrl: string | undefined;
  if (o.paymentMethod === "gateway") {
    const { getPaymentProvider } = await import("@/lib/payments");
    const session = await getPaymentProvider().createCheckout({
      orderNo: r.order_no, amount: Number(r.total), customerPhone: normalizePhone(o.phone),
      returnUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/track/${r.order_no}?t=${r.tracking_token}`,
    });
    payUrl = session.redirectUrl;
  }
  if (o.paymentMethod === "cod") {
    // WhatsApp COD confirmation (Confirm / Cancel buttons) — §5.8
    await sendTemplate(normalizePhone(o.phone), "cod_confirm", [o.name, r.order_no, String(Number(r.total) / 100)], { ref_type: "order", ref_id: r.order_id }, [`COD_CONFIRM:${r.order_id}`, `COD_CANCEL:${r.order_id}`])
      .then(() => supabaseAdmin().from("cod_confirmations").update({ sent_at: new Date().toISOString() }).eq("order_id", r.order_id))
      .catch(() => {});
  }
  if (o.paymentMethod !== "cod") {
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    await sendTemplate(normalizePhone(o.phone), "order_confirmation", [r.order_no, String(Number(r.total) / 100), `${site}/track/${r.order_no}?t=${r.tracking_token}`], { ref_type: "order", ref_id: r.order_id }).catch(() => {});
  }
  return { ok: true, data: { orderNo: r.order_no, token: r.tracking_token, total: Number(r.total), payUrl } };
}

// --- Track without an account: order/job number + phone --------------------------------
export type TrackHit = { no: string; status: string; url: string; at: string; total?: number; device?: string };
export async function trackAction(ref: string, phone: string): Promise<Result<{ orders: TrackHit[]; repairs: TrackHit[] }>> {
  if (!isValidPKMobile(phone)) return fail("Enter the mobile number you used when ordering/booking.");
  if (!ref.trim()) return fail("Enter your order number (ST-…) or repair number (RJ-…).");
  if (!(await rateLimit("track", 10, 60_000))) return fail("Too many attempts — please wait a minute.");
  if (!hasSupabase) return fail("Tracking is not available in demo mode.");
  const { data, error } = await supabasePublic().rpc("track_by_phone", { p_phone: phone, p_ref: ref.trim().slice(0, 40) });
  if (error) return fail("Something went wrong. Please try again.");
  if (!data) return fail("We couldn't find that number with this phone. Check both and try again, or WhatsApp us.");
  return { ok: true, data: data as { orders: TrackHit[]; repairs: TrackHit[] } };
}

// --- Repair booking -----------------------------------------------------------------
const BookingSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().refine(isValidPKMobile, "Enter a valid Pakistani mobile number"),
  deviceId: z.string().optional(),
  deviceLabel: z.string().max(80).optional(),
  issues: z.array(z.string()).min(1).max(6),
  notes: z.string().max(500).optional(),
  preferredAt: z.string().optional(),
});

export async function bookRepairAction(input: z.infer<typeof BookingSchema>): Promise<Result<{ jobNo: string; trackingRef: string }>> {
  const parsed = BookingSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check your details");
  if (!(await rateLimit("booking", 5, 60_000))) return fail("Too many attempts — please wait a minute.");
  const b = parsed.data;
  if (!hasSupabase) return { ok: true, data: { jobNo: "RJ-DEMO01", trackingRef: "DEMO1234" } };
  const deviceLabel = b.deviceLabel || mockDevices.find((d) => d.id === b.deviceId)?.name;
  const { data, error } = await supabasePublic().rpc("create_repair_job", {
    p: {
      phone: b.phone, name: b.name, device_id: b.deviceId && /^[0-9a-f-]{36}$/.test(b.deviceId) ? b.deviceId : null,
      device_label: deviceLabel, issues: b.issues, notes: b.notes, status: "booked",
      promised_at: b.preferredAt || null,
    },
  });
  if (error) return fail(friendly(error.message));
  const r = data as { job_no: string; tracking_ref: string };
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  await sendTemplate(normalizePhone(b.phone), "repair_status", [r.job_no, "booked — please bring your phone to the shop", `${site}/track/${r.tracking_ref}`], { ref_type: "repair" }).catch(() => {});
  await notifyOwner(`New repair booking ${r.job_no}: ${deviceLabel ?? "device"} — ${b.issues.join(", ")} (${b.name})`).catch(() => {});
  return { ok: true, data: { jobNo: r.job_no, trackingRef: r.tracking_ref } };
}

// --- Chat: visitor leaves a number after the bot hands off -----------------------------
export async function chatCallbackAction(inquiryId: string, name: string, phone: string): Promise<Result<null>> {
  if (!isValidPKMobile(phone)) return fail("Enter a valid mobile number, e.g. 0300 1234567");
  if (!/^[0-9a-f-]{36}$/.test(inquiryId)) return fail("Please try again.");
  if (!(await rateLimit("chat-callback", 5, 60_000))) return fail("Too many attempts — please wait a minute.");
  if (!hasSupabase) return { ok: true, data: null };
  // only a fresh, still-anonymous chat inquiry can be claimed
  const since = new Date(Date.now() - 6 * 3600_000).toISOString();
  const { error } = await supabaseAdmin().from("inquiries").update({ name: name.trim().slice(0, 80) || null, phone: normalizePhone(phone), priority: "high" })
    .eq("id", inquiryId).eq("kind", "chat").is("phone", null).gte("created_at", since);
  if (error) return fail("Please try again.");
  await notifyOwner(`Website chat: ${name || "visitor"} (${normalizePhone(phone)}) wants a reply — see Inbox.`).catch(() => {});
  return { ok: true, data: null };
}

// --- Inquiries (quick, trade, special order, contact) -------------------------------
const InquirySchema = z.object({
  kind: z.enum(["quick", "trade", "special_order", "contact"]),
  name: z.string().trim().min(2).max(80),
  phone: z.string().refine(isValidPKMobile, "Enter a valid Pakistani mobile number"),
  message: z.string().trim().min(3).max(1000),
  deviceText: z.string().max(120).optional(),
  meta: z.record(z.string(), z.string()).optional(),
});

export async function submitInquiryAction(input: z.infer<typeof InquirySchema>): Promise<Result<null>> {
  const parsed = InquirySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check your details");
  if (!(await rateLimit("inquiry", 5, 60_000))) return fail("Too many attempts — please wait a minute.");
  if (!hasSupabase) return { ok: true, data: null };
  const i = parsed.data;
  const { error } = await supabaseAdmin().from("inquiries").insert({
    kind: i.kind, name: i.name, phone: normalizePhone(i.phone), message: i.message, device_text: i.deviceText, meta: i.meta ?? {},
    priority: i.kind === "trade" ? "high" : "normal",
  });
  if (error) return fail("Could not send — please message us on WhatsApp.");
  return { ok: true, data: null };
}

// --- Reviews -------------------------------------------------------------------------
const ReviewSchema = z.object({
  name: z.string().trim().min(2).max(60),
  phone: z.string().refine(isValidPKMobile, "Enter a valid Pakistani mobile number"),
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().max(2000).optional(),
  productId: z.string().optional(),
  requestToken: z.string().max(64).optional(),
  media: z.array(z.object({ type: z.enum(["image", "video"]), url: z.string().url(), key: z.string().optional(), poster: z.string().optional() })).max(7).optional(),
});

export async function submitReviewAction(input: z.infer<typeof ReviewSchema>): Promise<Result<{ id: string; status: string }>> {
  const parsed = ReviewSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check your review");
  if (!(await rateLimit("review", 3, 60_000))) return fail("Too many attempts — please wait a minute.");
  const r = parsed.data;
  const pre = checkReviewText(r.text ?? "");
  if (!hasSupabase) return { ok: true, data: { id: "demo", status: pre ? "pending" : "published" } };
  const { data, error } = await supabasePublic().rpc("submit_review", {
    p: { name: r.name, phone: r.phone, rating: r.rating, text: r.text, product_id: r.productId || null, request_token: r.requestToken || null, media: r.media ?? [] },
  });
  if (error) return fail("Could not submit your review.");
  const res = data as { review_id: string; status: string };
  if (res.status === "published") revalidatePath("/");
  if (r.rating <= 3) await notifyOwner(`⚠️ New ${r.rating}★ review from ${r.name}: ${(r.text ?? "").slice(0, 120)}`).catch(() => {});
  return { ok: true, data: { id: res.review_id, status: res.status } };
}

export async function googlePromptClickedAction(reviewId: string) {
  if (!hasSupabase || !/^[0-9a-f-]{36}$/.test(reviewId)) return;
  await supabasePublic().rpc("track_google_prompt_click", { p_review: reviewId });
}

// --- Trade application -----------------------------------------------------------------
export async function applyTradeAction(input: { shopName: string; name: string; phone: string; area: string; cnicLast4?: string; message?: string }): Promise<Result<null>> {
  return submitInquiryAction({
    kind: "trade", name: input.name, phone: input.phone,
    message: `Trade account application — ${input.shopName}, ${input.area}. ${input.message ?? ""}`.trim(),
    meta: { shop_name: input.shopName, area: input.area, cnic_last4: (input.cnicLast4 ?? "").replace(/\D/g, "").slice(-4) },
  });
}
