import Link from "next/link";
import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import { ProductCard } from "@/components/store/ProductCard";
import { FitFinder } from "@/components/store/FitFinder";
import { getCategories, getDevices, getProducts } from "@/lib/data/store";
import { getActiveDevice } from "@/lib/device-cookie";
import { GRADES } from "@/lib/grades";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Shop genuine phone parts & accessories", description: "Displays, batteries, back glass, charging ports, chargers, cases and tools — graded, with model-exact fit." };

type SP = Promise<{ category?: string; q?: string; grade?: string; stock?: string; all?: string }>;

export default async function ShopPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const device = await getActiveDevice();
  const [cats, devices, products] = await Promise.all([
    getCategories(), getDevices(),
    getProducts({ category: sp.category, q: sp.q, grade: sp.grade, inStock: sp.stock === "1", device: device?.id, hideNonFitting: sp.all !== "1" }),
  ]);
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/shop${p.size ? `?${p}` : ""}`;
  };
  const activeCat = cats.find((c) => c.slug === sp.category);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow mb-2">{device ? `Showing parts for ${device.name}` : "All products"}</p>
          <h1 className="font-display text-4xl font-semibold">{sp.q ? `“${sp.q}”` : activeCat?.name ?? "Shop"}</h1>
        </div>
        <FitFinder devices={devices} variant="inline" />
      </div>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-6" aria-label="Filters">
          <nav>
            <h2 className="eyebrow mb-3">Category</h2>
            <ul className="space-y-1 text-sm">
              <li><Link href={qs({ category: undefined })} className={cn("block rounded-lg px-3 py-1.5 hover:bg-surface-2", !sp.category && "bg-surface-2 text-accent")}>All</Link></li>
              {cats.map((c) => (
                <li key={c.id}><Link href={qs({ category: c.slug })} className={cn("block rounded-lg px-3 py-1.5 hover:bg-surface-2", sp.category === c.slug && "bg-surface-2 text-accent")}>{c.name}</Link></li>
              ))}
            </ul>
          </nav>
          <div>
            <h2 className="eyebrow mb-3">Part grade</h2>
            <div className="flex flex-wrap gap-1.5">
              <Link href={qs({ grade: undefined })} className={cn("badge", !sp.grade && "border-accent text-accent")}>Any</Link>
              {Object.entries(GRADES).map(([k, g]) => (
                <Link key={k} href={qs({ grade: k })} className={cn("badge", sp.grade === k && "border-accent text-accent")}>{g.label}</Link>
              ))}
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <Link href={qs({ stock: sp.stock === "1" ? undefined : "1" })} className="flex items-center gap-2">
              <span className={cn("grid size-4 place-items-center rounded border border-line", sp.stock === "1" && "border-accent bg-accent")} />In stock only
            </Link>
            {device && (
              <Link href={qs({ all: sp.all === "1" ? undefined : "1" })} className="flex items-center gap-2">
                <span className={cn("grid size-4 place-items-center rounded border border-line", sp.all === "1" && "border-accent bg-accent")} />Show items that don&apos;t fit
              </Link>
            )}
          </div>
        </aside>

        <section aria-label="Products">
          <p className="mb-4 text-sm text-ink-3">{products.length} products</p>
          {products.length === 0 ? (
            <div className="card grid place-items-center gap-3 p-14 text-center">
              <SearchX className="size-8 text-ink-3" />
              <p className="font-medium">Nothing matches those filters.</p>
              <p className="text-sm text-ink-3">Can&apos;t find your part? We special-order — <Link href="/repair#special" className="text-accent underline">ask us</Link>.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {products.map((p) => <ProductCard key={p.id} p={p} deviceName={device?.name} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
