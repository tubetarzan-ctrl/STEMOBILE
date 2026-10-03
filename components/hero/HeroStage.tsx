"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Layers, Rotate3d, Sparkles } from "lucide-react";
import type { HeroSettings } from "@/lib/data/types";
import { AutoVideo } from "@/components/media/AutoVideo";
import { CssPhone, PosterPhone } from "./CssPhone";
import { PHONE_COLORS, type HeroMode, type LayerCounts, type PhoneColor } from "./layers";
import { cn } from "@/lib/utils";

// 3D bundle is code-split and only requested after first paint on capable GPUs.
const PhoneScene = dynamic(() => import("./PhoneScene"), { ssr: false });

type Tier = "poster" | "css" | "webgl";

export function HeroStage({ hero, counts }: { hero: HeroSettings; counts: LayerCounts }) {
  const [tier, setTier] = useState<Tier>("css");
  const [mode, setMode] = useState<HeroMode>("auto");
  const [color, setColor] = useState<PhoneColor>("cosmic-orange");
  const [explode, setExplode] = useState(0.15);
  const [onScreen, setOnScreen] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const explodeRef = useRef(0.15);
  const stage = useRef<HTMLDivElement>(null);

  // Capability tiering (§4.4): reduced motion / Save-Data / low GPU → poster; mid → CSS; high → WebGL.
  useEffect(() => {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || nav.connection?.saveData) { setTier("poster"); return; }
    setIsDesktop(window.matchMedia("(min-width: 1024px) and (pointer: fine)").matches);
    let cancelled = false;
    const idle = (cb: () => void) => ("requestIdleCallback" in window ? (window as Window & { requestIdleCallback: (c: () => void) => void }).requestIdleCallback(cb) : setTimeout(cb, 600));
    idle(async () => {
      try {
        const { getGPUTier } = await import("detect-gpu");
        const gpu = await getGPUTier({ benchmarksURL: undefined });
        if (cancelled) return;
        if (gpu.tier >= 2 && !gpu.isMobile) setTier("webgl");
        else if (gpu.tier >= 2) setTier("webgl");
        else if (gpu.tier === 1) setTier("css");
        else setTier("poster");
      } catch {
        if (!cancelled) setTier((nav.deviceMemory ?? 4) >= 4 ? "webgl" : "css");
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Pause rendering off-screen / hidden tab.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    const vis = () => setOnScreen(!document.hidden);
    document.addEventListener("visibilitychange", vis);
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", vis); };
  }, []);

  // Desktop: scroll through the hero drives the explode (GSAP ScrollTrigger). Mobile: auto-explode on view.
  useEffect(() => {
    if (tier === "poster" || mode !== "auto") return;
    let kill: (() => void) | undefined;
    if (isDesktop && stage.current) {
      (async () => {
        const { gsap } = await import("gsap");
        const { ScrollTrigger } = await import("gsap/ScrollTrigger");
        gsap.registerPlugin(ScrollTrigger);
        const st = ScrollTrigger.create({
          trigger: stage.current!.closest("section") ?? stage.current!,
          start: "top top", end: "bottom top", scrub: true,
          onUpdate: (self) => { const v = 0.15 + self.progress * 0.85; explodeRef.current = v; setExplode(v); },
        });
        kill = () => st.kill();
      })();
      // gentle breathing while at the top
      const id = setInterval(() => {
        if (window.scrollY < 20) { const v = 0.2 + (Math.sin(Date.now() / 1600) + 1) * 0.25; explodeRef.current = v; setExplode(v); }
      }, 120);
      return () => { clearInterval(id); kill?.(); };
    }
    const id = setInterval(() => { const v = (Math.sin(Date.now() / 1800) + 1) / 2; explodeRef.current = v; setExplode(v); }, 100);
    return () => clearInterval(id);
  }, [tier, mode, isDesktop]);

  const choose = (m: HeroMode) => {
    setMode(m);
    if (m !== "auto") { const v = m === "exploded" ? 1 : 0; explodeRef.current = v; setExplode(v); }
  };

  // --- Owner-selected hero media modes (§5.21) ---
  if (hero.mode === "video" && hero.media) {
    return <AutoVideo src={{ source: hero.media.source as "upload", url: hero.media.url, poster: hero.media.poster, external_id: hero.media.external_id }} className="absolute inset-0" rounded={false} />;
  }
  if (hero.mode === "image" && hero.media) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={hero.media.url} alt="" className="absolute inset-0 size-full object-cover" />;
  }
  const videoSrc = hero.mode === "3d_video" && hero.media?.source === "upload" ? hero.media.url : undefined;

  return (
    <div ref={stage} className="relative h-[420px] w-full sm:h-[520px] lg:h-[600px]">
      {/* spotlight + ground glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(40% 45% at 50% 40%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%)" }} />
      {tier === "poster" && <PosterPhone counts={counts} color={color} />}
      {tier === "css" && <CssPhone explode={explode} counts={counts} animate={mode === "auto"} showLabels color={color} />}
      {tier === "webgl" && (
        <div className="absolute inset-0">
          <PhoneScene explode={explodeRef} counts={counts} videoSrc={videoSrc} active={onScreen} showLabels={isDesktop} color={color} />
        </div>
      )}
      <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full border border-line bg-surface-1/80 px-2 py-1.5 backdrop-blur" role="group" aria-label="Phone colour">
        {(Object.keys(PHONE_COLORS) as PhoneColor[]).map((k) => (
          <button key={k} type="button" onClick={() => setColor(k)} aria-pressed={color === k} title={PHONE_COLORS[k].label} aria-label={PHONE_COLORS[k].label}
            className={cn("size-5 rounded-full border-2 transition-transform hover:scale-110", color === k ? "border-accent" : "border-transparent")}
            style={{ background: `linear-gradient(135deg, ${PHONE_COLORS[k].plateau}, ${PHONE_COLORS[k].body})` }} />
        ))}
      </div>
      {tier !== "poster" && (
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1 rounded-full border border-line bg-surface-1/80 p-1 backdrop-blur" role="group" aria-label="3D view">
          {([["auto", "Auto", Sparkles], ["exploded", "Exploded", Layers], ["assembled", "Assembled", Rotate3d]] as const).map(([m, label, Icon]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => choose(m)}
              className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-ink-2 transition-colors", mode === m && "bg-accent text-accent-ink")}
            >
              <Icon className="size-3.5" aria-hidden />{label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
