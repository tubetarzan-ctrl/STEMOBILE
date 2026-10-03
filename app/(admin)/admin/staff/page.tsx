import { requirePermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabase/server";
import { PageHead } from "@/components/panel/ui";
import { PermissionMatrix } from "./PermissionMatrix";
import { AddEmployee } from "./AddEmployee";

export default async function StaffPage() {
  const me = await requirePermission("staff.manage", "redirect");
  const sb = supabaseAdmin();
  const [{ data: staff }, { data: roles }, { data: perms }, { data: rolePerms }, { data: overrides }] = await Promise.all([
    sb.from("profiles").select("id, full_name, email, phone, role_key, is_active").eq("is_staff", true).order("full_name"),
    sb.from("roles").select("key, name").order("name"),
    sb.from("permissions").select("key, module, description").order("module"),
    sb.from("role_permissions").select("role_key, permission_key"),
    sb.from("employee_permissions").select("profile_id, permission_key, granted"),
  ]);
  return (
    <div>
      <PageHead title="Staff & permissions" sub="Add employees, pick their job (role), then switch single rights on/off. Deactivate someone who leaves — their history stays." />
      <AddEmployee roles={roles ?? []} isOwner={me.isOwner} />
      <PermissionMatrix staff={staff ?? []} roles={roles ?? []} perms={perms ?? []} rolePerms={rolePerms ?? []} overrides={overrides ?? []} />
    </div>
  );
}
