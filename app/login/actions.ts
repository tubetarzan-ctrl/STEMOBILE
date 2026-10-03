"use server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/utils";

/** After phone OTP: attach the auth user to the customer record with that phone (create if new). */
export async function linkCustomerAction() {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  const phone = data.user?.phone ? normalizePhone(data.user.phone) : null;
  if (!data.user || !phone) return;
  await supabaseAdmin().from("customers").upsert({ phone, auth_user_id: data.user.id }, { onConflict: "phone" });
}

export async function signOutAction() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
}
