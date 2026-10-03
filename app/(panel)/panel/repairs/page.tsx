import Link from "next/link";
import { requirePermission, can } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabase/server";
import { formatPKR } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { Empty, PageHead, StatusPill } from "@/components/panel/ui";
import { cn } from "@/lib/utils";

const COLUMNS = [["booked", "Booked"], ["received", "Checked in"], ["diagnosing", "Diagnosing"], ["awaiting_approval", "Awaiting approval"], ["awaiting_parts", "Awaiting parts"], ["in_repair", "In repair"], ["quality_check", "QC"], ["ready", "Ready"]] as const;

export default async function RepairsPage() {
  const staff = await requirePermission("repairs.view", "redirect");
  const { data } = await supabaseAdmin().from("repair_jobs")
    .select("id, job_no, device_label, status, issues, estimate, revised_estimate, promised_at, created_at, customers(name, phone), devices(name), profiles(full_name)")
    .not("status", "in", "(delivered,cancelled,returned_unrepaired)").order("promised_at", { nullsFirst: false });
  const now = Date.now();
  return (
    <div>
      <PageHead title="Repairs" sub="Live board. Customers see each status change on their tracker and WhatsApp.">
        {can(staff, "repairs.manage") && <Link href="/panel/repairs/new" className="btn btn-primary btn-sm">New intake</Link>}
      </PageHead>
      {!data?.length ? <Empty>No open repair jobs.</Empty> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map(([k, label]) => {
            const jobs = data.filter((j) => j.status === k);
            return (
              <section key={k} className="space-y-2">
                <h2 className="eyebrow flex justify-between"><span>{label}</span><span>{jobs.length}</span></h2>
                {jobs.map((j) => {
                  const late = j.promised_at && new Date(j.promised_at).getTime() < now;
                  return (
                    <Link key={j.id} href={`/panel/repairs/${j.id}`} className={cn("card block space-y-1 p-3 hover:border-ink-3", late && "border-danger/50")}>
                      <p className="flex justify-between text-sm"><span className="font-mono">{j.job_no}</span>{late && <span className="text-xs text-danger">overdue</span>}</p>
                      <p className="font-medium">{(j.devices as unknown as { name: string } | null)?.name ?? j.device_label}</p>
                      <p className="text-xs capitalize text-ink-3">{(j.issues as string[]).join(", ").replace(/_/g, " ")} · {(j.customers as unknown as { name: string })?.name}</p>
                      <p className="flex justify-between text-xs text-ink-3"><span>{j.promised_at ? `due ${formatDateTime(j.promised_at)}` : ""}</span><span className="money">{formatPKR(j.revised_estimate ?? j.estimate)}</span></p>
                    </Link>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
      <p className="mt-8 text-sm text-ink-3"><StatusPill status="delivered" /> jobs move to history automatically.</p>
    </div>
  );
}
