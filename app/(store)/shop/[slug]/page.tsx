import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronRight, ShieldCheck, Truck, Store } from "lucide-react";
import { getDevices, getProduct, getRelated, getReviews } from "@/lib/data/store";
import { getActiveDevice } from "@/lib/device-cookie";
import { gradeLabel } from "@/lib/grades";
import { ProductCard } from "@/components/store/ProductCard";
import { PartGlyph } from "@/components/store/PartGlyph";
import { categoryImage } from "@/lib/data/stock";
import { VariantPicker } from "./VariantPicker";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const p = await getProduct((await params).slug);
  if (!p) return {};
  return { title: p.name, description: p.description ?? undefined, alternates: { canonical: `/shop/${p.slug}` } };
}

export default async function ProductPage({ params }: { params: Params }) {
  const product = await getProduct((await params).slug);
  if (!product) notFound();
  const device = await getActiveDevice();
  const [related, reviews, devices] = await Promise.all([getRelated(product, device?.id), getReviews({ productId: product.id, limit: 6 }), getDevices()]);

  const fitsIds = new Set(product.variants.flatMap((v) => v.fits.map((f) => f.device_id)));
  const fitsNames = devices.filter((d) => fitsIds.has(d.id)).map((d) => `${d.brand} ${d.name}`);
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const schema = {
    "@context": "https://schema.org", "@type": "Product", name: product.name, description: product.description, sku: product.variants[0]?.sku,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    offers: product.variants.map((v) => ({
      "@type": "Offer", sku: v.sku, priceCurrency: "PKR", price: (v.sale_price / 100).toFixed(0), url: `${site}/shop/${product.slug}`,
      availability: v.stock === "out" ? "https://schema.org/OutOfStock" : "https://schema.org/InStock", name: gradeLabel(v.grade) || undefined,
    })),
    ...(reviews.length ? { aggregateRating: { "@type": "AggregateRating", ratingValue: (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1), reviewCount: reviews.length } } : {}),
  };
  const crumbs = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Shop", item: `${site}/shop` },
    { "@type": "ListItem", position: 2, name: product.category.name, item: `${site}/shop?category=${product.category.slug}` },
    { "@type": "ListItem", position: 3, name: product.name },
  ] };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([schema, crumbs]) }} />
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1 text-sm text-ink-3">
        <Link href="/shop" className="hover:text-ink">Shop</Link><ChevronRight className="size-3.5" />
        <Link href={`/shop?category=${product.category.slug}`} className="hover:text-ink">{product.category.name}</Link>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="card grid aspect-square place-items-center overflow-hidden">
            {product.images[0]
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={product.images[0].url} alt={product.images[0].alt ?? product.name} className="size-full object-cover" />
              : categoryImage(product.category.slug)
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={categoryImage(product.category.slug)!.src} alt={product.name} className="size-full object-cover" />
                : <PartGlyph kind={product.category.slug} className="w-1/2 text-ink-3" />}
          </div>
          {product.images.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {product.images.slice(1, 6).map((im) => <img key={im.url} src={im.url} alt={im.alt ?? ""} className="card aspect-square object-cover" />)}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <p className="eyebrow mb-2">{product.category.name}</p>
            <h1 className="font-display text-3xl font-semibold sm:text-4xl">{product.name}</h1>
          </div>
          <VariantPicker
            product={{ slug: product.slug, name: product.name, kind: product.category.kind }}
            variants={product.variants}
            device={device}
          />
          <ul className="grid gap-2 text-sm text-ink-2 sm:grid-cols-3">
            <li className="flex items-center gap-2"><Store className="size-4 text-accent" />Pickup at Sarena Mobile Mall</li>
            <li className="flex items-center gap-2"><Truck className="size-4 text-accent" />Karachi same/next day</li>
            <li className="flex items-center gap-2"><ShieldCheck className="size-4 text-trust" />Digital warranty</li>
          </ul>
          {product.description && <div><h2 className="eyebrow mb-2">Details</h2><p className="text-ink-2">{product.description}</p></div>}
          {fitsNames.length > 0 && (
            <div><h2 className="eyebrow mb-2">Compatible with</h2><p className="text-sm text-ink-2">{fitsNames.join(" · ")}</p></div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-6 font-display text-2xl font-semibold">Frequently bought together</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{related.map((p) => <ProductCard key={p.id} p={p} deviceName={device?.name} />)}</div>
        </section>
      )}

      <section className="mt-20">
        <div className="mb-6 flex items-center justify-between"><h2 className="font-display text-2xl font-semibold">Reviews</h2><Link href={`/reviews/new?product=${product.id}`} className="btn btn-ghost btn-sm">Write a review</Link></div>
        {reviews.length === 0 ? <p className="text-ink-3">No reviews yet for this product.</p> : (
          <div className="grid gap-4 md:grid-cols-2">
            {reviews.map((r) => <figure key={r.id} className="card p-5"><p className="text-warn">{"★".repeat(r.rating)}<span className="text-line">{"★".repeat(5 - r.rating)}</span></p>{r.text && <blockquote className="mt-2 text-sm text-ink-2">{r.text}</blockquote>}<figcaption className="mt-2 text-xs text-ink-3">{r.author_name}{r.verified && " · Verified purchase"}</figcaption></figure>)}
          </div>
        )}
      </section>
    </div>
  );
}
