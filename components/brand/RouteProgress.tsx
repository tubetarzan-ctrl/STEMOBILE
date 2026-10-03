"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LogoMark3D } from "./LogoMark3D";

/**
 * Top progress bar on every in-app navigation (the "TopLoader" pattern), with
 * a small spinning StarTech mark riding the leading edge. Starts on same-origin
 * link clicks, trickles toward 85%, completes when the new route commits.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [pct, setPct] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef(false);

  // Navigation committed → finish.
  useEffect(() => {
    if (!active.current) return;
    active.current = false;
    if (timer.current) clearInterval(timer.current);
    setPct(100);
    hideT.current = setTimeout(() => { setVisible(false); setPct(0); }, 380);
  }, [pathname, search]);

  useEffect(() => {
    const start = () => {
      if (hideT.current) clearTimeout(hideT.current);
      active.current = true;
      setVisible(true);
      setPct(8);
      if (timer.current) clearInterval(timer.current);
      timer.current = setInterval(() => setPct((p) => (p < 85 ? p + (85 - p) * 0.12 : p)), 180);
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // same page / hash link
      start();
    };
    const onPop = () => start();
    document.addEventListener("click", onClick, true);
    addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick, true);
      removeEventListener("popstate", onPop);
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  return (
    <div className="st-progress" data-visible={visible} aria-hidden>
      <div className="st-progress__bar" style={{ width: `${pct}%` }}>
        <span className="st-progress__tip"><LogoMark3D size={22} /></span>
      </div>
    </div>
  );
}
