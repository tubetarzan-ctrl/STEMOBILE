"use client";
// Mid-tier fallback: CSS-3D layered flagship phone (iPhone 17 Pro Max–style:
// aluminium back, full-width camera plateau, Dynamic Island). Spins a full 360°
// on a turntable while the layers separate. Also the instant first paint
// before the WebGL scene lazy-loads.
import { LAYERS, PHONE_COLORS, type LayerCounts, type PhoneColor } from "./layers";

export function CssPhone({ explode, counts, animate, showLabels, color = "cosmic-orange" }: { explode: number; counts: LayerCounts; animate: boolean; showLabels: boolean; color?: PhoneColor }) {
  const gap = 8 + explode * 44;
  const c = PHONE_COLORS[color];
  return (
    <div className="relative grid h-full w-full place-items-center [perspective:1600px]" role="img" aria-label="Flagship phone spinning 360 degrees and separating into display, frame, logic board, battery and back">
      <div
        className="relative h-[300px] w-[146px] sm:h-[360px] sm:w-[172px] [transform-style:preserve-3d]"
        style={{ transform: "rotateX(58deg) rotateZ(-34deg)", animation: animate ? "st-turntable 16s linear infinite" : undefined }}
      >
        {[...LAYERS].reverse().map((l) => (
          <div
            key={l.key}
            className="absolute inset-0 overflow-hidden rounded-[30px] [transform-style:preserve-3d]"
            style={{
              transform: `translateZ(${l.z * gap}px)`,
              transition: "transform .5s var(--ease)",
              background: layerBg(l.key, c),
              border: l.key === "frame" ? `6px solid ${c.frame}` : `1px solid ${l.key === "display" ? "rgba(255,255,255,.18)" : "rgba(255,255,255,.08)"}`,
              boxShadow: l.key === "display" ? "0 0 40px color-mix(in srgb, var(--accent) 25%, transparent)" : "0 10px 30px rgba(0,0,0,.45)",
            }}
          >
            {l.key === "display" && <DisplayFace tone={c.body} />}
            {l.key === "board" && <BoardDetail />}
            {l.key === "battery" && <div className="absolute inset-x-6 top-[42%] bottom-6 rounded-xl border border-white/10 bg-[#1f232b]"><div className="mx-auto mt-3 h-1 w-1/2 rounded bg-trust/70" /></div>}
            {l.key === "back" && <BackFace plateau={c.plateau} frame={c.frame} body={c.body} />}
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

function layerBg(key: string, c: (typeof PHONE_COLORS)[PhoneColor]) {
  switch (key) {
    case "display": return "#05060a";
    case "frame": return "transparent";
    case "board": return "linear-gradient(160deg,#0f3b2e,#0a2a21)";
    case "battery": return "transparent";
    default: return `linear-gradient(160deg, ${c.plateau}, ${c.body} 55%, ${c.frame})`;
  }
}

function DisplayFace({ tone }: { tone: string }) {
  return (
    <div className="absolute inset-[5px] overflow-hidden rounded-[25px]" style={{ background: `radial-gradient(120% 70% at 30% 35%, rgba(255,255,255,.18), transparent 60%), linear-gradient(160deg,#05060a, ${tone} 60%, #0b0d14)` }}>
      <div className="mx-auto mt-2 h-[14px] w-[58px] rounded-full bg-black" />
      <p className="mt-6 text-center font-display text-[11px] font-semibold text-white/85">Friday 3 October</p>
      <p className="text-center font-display text-5xl font-bold leading-none text-white/95">9:41</p>
    </div>
  );
}

function BackFace({ plateau, frame, body }: { plateau: string; frame: string; body: string }) {
  const lens = "absolute size-[42px] rounded-full border-[5px] bg-[radial-gradient(circle_at_35%_35%,#3a4a6b,#05070b_55%)]";
  return (
    <>
      <div className="absolute inset-x-[3px] top-[3px] h-[31%] rounded-[27px]" style={{ background: `linear-gradient(160deg, ${plateau}, ${body})`, boxShadow: "inset 0 -6px 10px rgba(0,0,0,.18)" }}>
        <span className={lens} style={{ left: 12, top: 10, borderColor: frame }} />
        <span className={lens} style={{ left: 12, top: 58, borderColor: frame }} />
        <span className={lens} style={{ left: 56, top: 34, borderColor: frame }} />
        <span className="absolute right-4 top-4 size-3 rounded-full bg-[#f4f1e8]" />
        <span className="absolute right-4 top-12 size-3 rounded-full bg-[#0a0b10]" />
      </div>
      <div className="absolute inset-x-8 bottom-10 top-[40%] rounded-2xl border border-white/10" style={{ background: "linear-gradient(160deg, rgba(255,255,255,.08), transparent)" }}>
        <div className="mx-auto mt-[30%] size-16 rounded-full border border-white/15" />
      </div>
    </>
  );
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

/** Static poster (low-end / Save-Data / reduced motion): same scene, exploded, no animation. */
export function PosterPhone({ counts, color = "cosmic-orange" }: { counts: LayerCounts; color?: PhoneColor }) {
  return <CssPhone explode={0.7} counts={counts} animate={false} showLabels color={color} />;
}
