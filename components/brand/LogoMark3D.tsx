import { cn } from "@/lib/utils";

/**
 * StarTech 3D logo mark: the logo's phone, built from the same five layers as
 * the exploded hero (back glass → battery → logic board → frame → display).
 * It spins on Y while the layers breathe apart and back together. Pure
 * CSS (styles in globals.css), so it renders before any JS and works in Server
 * Components, the first-visit splash, loading.tsx and the route progress bar.
 */
export function LogoMark3D({ size = 72, className, still = false }: { size?: number; className?: string; still?: boolean }) {
  return (
    <span className={cn("st-mark-stage", className)} style={{ ["--s" as string]: `${size}px` }} aria-hidden>
      <span className={cn("st-mark", still && "st-mark--still")}>
        <span className="st-layer st-layer--back" />
        <span className="st-layer st-layer--battery" />
        <span className="st-layer st-layer--board"><span className="st-chip" /></span>
        <span className="st-layer st-layer--frame" />
        <span className="st-layer st-layer--display"><span className="st-notch" /></span>
      </span>
      <span className="st-mark-shadow" />
    </span>
  );
}
