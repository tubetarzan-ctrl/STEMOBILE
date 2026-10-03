"use client";
// Muted-autoplay video with our own sound / volume / pause controls (§5.21–5.22).
// - Uploaded MP4: <video autoplay muted loop playsinline>
// - YouTube: privacy-enhanced iframe, controlled via postMessage (no API script)
// - TikTok / Facebook: official players with autoplay (muted); mounted only while
//   on screen, so leaving the screen stops them
// - Instagram: official embed (shows its own thumbnail; Instagram blocks autoplay)
// - Photo posts: plain image
// - Plays only while on screen; pauses when hidden. Only one plays at a time.
// - Save-Data / slow network / reduced motion: poster + play button, no autoplay.
import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

type Source = { source: "upload" | "youtube" | "instagram" | "tiktok" | "facebook"; type?: string; url: string; external_id?: string | null; poster?: string | null; captions?: string | null };

let current: { pause: () => void } | null = null; // one video at a time
const VOL_KEY = "st_video_volume";

function prefersLite(): boolean {
  if (typeof window === "undefined") return true;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } };
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !!nav.connection?.saveData ||
    ["slow-2g", "2g"].includes(nav.connection?.effectiveType ?? "")
  );
}

export function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export function AutoVideo({ src, className, fit = "cover", controls = true, rounded = true }: { src: Source; className?: string; fit?: "cover" | "contain"; controls?: boolean; rounded?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [lite, setLite] = useState(true);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const ytId = src.source === "youtube" ? src.external_id || youtubeId(src.url) : null;

  useEffect(() => setLite(prefersLite()), []);

  const yt = (func: string, args: unknown[] = []) =>
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");

  const api = useRef({
    play: () => { if (current && current !== api.current) current.pause(); current = api.current; if (video.current) video.current.play().catch(() => {}); else yt("playVideo"); setPlaying(true); },
    pause: () => { if (video.current) video.current.pause(); else yt("pauseVideo"); setPlaying(false); },
  });

  // Start when on screen (after the poster has painted), pause when off screen / tab hidden.
  useEffect(() => {
    if (lite && !started) return;
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      const on = e.isIntersecting && e.intersectionRatio > 0.5;
      setInView(on);
      if (on) { setStarted(true); api.current.play(); } else if (started) api.current.pause();
    }, { threshold: [0, 0.5, 1] });
    io.observe(el);
    const vis = () => document.hidden && api.current.pause();
    document.addEventListener("visibilitychange", vis);
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", vis); };
  }, [lite, started]);

  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    const vol = Number(sessionStorage.getItem(VOL_KEY) ?? "0.8");
    if (video.current) { video.current.muted = next; video.current.volume = vol; }
    else { yt(next ? "mute" : "unMute"); yt("setVolume", [Math.round(vol * 100)]); }
    if (!next) api.current.play();
  };
  const setVolume = (v: number) => {
    sessionStorage.setItem(VOL_KEY, String(v));
    if (video.current) video.current.volume = v; else yt("setVolume", [Math.round(v * 100)]);
  };

  if (src.type === "image") {
    return (
      <div className={cn("relative overflow-hidden bg-surface-2", rounded && "rounded-2xl", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src.url} alt={src.captions ?? ""} loading="lazy" className={cn("size-full", fit === "cover" ? "object-cover" : "object-contain")} />
        {src.captions && <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8 text-xs text-white">{src.captions}</span>}
      </div>
    );
  }

  if (src.source === "instagram") {
    const kind = /\/reels?\//.test(src.url) ? "reel" : "p";
    return (
      <div className={cn("relative overflow-hidden bg-surface-2", rounded && "rounded-2xl", className)}>
        {src.external_id ? (
          <iframe title={src.captions ?? "Instagram post"} src={`https://www.instagram.com/${kind}/${src.external_id}/embed/`} loading="lazy"
            allow="autoplay; encrypted-media" className="absolute inset-0 size-full border-0 bg-white" />
        ) : (
          <a href={src.url} target="_blank" rel="noopener" className="absolute inset-0 grid place-items-center"><span className="btn btn-ghost btn-sm"><Play className="size-4" />View on Instagram</span></a>
        )}
      </div>
    );
  }

  const embed =
    src.source === "tiktok" && src.external_id
      ? `https://www.tiktok.com/player/v1/${src.external_id}?autoplay=1&loop=1&controls=1&progress_bar=0&music_info=0&description=0&rel=0&native_context_menu=0&closed_caption=0`
      : src.source === "facebook"
        ? `https://www.facebook.com/plugins/${/\/(videos|reel|watch)|fb\.watch/.test(src.url) ? "video" : "post"}.php?href=${encodeURIComponent(src.url)}&show_text=false&autoplay=true&mute=1`
        : null;

  return (
    <div ref={wrap} className={cn("group relative overflow-hidden bg-surface-2", rounded && "rounded-2xl", className)}>
      {src.poster && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src.poster} alt="" aria-hidden className={cn("absolute inset-0 size-full transition-opacity duration-700", fit === "cover" ? "object-cover" : "object-contain", loaded && "opacity-0")} />
      )}
      {(!lite || started) && (src.source === "upload" ? (
        <video
          ref={video}
          src={src.url}
          poster={src.poster ?? undefined}
          muted
          loop
          playsInline
          preload="metadata"
          onPlaying={() => setLoaded(true)}
          aria-label={src.captions ?? "Video"}
          className={cn("absolute inset-0 size-full transition-opacity duration-700", fit === "cover" ? "object-cover" : "object-contain", loaded ? "opacity-100" : "opacity-0")}
        />
      ) : embed ? (
        (inView || fit === "contain") && (
          <iframe
            title={src.captions ?? `${src.source} video`}
            src={embed}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            loading="lazy"
            onLoad={() => setLoaded(true)}
            className="absolute inset-0 size-full border-0"
          />
        )
      ) : ytId ? (
        <iframe
          ref={frame}
          title={src.captions ?? "YouTube video"}
          src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&mute=1&playsinline=1&loop=1&playlist=${ytId}&rel=0&controls=0&modestbranding=1&enablejsapi=1`}
          allow="autoplay; encrypted-media; picture-in-picture"
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className="absolute inset-0 size-full scale-[1.35] border-0"
        />
      ) : null)}

      {lite && !started && (
        <button type="button" onClick={() => { setStarted(true); setTimeout(() => api.current.play(), 50); }} className="absolute inset-0 grid place-items-center" aria-label="Play video">
          <span className="grid size-14 place-items-center rounded-full bg-surface-1/80 backdrop-blur"><Play className="size-6" /></span>
        </button>
      )}

      {controls && started && !embed && (
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/55 p-1 backdrop-blur">
          <button type="button" onClick={() => (playing ? api.current.pause() : api.current.play())} className="grid size-9 place-items-center rounded-full text-white hover:bg-white/10" aria-label={playing ? "Pause video" : "Play video"}>
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          {!muted && (
            <input type="range" min={0} max={1} step={0.05} defaultValue={0.8} aria-label="Volume" onChange={(e) => setVolume(Number(e.target.value))} className="w-20 accent-[var(--accent)]" />
          )}
          <button type="button" onClick={toggleSound} className="grid size-9 place-items-center rounded-full text-white hover:bg-white/10" aria-label={muted ? "Unmute video" : "Mute video"}>
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
        </div>
      )}
    </div>
  );
}
