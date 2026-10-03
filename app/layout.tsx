import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Noto_Naskh_Arabic, Noto_Nastaliq_Urdu, Space_Grotesk } from "next/font/google";
import { cookies } from "next/headers";
import { getActiveTheme, getFontKey, getThemes } from "@/lib/data/store";
import { fontByKey, googleFontsHref } from "@/lib/fonts";
import { getLang } from "@/lib/i18n";
import { Suspense } from "react";
import { RouteProgress } from "@/components/brand/RouteProgress";
import "./globals.css";

const display = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-space-grotesk", display: "swap" });
const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono", display: "swap" });
const nastaliq = Noto_Nastaliq_Urdu({ subsets: ["arabic"], weight: ["400", "600"], variable: "--font-nastaliq", display: "swap", preload: false });
const naskh = Noto_Naskh_Arabic({ subsets: ["arabic"], weight: ["400", "600"], variable: "--font-naskh", display: "swap", preload: false });

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "StarTech Electronics — Genuine phone parts & repairs in Karachi", template: "%s · StarTech Electronics" },
  description:
    "Genuine and graded phone parts that fit your exact model, instant repair quotes, live repair tracking and a digital warranty. 22 years at Sarena Mobile Mall, Karachi.",
  manifest: "/manifest.webmanifest",
  openGraph: { type: "website", siteName: "StarTech Electronics", locale: "en_PK" },
};

export const viewport: Viewport = {
  themeColor: "#07080B",
  width: "device-width",
  initialScale: 1,
};

/** Active theme tokens rendered server-side → no flash of the wrong theme. */
async function themeCss(): Promise<string> {
  const mode = (await cookies()).get("st_mode")?.value; // visitor's own light/dark choice
  let theme = await getActiveTheme();
  if (mode === "light" && theme.is_dark) theme = (await getThemes()).find((t) => t.key === "daylight") ?? theme;
  if (mode === "dark" && !theme.is_dark) theme = (await getThemes()).find((t) => t.key === "midnight-lab") ?? theme;
  const vars = Object.entries(theme.tokens)
    .filter(([k, v]) => /^[a-z0-9-]+$/.test(k) && /^#[0-9a-fA-F]{3,8}$/.test(v))
    .map(([k, v]) => `--${k}:${v};`)
    .join("");
  // Chart series colours validated per mode (dataviz validator: band, chroma, CVD, contrast).
  const chart = theme.is_dark ? "--chart-1:#0AA2C0;--chart-2:#8B5CF6;" : "--chart-1:#0891B2;--chart-2:#7C3AED;";
  return `:root{${vars}${chart}color-scheme:${theme.is_dark ? "dark" : "light"};}`;
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const lang = await getLang();
  const font = fontByKey(await getFontKey());
  const fontHref = googleFontsHref(font);
  return (
    <html
      suppressHydrationWarning // splash script toggles classes on <html> before hydration
      lang={lang}
      dir={lang === "ur" ? "rtl" : "ltr"}
      className={`${display.variable} ${sans.variable} ${mono.variable} ${nastaliq.variable} ${naskh.variable}`}
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: await themeCss() }} />
        {fontHref && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
            <link rel="stylesheet" href={fontHref} />
            <style dangerouslySetInnerHTML={{ __html: `:root{--font-pick:"${font.family}";}` }} />
          </>
        )}
      </head>
      <body className="min-h-dvh antialiased">
        <Suspense fallback={null}><RouteProgress /></Suspense>
        {children}
      </body>
    </html>
  );
}
