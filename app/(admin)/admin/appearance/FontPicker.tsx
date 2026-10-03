"use client";
import { useEffect, useState, useTransition } from "react";
import { FONTS, fontByKey, googleFontsHref } from "@/lib/fonts";
import { setFontAction } from "../website/actions";

/** Font dropdown with live preview; "Apply" switches the whole website. */
export function FontPicker({ current }: { current: string }) {
  const [live, setLive] = useState(current);
  const [pick, setPick] = useState(current);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const f = fontByKey(pick);

  // load the previewed font on demand
  useEffect(() => {
    const href = googleFontsHref(f);
    if (!href || document.querySelector(`link[href="${href}"]`)) return;
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.href = href;
    document.head.appendChild(l);
  }, [f]);

  const family = f.family ? `"${f.family}", ui-sans-serif, system-ui, sans-serif` : undefined;

  return (
    <section className="card space-y-4 p-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-64 flex-1 space-y-1">
          <span className="label">Website font</span>
          <select value={pick} onChange={(e) => { setPick(e.target.value); setMsg(null); }} className="input">
            {FONTS.map((x) => <option key={x.key} value={x.key}>{x.label} — {x.usedBy}{x.key === live ? " (live)" : ""}</option>)}
          </select>
        </label>
        <button type="button" className="btn btn-primary" disabled={pending || pick === live}
          onClick={() => start(async () => { const r = await setFontAction(pick); if (r.ok) { setLive(pick); setMsg("Font applied to site ✓"); } else setMsg(r.error); })}>
          {pending ? "Applying…" : "Apply font"}
        </button>
        {msg && <span className="text-sm">{msg}</span>}
      </div>
      <div className="rounded-2xl border border-line bg-surface-2 p-5" style={family ? { fontFamily: family } : undefined}>
        <p className="text-xs uppercase tracking-widest text-ink-3">Preview · {f.label}</p>
        <p className="mt-2 text-3xl font-bold tracking-tight" style={family ? { fontFamily: family, letterSpacing: "-0.02em" } : undefined}>The inside of your phone, done right.</p>
        <p className="mt-2 text-ink-2">Genuine and graded parts that fit your exact model — iPhone 15 Pro Max OLED, Rs 53,250, in stock.</p>
      </div>
    </section>
  );
}
