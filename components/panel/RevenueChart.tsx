"use client";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPKR, formatPKRCompact } from "@/lib/money";

export type DayPoint = { date: string; revenue: number; gross: number };

// Revenue (bars) vs gross profit (line): same unit → one axis. Series colours
// come from --chart-1/--chart-2, validated for both dark and light surfaces.
export function RevenueChart({ data }: { data: DayPoint[] }) {
  const label = (d: string) => new Date(`${d}T12:00:00+05:00`).toLocaleDateString("en-PK", { day: "numeric", month: "short" });
  return (
    <figure className="card p-5">
      <figcaption className="mb-4 flex items-baseline justify-between">
        <span className="font-display text-lg font-semibold">Last 14 days</span>
        <span className="text-xs text-ink-3">PKR · business days (PKT)</span>
      </figcaption>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="0" />
            <XAxis dataKey="date" tickFormatter={label} tick={{ fill: "var(--ink-3)", fontSize: 11 }} axisLine={{ stroke: "var(--line)" }} tickLine={false} />
            <YAxis tickFormatter={(v) => formatPKRCompact(v).replace("Rs ", "")} tick={{ fill: "var(--ink-3)", fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
            <Tooltip
              cursor={{ fill: "color-mix(in srgb, var(--ink) 6%, transparent)" }}
              content={({ active, payload, label: l }) =>
                active && payload?.length ? (
                  <div className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs shadow-xl">
                    <p className="mb-1 text-ink-3">{label(String(l))}</p>
                    {payload.map((p) => (
                      <p key={String(p.dataKey)} className="flex items-center gap-2 text-ink">
                        <span className="size-2 rounded-full" style={{ background: p.color }} />
                        <span className="text-ink-2">{p.name}</span>
                        <span className="money ml-auto pl-3 font-semibold">{formatPKR(Number(p.value))}</span>
                      </p>
                    ))}
                  </div>
                ) : null
              }
            />
            <Legend verticalAlign="top" align="right" height={28} iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs text-ink-2">{v}</span>} />
            <Bar dataKey="revenue" name="Revenue" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Line dataKey="gross" name="Gross profit" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "var(--surface-1)", fill: "var(--chart-2)" }} activeDot={{ r: 5 }} type="monotone" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-ink-3">View as table</summary>
        <table className="table mt-2">
          <thead><tr><th>Date</th><th className="num">Revenue</th><th className="num">Gross profit</th></tr></thead>
          <tbody>{data.map((d) => <tr key={d.date}><td>{label(d.date)}</td><td className="num">{formatPKR(d.revenue)}</td><td className="num">{formatPKR(d.gross)}</td></tr>)}</tbody>
        </table>
      </details>
    </figure>
  );
}
