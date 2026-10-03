import Link from "next/link";
import { cookies } from "next/headers";
import { Search } from "lucide-react";
import { getAnnouncement } from "@/lib/data/store";
import { getLang, pick, t } from "@/lib/i18n";
import { CartButton, PrefsToggles } from "./HeaderClient";
import { DeviceBar } from "./FitFinder";
import { Logo } from "./Logo";

export async function Header() {
  const [lang, ann, jar] = await Promise.all([getLang(), getAnnouncement(), cookies()]);
  const mode = (jar.get("st_mode")?.value ?? "") as "light" | "dark" | "";
  return (
    <>
      {ann && (
        <div className="bg-accent text-accent-ink">
          <Link href={ann.link ?? "/shop"} className="mx-auto block max-w-7xl px-4 py-1.5 text-center text-[13px] font-semibold">
            {pick(ann as Record<string, unknown>, "text", lang)}
          </Link>
        </div>
      )}
      <header
        className="sticky top-0 z-30 border-b border-line backdrop-blur-xl"
        style={{ background: "color-mix(in srgb, var(--bg) 82%, transparent)" }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:gap-4 sm:px-4">
          <Link href="/" className="shrink-0" aria-label="StarTech Electronics home">
            <Logo />
          </Link>
          <nav className="ml-4 hidden items-center gap-1 text-sm text-ink-2 md:flex" aria-label="Main">
            <Link href="/shop" className="rounded-lg px-3 py-2 hover:bg-surface-2 hover:text-ink">{t("shop", lang)}</Link>
            <Link href="/repair" className="rounded-lg px-3 py-2 hover:bg-surface-2 hover:text-ink">{t("repair", lang)}</Link>
            <Link href="/verify" className="rounded-lg px-3 py-2 hover:bg-surface-2 hover:text-ink">{t("verify", lang)}</Link>
            <Link href="/trade/apply" className="rounded-lg px-3 py-2 hover:bg-surface-2 hover:text-ink">{t("trade", lang)}</Link>
          </nav>
          <form action="/shop" className="ml-auto hidden max-w-sm flex-1 lg:block" role="search">
            <label className="relative block">
              <span className="sr-only">Search</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
              <input name="q" className="input h-10 pl-9 text-sm" placeholder={t("search", lang)} />
            </label>
          </form>
          <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1 lg:ml-0">
            <PrefsToggles lang={lang} mode={mode} />
            <CartButton />
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-line px-3 py-1.5 text-sm text-ink-2 md:hidden [scrollbar-width:none] [mask-image:linear-gradient(90deg,#000_85%,transparent)]" aria-label="Main (mobile)">
          {[["/shop", t("shop", lang)], ["/repair", t("repair", lang)], ["/verify", t("verify", lang)], ["/track", t("track", lang)], ["/trade/apply", t("trade", lang)]].map(([href, label]) => (
            <Link key={href} href={href} className="shrink-0 rounded-lg px-3 py-1.5 hover:bg-surface-2 hover:text-ink">{label}</Link>
          ))}
        </nav>
        <DeviceBar />
      </header>
    </>
  );
}
