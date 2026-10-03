import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { hasSupabase, supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

export type Staff = {
  id: string;
  fullName: string;
  role: string;
  permissions: Set<string>;
  isOwner: boolean;
};

/** Current staff member (null for customers / anonymous). Cached per request. */
export const getStaff = cache(async (): Promise<Staff | null> => {
  if (!hasSupabase) return null;
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return null;
  // Role tables are readable only with staff.manage, so load them with the
  // service role once the user is authenticated.
  const admin = supabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, role_key, is_staff, is_active")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!profile?.is_staff || !profile.is_active) return null;

  const isOwner = profile.role_key === "super_admin";
  const [{ data: rolePerms }, { data: overrides }] = await Promise.all([
    admin.from("role_permissions").select("permission_key").eq("role_key", profile.role_key ?? ""),
    admin.from("employee_permissions").select("permission_key, granted").eq("profile_id", profile.id),
  ]);
  const perms = new Set<string>((rolePerms ?? []).map((r) => r.permission_key));
  for (const o of overrides ?? []) {
    if (o.granted) perms.add(o.permission_key);
    else perms.delete(o.permission_key);
  }
  return { id: profile.id, fullName: profile.full_name ?? "Staff", role: profile.role_key ?? "", permissions: perms, isOwner };
});

export function can(staff: Staff | null, key: string): boolean {
  return !!staff && (staff.isOwner || staff.permissions.has(key));
}

/** Server action / page guard. Throws (actions) or redirects (pages). */
export async function requirePermission(key: string, mode: "throw" | "redirect" = "throw"): Promise<Staff> {
  const staff = await getStaff();
  if (!can(staff, key)) {
    if (mode === "redirect") redirect(staff ? "/panel?denied=" + encodeURIComponent(key) : "/login?next=/panel");
    throw new Error(`permission_denied: ${key}`);
  }
  return staff!;
}

export async function requireStaff(): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/login?next=/panel");
  return staff;
}
