import Link from "next/link";
import { ArrowRight, BadgeCheck, MapPin, ShieldCheck, Smartphone, Star, Wallet, Wrench, Zap } from "lucide-react";
import type { Category, Device, Faq, ProductCard as Card, RepairStory, Review, Section } from "@/lib/data/types";
import { GRADES } from "@/lib/grades";
import { pick, type Lang } from "@/lib/i18n";
import type { GoogleBlock } from "@/lib/reviews/google";
import { whatsappLink } from "@/lib/utils";
import { FitFinder } from "@/components/store/FitFinder";
import { ProductCard } from "@/components/store/ProductCard";
import { PartGlyph } from "@/components/store/PartGlyph";
import { BENCH, categoryImage, storyImages } from "@/lib/data/stock";
import { GradeBadge } from "@/components/ui/badges";
import { HeroStage } from "@/components/hero/HeroStage";
import type { HeroSettings, BusinessSettings } from "@/lib/data/types";
import { RepairZonePicker } from "./RepairZonePicker";
import { TiltCard } from "./TiltCard";
import { HoloProofCard } from "./HoloProofCard";
import { QuickInquiry } from "./QuickInquiry";
import { ReelStrip } from "./ReelStrip";

type D = Record<string, unknown>;
const arr = <T,>(v: unknown) => (Array.isArray(v) ? (v as T[]) : []);
const obj = (v: unknown) => (v && typeof v === "object" ? (v as D) : {});

export type HomeContext = {
  lang: Lang;
  devices: Device[];
  categories: Category[];
  picks: Card[];
  deviceName?: string;
  faqs: Faq[];
  stories: RepairStory[];
  reviews: Review[];
  google: GoogleBlock;
  hero: HeroSettings;
  business: BusinessSettings;
  counts: Record<string, number>;
  reels: { id: string; source: string; url: string; poster: string | null; external_id: string | null; captions: string | null }[];
};

function SectionHead({ eyebrow, title, sub, lang }: { eyebrow?: string; title: string; sub?: string; lang: Lang }) {
  return (
    <div className="mb-10 max-w-2xl">
      {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
      <h2 lang={lang} className="font-display text-3xl font-semibold sm:text-4xl">{title}</h2>
      {sub && <p className="mt-3 text-ink-2">{sub}</p>}
    </div>
  );
}

const Wrap = ({ id, children, className = "" }: { id?: string; children: React.ReactNode; className?: string }) => (
  <section id={id} className={`mx-auto max-w-7xl scroll-mt-24 px-4 py-16 sm:py-24 ${className}`}>{children}</section>
);

// 1 — Hero
function Hero({ d, ctx }: { d: D; ctx: HomeContext }) {
  const primary = obj(d.primary_cta), secondary = obj(d.secondary_cta);
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[600px] opacity-40" style={{ background: "radial-gradient(60% 50% at 70% 30%, color-mix(in srgb, var(--accent) 10%, transparent), transparent)" }} />
      <div className="mx-auto grid max-w-7xl items-center gap-6 px-4 pb-10 pt-10 lg:min-h-[640px] lg:grid-cols-[1.05fr_1fr] lg:pt-16">
        <div className="relative z-10 space-y-7">
          {typeof d.eyebrow === "string" && <p className="eyebrow">{d.eyebrow}</p>}
          <h1 lang={ctx.lang} className="font-display text-[2.6rem] font-bold leading-[1.02] sm:text-6xl lg:text-[4.2rem]">
            {pick(d, "headline", ctx.lang)}
          </h1>
          <p className="max-w-xl text-lg text-ink-2">{pick(d, "sub", ctx.lang)}</p>
          <FitFinder devices={ctx.devices} />
          <div className="flex flex-wrap gap-3">
            <Link href={String(primary.href ?? "/shop")} className="btn btn-primary">{pick(primary, "label", ctx.lang)}<ArrowRight className="size-4" /></Link>
            <Link href={String(secondary.href ?? "#portfolio")} className="btn btn-ghost">{pick(secondary, "label", ctx.lang)}</Link>
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-3 border-t border-line pt-6">
            {ctx.google.rating && (
              <div><dt className="sr-only">Google rating</dt><dd className="flex items-center gap-1.5 font-display text-lg font-semibold"><Star className="size-4 fill-warn text-warn" />{ctx.google.rating.toFixed(1)}<span className="text-sm font-normal text-ink-3">· {ctx.google.total} Google reviews</span></dd></div>
            )}
            {arr<D>(d.trust).map((t, i) => (
              <div key={i}><dt className="text-xs text-ink-3">{pick(t, "label", ctx.lang)}</dt><dd className="font-display text-lg font-semibold">{String(t.value ?? "")}</dd></div>
            ))}
          </dl>
        </div>
        <div className="relative -mx-4 lg:mx-0"><HeroStage hero={ctx.hero} counts={ctx.counts} /></div>
      </div>
      <BrandMarquee devices={ctx.devices} />
    </section>
  );
}

function BrandMarquee({ devices }: { devices: Device[] }) {
  const brands = [...new Set(devices.map((d) => d.brand).filter(Boolean))] as string[];
  const items = [...brands, ...brands, ...brands];
  return (
    <div className="relative overflow-hidden border-y border-line py-4" aria-label="Brands we support">
      <div className="flex w-max animate-marquee gap-12 whitespace-nowrap font-mono text-sm uppercase tracking-[0.2em] text-ink-3">
        {[...items, ...items].map((b, i) => <span key={i}>{b}</span>)}
      </div>
    </div>
  );
}

// 2 — Problem / Solution
const PS_ICONS: Record<string, typeof ShieldCheck> = { "shield-check": ShieldCheck, smartphone: Smartphone, wallet: Wallet, zap: Zap };
function ProblemSolution({ d, ctx }: { d: D; ctx: HomeContext }) {
  return (
    <Wrap>
      <SectionHead eyebrow="Problem → Solution" title={pick(d, "title", ctx.lang)} lang={ctx.lang} />
      <div className="grid gap-4 md:grid-cols-2">
        {arr<D>(d.items).map((it, i) => {
          const Icon = PS_ICONS[String(it.icon)] ?? ShieldCheck;
          return (
            <div key={i} className="card grid gap-4 p-6 sm:grid-cols-[1fr_auto_1.3fr] sm:items-center">
              <p className="text-ink-3 line-through decoration-danger/60">{pick(it, "problem", ctx.lang)}</p>
              <ArrowRight className="hidden size-4 text-ink-3 sm:block" aria-hidden />
              <p className="flex gap-3"><Icon className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden /><span>{pick(it, "solution", ctx.lang)}</span></p>
            </div>
          );
        })}
      </div>
    </Wrap>
  );
}

// 3 — Shop by part (bento)
function CategoryGrid({ d, ctx }: { d: D; ctx: HomeContext }) {
  const cats = ctx.categories.slice(0, 8);
  return (
    <Wrap>
      <SectionHead eyebrow="Catalogue" title={pick(d, "title", ctx.lang)} sub={pick(d, "subtitle", ctx.lang)} lang={ctx.lang} />
      <div className="grid auto-rows-[160px] grid-cols-2 gap-4 md:grid-cols-4">
        {cats.map((c, i) => (
          <TiltCard key={c.id} className={i === 0 ? "col-span-2 row-span-2" : i === 3 ? "md:col-span-2" : ""}>
            <Link href={`/shop?category=${c.slug}`} className="relative flex h-full flex-col justify-between overflow-hidden p-4 sm:p-5">
              {categoryImage(c.slug) ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={categoryImage(c.slug)!.src} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />
                </>
              ) : (
                <PartGlyph kind={c.slug} className={`absolute right-4 top-1/2 -translate-y-1/2 text-ink-3/70 ${i === 0 ? "w-40" : "w-20"}`} />
              )}
              <span className="relative w-fit rounded-full bg-black/45 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/85 backdrop-blur-sm">{c.kind === "part" ? "Genuine parts" : c.kind === "tool" ? "For technicians" : "Accessories"}</span>
              <span className="relative">
                <span lang={ctx.lang} className="block font-display text-lg font-semibold text-white sm:text-xl">{ctx.lang === "ur" && c.name_ur ? c.name_ur : c.name}</span>
                {ctx.counts[c.slug] ? <span className="text-xs text-white/75 sm:text-sm">{ctx.counts[c.slug]} products</span> : null}
              </span>
            </Link>
          </TiltCard>
        ))}
      </div>
    </Wrap>
  );
}

// 4 — Picked for your phone
function ProductRow({ d, ctx }: { d: D; ctx: HomeContext }) {
  return (
    <Wrap>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHead eyebrow={ctx.deviceName ? `For your ${ctx.deviceName}` : "Popular now"} title={pick(d, "title", ctx.lang)} sub={ctx.deviceName ? undefined : pick(d, "subtitle", ctx.lang)} lang={ctx.lang} />
        <Link href="/shop" className="btn btn-ghost btn-sm mb-10">View all<ArrowRight className="size-4" /></Link>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {ctx.picks.slice(0, 8).map((p) => <ProductCard key={p.id} p={p} deviceName={ctx.deviceName} />)}
      </div>
    </Wrap>
  );
}

// 5 — Instant Repair Quote
function RepairQuote({ d, ctx }: { d: D; ctx: HomeContext }) {
  return (
    <Wrap id="quote">
      <SectionHead eyebrow="Instant quote" title={pick(d, "title", ctx.lang)} sub={pick(d, "subtitle", ctx.lang)} lang={ctx.lang} />
      <RepairZonePicker devices={ctx.devices} />
    </Wrap>
  );
}

// 6 — Case studies
function CaseStudies({ d, ctx }: { d: D; ctx: HomeContext }) {
  if (ctx.stories.length === 0) return null;
  return (
    <Wrap>
      <SectionHead eyebrow="Case studies" title={pick(d, "title", ctx.lang)} sub={pick(d, "subtitle", ctx.lang)} lang={ctx.lang} />
      <div className="grid gap-4 md:grid-cols-3">
        {ctx.stories.slice(0, 3).map((s, si) => (
          <article key={s.id} className="card flex flex-col overflow-hidden">
            <div className="grid grid-cols-2 gap-px bg-line">
              {[["Before", s.before_url ?? storyImages(si).before?.src], ["After", s.after_url ?? storyImages(si).after?.src]].map(([label, url]) => (
                <div key={label} className="relative aspect-square bg-surface-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {url ? <img src={url} alt={`${s.device_label} ${label?.toLowerCase()}`} className="size-full object-cover" loading="lazy" /> : <PartGlyph kind="displays" className="mx-auto mt-6 w-1/2 text-ink-3/50" />}
                  <span className="absolute left-2 top-2 badge bg-surface-1/80">{label}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-1 flex-col gap-3 p-5">
              <div className="flex items-center justify-between gap-2"><h3 className="font-display text-lg font-semibold">{s.device_label}</h3>{s.grade && <GradeBadge grade={s.grade} />}</div>
              <p className="text-sm text-ink-2">{s.problem}</p>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div><dt className="text-ink-3">Replaced</dt><dd>{s.replaced}</dd></div>
                <div><dt className="text-ink-3">Time</dt><dd>{s.time_taken}</dd></div>
              </dl>
              {s.quote && <blockquote className="mt-auto border-l-2 border-accent pl-3 text-sm italic text-ink-2">“{s.quote}” <span className="not-italic text-ink-3">— {s.customer_name}</span></blockquote>}
            </div>
          </article>
        ))}
      </div>
    </Wrap>
  );
}

// 7 — Testimonials (Google + on-site)
function Stars({ n }: { n: number }) {
  return <span className="flex" aria-label={`${n} out of 5 stars`}>{[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`size-4 ${i <= n ? "fill-warn text-warn" : "text-line"}`} aria-hidden />)}</span>;
}
function Testimonials({ d, ctx }: { d: D; ctx: HomeContext }) {
  const g = ctx.google;
  const showGoogle = d.show_google !== false && g.source !== "none";
  return (
    <Wrap>
      <SectionHead eyebrow="Testimonials" title={pick(d, "title", ctx.lang)} lang={ctx.lang} />
      {showGoogle && (
        <div className="card mb-6 p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="font-display text-4xl font-bold">{g.rating?.toFixed(1)}</span>
              <div><Stars n={Math.round(g.rating ?? 0)} /><p className="text-sm text-ink-3">{g.total} reviews on Google</p></div>
            </div>
            <a href={g.url} target="_blank" rel="noopener" className="btn btn-ghost btn-sm">See all on Google<ArrowRight className="size-4" /></a>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {g.reviews.slice(0, 3).map((r) => (
              <figure key={r.id} className="rounded-xl bg-surface-2 p-4">
                <Stars n={r.rating} />
                <blockquote className="mt-2 line-clamp-5 text-sm text-ink-2">{r.text}</blockquote>
                <figcaption className="mt-3 text-xs text-ink-3">{r.author} · via Google</figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-4 font-mono text-[11px] text-ink-3">Reviews powered by Google</p>
        </div>
      )}
      {ctx.reviews.length > 0 ? (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {ctx.reviews.map((r) => (
            <figure key={r.id} className="card mb-4 break-inside-avoid p-5">
              <div className="flex items-center justify-between"><Stars n={r.rating} />{r.verified && <span className="badge text-trust"><BadgeCheck className="size-3" />Verified</span>}</div>
              {r.text && <blockquote className="mt-3 text-sm text-ink-2">{r.text}</blockquote>}
              {r.media.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {r.media.slice(0, 3).map((m, i) => m.type === "image"
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img key={i} src={m.url} alt="" className="aspect-square rounded-lg object-cover" loading="lazy" />
                    : <video key={i} src={m.url} poster={m.poster ?? undefined} muted playsInline controls className="aspect-square rounded-lg object-cover" />)}
                </div>
              )}
              <figcaption className="mt-3 text-xs text-ink-3">{r.author_name}</figcaption>
              {r.owner_reply && <p className="mt-3 rounded-lg bg-surface-2 p-3 text-xs text-ink-2"><span className="font-semibold text-ink">StarTech:</span> {r.owner_reply}</p>}
            </figure>
          ))}
        </div>
      ) : !showGoogle ? <p className="text-ink-3">Be the first to review us.</p> : null}
      <div className="mt-8 flex justify-center"><Link href="/reviews/new" className="btn btn-primary">Write a review</Link></div>
    </Wrap>
  );
}

// 8 — Portfolio + reels
function Portfolio({ d, ctx }: { d: D; ctx: HomeContext }) {
  return (
    <Wrap id="portfolio">
      <SectionHead eyebrow="Portfolio" title={pick(d, "title", ctx.lang)} sub={pick(d, "subtitle", ctx.lang)} lang={ctx.lang} />
      {d.show_reels !== false && ctx.reels.length > 0 ? (
        <ReelStrip reels={ctx.reels} />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {BENCH.map((b, i) => (
            <div key={b.key} className="card group relative aspect-[4/5] overflow-hidden">
              {b.img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.img.src} alt={b.img.alt} loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105" />
              ) : (
                <div className="absolute inset-0 grid place-items-center bg-surface-2"><PartGlyph kind={["displays", "batteries", "charging-ports", "back-glass"][i]} className="w-1/3 text-ink-3/50" /></div>
              )}
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />
              <span className="absolute bottom-3 left-3 right-3 text-sm font-medium text-white">{b.label}</span>
            </div>
          ))}
        </div>
      )}
    </Wrap>
  );
}

// 9 — Genuine Proof
function GenuineProof({ d, ctx }: { d: D; ctx: HomeContext }) {
  return (
    <Wrap>
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <SectionHead eyebrow="Genuine Proof™" title={pick(d, "title", ctx.lang)} sub={pick(d, "subtitle", ctx.lang)} lang={ctx.lang} />
          <ol className="space-y-2">
            {Object.entries(GRADES).map(([code, g]) => (
              <li key={code} className="card flex items-center justify-between gap-4 px-4 py-3">
                <span className="flex items-center gap-3"><span className="font-mono text-xs text-ink-3">{g.rank}</span><GradeBadge grade={code} /></span>
                <span className="text-right text-sm text-ink-2">{g.meaning}</span>
              </li>
            ))}
          </ol>
          <Link href="/verify" className="btn btn-ghost mt-6">Verify a part<ArrowRight className="size-4" /></Link>
        </div>
        <HoloProofCard />
      </div>
    </Wrap>
  );
}

// 10 — Why us
function WhyUs({ d, ctx }: { d: D; ctx: HomeContext }) {
  const cmp = obj(d.comparison);
  const cols = arr<string>(cmp.columns), rows = arr<string[]>(cmp.rows);
  return (
    <Wrap>
      <SectionHead eyebrow="Why us" title={pick(d, "title", ctx.lang)} lang={ctx.lang} />
      <div className="grid gap-4 md:grid-cols-3">
        {arr<D>(d.points).map((p, i) => (
          <div key={i} className="card p-6"><p className="font-mono text-xs text-accent">0{i + 1}</p><h3 className="mt-3 font-display text-xl font-semibold">{pick(p, "title", ctx.lang)}</h3><p className="mt-2 text-ink-2">{pick(p, "body", ctx.lang)}</p></div>
        ))}
      </div>
      {rows.length > 0 && (
        <div className="card mt-6 overflow-x-auto">
          <table className="table min-w-[640px]">
            <thead><tr><th scope="col"><span className="sr-only">Feature</span></th>{cols.map((c, i) => <th key={c} scope="col" className={i === 0 ? "!text-accent" : ""}>{c}</th>)}</tr></thead>
            <tbody>{rows.map((r) => <tr key={r[0]}><th scope="row" className="!normal-case !tracking-normal !text-sm !text-ink">{r[0]}</th>{r.slice(1).map((c, i) => <td key={i} className={i === 0 ? "font-medium text-trust" : "text-ink-3"}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </Wrap>
  );
}

// 11 — Technician Pro
function TechnicianPro({ d, ctx }: { d: D; ctx: HomeContext }) {
  const cta = obj(d.cta);
  return (
    <Wrap>
      <div className="card relative grid items-center gap-8 overflow-hidden p-8 sm:p-12 md:grid-cols-[1.4fr_1fr]">
        <div aria-hidden className="absolute -right-24 -top-24 size-72 rounded-full opacity-30 blur-3xl" style={{ background: "var(--accent)" }} />
        <div className="relative">
          <p className="eyebrow mb-3 flex items-center gap-2"><Wrench className="size-3.5" />For repair shops</p>
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">{pick(d, "title", ctx.lang)}</h2>
          <p className="mt-3 max-w-xl text-ink-2">{pick(d, "body", ctx.lang)}</p>
          <Link href={String(cta.href ?? "/trade/apply")} className="btn btn-primary mt-6">{pick(cta, "label", ctx.lang) || "Apply"}<ArrowRight className="size-4" /></Link>
        </div>
        <ul className="relative grid gap-2 text-sm">
          {["Tiered trade pricing", "Credit limit + digital khata", "WhatsApp statements & Raast pay links", "Bulk add by SKU · quick reorder"].map((x) => (
            <li key={x} className="flex items-center gap-2 rounded-xl bg-surface-2 px-4 py-3"><BadgeCheck className="size-4 text-trust" />{x}</li>
          ))}
        </ul>
      </div>
    </Wrap>
  );
}

// 12 — FAQ (+ FAQPage schema)
function FaqSection({ d, ctx }: { d: D; ctx: HomeContext }) {
  const schema = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: ctx.faqs.map((f) => ({ "@type": "Question", name: f.q_en, acceptedAnswer: { "@type": "Answer", text: f.a_en } })) };
  return (
    <Wrap>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
        <SectionHead eyebrow="FAQ" title={pick(d, "title", ctx.lang)} lang={ctx.lang} />
        <div className="divide-y divide-line border-y border-line">
          {ctx.faqs.map((f) => (
            <details key={f.id} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium" lang={ctx.lang}>
                {ctx.lang === "ur" && f.q_ur ? f.q_ur : f.q_en}
                <span className="text-xl text-ink-3 transition-transform group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="mt-3 text-ink-2" lang={ctx.lang}>{ctx.lang === "ur" && f.a_ur ? f.a_ur : f.a_en}</p>
            </details>
          ))}
        </div>
      </div>
    </Wrap>
  );
}

// 13 — Final CTA
function FinalCta({ d, ctx }: { d: D; ctx: HomeContext }) {
  const b = ctx.business;
  return (
    <Wrap>
      <div className="card grid gap-10 p-8 sm:p-12 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-3xl font-semibold sm:text-5xl" lang={ctx.lang}>{pick(d, "title", ctx.lang)}</h2>
          <p className="mt-4 text-ink-2">{pick(d, "body", ctx.lang)}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/repair" className="btn btn-primary">Book a repair</Link>
            <Link href="/shop" className="btn btn-ghost">Shop now</Link>
            <a href={whatsappLink(b.whatsapp, "Hi StarTech!")} target="_blank" rel="noopener" className="btn btn-ghost">WhatsApp</a>
          </div>
          <div className="mt-8 flex items-start gap-3 text-sm text-ink-2">
            <MapPin className="mt-0.5 size-4 text-accent" />
            <div><p>{b.address}</p><p className="text-ink-3">{b.hours}</p><a href={b.map_url} target="_blank" rel="noopener" className="text-accent underline-offset-4 hover:underline">Get directions</a></div>
          </div>
        </div>
        <QuickInquiry />
      </div>
    </Wrap>
  );
}

const REGISTRY: Record<string, (p: { d: D; ctx: HomeContext }) => React.ReactNode> = {
  hero: Hero, problem_solution: ProblemSolution, category_grid: CategoryGrid, product_row: ProductRow,
  repair_quote: RepairQuote, case_studies: CaseStudies, testimonials: Testimonials, portfolio: Portfolio,
  genuine_proof: GenuineProof, why_us: WhyUs, technician_pro: TechnicianPro, faq: FaqSection, final_cta: FinalCta,
  comparison_table: WhyUs, cta_band: FinalCta, reel_strip: Portfolio,
  rich_text: ({ d, ctx }) => <Wrap><div className="prose max-w-3xl text-ink-2" lang={ctx.lang}><h2 className="font-display text-3xl text-ink">{pick(d, "title", ctx.lang)}</h2><p className="mt-4 whitespace-pre-line">{pick(d, "body", ctx.lang)}</p></div></Wrap>,
  text_image: ({ d, ctx }) => (
    <Wrap><div className="grid items-center gap-10 md:grid-cols-2"><div><h2 className="font-display text-3xl font-semibold">{pick(d, "title", ctx.lang)}</h2><p className="mt-4 whitespace-pre-line text-ink-2">{pick(d, "body", ctx.lang)}</p></div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {typeof d.image === "string" && <img src={d.image} alt={String(d.alt ?? "")} className="card aspect-[4/3] w-full object-cover" />}</div></Wrap>
  ),
  map_hours: FinalCta,
};

export function RenderSections({ sections, ctx }: { sections: Section[]; ctx: HomeContext }) {
  return (
    <>
      {sections.map((s) => {
        const C = REGISTRY[s.type];
        return C ? <div key={s.id} data-section={s.type}><C d={s.data} ctx={ctx} /></div> : null;
      })}
    </>
  );
}
