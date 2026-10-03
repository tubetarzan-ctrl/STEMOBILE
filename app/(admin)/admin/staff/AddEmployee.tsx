"use client";
import { useState, useTransition } from "react";
import { createEmployeeAction } from "@/app/actions/panel";

const HINTS: Record<string, string> = {
  super_admin: "Full rights — everything, including money and staff.",
  manager: "Runs the shop: sales, stock, repairs, orders. No owner tools.",
  cashier: "Counter sales and cash drawer only.",
  repair_tech: "Repair jobs only.",
  accountant: "Books, daily closing and reports.",
  inventory_clerk: "Stock in, counts and labels.",
  order_handler: "Online orders and delivery.",
  support_agent: "Answers website chat, WhatsApp and inquiries.",
  content_editor: "Website text, FAQs and pictures.",
  social_media: "Instagram posts and reels.",
  trade_manager: "Technician Pro (trade) accounts.",
};

export function AddEmployee({ roles, isOwner }: { roles: { key: string; name: string }[]; isOwner: boolean }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ full_name: "", email: "", phone: "", password: "", role: "cashier" });
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  if (!open) return <button className="btn btn-primary mb-4" onClick={() => setOpen(true)}>+ Add employee</button>;
  return (
    <form
      className="card mb-6 grid gap-3 p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createEmployeeAction(f);
          if (!r.ok) return setMsg(r.error);
          setMsg(`✓ ${f.full_name} can now sign in at /login (Staff) with ${f.email}. Share the password with them privately.`);
          setF({ full_name: "", email: "", phone: "", password: "", role: "cashier" });
        });
      }}
    >
      <h3 className="font-medium sm:col-span-2">New employee</h3>
      <input className="input" placeholder="Full name" value={f.full_name} onChange={set("full_name")} required />
      <input className="input" placeholder="Phone (optional)" value={f.phone} onChange={set("phone")} />
      <input className="input" type="email" placeholder="Login email" value={f.email} onChange={set("email")} required />
      <input className="input" type="text" placeholder="Password (8+ characters)" value={f.password} onChange={set("password")} minLength={8} required />
      <label className="space-y-1 sm:col-span-2">
        <span className="text-sm text-ink-3">Job (sets their rights — you can fine-tune each right below after saving)</span>
        <select className="input" value={f.role} onChange={set("role")}>
          {roles.filter((r) => isOwner || r.key !== "super_admin").map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
        </select>
        <span className="block text-xs text-ink-3">{HINTS[f.role] ?? ""}</span>
      </label>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Creating…" : "Create login"}</button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Close</button>
        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </form>
  );
}
