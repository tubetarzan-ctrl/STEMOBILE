"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/permissions";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { encryptPasscode } from "@/lib/crypto/passcode";
import { getCourier } from "@/lib/courier";
import { sendTemplate } from "@/lib/whatsapp";
import { replyToGoogleReview } from "@/lib/reviews/google";
import { askCopilot } from "@/lib/ai/copilot";

export type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

// UI-side guard + DB-side guard: requirePermission() here, and the RPC runs as
// the signed-in staff member so has_permission() is enforced again in Postgres.
async function rpc<T = unknown>(perm: string, fn: string, args: Record<string, unknown>, revalidate?: string | string[]): Promise<ActionResult<T>> {
  try {
    await requirePermission(perm);
    const sb = await supabaseServer();
    const { data, error } = await sb.rpc(fn, args);
    if (error) return { ok: false, error: humanize(error.message) };
    for (const p of [revalidate ?? []].flat()) revalidatePath(p);
    return { ok: true, data: data as T };
  } catch (e) {
    return { ok: false, error: humanize((e as Error).message) };
  }
}

function humanize(msg: string): string {
  const map: [RegExp, string][] = [
    [/permission_denied: (\S+)/, "You don't have permission ($1)."],
    [/insufficient_stock: (.+)/, "Not enough stock: $1"],
    [/below_min_price: (.+)/, "Below minimum price: $1 — needs manager approval."],
    [/payment_mismatch: (.+)/, "Payments don't add up: $1"],
    [/credit_limit_exceeded: (.+)/, "Credit limit exceeded: $1"],
    [/period_locked: (.+)/, "That day/period is closed: $1"],
    [/journal_unbalanced/, "Journal doesn't balance."],
    [/insufficient_wallet_credit/, "Not enough store credit."],
    [/qc_checklist_required/, "Complete the QC checklist first."],
  ];
  for (const [re, out] of map) {
    const m = msg.match(re);
    if (m) return out.replace("$1", m[1] ?? "");
  }
  return msg;
}

// --- POS -----------------------------------------------------------------------------
export async function postPosSaleAction(payload: Record<string, unknown>) {
  return rpc<{ sale_id: string; sale_no: number; total: number; duplicate?: boolean }>("pos.sell", "post_pos_sale", { p: payload }, "/panel");
}
export async function syncOfflineSalesAction(sales: Record<string, unknown>[]) {
  return rpc<{ idempotency_key: string; ok: boolean; error?: string }[]>("pos.sell", "sync_offline_sales", { p_sales: sales }, "/panel");
}
export async function openDrawerAction(drawerId: string, openingFloat: number) {
  return rpc<string>("pos.drawer", "open_drawer", { p_drawer: drawerId, p_opening_float: openingFloat }, ["/panel/pos", "/panel/closing"]);
}
export async function closeDrawerAction(sessionId: string, counted: number, denominations: Record<string, number>) {
  return rpc<{ expected: number; counted: number; variance: number }>("pos.drawer", "close_drawer", { p_session: sessionId, p_counted: counted, p_denominations: denominations }, "/panel/closing");
}
export async function salesReturnAction(payload: Record<string, unknown>) {
  return rpc("pos.void", "post_sales_return", { p: payload }, "/panel");
}

// --- Inventory ---------------------------------------------------------------------------
export async function receiveGrnAction(payload: Record<string, unknown>) {
  return rpc<string>("inventory.receive", "receive_grn", { p: payload }, ["/panel/inventory", "/panel/inventory/receive"]);
}
export async function requestAdjustmentAction(variantId: string, locationId: number, qty: number, reason: string) {
  return rpc("inventory.adjust", "request_adjustment", { p_variant: variantId, p_location: locationId, p_qty: qty, p_reason: reason }, "/panel/inventory");
}
export async function approveAdjustmentAction(id: string, approve: boolean) {
  return rpc("inventory.adjust.approve", "approve_adjustment", { p_id: id, p_approve: approve }, "/panel/inventory");
}
export async function transferStockAction(from: number, to: number, lines: { variant_id: string; qty: number }[], note?: string) {
  return rpc("inventory.transfer", "transfer_stock", { p_from: from, p_to: to, p_lines: lines, p_note: note ?? null }, "/panel/inventory");
}

// --- Orders --------------------------------------------------------------------------------
export async function verifyPaymentAction(paymentId: string, approve: boolean) {
  return rpc("orders.verify_payment", "verify_payment", { p_payment: paymentId, p_approve: approve }, "/panel/orders");
}
export async function confirmCodManualAction(orderId: string, confirmed: boolean) {
  return rpc("orders.manage", "confirm_cod", { p_order: orderId, p_confirmed: confirmed, p_channel: "call" }, "/panel/orders");
}
export async function setOrderStatusAction(orderId: string, status: "packed" | "dispatched") {
  return rpc("orders.manage", "update_order_status", { p_order: orderId, p_status: status }, "/panel/orders");
}
export async function markDeliveredAction(orderId: string) {
  return rpc("orders.manage", "mark_order_delivered", { p_order: orderId }, "/panel/orders");
}
export async function cancelOrderAction(orderId: string, reason: string) {
  return rpc("orders.manage", "cancel_order", { p_order: orderId, p_reason: reason }, "/panel/orders");
}
export async function markRtoAction(orderId: string, loss: number) {
  return rpc("orders.manage", "mark_order_rto", { p_order: orderId, p_shipping_loss: loss }, "/panel/orders");
}
/** Book with the courier, record the shipment, mark dispatched, notify the customer. */
export async function bookShipmentAction(orderId: string): Promise<ActionResult<string>> {
  try {
    await requirePermission("orders.manage");
    const admin = supabaseAdmin();
    const { data: o } = await admin.from("orders").select("id, order_no, total, paid_amount, address, city, status, customers(name, phone)").eq("id", orderId).single();
    if (!o || o.status !== "packed") return { ok: false, error: "Pack the order first" };
    const c = o.customers as unknown as { name: string; phone: string };
    const courier = getCourier();
    const cod = Number(o.total) - Number(o.paid_amount);
    const booking = await courier.book({
      orderNo: o.order_no, codAmount: cod, pieces: 1, weightKg: 0.5, description: "Mobile accessories",
      consignee: { name: c.name ?? "Customer", phone: c.phone, address: (o.address as { line1?: string })?.line1 ?? "", city: o.city ?? "Karachi" },
    });
    await admin.from("shipments").insert({ order_id: o.id, provider: courier.name, tracking_no: booking.trackingNo, label_url: booking.labelUrl, cod_amount: cod, charges: booking.charges ?? 0 });
    const r = await setOrderStatusAction(orderId, "dispatched");
    if (!r.ok) return r;
    await sendTemplate(c.phone, "dispatch", [o.order_no, courier.name, booking.trackingNo], { ref_type: "order", ref_id: o.id }).catch(() => {});
    return { ok: true, data: booking.trackingNo };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// --- Repairs ---------------------------------------------------------------------------------
export async function createRepairJobAction(payload: Record<string, unknown> & { passcode?: string }) {
  const { passcode, ...rest } = payload;
  const p = { ...rest, passcode_enc: passcode ? encryptPasscode(String(passcode)) : null };
  return rpc<{ job_id: string; job_no: string; tracking_ref: string }>("repairs.manage", "create_repair_job", { p }, "/panel/repairs");
}
export async function updateRepairStatusAction(jobId: string, status: string, note?: string, revisedEstimate?: number) {
  const r = await rpc("repairs.manage", "update_repair_status", { p_job: jobId, p_status: status, p_note: note ?? null, p_revised_estimate: revisedEstimate ?? null }, "/panel/repairs");
  if (r.ok) await notifyRepair(jobId, status).catch(() => {});
  return r;
}
async function notifyRepair(jobId: string, status: string) {
  const { data: j } = await supabaseAdmin().from("repair_jobs").select("job_no, tracking_ref, approval_token, revised_estimate, device_label, customers(phone)").eq("id", jobId).single();
  const phone = (j?.customers as unknown as { phone: string })?.phone;
  if (!j || !phone) return;
  const link = `${process.env.NEXT_PUBLIC_SITE_URL}/track/${j.tracking_ref}`;
  if (status === "awaiting_approval") await sendTemplate(phone, "estimate_approval", [j.job_no, String(Number(j.revised_estimate ?? 0) / 100), `${link}?approve=${j.approval_token}`]);
  else if (status === "ready") await sendTemplate(phone, "ready_for_pickup", [j.device_label ?? "phone", j.job_no]);
  else await sendTemplate(phone, "repair_status", [j.job_no, status.replace(/_/g, " "), link]);
}
export async function saveChecklistAction(jobId: string, kind: "intake" | "qc", items: Record<string, string>): Promise<ActionResult<null>> {
  await requirePermission("repairs.manage");
  const sb = await supabaseServer();
  const { error } = await sb.from("repair_checklists").upsert({ job_id: jobId, kind, items });
  revalidatePath(`/panel/repairs/${jobId}`);
  return error ? { ok: false, error: error.message } : { ok: true, data: null };
}
export async function consumePartAction(jobId: string, variantId: string, qty: number, unitPrice?: number) {
  return rpc("repairs.manage", "consume_repair_part", { p_job: jobId, p_variant: variantId, p_qty: qty, p_unit_price: unitPrice ?? null }, `/panel/repairs/${jobId}`);
}
export async function deliverRepairAction(jobId: string, payments: { method: string; amount: number }[], sessionId?: string) {
  const r = await rpc("repairs.deliver", "deliver_repair_job", { p_job: jobId, p_payments: payments, p_session: sessionId ?? null }, ["/panel/repairs", `/panel/repairs/${jobId}`]);
  if (r.ok) {
    const { data: j } = await supabaseAdmin().from("repair_jobs").select("customer_id, customers(phone)").eq("id", jobId).single();
    const phone = (j?.customers as unknown as { phone: string })?.phone;
    if (j && phone) {
      const { data: req } = await supabaseAdmin().from("review_requests").insert({ customer_id: j.customer_id, source_type: "repair", source_id: jobId, sent_at: new Date().toISOString() }).select("token").single();
      if (req) await sendTemplate(phone, "review_request", [`${process.env.NEXT_PUBLIC_SITE_URL}/reviews/new?r=${req.token}`]).catch(() => {});
    }
  }
  return r;
}

// --- Accounts ----------------------------------------------------------------------------------
export async function postExpenseAction(account: number, amount: number, paidFrom: number, memo: string, sessionId?: string) {
  return rpc("accounts.expense", "post_expense", { p_account: account, p_amount: amount, p_paid_from: paidFrom, p_memo: memo, p_session: sessionId ?? null, p_date: null }, ["/panel/accounts", "/panel/closing"]);
}
export async function postManualJournalAction(date: string, memo: string, lines: { account: number; debit?: number; credit?: number }[]) {
  return rpc("accounts.journal.create", "post_manual_journal", { p_date: date, p_memo: memo, p_lines: lines }, "/panel/accounts");
}
export async function reverseJournalAction(entryId: string, reason: string) {
  return rpc("accounts.journal.create", "reverse_journal", { p_entry: entryId, p_reason: reason }, "/panel/accounts");
}
export async function runDailyClosingAction(date: string) {
  return rpc("accounts.period.close", "run_daily_closing", { p_date: date }, "/panel/closing");
}
export async function verifyDayAction(date: string) {
  return rpc("accounts.period.close", "verify_business_day", { p_date: date }, "/panel/closing");
}
export async function closeMonthAction(month: string) {
  return rpc<{ closed: boolean; checks: Record<string, unknown> }>("accounts.period.close", "close_month", { p_month: month }, "/panel/accounts");
}
export async function closeYearAction(yearEnd: string) {
  return rpc("accounts.period.close", "close_year", { p_year_end: yearEnd }, "/panel/accounts");
}
export async function runDepreciationAction(month: string) {
  return rpc<number>("accounts.fixed_assets", "run_depreciation", { p_month: month }, "/panel/accounts");
}

// --- Trade --------------------------------------------------------------------------------------
export async function approveTradeAction(accountId: string, approve: boolean, creditLimit: number, tierKey: string): Promise<ActionResult<null>> {
  await requirePermission(creditLimit > 0 ? "trade.credit_limit.edit" : "trade.manage");
  const sb = await supabaseServer();
  const { data: tier } = await sb.from("price_tiers").select("id").eq("key", tierKey).maybeSingle();
  const { error } = await sb.from("trade_accounts").update({
    status: approve ? "approved" : "rejected", credit_limit: creditLimit, tier_id: tier?.id ?? null, approved_at: approve ? new Date().toISOString() : null,
  }).eq("id", accountId);
  revalidatePath("/panel/trade");
  return error ? { ok: false, error: error.message } : { ok: true, data: null };
}
export async function tradePaymentAction(customerId: string, amount: number, method: string, reference?: string) {
  return rpc("trade.manage", "post_trade_payment", { p_customer: customerId, p_amount: amount, p_method: method, p_reference: reference ?? null, p_session: null }, "/panel/trade");
}

// --- Reviews ------------------------------------------------------------------------------------
export async function moderateReviewAction(id: string, patch: { status?: string; featured?: boolean; owner_reply?: string | null; sort?: number }): Promise<ActionResult<null>> {
  await requirePermission(patch.owner_reply !== undefined ? "reviews.reply" : "reviews.moderate");
  const sb = await supabaseServer();
  const { error } = await sb.from("reviews").update({ ...patch, ...(patch.owner_reply !== undefined ? { owner_reply_at: new Date().toISOString() } : {}) }).eq("id", id);
  revalidatePath("/admin/reviews"); revalidatePath("/");
  return error ? { ok: false, error: error.message } : { ok: true, data: null };
}
export async function deleteReviewAction(id: string): Promise<ActionResult<null>> {
  await requirePermission("reviews.moderate");
  const sb = await supabaseServer();
  const { error } = await sb.from("reviews").delete().eq("id", id);
  revalidatePath("/admin/reviews"); revalidatePath("/");
  return error ? { ok: false, error: error.message } : { ok: true, data: null };
}
export async function replyGoogleAction(reviewId: string, comment: string): Promise<ActionResult<null>> {
  await requirePermission("reviews.reply");
  try {
    await replyToGoogleReview(reviewId, comment);
    await supabaseAdmin().from("google_reviews").update({ reply: comment, reply_at: new Date().toISOString() }).eq("google_review_id", reviewId);
    revalidatePath("/admin/reviews");
    return { ok: true, data: null };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

// --- Staff & permissions --------------------------------------------------------------------------
export async function setPermissionOverrideAction(profileId: string, key: string, granted: boolean | null): Promise<ActionResult<null>> {
  await requirePermission("staff.manage");
  const sb = await supabaseServer();
  const { error } = granted === null
    ? await sb.from("employee_permissions").delete().eq("profile_id", profileId).eq("permission_key", key)
    : await sb.from("employee_permissions").upsert({ profile_id: profileId, permission_key: key, granted });
  revalidatePath("/admin/staff");
  return error ? { ok: false, error: error.message } : { ok: true, data: null };
}
export async function setStaffRoleAction(profileId: string, role: string, active: boolean): Promise<ActionResult<null>> {
  await requirePermission("staff.manage");
  const { error } = await supabaseAdmin().from("profiles").update({ role_key: role, is_active: active }).eq("id", profileId);
  revalidatePath("/admin/staff");
  return error ? { ok: false, error: error.message } : { ok: true, data: null };
}

// --- Misc -------------------------------------------------------------------------------------------
export async function markNotificationsReadAction(): Promise<ActionResult<null>> {
  const sb = await supabaseServer();
  await sb.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  revalidatePath("/panel");
  return { ok: true, data: null };
}
export async function askCopilotAction(question: string): Promise<ActionResult<{ answer: string; tools: string[] }>> {
  try {
    await requirePermission("reports.financial.view");
    return { ok: true, data: await askCopilot(question) };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}
