"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Check, ShieldCheck, ShoppingBag } from "lucide-react";
import type { Variant } from "@/lib/data/types";
import { GRADES, gradeLabel, type Grade } from "@/lib/grades";
import { formatPKR } from "@/lib/money";
import { useCart } from "@/lib/client/stores";
import { FitBadge, StockBadge } from "@/components/ui/badges";
import { cn } from "@/lib/utils";

/** Grade ladder + compatibility verdict + honest stock + add to cart. */
export function VariantPicker({ product, variants, device }: { product: { slug: string; name: string; kind: string }; variants: Variant[]; device: { id: string; name: string } | null }) {
  const sorted = useMemo(
    () => [...variants].sort((a, b) => (GRADES[a.grade as Exclude<Grade, "NA">]?.rank ?? 9) - (GRADES[b.grade as Exclude<Grade, "NA">]?.rank ?? 9) || a.sale_price - b.sale_price),
    [variants],
  );
  const [id, setId] = useState(sorted.find((v) => v.stock !== "out")?.id ?? sorted[0]?.id);
  const [added, setAdded] = useState(false);
  const { add } = useCart();
  const v = sorted.find((x) => x.id === id) ?? sorted[0];
  const graded = sorted.some((x) => x.grade !== "NA");

  const fit = device
    ? v.fits.length === 0 ? null
      : v.fits.find((f) => f.device_id === device.id)?.confidence ?? "no"
    : null;

  return (
    <div className="space-y-5">
      <p className="money font-display text-4xl font-bold">{formatPKR(v.sale_price)}</p>

      {device && fit && <div className="flex items-center gap-2"><FitBadge fit={fit} device={device.name} />{fit === "check_version" && <span className="text-xs text-ink-3">Match the model number in Settings → About phone.</span>}</div>}
      {!device && v.fits.length > 0 && <p className="text-sm text-ink-3">Set your phone at the top of the page to check fit.</p>}

      {graded ? (
        <fieldset>
          <legend className="eyebrow mb-3">Choose grade</legend>
          <div className="space-y-2" role="radiogroup">
            {sorted.map((x) => {
              const g = GRADES[x.grade as Exclude<Grade, "NA">];
              return (
                <button
                  key={x.id}
                  type="button"
                  role="radio"
                  aria-checked={x.id === v.id}
                  onClick={() => setId(x.id)}
                  className={cn("card flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-shadow", x.id === v.id && "glow border-transparent")}
                >
                  <span>
                    <span className="flex items-center gap-2 font-medium">{g?.rank <= 2 && <ShieldCheck className="size-4 text-trust" />}{gradeLabel(x.grade)}</span>
                    <span className="block text-xs text-ink-3">{g?.meaning}{x.warranty_days ? ` · ${x.warranty_days}-day warranty` : ""}</span>
                  </span>
                  <span className="text-right">
                    <span className="money block font-semibold">{formatPKR(x.sale_price)}</span>
                    <span className="text-xs text-ink-3">{x.stock === "out" ? "Out of stock" : x.stock === "low" ? `Only ${x.low_qty} left` : "In stock"}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : sorted.length > 1 ? (
        <fieldset>
          <legend className="eyebrow mb-3">Option</legend>
          <div className="flex flex-wrap gap-2">
            {sorted.map((x) => (
              <button key={x.id} type="button" onClick={() => setId(x.id)} aria-pressed={x.id === v.id} className={cn("badge px-3 py-1.5 text-sm", x.id === v.id && "border-accent text-accent")}>
                {Object.values(x.attributes).join(" · ") || x.sku}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <StockBadge status={v.stock} lowQty={v.low_qty} />
        <span className="font-mono text-xs text-ink-3">SKU {v.sku}</span>
      </div>

      {v.stock === "out" ? (
        <Link href={`/repair?notify=${v.sku}#special`} className="btn btn-ghost w-full sm:w-auto"><Bell className="size-4" />Out of stock — notify me</Link>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn btn-primary min-w-48"
            onClick={() => {
              add({ variantId: v.id, productSlug: product.slug, name: product.name, sku: v.sku, grade: v.grade, price: v.sale_price });
              setAdded(true);
              setTimeout(() => setAdded(false), 1800);
            }}
          >
            {added ? <><Check className="size-4" />Added</> : <><ShoppingBag className="size-4" />Add to cart</>}
          </button>
          {product.kind === "part" && <Link href="/repair" className="btn btn-ghost">Get it fitted</Link>}
        </div>
      )}
    </div>
  );
}
