// Section library for the Website Content Manager (§5.20). Each entry gives the
// defaults a new section starts with and per-field character limits so edits
// never break the layout.
export type SectionDef = { type: string; label: string; defaults: Record<string, unknown>; limits?: Record<string, number> };

export const SECTION_LIBRARY: SectionDef[] = [
  { type: "hero", label: "Hero", defaults: { headline_en: "New headline", headline_ur: "", sub_en: "Supporting line", primary_cta: { label_en: "Shop now", href: "/shop" }, secondary_cta: { label_en: "See our repairs", href: "#portfolio" }, trust: [] }, limits: { headline_en: 70, sub_en: 200 } },
  { type: "problem_solution", label: "Problem / Solution", defaults: { title_en: "Problems we solve", items: [{ problem_en: "Problem", solution_en: "Our solution", icon: "shield-check" }] }, limits: { title_en: 90 } },
  { type: "category_grid", label: "Category grid", defaults: { title_en: "Shop by part", subtitle_en: "" } },
  { type: "product_row", label: "Product row", defaults: { title_en: "Picked for you", subtitle_en: "", pinned: [] } },
  { type: "repair_quote", label: "Instant repair quote", defaults: { title_en: "Instant repair quote", subtitle_en: "" } },
  { type: "case_studies", label: "Case-study row (Repair stories)", defaults: { title_en: "Repair stories", subtitle_en: "" } },
  { type: "testimonials", label: "Testimonial grid", defaults: { title_en: "What customers say", show_google: true } },
  { type: "portfolio", label: "Portfolio grid", defaults: { title_en: "From the bench", subtitle_en: "", show_reels: true } },
  { type: "reel_strip", label: "Reel strip", defaults: { title_en: "Watch the bench", show_reels: true } },
  { type: "genuine_proof", label: "Genuine Proof", defaults: { title_en: "Genuine Proof™", subtitle_en: "" } },
  { type: "why_us", label: "Why us", defaults: { title_en: "Why StarTech", points: [{ title_en: "Point", body_en: "Detail" }] } },
  { type: "comparison_table", label: "Comparison table", defaults: { title_en: "How we compare", points: [], comparison: { columns: ["StarTech", "Others"], rows: [["Feature", "Yes", "No"]] } } },
  { type: "technician_pro", label: "Technician Pro", defaults: { title_en: "Technician Pro", body_en: "", cta: { label_en: "Apply", href: "/trade/apply" } } },
  { type: "faq", label: "FAQ", defaults: { title_en: "Questions, answered" } },
  { type: "final_cta", label: "CTA band", defaults: { title_en: "Ready when you are.", body_en: "" } },
  { type: "map_hours", label: "Map + hours", defaults: { title_en: "Visit the shop", body_en: "" } },
  { type: "text_image", label: "Text + image", defaults: { title_en: "Title", body_en: "Body", image: "", alt: "" } },
  { type: "rich_text", label: "Rich text", defaults: { title_en: "Title", body_en: "Write here…" }, limits: { body_en: 5000 } },
];

export function limitFor(type: string, field: string): number {
  const def = SECTION_LIBRARY.find((s) => s.type === type);
  return def?.limits?.[field] ?? (field.startsWith("body") ? 2000 : field.startsWith("title") || field.startsWith("headline") ? 120 : 300);
}
