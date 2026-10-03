import { CheckCircle2, CircleAlert, CircleSlash, ShieldCheck } from "lucide-react";
import { GRADES, type Grade } from "@/lib/grades";
import { formatPKR } from "@/lib/money";
import type { Fit, StockStatus } from "@/lib/data/types";
import { cn } from "@/lib/utils";

export function GradeBadge({ grade, className }: { grade: Grade | string; className?: string }) {
  if (!grade || grade === "NA") return null;
  const g = GRADES[grade as Exclude<Grade, "NA">];
  if (!g) return null;
  return (
    <span className={cn("badge font-mono", className)} style={{ color: g.tone, borderColor: `color-mix(in srgb, ${g.tone} 40%, transparent)` }}>
      {g.rank <= 2 && <ShieldCheck className="size-3" aria-hidden />}
      {g.label}
    </span>
  );
}

export function StockBadge({ status, lowQty }: { status: StockStatus; lowQty?: number }) {
  if (status === "out") return <span className="badge text-ink-3">Out of stock</span>;
  if (status === "low")
    return <span className="badge text-warn" style={{ borderColor: "color-mix(in srgb, var(--warn) 40%, transparent)" }}>Only {lowQty || "a few"} left</span>;
  return <span className="badge text-trust" style={{ borderColor: "color-mix(in srgb, var(--trust) 40%, transparent)" }}>In stock at shop</span>;
}

export function FitBadge({ fit, device }: { fit: Fit; device?: string }) {
  if (!fit) return null;
  if (fit === "exact")
    return <span className="badge text-trust" style={{ borderColor: "color-mix(in srgb, var(--trust) 40%, transparent)" }}><CheckCircle2 className="size-3" aria-hidden />Fits{device ? ` ${device}` : ""}</span>;
  if (fit === "check_version")
    return <span className="badge text-warn" style={{ borderColor: "color-mix(in srgb, var(--warn) 40%, transparent)" }}><CircleAlert className="size-3" aria-hidden />Fits — check version</span>;
  return <span className="badge text-danger" style={{ borderColor: "color-mix(in srgb, var(--danger) 40%, transparent)" }}><CircleSlash className="size-3" aria-hidden />Doesn&apos;t fit</span>;
}

export function Price({ paisa, className, from }: { paisa: number; className?: string; from?: boolean }) {
  return (
    <span className={cn("money font-display font-semibold", className)}>
      {from && <span className="text-ink-3 text-xs font-sans font-normal mr-1">from</span>}
      {formatPKR(paisa)}
    </span>
  );
}
