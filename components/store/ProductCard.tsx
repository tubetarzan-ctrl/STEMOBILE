import Link from "next/link";
import type { ProductCard as Card } from "@/lib/data/types";
import { FitBadge, GradeBadge, Price, StockBadge } from "@/components/ui/badges";
import { PartGlyph } from "./PartGlyph";

export function ProductCard({ p, deviceName }: { p: Card; deviceName?: string }) {
  return (
    <Link
      href={`/shop/${p.slug}`}
      className="card group flex flex-col overflow-hidden transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-ink-3"
    >
      <div className="relative aspect-[4/3] bg-surface-2 grid place-items-center overflow-hidden">
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <PartGlyph kind={p.category_slug} className="w-1/2 text-ink-3 transition-transform duration-500 group-hover:scale-105" />
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">{p.fit && <FitBadge fit={p.fit} device={deviceName} />}</div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-sans text-[0.95rem] font-medium leading-snug tracking-normal line-clamp-2">{p.name}</h3>
        {p.grades.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {p.grades.slice(0, 2).map((g) => <GradeBadge key={g} grade={g} />)}
            {p.grades.length > 2 && <span className="badge text-ink-3">+{p.grades.length - 2} grades</span>}
          </div>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <Price paisa={p.from_price} from={p.grades.length > 1} className="text-lg" />
          <StockBadge status={p.stock} />
        </div>
      </div>
    </Link>
  );
}
