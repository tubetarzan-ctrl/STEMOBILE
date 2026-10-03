"use client";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import type { Theme } from "@/lib/data/types";
import { activateThemeAction } from "../website/actions";
import { cn } from "@/lib/utils";

const WORLD: Record<string, string> = {
  "cupertino-light": "Clean white & blue — Apple Store style",
  "graphite-pro": "Black & graphite — Apple Pro pages style",
  "indigo-wave": "Airy light & indigo — Stripe style",
  "dusk-violet": "Near-black & violet — Linear style",
  "mono-signal": "Black & white, red signal — Nothing style",
  "ocean-navy": "Deep navy & electric blue — Samsung style",
  noir: "Pure black, white accent — Vercel style",
  "neon-pulse": "Charcoal & neon green — Spotify style",
};

export function ThemeGrid({ themes }: { themes: Theme[] }) {
  const [active, setActive] = useState(themes.find((t) => t.is_active)?.key);
  const [preview, setPreview] = useState(active);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const p = themes.find((t) => t.key === preview)!;
  const v = (k: string) => p?.tokens[k];

  const apply = (key: string) => start(async () => { const r = await activateThemeAction(key); if (r.ok) { setActive(key); setMsg("Applied to site ✓"); } else setMsg(r.error); });
  const world = themes.filter((t) => WORLD[t.key]);
  const originals = themes.filter((t) => !WORLD[t.key]);

  return (
    <div className="space-y-8">
      <div className="card flex flex-wrap items-end gap-3 p-5">
        <label className="min-w-64 flex-1 space-y-1">
          <span className="label">Website theme</span>
          <select value={preview} onChange={(e) => { setPreview(e.target.value); setMsg(null); }} className="input">
            <optgroup label="World-class looks">
              {world.map((t) => <option key={t.key} value={t.key}>{t.name} — {WORLD[t.key]}{active === t.key ? " (live)" : ""}</option>)}
            </optgroup>
            <optgroup label="StarTech originals">
              {originals.map((t) => <option key={t.key} value={t.key}>{t.name}{active === t.key ? " (live)" : ""}</option>)}
            </optgroup>
          </select>
        </label>
        <button type="button" className="btn btn-primary" disabled={pending || preview === active || !preview} onClick={() => preview && apply(preview)}>
          {pending ? "Applying…" : "Apply to site"}
        </button>
        {msg && <span className="text-sm">{msg}</span>}
      </div>
    <div className="grid gap-8 xl:grid-cols-[1fr_1.2fr]">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {themes.map((t) => (
          <button key={t.key} type="button" onClick={() => setPreview(t.key)} aria-pressed={preview === t.key}
            className={cn("card overflow-hidden text-left", preview === t.key && "glow border-transparent")}>
            <div className="flex h-16" style={{ background: t.tokens.bg }}>
              {["surface-1", "accent", "trust", "warn"].map((k) => <span key={k} className="m-2 size-6 rounded-full" style={{ background: t.tokens[k] }} />)}
            </div>
            <p className="flex items-center justify-between px-3 py-2 text-sm">{t.name}{active === t.key && <Check className="size-4 text-trust" />}</p>
          </button>
        ))}
      </div>
      {p && (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border" style={{ background: v("bg"), borderColor: v("line"), color: v("ink") }}>
            <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: v("line") }}><span className="font-display font-bold">StarTech</span><span className="text-xs" style={{ color: v("ink-3") }}>Shop · Repair · Verify</span></div>
            <div className="space-y-4 p-6">
              <p className="font-mono text-xs uppercase tracking-widest" style={{ color: v("ink-3") }}>Sarena Mobile Mall · Since 2003</p>
              <p className="font-display text-3xl font-bold">The inside of your phone, done right.</p>
              <div className="flex gap-2"><span className="rounded-xl px-4 py-2 text-sm font-semibold" style={{ background: v("accent"), color: v("accent-ink") }}>Shop parts that fit</span><span className="rounded-xl border px-4 py-2 text-sm" style={{ borderColor: v("line") }}>See our repairs</span></div>
              <div className="grid grid-cols-3 gap-2">{["Displays", "Batteries", "Chargers"].map((x) => <div key={x} className="rounded-xl border p-3 text-sm" style={{ background: v("surface-1"), borderColor: v("line") }}>{x}<p className="text-xs" style={{ color: v("trust") }}>In stock</p></div>)}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn btn-primary" disabled={pending || preview === active} onClick={() => preview && apply(preview)}>Apply to site</button>
            {msg && <span className="text-sm">{msg}</span>}
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
