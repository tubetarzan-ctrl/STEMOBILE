import Link from "next/link";
import { getBusiness, getCategories } from "@/lib/data/store";
import { formatPhonePK, whatsappLink } from "@/lib/utils";
import { SHOP } from "@/lib/data/shop";
import { Logo } from "./Logo";

export async function Footer() {
  const [biz, cats] = await Promise.all([getBusiness(), getCategories()]);
  const localBusiness = {
    "@context": "https://schema.org",
    "@type": "ElectronicsStore",
    name: biz.name,
    address: { "@type": "PostalAddress", streetAddress: biz.address, addressLocality: "Karachi", addressCountry: "PK" },
    description: SHOP.services,
    telephone: biz.phone,
    openingHours: SHOP.openingHoursSchema,
    url: process.env.NEXT_PUBLIC_SITE_URL,
  };
  return (
    <footer className="mt-24 border-t border-line">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusiness) }} />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-4">
        <div className="space-y-4">
          <Logo />
          <p className="text-sm text-ink-2">{biz.tagline}</p>
          <p className="text-sm text-ink-3">{biz.address}<br />{biz.hours}</p>
        </div>
        <div>
          <h3 className="eyebrow mb-4">Shop</h3>
          <ul className="space-y-2 text-sm text-ink-2">
            {cats.slice(0, 7).map((c) => (
              <li key={c.id}><Link href={`/shop?category=${c.slug}`} className="hover:text-ink">{c.name}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="eyebrow mb-4">Services</h3>
          <ul className="space-y-2 text-sm text-ink-2">
            <li><Link href="/repair" className="hover:text-ink">Repair &amp; instant quote</Link></li>
            <li><Link href="/track" className="hover:text-ink">Track a repair or order</Link></li>
            <li><Link href="/verify" className="hover:text-ink">Verify a part (Genuine Proof)</Link></li>
            <li><Link href="/warranty" className="hover:text-ink">Warranty wallet</Link></li>
            <li><Link href="/trade/apply" className="hover:text-ink">Technician Pro</Link></li>
            <li><Link href="/reviews/new" className="hover:text-ink">Write a review</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="eyebrow mb-4">Talk to us</h3>
          <ul className="space-y-2 text-sm text-ink-2">
            <li><a href={whatsappLink(biz.whatsapp, "Hi StarTech!")} className="hover:text-ink" target="_blank" rel="noopener">WhatsApp</a></li>
            <li><a href={`tel:${biz.phone}`} className="hover:text-ink">{formatPhonePK(biz.phone)}</a></li>
            {biz.email && <li><a href={`mailto:${biz.email}`} className="hover:text-ink">{biz.email}</a></li>}
            <li><a href={biz.map_url} className="hover:text-ink" target="_blank" rel="noopener">Directions</a></li>
          </ul>
          <h3 className="eyebrow mb-3 mt-8">Policies</h3>
          <ul className="space-y-2 text-sm text-ink-3">
            <li><Link href="/p/warranty-policy" className="hover:text-ink">Warranty</Link> · <Link href="/p/returns" className="hover:text-ink">Returns</Link></li>
            <li><Link href="/p/delivery" className="hover:text-ink">Delivery</Link> · <Link href="/p/privacy" className="hover:text-ink">Privacy</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-7xl px-4 py-5 font-mono text-xs text-ink-3">© {new Date().getFullYear()} {biz.name}. Prices in PKR.</p>
      </div>
    </footer>
  );
}
