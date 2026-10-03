import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabase/server";
import { formatPKR } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { gradeLabel } from "@/lib/grades";
import { PageHead, StatusPill } from "@/components/panel/ui";
import { JobActions } from "./JobActions";

export default async function RepairJobPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePermission("repairs.view", "redirect");
  const { id } = await params;
  const sb = supabaseAdmin();
  const { data: j } = await sb.from("repair_jobs").select("*, customers(name, phone), devices(name), profiles(full_name)").eq("id", id).maybeSingle();
  if (!j) notFound();
  const [{ data: parts }, { data: history }, { data: checklists }, { data: sessions }] = await Promise.all([
    sb.from("repair_parts").select("id, qty, unit_price, unit_cost, grade, product_variants(sku, products(name))").eq("job_id", id),
    sb.from("repair_status_history").select("status, note, at").eq("job_id", id).order("at"),
    sb.from("repair_checklists").select("kind, items").eq("job_id", id),
    sb.from("drawer_sessions").select("id").eq("status", "open").limit(1),
  ]);
  const c = j.customers as { name: string; phone: string };
  const partsTotal = (parts ?? []).reduce((a, p) => a + p.qty * Number(p.unit_price), 0);
  const total = Number(j.labour) + partsTotal;
  const intake = checklists?.find((x) => x.kind === "intake")?.items ?? j.condition;
  const qc = checklists?.find((x) => x.kind === "qc")?.items as Record<string, string> | undefined;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  return (
    <div className="space-y-6">
      <PageHead title={`${j.job_no} · ${(j.devices as { name: string } | null)?.name ?? j.device_label}`} sub={`${c.name} · ${c.phone}`}>
        <StatusPill status={j.status} />
      </PageHead>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="card grid gap-4 p-5 sm:grid-cols-4 text-sm">
            <div><p className="text-ink-3">Issues</p><p className="capitalize">{(j.issues as string[]).join(", ").replace(/_/g, " ")}</p></div>
            <div><p className="text-ink-3">IMEI</p><p className="font-mono">{j.imei ?? "—"}</p></div>
            <div><p className="text-ink-3">Promised</p><p>{formatDateTime(j.promised_at)}</p></div>
            <div><p className="text-ink-3">Technician</p><p>{(j.profiles as { full_name: string } | null)?.full_name ?? "Unassigned"}</p></div>
            <div><p className="text-ink-3">Estimate</p><p className="money">{formatPKR(j.revised_estimate ?? j.estimate)}</p></div>
            <div><p className="text-ink-3">Advance</p><p className="money">{formatPKR(j.advance)}</p></div>
            <div><p className="text-ink-3">Passcode</p><p>{j.passcode_enc ? "Stored (encrypted)" : "—"}</p></div>
            <div><p className="text-ink-3">Tracker</p><a className="font-mono text-accent" href={`/track/${j.tracking_ref}`} target="_blank">{j.tracking_ref}</a></div>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-medium">Parts used</h2>
            <table className="table">
              <thead><tr><th>Part</th><th>Grade</th><th className="num">Qty</th><th className="num">Price</th>{can(staff, "inventory.view") && <th className="num">Cost</th>}</tr></thead>
              <tbody>
                {(parts ?? []).map((p) => { const v = p.product_variants as unknown as { sku: string; products: { name: string } }; return (
                  <tr key={p.id}><td>{v.products.name} <span className="font-mono text-xs text-ink-3">{v.sku}</span></td><td>{gradeLabel(p.grade)}</td><td className="num">{p.qty}</td><td className="num">{formatPKR(p.unit_price)}</td>{can(staff, "inventory.view") && <td className="num text-ink-3">{formatPKR(p.unit_cost)}</td>}</tr>
                ); })}
                <tr><td colSpan={3}>Labour</td><td className="num">{formatPKR(j.labour)}</td></tr>
                <tr><td colSpan={3} className="font-semibold">Total</td><td className="num font-semibold">{formatPKR(total)}</td></tr>
              </tbody>
            </table>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="card p-5 text-sm"><h2 className="mb-2 font-medium">Check-in condition</h2>{Object.entries((intake ?? {}) as Record<string, string>).map(([k, v]) => <p key={k} className="flex justify-between capitalize"><span className="text-ink-3">{k.replace(/_/g, " ")}</span><span>{v}</span></p>)}</div>
            <div className="card p-5 text-sm"><h2 className="mb-2 font-medium">Quality check</h2>{qc ? Object.entries(qc).map(([k, v]) => <p key={k} className="flex justify-between capitalize"><span className="text-ink-3">{k.replace(/_/g, " ")}</span><span>{v}</span></p>) : <p className="text-ink-3">Not done yet — required before Ready.</p>}</div>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-medium">History</h2>
            <ol className="space-y-1 text-sm">{(history ?? []).map((h, i) => <li key={i} className="flex gap-3"><span className="w-36 text-ink-3">{formatDateTime(h.at)}</span><span className="capitalize">{h.status.replace(/_/g, " ")}</span>{h.note && <span className="text-ink-3">— {h.note}</span>}</li>)}</ol>
          </section>
        </div>

        <aside className="space-y-4">
          <JobActions job={{ id: j.id, status: j.status, total, advance: Number(j.advance), deviceId: j.device_id }} sessionId={sessions?.[0]?.id ?? null}
            canManage={can(staff, "repairs.manage")} canDeliver={can(staff, "repairs.deliver")} />
          <div id="receipt" className="card space-y-1 p-4 font-mono text-xs">
            <p className="text-center font-bold">StarTech · Job card {j.job_no}</p>
            <p>{c.name} · {c.phone}</p>
            <p>{(j.devices as { name: string } | null)?.name ?? j.device_label} · IMEI {j.imei ?? "—"}</p>
            <p className="capitalize">Issue: {(j.issues as string[]).join(", ").replace(/_/g, " ")}</p>
            <p>Estimate {formatPKR(j.estimate)} · Advance {formatPKR(j.advance)}</p>
            <p>Promised {formatDateTime(j.promised_at)}</p>
            <p>Track: {site}/track/{j.tracking_ref}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
