// Website font choices (Super Admin → Appearance). The default pair is bundled
// with the app; the others load from Google Fonts only when selected, so they
// cost nothing until used. Urdu text keeps its Nastaliq/Naskh fonts.
export type FontChoice = { key: string; label: string; family: string | null; google: string | null; usedBy: string };

export const FONTS: FontChoice[] = [
  { key: "startech", label: "StarTech default (Space Grotesk + IBM Plex)", family: null, google: null, usedBy: "Built-in pairing" },
  { key: "inter", label: "Inter", family: "Inter", google: "Inter:wght@400;500;600;700", usedBy: "GitHub, Linear, Figma style" },
  { key: "geist", label: "Geist", family: "Geist", google: "Geist:wght@400;500;600;700", usedBy: "Vercel style" },
  { key: "poppins", label: "Poppins", family: "Poppins", google: "Poppins:wght@400;500;600;700", usedBy: "Popular e-commerce style" },
  { key: "montserrat", label: "Montserrat", family: "Montserrat", google: "Montserrat:wght@400;500;600;700", usedBy: "Bold retail & brand sites" },
  { key: "roboto", label: "Roboto", family: "Roboto", google: "Roboto:wght@400;500;700", usedBy: "Google & Android style" },
  { key: "plus-jakarta", label: "Plus Jakarta Sans", family: "Plus Jakarta Sans", google: "Plus+Jakarta+Sans:wght@400;500;600;700", usedBy: "Modern startup style" },
  { key: "dm-sans", label: "DM Sans", family: "DM Sans", google: "DM+Sans:wght@400;500;600;700", usedBy: "Clean product pages" },
  { key: "manrope", label: "Manrope", family: "Manrope", google: "Manrope:wght@400;500;600;700", usedBy: "Fintech & SaaS style" },
  { key: "outfit", label: "Outfit", family: "Outfit", google: "Outfit:wght@400;500;600;700", usedBy: "Friendly, geometric tech style" },
];

export function fontByKey(key?: string | null): FontChoice {
  return FONTS.find((f) => f.key === key) ?? FONTS[0];
}

export function googleFontsHref(f: FontChoice): string | null {
  return f.google ? `https://fonts.googleapis.com/css2?family=${f.google}&display=swap` : null;
}
