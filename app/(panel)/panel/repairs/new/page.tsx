import { requirePermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabase/server";
import { PageHead } from "@/components/panel/ui";
import { IntakeForm } from "./IntakeForm";

export default async function NewRepairPage() {
  await requirePermission("repairs.manage", "redirect");
  const sb = supabaseAdmin();
  const [{ data: devices }, { data: techs }, { data: sessions }] = await Promise.all([
    sb.from("devices").select("id, name, brands(name)").order("name"),
    sb.from("profiles").select("id, full_name").eq("is_staff", true).eq("is_active", true).in("role_key", ["repair_tech", "manager", "super_admin"]),
    sb.from("drawer_sessions").select("id").eq("status", "open").limit(1),
  ]);
  return (
    <div className="max-w-4xl">
      <PageHead title="New repair intake" sub="Photos and checklist in front of the customer. Passcode is encrypted and deleted at handover." />
      <IntakeForm
        devices={(devices ?? []).map((d) => ({ id: d.id, name: `${(d.brands as unknown as { name: string }).name} ${d.name}` }))}
        techs={(techs ?? []).map((t) => ({ id: t.id, name: t.full_name ?? "Tech" }))}
        sessionId={sessions?.[0]?.id ?? null}
      />
    </div>
  );
}
