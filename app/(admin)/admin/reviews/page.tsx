import Link from "next/link";
import { requirePermission } from "@/lib/auth/permissions";
import { supabaseServer } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { Empty, Kpi, PageHead, StatusPill } from "@/components/panel/ui";
import { cn } from "@/lib/utils";
import { GoogleReply, ReviewControls } from "./ReviewsClient";

const TABS = ["pending", "published", "hidden", "rejected", "google"] as const;

export default async function ReviewsManager({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePermission("reviews.moderate", "redirect");
  const { tab = "pending" } = await searchParams;
  const sb = await supabaseServer();
  const [{ data: stats }, list] = await Promise.all([
    sb.from("v_review_stats").select("*").maybeSingle(),
    tab === "google"
      ? sb.from("google_reviews").select("*").order("time", { ascending: false }).limit(50)
      : sb.from("reviews").select("*, review_media(type, url)").eq("status", tab).order("created_at", { ascending: false }).limit(100),
  ]);
  const s = stats as Record<string, number | null> | null;

  return (
    <div className="space-y-6">
      <PageHead title="Reviews" sub="Moderate on-site reviews, reply publicly, feature the best, and answer Google reviews." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="On-site rating" value={s?.onsite_avg ? `${Number(s.onsite_avg).toFixed(2)}★` : "—"} hint={`${s?.onsite_count ?? 0} published`} />
        <Kpi label="Google rating" value={s?.google_avg ? `${Number(s.google_avg).toFixed(2)}★` : "—"} hint={`${s?.google_count ?? 0} synced`} />
        <Kpi label="Requests → reviews" value={`${s?.reviews_from_requests ?? 0} / ${s?.requests_sent ?? 0}`} />
        <Kpi label="Google follow-up clicks" value={s?.google_clicks ?? 0} />
      </div>
      <nav className="flex gap-1 border-b border-line">{TABS.map((t) => <Link key={t} href={`/admin/reviews?tab=${t}`} className={cn("border-b-2 px-4 py-2 text-sm capitalize", tab === t ? "border-accent" : "border-transparent text-ink-3")}>{t}</Link>)}</nav>
      {!list.data?.length ? <Empty>Nothing here.</Empty> : tab === "google" ? (
        <div className="space-y-2">{(list.data as { google_review_id: string; author: string; rating: number; text: string; time: string; reply: string | null }[]).map((g) => (
          <div key={g.google_review_id} className="card space-y-2 p-4">
            <p className="text-sm"><span className="text-warn">{"★".repeat(g.rating)}</span> <span className="font-medium">{g.author}</span> <span className="text-ink-3">· {formatDateTime(g.time)}</span></p>
            <p className="text-sm text-ink-2">{g.text}</p>
            <GoogleReply id={g.google_review_id} existing={g.reply} />
          </div>
        ))}</div>
      ) : (
        <div className="space-y-2">{(list.data as { id: string; rating: number; text: string | null; author_name: string; phone: string | null; verified: boolean; featured: boolean; status: string; owner_reply: string | null; flagged_reason: string | null; created_at: string; review_media: { type: string; url: string }[] }[]).map((r) => (
          <div key={r.id} className="card grid gap-3 p-4 lg:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <p className="flex flex-wrap items-center gap-2 text-sm"><span className="text-warn">{"★".repeat(r.rating)}</span><span className="font-medium">{r.author_name}</span><span className="text-ink-3">{r.phone} · {formatDateTime(r.created_at)}</span><StatusPill status={r.status} />{r.verified && <span className="badge text-trust">verified</span>}{r.featured && <span className="badge text-accent">featured</span>}{r.flagged_reason && <span className="badge text-danger">{r.flagged_reason.replace(/_/g, " ")}</span>}</p>
              {r.text && <p className="text-sm text-ink-2">{r.text}</p>}
              {r.review_media.length > 0 && <div className="flex gap-2">{r.review_media.map((m, i) => m.type === "image"
                // eslint-disable-next-line @next/next/no-img-element
                ? <img key={i} src={m.url} alt="" className="size-16 rounded-lg object-cover" />
                : <video key={i} src={m.url} className="size-16 rounded-lg object-cover" muted />)}</div>}
            </div>
            <ReviewControls review={{ id: r.id, status: r.status, featured: r.featured, owner_reply: r.owner_reply }} />
          </div>
        ))}</div>
      )}
    </div>
  );
}
