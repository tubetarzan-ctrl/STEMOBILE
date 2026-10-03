"use client";
import { useState, useTransition } from "react";
import { setPermissionOverrideAction, setStaffRoleAction } from "@/app/actions/panel";
import { cn } from "@/lib/utils";

type P = { id: string; full_name: string | null; email: string | null; phone: string | null; role_key: string | null; is_active: boolean };

export function PermissionMatrix({ staff, roles, perms, rolePerms, overrides }: {
  staff: P[]; roles: { key: string; name: string }[]; perms: { key: string; module: string; description: string }[];
  rolePerms: { role_key: string; permission_key: string }[]; overrides: { profile_id: string; permission_key: string; granted: boolean }[];
}) {
  const [sel, setSel] = useState(staff[0]?.id);
  const [ov, setOv] = useState(overrides);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const person = staff.find((s) => s.id === sel);
  if (!person) return <p className="text-ink-3">No staff yet.</p>;
  const roleHas = (k: string) => person.role_key === "super_admin" || rolePerms.some((r) => r.role_key === person.role_key && r.permission_key === k);
  const override = (k: string) => ov.find((o) => o.profile_id === person.id && o.permission_key === k);
  const modules = [...new Set(perms.map((p) => p.module))];

  const cycle = (k: string) => {
    // no override → override to the opposite of the role default; override → back to role default
    const target = override(k) === undefined ? !roleHas(k) : null;
    start(async () => {
      const r = await setPermissionOverrideAction(person.id, k, target);
      if (!r.ok) return setMsg(r.error);
      setOv((list) => [...list.filter((x) => !(x.profile_id === person.id && x.permission_key === k)), ...(target === null ? [] : [{ profile_id: person.id, permission_key: k, granted: target }])]);
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <ul className="card divide-y divide-line">
        {staff.map((s) => (
          <li key={s.id}><button type="button" onClick={() => setSel(s.id)} className={cn("w-full p-3 text-left text-sm", s.id === sel && "bg-surface-2", !s.is_active && "opacity-50")}>
            <span className="block font-medium">{s.full_name ?? s.email}</span><span className="text-xs capitalize text-ink-3">{s.role_key?.replace("_", " ")}{!s.is_active && " · inactive"}</span>
          </button></li>
        ))}
      </ul>
      <div className="space-y-4">
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <span className="font-medium">{person.full_name}</span>
          <select defaultValue={person.role_key ?? ""} className="input h-10 w-48" onChange={(e) => start(async () => { const r = await setStaffRoleAction(person.id, e.target.value, person.is_active); setMsg(r.ok ? "Role saved" : r.error); })}>
            {roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => start(async () => { const r = await setStaffRoleAction(person.id, person.role_key ?? "cashier", !person.is_active); setMsg(r.ok ? (person.is_active ? "Deactivated" : "Reactivated") : r.error); })}>{person.is_active ? "Deactivate" : "Reactivate"}</button>
          {msg && <span className="text-sm">{msg}</span>}
        </div>
        <p className="text-xs text-ink-3">Click a permission to cycle: role default → override. <span className="text-trust">●</span> granted · <span className="text-ink-3">○</span> not granted · ring = personal override.</p>
        {modules.map((m) => (
          <section key={m} className="card p-4">
            <h3 className="eyebrow mb-2">{m}</h3>
            <div className="grid gap-1 sm:grid-cols-2">
              {perms.filter((p) => p.module === m).map((p) => {
                const o = override(p.key);
                const on = o ? o.granted : roleHas(p.key);
                return (
                  <button key={p.key} type="button" disabled={pending || person.role_key === "super_admin"} onClick={() => cycle(p.key)}
                    className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2", o && "ring-1 ring-accent/60")}>
                    <span className={on ? "text-trust" : "text-ink-3"}>{on ? "●" : "○"}</span>
                    <span className="flex-1">{p.description}</span><span className="font-mono text-[10px] text-ink-3">{p.key}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
