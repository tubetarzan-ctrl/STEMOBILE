"use server";
import { hasSupabase, supabaseAdmin, supabasePublic } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export async function respondEstimateAction(token: string, approve: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasSupabase || !/^[0-9a-f]{32}$/.test(token)) return { ok: false, error: "Invalid link" };
  const { error } = await supabasePublic().rpc("respond_repair_estimate", { p_token: token, p_approve: approve });
  return error ? { ok: false, error: "This estimate is no longer awaiting approval." } : { ok: true };
}

/** Payment proofs go to a PRIVATE bucket (served later via short-lived signed URLs). */
export async function uploadProofAction(form: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasSupabase) return { ok: false, error: "Unavailable in demo" };
  if (!(await rateLimit("proof", 5, 60_000))) return { ok: false, error: "Too many attempts" };
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a file" };
  if (file.size > 8 * 1024 * 1024) return { ok: false, error: "File too large (max 8 MB)" };
  if (!/^(image\/(jpeg|png|webp|heic)|application\/pdf)$/.test(file.type)) return { ok: false, error: "Upload an image or PDF" };
  const orderNo = String(form.get("orderNo")), token = String(form.get("token"));

  // Validate the order/token before storing anything.
  const { data: order } = await supabasePublic().rpc("track_order", { p_order_no: orderNo, p_token: token });
  if (!order) return { ok: false, error: "Order not found" };

  const path = `${orderNo}/${crypto.randomUUID()}.${file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin"}`;
  const { error: upErr } = await supabaseAdmin().storage.from("payment-proofs").upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { ok: false, error: "Upload failed" };
  const { error } = await supabasePublic().rpc("submit_payment_proof", {
    p_order_no: orderNo, p_token: token, p_proof_path: `payment-proofs/${path}`, p_reference: String(form.get("reference") ?? ""), p_amount: Number(form.get("amount")),
  });
  return error ? { ok: false, error: "Could not record the payment" } : { ok: true };
}
