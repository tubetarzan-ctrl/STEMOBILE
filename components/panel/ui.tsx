import { formatPKR, formatPKRCompact } from "@/lib/money";
import { cn } from "@/lib/utils";

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="font-display text-3xl font-semibold">{title}</h1>{sub && <p className="mt-1 text-ink-3">{sub}</p>}</div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Kpi({ label, paisa, value, hint, tone }: { label: string; paisa?: number; value?: string | number; hint?: string; tone?: "trust" | "warn" | "danger" }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-ink-3">{label}</p>
      <p className={cn("money mt-2 font-display text-2xl font-semibold", tone === "trust" && "text-trust", tone === "warn" && "text-warn", tone === "danger" && "text-danger")}
        title={paisa !== undefined ? formatPKR(paisa) : undefined}>
        {paisa !== undefined ? formatPKRCompact(paisa) : value}
      </p>
      {hint && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card p-10 text-center text-ink-3">{children}</div>;
}

export function StatusPill({ status }: { status: string }) {
  const tone = /deliver|verified|ready|paid|published|approved|closed/.test(status) ? "text-trust"
    : /cancel|reject|rto|fail|returned_unrepaired|hidden/.test(status) ? "text-danger"
    : /pending|await|submitted|booked|draft/.test(status) ? "text-warn" : "text-accent";
  return <span className={cn("badge capitalize", tone)}>{status.replace(/_/g, " ")}</span>;
}
