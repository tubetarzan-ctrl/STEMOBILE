"use client";
import { useRef } from "react";
import { cn } from "@/lib/utils";

/** Tile that tilts toward the cursor; its edge lights up on hover. */
export function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        ref.current.style.transform = `perspective(900px) rotateX(${-y * 6}deg) rotateY(${x * 8}deg)`;
        ref.current.style.setProperty("--mx", `${(x + 0.5) * 100}%`);
        ref.current.style.setProperty("--my", `${(y + 0.5) * 100}%`);
      }}
      onPointerLeave={() => { if (ref.current) ref.current.style.transform = ""; }}
      className={cn(
        "card relative overflow-hidden transition-[transform,border-color,box-shadow] duration-300 ease-[var(--ease)] hover:border-accent/50",
        "before:pointer-events-none before:absolute before:inset-0 before:opacity-0 before:transition-opacity hover:before:opacity-100",
        "before:[background:radial-gradient(240px_circle_at_var(--mx,50%)_var(--my,50%),color-mix(in_srgb,var(--accent)_14%,transparent),transparent_70%)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
