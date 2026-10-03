import Link from "next/link";
import { requirePermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { Empty, PageHead, StatusPill } from "@/components/panel/ui";
import { cn } from "@/lib/utils";
import { InquiryStatus, WhatsAppReply } from "./InboxClient";

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ tab?: string; thread?: string }> }) {
  await requirePermission("inbox.manage", "redirect");
  const { tab = "inquiries", thread } = await searchParams;
  const sb = supabaseAdmin();
  return (
    <div>
      <PageHead title="Inbox" sub="Website forms, escalated WhatsApp chats and email — one list." />
      <nav className="mb-6 flex gap-1 border-b border-line">
        {[["inquiries", "Inquiries & email"], ["whatsapp", "WhatsApp"]].map(([k, l]) => <Link key={k} href={`/panel/inbox?tab=${k}`} className={cn("border-b-2 px-4 py-2 text-sm", tab === k ? "border-accent" : "border-transparent text-ink-3")}>{l}</Link>)}
      </nav>
      {tab === "inquiries" ? <Inquiries sb={sb} /> : <WhatsApp sb={sb} thread={thread} />}
    </div>
  );
}

type SB = ReturnType<typeof supabaseAdmin>;

async function Inquiries({ sb }: { sb: SB }) {
  const { data } = await sb.from("inquiries").select("*").neq("status", "closed").order("priority").order("created_at", { ascending: false }).limit(100);
  if (!data?.length) return <Empty>Inbox zero.</Empty>;
  return (
    <div className="space-y-2">{data.map((i) => (
      <div key={i.id} className={cn("card flex flex-wrap items-start justify-between gap-3 p-4", i.priority === "high" && "border-warn/60")}>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm"><span className="badge capitalize">{i.kind.replace("_", " ")}</span>{i.priority === "high" && <span className="badge text-warn">priority</span>}<span className="font-medium">{i.name ?? i.email}</span><span className="text-ink-3">{i.phone ?? i.email} · {formatDateTime(i.created_at)}</span></p>
          <p className="mt-2 whitespace-pre-line text-sm text-ink-2">{i.message.slice(0, 600)}</p>
          {i.device_text && <p className="mt-1 text-xs text-ink-3">Device: {i.device_text}</p>}
        </div>
        <div className="flex flex-col items-end gap-2"><StatusPill status={i.status} /><InquiryStatus id={i.id} phone={i.phone} /></div>
      </div>
    ))}</div>
  );
}

async function WhatsApp({ sb, thread }: { sb: SB; thread?: string }) {
  const { data: threads } = await sb.from("whatsapp_threads").select("id, phone, unread, last_message_at, window_expires_at, customers(name)").order("last_message_at", { ascending: false }).limit(50);
  const active = thread ?? threads?.[0]?.id;
  const { data: msgs } = active ? await sb.from("whatsapp_messages").select("id, direction, body, template, status, created_at").eq("thread_id", active).order("created_at").limit(200) : { data: [] };
  const t = threads?.find((x) => x.id === active);
  if (!threads?.length) return <Empty>No WhatsApp conversations yet.</Empty>;
  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <ul className="card max-h-[70vh] divide-y divide-line overflow-auto">
        {threads.map((x) => (
          <li key={x.id}><Link href={`/panel/inbox?tab=whatsapp&thread=${x.id}`} className={cn("flex justify-between gap-2 p-3 text-sm hover:bg-surface-2", x.id === active && "bg-surface-2")}>
            <span><span className="block font-medium">{(x.customers as unknown as { name: string } | null)?.name ?? x.phone}</span><span className="text-xs text-ink-3">{formatDateTime(x.last_message_at)}</span></span>
            {x.unread > 0 && <span className="grid size-5 place-items-center rounded-full bg-accent text-[10px] font-bold text-accent-ink">{x.unread}</span>}
          </Link></li>
        ))}
      </ul>
      <div className="card flex max-h-[70vh] flex-col">
        <div className="flex-1 space-y-2 overflow-auto p-4">
          {(msgs ?? []).map((m) => (
            <div key={m.id} className={cn("max-w-[75%] rounded-2xl px-3 py-2 text-sm", m.direction === "in" ? "bg-surface-2" : "ml-auto bg-accent/15")}>
              {m.template && <p className="mb-1 font-mono text-[10px] text-ink-3">template: {m.template}</p>}
              <p className="whitespace-pre-line">{m.body}</p>
              <p className="mt-1 text-right text-[10px] text-ink-3">{formatDateTime(m.created_at)} {m.direction === "out" && m.status}</p>
            </div>
          ))}
        </div>
        {t && <WhatsAppReply threadId={t.id} phone={t.phone} windowOpen={!!t.window_expires_at && new Date(t.window_expires_at) > new Date()} />}
      </div>
    </div>
  );
}
