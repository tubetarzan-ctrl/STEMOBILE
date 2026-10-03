"use client";
import { useRef } from "react";
import { QrCode, ShieldCheck } from "lucide-react";

/** Holographic Genuine Proof card — tilted, with a moving light sheen. */
export function HoloProofCard({ data }: { data?: { product: string; grade: string; code: string; sold?: string; warrantyEnds?: string; valid?: boolean } }) {
  const ref = useRef<HTMLDivElement>(null);
  const d = data ?? { product: "iPhone 13 Display Assembly", grade: "Original (New)", code: "K7QX-M2PR-9D", sold: "Sold 14 Sep 2026", warrantyEnds: "Warranty to 13 Mar 2027", valid: true };
  return (
    <div className="grid place-items-center [perspective:1200px]">
      <div
        ref={ref}
        onPointerMove={(e) => {
          if (!ref.current || e.pointerType !== "mouse") return;
          const r = ref.current.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
          ref.current.style.transform = `rotateX(${8 - y * 14}deg) rotateY(${-10 + x * 18}deg)`;
        }}
        onPointerLeave={() => { if (ref.current) ref.current.style.transform = ""; }}
        className="relative aspect-[1.6] w-full max-w-md overflow-hidden rounded-3xl border p-6 transition-transform duration-500 ease-[var(--ease)] [transform:rotateX(8deg)_rotateY(-10deg)]"
        style={{
          borderColor: "color-mix(in srgb, var(--trust) 45%, transparent)",
          background: "linear-gradient(135deg, color-mix(in srgb, var(--trust) 14%, var(--surface-1)), var(--surface-1) 45%, color-mix(in srgb, var(--accent) 14%, var(--surface-1)))",
          boxShadow: "0 30px 80px -20px color-mix(in srgb, var(--trust) 30%, transparent)",
        }}
        role="img"
        aria-label={`Genuine Proof card: ${d.product}, grade ${d.grade}, ${d.valid ? "verified" : "not verified"}`}
      >
        <div aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 opacity-60" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent)", animation: "sheen 4.5s var(--ease) infinite" }} />
        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-trust"><ShieldCheck className="size-4" />{d.valid === false ? "Not verified" : "Genuine Proof · Verified"}</span>
            <QrCode className="size-10 text-ink-2" aria-hidden />
          </div>
          <div>
            <p className="font-display text-xl font-semibold">{d.product}</p>
            <p className="text-sm text-ink-2">{d.grade}</p>
          </div>
          <div className="flex items-end justify-between font-mono text-xs text-ink-3">
            <span>{d.code}</span>
            <span className="text-right">{d.sold}<br />{d.warrantyEnds}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
