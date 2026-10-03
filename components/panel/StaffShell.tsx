import Link from "next/link";
import {
  BarChart3, Bell, BookOpen, Boxes, ClipboardList, Gauge, Globe, Inbox, Landmark, LogOut, MessageSquareQuote,
  Palette, ReceiptText, ShieldCheck, ShoppingCart, Sparkles, Store, Truck, Users, Wrench,
} from "lucide-react";
import { getStaff, can, type Staff } from "@/lib/auth/permissions";
import { hasSupabase, supabaseServer } from "@/lib/supabase/server";
import { Logo } from "@/components/store/Logo";
import { signOutAction } from "@/app/login/actions";
import { redirect } from "next/navigation";

const NAV: { href: string; label: string; icon: typeof Gauge; perm?: string; group: string }[] = [
  { href: "/panel", label: "Cockpit", icon: Gauge, group: "Run" },
  { href: "/panel/pos", label: "POS", icon: ShoppingCart, perm: "pos.sell", group: "Run" },
  { href: "/panel/receipts", label: "Receipts", icon: ReceiptText, perm: "pos.sell", group: "Run" },
  { href: "/panel/orders", label: "Online orders", icon: Truck, perm: "orders.view", group: "Run" },
  { href: "/panel/repairs", label: "Repairs", icon: Wrench, perm: "repairs.view", group: "Run" },
  { href: "/panel/inbox", label: "Inbox", icon: Inbox, perm: "inbox.manage", group: "Run" },
  { href: "/panel/inventory", label: "Inventory", icon: Boxes, perm: "inventory.view", group: "Stock" },
  { href: "/panel/inventory/products", label: "Products", icon: Boxes, perm: "inventory.view", group: "Stock" },
  { href: "/panel/inventory/receive", label: "Receive goods", icon: ClipboardList, perm: "inventory.receive", group: "Stock" },
  { href: "/panel/trade", label: "Trade accounts", icon: Store, perm: "trade.manage", group: "Stock" },
  { href: "/panel/closing", label: "Daily closing", icon: ReceiptText, perm: "pos.drawer", group: "Money" },
  { href: "/panel/accounts", label: "Accounts", icon: Landmark, perm: "reports.financial.view", group: "Money" },
  { href: "/panel/reports", label: "Reports", icon: BarChart3, perm: "reports.financial.view", group: "Money" },
  { href: "/panel/copilot", label: "Owner Copilot", icon: Sparkles, perm: "reports.financial.view", group: "Money" },
  { href: "/admin/website", label: "Website", icon: Globe, perm: "content.edit", group: "Website" },
  { href: "/admin/appearance", label: "Appearance", icon: Palette, perm: "appearance.manage", group: "Website" },
  { href: "/admin/reviews", label: "Reviews", icon: MessageSquareQuote, perm: "reviews.moderate", group: "Website" },
  { href: "/admin/faq", label: "FAQ", icon: BookOpen, perm: "content.edit", group: "Website" },
  { href: "/admin/staff", label: "Staff & permissions", icon: Users, perm: "staff.manage", group: "Admin" },
  { href: "/admin/audit", label: "Audit log", icon: ShieldCheck, perm: "audit.view", group: "Admin" },
];

export async function StaffShell({ children }: { children: React.ReactNode }) {
  if (!hasSupabase) return <SetupNotice />;
  const staff = await getStaff();
  if (!staff) redirect("/login?next=/panel");
  const sb = await supabaseServer();
  const { count: unread } = await sb.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  const items = NAV.filter((n) => !n.perm || can(staff, n.perm));
  const groups = [...new Set(items.map((i) => i.group))];

  return (
    <div className="grid min-h-dvh lg:grid-cols-[232px_1fr]">
      <aside className="hidden border-r border-line bg-surface-1 lg:flex lg:flex-col">
        <Link href="/panel" className="flex h-16 items-center border-b border-line px-5"><Logo /></Link>
        <nav className="flex-1 space-y-5 overflow-y-auto p-3" aria-label="Staff">
          {groups.map((g) => (
            <div key={g}>
              <p className="eyebrow px-3 pb-1.5 !text-[10px]">{g}</p>
              {items.filter((i) => i.group === g).map((i) => (
                <Link key={i.href} href={i.href} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">
                  <i.icon className="size-4" aria-hidden />{i.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <StaffFooter staff={staff} />
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-bg/90 px-4 backdrop-blur lg:px-8">
          <nav className="flex gap-1 overflow-x-auto lg:hidden" aria-label="Staff mobile">
            {items.slice(0, 6).map((i) => <Link key={i.href} href={i.href} className="rounded-lg p-2 text-ink-2 hover:bg-surface-2" aria-label={i.label}><i.icon className="size-5" /></Link>)}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/panel/notifications" className="relative grid size-10 place-items-center rounded-xl border border-line" aria-label={`${unread ?? 0} notifications`}>
              <Bell className="size-4" />
              {!!unread && <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-bg">{unread}</span>}
            </Link>
            <Link href="/" className="btn btn-ghost btn-sm">Store</Link>
          </div>
        </header>
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function StaffFooter({ staff }: { staff: Staff }) {
  return (
    <div className="flex items-center justify-between border-t border-line p-4">
      <div className="min-w-0"><p className="truncate text-sm font-medium">{staff.fullName}</p><p className="text-xs capitalize text-ink-3">{staff.role.replace("_", " ")}</p></div>
      <form action={async () => { "use server"; await signOutAction(); redirect("/login"); }}>
        <button className="grid size-9 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Sign out"><LogOut className="size-4" /></button>
      </form>
    </div>
  );
}

function SetupNotice() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20">
      <Logo />
      <h1 className="mt-8 font-display text-3xl font-semibold">Connect the database to open the back office</h1>
      <ol className="mt-6 list-decimal space-y-2 pl-5 text-ink-2">
        <li>Create a Supabase project (or run <code className="font-mono">npx supabase start</code> locally).</li>
        <li>Apply migrations + seed: <code className="font-mono">npx supabase db reset</code> (local) or <code className="font-mono">npx supabase db push</code>.</li>
        <li>Copy <code className="font-mono">.env.example</code> to <code className="font-mono">.env.local</code> and fill the Supabase keys.</li>
        <li>Create the owner account: <code className="font-mono">npm run owner:create -- owner@startech.pk &apos;a-strong-password&apos; &quot;Owner Name&quot;</code></li>
      </ol>
      <p className="mt-6 text-sm text-ink-3">The storefront already works in demo mode without a database.</p>
    </div>
  );
}
