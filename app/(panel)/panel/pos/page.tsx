import { requirePermission, can } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabase/server";
import { PosClient } from "./PosClient";

export const metadata = { title: "POS" };

export default async function PosPage() {
  const staff = await requirePermission("pos.sell", "redirect");
  const sb = supabaseAdmin();
  const [{ data: drawers }, { data: sessions }] = await Promise.all([
    sb.from("cash_drawers").select("id, name").eq("is_active", true),
    sb.from("drawer_sessions").select("id, drawer_id, opening_float, opened_at").eq("status", "open"),
  ]);
  return (
    <PosClient
      drawers={drawers ?? []}
      openSessions={sessions ?? []}
      canDiscount={can(staff, "pos.discount")}
      canBelowMin={can(staff, "pos.discount.above_limit")}
      cashier={staff.fullName}
    />
  );
}
