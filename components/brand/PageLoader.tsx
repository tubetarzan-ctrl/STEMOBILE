import { LogoMark3D } from "./LogoMark3D";

/** Shown by loading.tsx while a route streams in. */
export function PageLoader({ label = "Loading", compact = false }: { label?: string; compact?: boolean }) {
  return (
    <div className={compact ? "grid min-h-[50vh] place-items-center" : "grid min-h-[70vh] place-items-center"} role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-5">
        <LogoMark3D size={compact ? 56 : 80} />
        <p className="flex items-center gap-1 font-mono text-xs uppercase tracking-[0.25em] text-ink-3">
          {label}<span className="st-dots" aria-hidden><span>.</span><span>.</span><span>.</span></span>
        </p>
      </div>
    </div>
  );
}
