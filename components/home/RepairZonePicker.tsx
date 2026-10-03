"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Clock, ShieldCheck } from "lucide-react";
import { useDevice } from "@/lib/client/stores";
import type { Device, RepairQuoteRow } from "@/lib/data/types";
import { GRADES, ISSUES, type Grade, type IssueKey } from "@/lib/grades";
import { formatPKR } from "@/lib/money";
import { cn } from "@/lib/utils";
import { getQuoteAction } from "@/app/actions/store";
import { GradeBadge } from "@/components/ui/badges";

// Hotspots on a phone outline (percent of the 200x400 outline).
const HOTSPOTS: Record<IssueKey, { x: number; y: number }> = {
  screen: { x: 50, y: 42 }, battery: { x: 50, y: 64 }, charging_port: { x: 50, y: 97 },
  camera: { x: 30, y: 9 }, back_glass: { x: 74, y: 22 }, speaker: { x: 50, y: 3.5 },
};

export function RepairZonePicker({ devices }: { devices: Device[] }) {
  const [device] = useDevice();
  const [deviceId, setDeviceId] = useState<string>("");
  const [issue, setIssue] = useState<IssueKey>("screen");
  const [rows, setRows] = useState<RepairQuoteRow[] | null>(null);
  const [selected, setSelected] = useState<Grade | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => { if (device && !deviceId) setDeviceId(device.id); }, [device, deviceId]);
  useEffect(() => {
    if (!deviceId) return;
    start(async () => {
      const r = await getQuoteAction(deviceId, issue);
      setRows(r);
      setSelected(r[0]?.grade ?? null);
    });
  }, [deviceId, issue]);

  const current = rows?.find((r) => r.grade === selected);

  return (
    <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
      <div className="mx-auto w-full max-w-[260px]">
        <div className="relative aspect-[1/2]">
          <svg viewBox="0 0 200 400" className="absolute inset-0 size-full" aria-hidden>
            <rect x="12" y="6" width="176" height="388" rx="34" fill="var(--surface-1)" stroke="var(--line)" strokeWidth="2" />
            <rect x="22" y="18" width="156" height="364" rx="26" fill="none" stroke="var(--line)" strokeDasharray="4 6" />
            <rect x="78" y="12" width="44" height="10" rx="5" fill="var(--line)" />
          </svg>
          {ISSUES.map((z) => (
            <button
              key={z.key}
              type="button"
              aria-pressed={issue === z.key}
              onClick={() => setIssue(z.key)}
              className="group absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${HOTSPOTS[z.key].x}%`, top: `${HOTSPOTS[z.key].y}%` }}
            >
              <span className={cn("block size-4 rounded-full border-2 transition-all", issue === z.key ? "border-accent bg-accent pulse-dot" : "border-ink-3 bg-surface-2 group-hover:border-accent")} />
              <span className={cn("absolute left-1/2 top-6 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium", issue === z.key ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-2")}>
                {z.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-5">
        <label className="block max-w-sm space-y-1.5">
          <span className="label">Your phone</span>
          <select className="input" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
            <option value="">Select your model…</option>
            {devices.map((d) => <option key={d.id} value={d.id}>{d.brand} {d.name}</option>)}
          </select>
        </label>

        {!deviceId && <p className="text-ink-3">Pick your phone and tap where it hurts.</p>}
        {deviceId && pending && <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-16" />)}</div>}
        {deviceId && !pending && rows && rows.length === 0 && (
          <div className="card p-5 text-ink-2">No fixed price for this repair yet — <Link className="text-accent underline" href="/repair">book a free diagnosis</Link> and we&apos;ll quote on WhatsApp.</div>
        )}
        {!pending && rows && rows.length > 0 && (
          <>
            <ul className="space-y-2" aria-label="Price per grade">
              {rows.map((r) => (
                <li key={r.grade}>
                  <button
                    type="button"
                    onClick={() => setSelected(r.grade)}
                    aria-pressed={selected === r.grade}
                    className={cn("card flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-shadow", selected === r.grade && "glow border-transparent")}
                  >
                    <span className="flex flex-col gap-1">
                      <GradeBadge grade={r.grade} />
                      <span className="text-xs text-ink-3">{GRADES[r.grade as Exclude<Grade, "NA">]?.meaning}</span>
                    </span>
                    <span className="text-right">
                      <span className="money block font-display text-xl font-semibold">{formatPKR(r.total)}</span>
                      <span className="text-xs text-ink-3">{r.in_stock ? "Part in stock" : "Part in 1–3 days"}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {current && (
              <div className="flex flex-wrap items-center gap-4 text-sm text-ink-2">
                <span className="flex items-center gap-1.5"><Clock className="size-4 text-accent" />~{current.est_minutes} min</span>
                <span className="flex items-center gap-1.5"><ShieldCheck className="size-4 text-trust" />{current.warranty_days}-day warranty</span>
                <span className="text-ink-3">Labour {formatPKR(current.labour)} + part {formatPKR(current.part_price)}</span>
                <Link href={`/repair?device=${deviceId}&issue=${issue}&grade=${current.grade}`} className="btn btn-primary ml-auto">Book this repair</Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
