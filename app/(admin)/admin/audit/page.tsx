import { requirePermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { PageHead } from "@/components/panel/ui";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ entity?: string }> }) {
  await requirePermission("audit.view", "redirect");
  const { entity } = await searchParams;
  const sb = supabaseAdmin();
  let q = sb.from("audit_log").select("id, at, actor, action, entity, entity_id, before, after").order("at", { ascending: false }).limit(200);
  if (entity) q = q.eq("entity", entity);
  const [{ data }, { data: people }] = await Promise.all([q, sb.from("profiles").select("id, full_name")]);
  const who = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  return (
    <div>
      <PageHead title="Audit log" sub="Every sensitive action, with before/after values." />
      <form className="mb-4"><input name="entity" defaultValue={entity} className="input max-w-xs" placeholder="Filter by entity (e.g. journal_entries)" /></form>
      <div className="space-y-2">{(data ?? []).map((a) => (
        <details key={a.id} className="card p-3 text-sm">
          <summary className="flex cursor-pointer flex-wrap gap-3"><span className="w-40 text-ink-3">{formatDateTime(a.at)}</span><span>{a.actor ? who.get(a.actor) ?? a.actor.slice(0, 8) : "system"}</span><span className="badge">{a.action}</span><span className="font-mono text-xs">{a.entity} {a.entity_id?.slice(0, 12)}</span></summary>
          <div className="mt-2 grid gap-2 md:grid-cols-2"><pre className="overflow-auto rounded-lg bg-surface-2 p-2 text-xs">{JSON.stringify(a.before, null, 2)}</pre><pre className="overflow-auto rounded-lg bg-surface-2 p-2 text-xs">{JSON.stringify(a.after, null, 2)}</pre></div>
        </details>
      ))}</div>
    </div>
  );
}
