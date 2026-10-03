"use client";
// Mid-tier fallback: CSS-3D layered phone. Also the instant first paint
// before the WebGL scene lazy-loads.
import { LAYERS, type LayerCounts } from "./layers";

export function CssPhone({ explode, counts, animate, showLabels }: { explode: number; counts: LayerCounts; animate: boolean; showLabels: boolean }) {
  const gap = 10 + explode * 46;
  return (
    <div className="relative grid h-full w-full place-items-center [perspective:1400px]" role="img" aria-label="StarTech phone separating into display, frame, logic board, battery and back glass">
      <div
        className="relative h-[300px] w-[150px] sm:h-[360px] sm:w-[180px] [transform-style:preserve-3d]"
        style={{ transform: "rotateX(56deg) rotateZ(-34deg)", animation: animate ? "sway 8s var(--ease) infinite" : undefined, transition: "transform .4s var(--ease)" }}
      >
        {[...LAYERS].reverse().map((l) => (
          <div
            key={l.key}
            className="absolute inset-0 rounded-[26px] border [transform-style:preserve-3d]"
            style={{
              transform: `translateZ(${l.z * gap}px)`,
              transition: "transform .5s var(--ease)",
              background: layerBg(l.key),
              borderColor: l.key === "display" ? "color-mix(in srgb, var(--accent) 45%, transparent)" : "rgba(255,255,255,.08)",
              boxShadow: l.key === "display" ? "var(--glow)" : "0 10px 30px rgba(0,0,0,.45)",
            }}
          >
            {l.key === "board" && <BoardDetail />}
            {l.key === "battery" && <div className="absolute inset-x-6 top-[42%] bottom-6 rounded-xl border border-white/10 bg-[#1f232b]"><div className="mx-auto mt-3 h-1 w-1/2 rounded bg-trust/70" /></div>}
            {l.key === "back" && <div className="absolute left-3 top-3 size-14 rounded-2xl border border-white/10 bg-[#141c22]" />}
          </div>
        ))}
      </div>
      {showLabels && (
        <ul className="pointer-events-auto absolute right-0 top-1/2 hidden -translate-y-1/2 space-y-2 lg:block" aria-label="Phone parts">
          {LAYERS.map((l) => (
            <li key={l.key} style={{ opacity: 0.35 + explode * 0.65, transition: "opacity .4s" }}>
              <a href={l.href} className="rounded-full border border-line bg-surface-1/70 px-2.5 py-1 font-mono text-[11px] text-ink-2 hover:border-accent hover:text-ink">
                {l.label}{counts[l.category] ? ` · ${counts[l.category]}+ fits` : ""}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function layerBg(key: string) {
  switch (key) {
    case "display": return "linear-gradient(160deg,#10131a,#05060a 60%), radial-gradient(circle at 30% 20%, color-mix(in srgb, var(--accent) 25%, transparent), transparent 60%)";
    case "frame": return "linear-gradient(135deg,rgba(170,178,188,.0),rgba(170,178,188,.0)) padding-box, linear-gradient(135deg,#c8ced6,#6b737d) border-box";
    case "board": return "linear-gradient(160deg,#0f3b2e,#0a2a21)";
    case "battery": return "transparent";
    default: return "linear-gradient(160deg,#1b2a33,#0e161b)";
  }
}

function BoardDetail() {
  return (
    <div className="absolute inset-x-4 top-4 h-[40%] rounded-xl bg-[#0d3a2c] p-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-1 aspect-square rounded bg-[#1c1f26] ring-1 ring-accent/40" />
        <div className="col-span-2 h-6 rounded bg-[#2a2f39]" />
        <div className="col-span-2 h-4 rounded bg-[#2a2f39]" />
        <div className="h-4 rounded bg-[#2a2f39]" />
      </div>
    </div>
  );
}

/** Static poster (low-end / Save-Data / reduced motion): same scene, exploded, no JS animation. */
export function PosterPhone({ counts }: { counts: LayerCounts }) {
  return <CssPhone explode={0.7} counts={counts} animate={false} showLabels />;
}
