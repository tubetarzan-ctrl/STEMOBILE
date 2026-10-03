// DECISION: locale is a cookie ("st_lang" = en | ur) with a small dictionary
// and *_ur CMS fields falling back to English. This keeps URLs stable for SEO
// in phase 2; next-intl routing (/ur/...) can be layered on without changing
// the content model.
import "server-only";
import { cookies } from "next/headers";

export type Lang = "en" | "ur";

export async function getLang(): Promise<Lang> {
  const c = (await cookies()).get("st_lang")?.value;
  return c === "ur" ? "ur" : "en";
}

/** Pick `${field}_ur` when Urdu is active and present, else `${field}_en` / `${field}`. */
export function pick(obj: Record<string, unknown> | null | undefined, field: string, lang: Lang): string {
  if (!obj) return "";
  const ur = obj[`${field}_ur`];
  const en = obj[`${field}_en`] ?? obj[field];
  return String((lang === "ur" && typeof ur === "string" && ur.trim() ? ur : en) ?? "");
}

const DICT = {
  shop: { en: "Shop", ur: "خریداری" },
  repair: { en: "Repair", ur: "مرمت" },
  verify: { en: "Verify part", ur: "پارٹ کی تصدیق" },
  track: { en: "Track", ur: "ٹریک" },
  trade: { en: "Technician Pro", ur: "ٹیکنیشن پرو" },
  cart: { en: "Cart", ur: "کارٹ" },
  search: { en: "Search parts, e.g. “iPhone 12 panel”", ur: "پارٹس تلاش کریں" },
  inStock: { en: "In stock at shop", ur: "دکان پر دستیاب" },
  outOfStock: { en: "Out of stock", ur: "اسٹاک ختم" },
  addToCart: { en: "Add to cart", ur: "کارٹ میں شامل کریں" },
} as const;

export function t(key: keyof typeof DICT, lang: Lang): string {
  return DICT[key][lang];
}
