import Link from "next/link";
import { requireStaff } from "@/lib/auth/permissions";
import { supabaseServer } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { Empty, PageHead } from "@/components/panel/ui";
import { markNotificationsReadAction } from "@/app/actions/panel";

export default async function NotificationsPage() {
  await requireStaff();
  const sb = await supabaseServer();
  const { data } = await sb.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
  return (
    <div className="max-w-3xl">
      <PageHead title="Notifications">
        <form action={async () => { "use server"; await markNotificationsReadAction(); }}><button className="btn btn-ghost btn-sm">Mark all read</button></form>
      </PageHead>
      {!data?.length ? <Empty>Nothing new.</Empty> : (
        <ul className="space-y-2">{data.map((n) => (
          <li key={n.id}><Link href={n.link ?? "#"} className={`card block p-4 ${n.read_at ? "opacity-60" : ""} ${n.priority === "high" ? "border-warn/60" : ""}`}>
            <p className="font-medium">{n.title}</p>{n.body && <p className="text-sm text-ink-2">{n.body}</p>}<p className="mt-1 text-xs text-ink-3">{formatDateTime(n.created_at)}</p>
          </Link></li>
        ))}</ul>
      )}
    </div>
  );
}
