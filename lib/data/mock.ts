// Deterministic demo catalogue used when Supabase isn't configured, so the
// storefront runs with zero setup. Mirrors supabase/seed.sql's shape.
import type { Grade } from "@/lib/grades";
import type { Brand, Category, Device, Faq, Product, RepairStory, Section, Theme } from "./types";

const BRANDS: Brand[] = ["Apple", "Samsung", "Xiaomi", "Oppo", "Vivo", "Infinix", "Tecno", "Realme", "Google"].map((n, i) => ({
  id: `b${i}`, name: n, slug: n.toLowerCase(),
}));

const DEVICE_LIST: [string, string, string[], number][] = [
  ["Apple", "iPhone 11", ["A2221"], 2019], ["Apple", "iPhone 12", ["A2403"], 2020], ["Apple", "iPhone 13", ["A2633"], 2021],
  ["Apple", "iPhone 13 Pro", ["A2638"], 2021], ["Apple", "iPhone 14", ["A2882"], 2022], ["Apple", "iPhone 14 Pro Max", ["A2894"], 2022],
  ["Apple", "iPhone 15", ["A3090"], 2023], ["Apple", "iPhone 15 Pro Max", ["A3106"], 2023],
  ["Samsung", "Galaxy A14", ["SM-A145F"], 2023], ["Samsung", "Galaxy A24", ["SM-A245F"], 2023], ["Samsung", "Galaxy A34", ["SM-A346E"], 2023],
  ["Samsung", "Galaxy A54", ["SM-A546E", "SM-A546B"], 2023], ["Samsung", "Galaxy A55", ["SM-A556E"], 2024], ["Samsung", "Galaxy S21", ["SM-G991B"], 2021],
  ["Samsung", "Galaxy S22 Ultra", ["SM-S908E"], 2022], ["Samsung", "Galaxy S23", ["SM-S911B"], 2023],
  ["Xiaomi", "Redmi Note 12", ["23021RAAEG"], 2023], ["Xiaomi", "Redmi Note 13", ["23129RAA4G"], 2024], ["Xiaomi", "Redmi 13C", ["23100RN82L"], 2023],
  ["Xiaomi", "Poco X6 Pro", ["2311DRK48G"], 2024], ["Oppo", "A78", ["CPH2565"], 2023], ["Oppo", "Reno 10", ["CPH2531"], 2023],
  ["Vivo", "Y36", ["V2247"], 2023], ["Vivo", "V29", ["V2250"], 2023], ["Infinix", "Hot 40", ["X6836"], 2023], ["Infinix", "Note 30", ["X6833B"], 2023],
  ["Tecno", "Spark 20", ["KJ5"], 2023], ["Tecno", "Camon 20", ["CK6n"], 2023], ["Realme", "C55", ["RMX3710"], 2023], ["Google", "Pixel 7", ["GVU6C"], 2022],
];

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const mockDevices: Device[] = DEVICE_LIST.map(([brand, name, models, year], i) => {
  const b = BRANDS.find((x) => x.name === brand)!;
  return { id: `d${i}`, brand_id: b.id, brand, name, slug: slugify(brand === "Apple" || brand === "Google" ? name : `${brand} ${name}`), model_numbers: models, release_year: year };
});
export const mockBrands = BRANDS;

export const mockCategories: Category[] = [
  ["Displays", "displays", "part"], ["Batteries", "batteries", "part"], ["Back Glass", "back-glass", "part"],
  ["Charging Ports", "charging-ports", "part"], ["Cameras", "cameras", "part"], ["Cases", "cases", "accessory"],
  ["Screen Protectors", "screen-protectors", "accessory"], ["Chargers", "chargers", "accessory"], ["Cables", "cables", "accessory"],
  ["Audio", "audio", "accessory"], ["Power Banks", "power-banks", "accessory"], ["Tools", "tools", "tool"],
].map(([name, slug, kind], i) => ({ id: `c${i}`, name, slug, kind: kind as Category["kind"], sort: i }));

const cat = (slug: string) => mockCategories.find((c) => c.slug === slug)!;
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const round50 = (n: number) => Math.round(n / 5000) * 5000;

function stockFor(sku: string) {
  const q = hash(sku) % 11;
  return { stock: (q === 0 ? "out" : q <= 3 ? "low" : "in") as "out" | "low" | "in", low_qty: Math.min(q, 3) };
}

export const mockProducts: Product[] = (() => {
  const out: Product[] = [];
  for (const d of mockDevices) {
    const tier = (d.brand === "Apple" ? 3 : d.brand === "Samsung" ? 2 : d.brand === "Google" ? 2.2 : 1) * (1 + ((d.release_year ?? 2022) - 2021) * 0.08);
    const grades: Grade[] = ["Apple", "Samsung", "Google"].includes(d.brand!) ? ["ORIG_NEW", "OEM", "PREMIUM", "STANDARD"] : ["OEM", "PREMIUM", "STANDARD"];
    const mult: Record<string, number> = { ORIG_NEW: 1.7, OEM: 1, PREMIUM: 0.7, STANDARD: 0.45 };
    const wd: Record<string, number> = { ORIG_NEW: 180, OEM: 90, PREMIUM: 30, STANDARD: 7 };
    const base = `${d.brand} ${d.name}`;
    const fit = [{ device_id: d.id, confidence: "exact" as const }];
    out.push({
      id: `p-${d.slug}-display`, name: `${base} Display Assembly`, slug: `${d.slug}-display`, category: cat("displays"), brand: d.brand,
      description: `Complete display assembly (screen + digitizer) for ${d.name}. Pre-installed adhesive. Tested before dispatch.`,
      warranty_days: 90, images: [],
      variants: grades.map((g) => {
        const sku = `${d.slug.replace(/-/g, "").toUpperCase()}-DSP-${g}`;
        return { id: `v-${sku}`, sku, grade: g, attributes: {}, sale_price: round50(900000 * tier * mult[g]), warranty_days: wd[g], fits: fit, ...stockFor(sku) };
      }),
    });
    out.push({
      id: `p-${d.slug}-battery`, name: `${base} Battery`, slug: `${d.slug}-battery`, category: cat("batteries"), brand: d.brand,
      description: `Replacement battery for ${d.name} with adhesive strips. Zero cycle count.`, warranty_days: 90, images: [],
      variants: (["OEM", "PREMIUM"] as Grade[]).map((g) => {
        const sku = `${d.slug.replace(/-/g, "").toUpperCase()}-BAT-${g}`;
        return { id: `v-${sku}`, sku, grade: g, attributes: {}, sale_price: round50(250000 * tier * (g === "OEM" ? 1 : 0.7)), warranty_days: g === "OEM" ? 90 : 30, fits: fit, ...stockFor(sku) };
      }),
    });
    out.push({
      id: `p-${d.slug}-charging-port`, name: `${base} Charging Port Flex`, slug: `${d.slug}-charging-port`, category: cat("charging-ports"), brand: d.brand,
      description: `Charging port flex with microphone for ${d.name}.`, warranty_days: 30, images: [],
      variants: [{ id: `v-${d.slug}-chp`, sku: `${d.slug.replace(/-/g, "").toUpperCase()}-CHP-OEM`, grade: "OEM", attributes: {}, sale_price: round50(120000 * tier), warranty_days: 30, fits: fit, ...stockFor(d.slug + "chp") }],
    });
    out.push({
      id: `p-${d.slug}-glass`, name: `${d.name} Tempered Glass 9H`, slug: `${d.slug}-glass`, category: cat("screen-protectors"), brand: "Generic",
      description: "Full-glue edge-to-edge 9H glass, oleophobic coating.", warranty_days: 0, images: [],
      variants: [{ id: `v-${d.slug}-gls`, sku: `${d.slug.replace(/-/g, "").toUpperCase()}-GLS`, grade: "NA", attributes: {}, sale_price: 50000, warranty_days: 0, fits: fit, ...stockFor(d.slug + "gls") }],
    });
    out.push({
      id: `p-${d.slug}-case`, name: `${d.name} Shockproof Case`, slug: `${d.slug}-case`, category: cat("cases"), brand: "Generic",
      description: "Military-grade drop protection with raised camera lip.", warranty_days: 0, images: [],
      variants: ["Black", "Clear", "Navy Blue"].map((c) => {
        const sku = `${d.slug.replace(/-/g, "").toUpperCase()}-CASE-${c.slice(0, 3).toUpperCase()}`;
        return { id: `v-${sku}`, sku, grade: "NA" as Grade, attributes: { colour: c }, sale_price: 120000, warranty_days: 0, fits: fit, ...stockFor(sku) };
      }),
    });
  }
  const acc: [string, string, string, number][] = [
    ["20W USB-C Fast Charger", "chargers", "PD 3.0 fast charger. Charges an iPhone to 50% in 30 minutes.", 250000],
    ["25W Super Fast Charger", "chargers", "Samsung PPS compatible 25W charger.", 280000],
    ["65W GaN Dual Charger", "chargers", "Compact GaN, charges phone + laptop together.", 650000],
    ["USB-C to USB-C Braided Cable", "cables", "60W braided cable, 10,000+ bend tested.", 90000],
    ["USB-C to Lightning Cable", "cables", "Supports fast charging.", 120000],
    ["True Wireless Earbuds Pro", "audio", "ENC calls, 30h total battery.", 450000],
    ["10,000mAh Power Bank 22.5W", "power-banks", "Slim, fast-charge both ways.", 550000],
    ["20,000mAh Power Bank PD", "power-banks", "PD 20W + QC 3.0, LED display.", 850000],
    ["Precision Screwdriver Kit 24-in-1", "tools", "Pentalobe, Tri-wing, Phillips, Torx bits.", 350000],
    ["Heat Gun 858D Station", "tools", "Hot air rework station for screen separation.", 1200000],
    ["B-7000 Adhesive 50ml", "tools", "Industrial adhesive for frames and glass.", 35000],
    ["LCD Separator Machine", "tools", "7-inch rotary separator with vacuum.", 2800000],
  ];
  for (const [name, c, description, price] of acc) {
    const slug = slugify(name);
    out.push({
      id: `p-${slug}`, name, slug, category: cat(c), brand: "Generic", description, warranty_days: ["chargers", "audio", "power-banks"].includes(c) ? 180 : 0, images: [],
      variants: [{ id: `v-${slug}`, sku: `ACC-${slug.toUpperCase().slice(0, 12)}`, grade: "NA", attributes: {}, sale_price: price, warranty_days: null, fits: [], ...stockFor(slug) }],
    });
  }
  return out;
})();

export const mockFaqs: Faq[] = [
  ["What do the part grades mean?", "Original (New) is a new manufacturer part. Original (Pulled) is a manufacturer part removed from another device and tested. OEM is made to manufacturer spec by a third party. Premium Copy is high-quality aftermarket; Standard Copy is budget aftermarket. The grade is printed on your invoice and, for serialized parts, on a scannable Genuine Proof code."],
  ["How long is the warranty?", "Up to 180 days for Original (New) displays, 90 days for OEM, 30 days for Premium and 7 days for Standard. Repairs carry a separate workmanship warranty. Every warranty is saved under your phone number."],
  ["How long does a screen replacement take?", "Most screen and battery replacements take 30–60 minutes while you wait. You can track your repair live with the link we send on WhatsApp."],
  ["Do you offer cash on delivery?", "Yes, across Pakistan. We confirm COD orders on WhatsApp before dispatch. Karachi orders can also be paid by Raast, card or bank transfer."],
  ["How fast is delivery?", "Karachi: same or next day by our rider. Other cities: 2–3 working days by courier."],
  ["Is my data safe during a repair?", "We only ask for your passcode if a test needs it. It is encrypted and automatically deleted the moment you collect your phone."],
  ["How do I check if a part is genuine?", "Scan the QR code on the part's label or enter its code on our Verify page. You'll see the grade, sale date and remaining warranty."],
  ["Where is the shop and when are you open?", "Shop # 1F, Sarena Family Market and Mobile Mall, Roundabout, Sakhi Hassan, Sector 15-A-1, Buffer Zone, Karachi. Open Monday to Saturday, 1:00 PM to 12:00 AM; closed Sunday. Call or WhatsApp +92 332 2142141."],
  ["What repairs do you do?", "iPhone and Android repairs, screen replacements, battery and charging-port fixes, and complex hardware troubleshooting such as Wi-Fi IC repairs. Use the Instant Repair Quote to see the price before you visit."],
  ["Can repair shops buy at trade prices?", "Yes — apply for a Technician Pro account for tiered pricing, a credit limit with a digital khata and WhatsApp statements."],
].map(([q, a], i) => ({ id: `f${i}`, q_en: q, a_en: a }));

export const mockStories: RepairStory[] = [
  { id: "s1", device_label: "iPhone 13", problem: "Shattered display after a fall; Face ID still working.", replaced: "Display assembly", grade: "OEM", time_taken: "45 minutes", quote: "Watched the whole thing on the tracker. True Tone works perfectly.", customer_name: "Sana K.", before_url: null, after_url: null, video_url: null },
  { id: "s2", device_label: "Galaxy S22 Ultra", problem: "Green line across the OLED and bent mid-frame.", replaced: "Display + mid-frame", grade: "ORIG_NEW", time_taken: "1 day", quote: "They called before doing the frame — no surprise charges.", customer_name: "Fatima N.", before_url: null, after_url: null, video_url: null },
  { id: "s3", device_label: "Redmi Note 12", problem: "Phone stopped charging; port full of lint and corroded.", replaced: "Charging port flex", grade: "OEM", time_taken: "30 minutes", quote: "Fixed while I had chai downstairs.", customer_name: "Usman T.", before_url: null, after_url: null, video_url: null },
];

export const mockThemes: Theme[] = [
  { key: "midnight-lab", name: "Midnight Lab", is_dark: true, is_active: true, tokens: { bg: "#07080B", "surface-1": "#0E1015", "surface-2": "#151821", line: "#232733", ink: "#EEF0F3", "ink-2": "#B7BDC7", "ink-3": "#8A919C", accent: "#22D3EE", "accent-ink": "#04181C", trust: "#34D399", warn: "#FBBF24", danger: "#F87171" } },
  { key: "midnight-gold", name: "Midnight Gold", is_dark: true, is_active: false, tokens: { bg: "#09080A", "surface-1": "#121014", "surface-2": "#1A171C", line: "#2A262D", ink: "#F2EFEA", "ink-2": "#C4BDB2", "ink-3": "#948C80", accent: "#F5C04E", "accent-ink": "#1E1606", trust: "#34D399", warn: "#FB923C", danger: "#F87171" } },
  { key: "graphite-green", name: "Graphite Green", is_dark: true, is_active: false, tokens: { bg: "#0A0C0B", "surface-1": "#111513", "surface-2": "#181D1A", line: "#26302B", ink: "#ECF1EE", "ink-2": "#B5C2BB", "ink-3": "#86948C", accent: "#4ADE80", "accent-ink": "#05170C", trust: "#22D3EE", warn: "#FBBF24", danger: "#F87171" } },
  { key: "deep-navy", name: "Deep Navy", is_dark: true, is_active: false, tokens: { bg: "#060A14", "surface-1": "#0C1220", "surface-2": "#121A2C", line: "#1F2A40", ink: "#EAF0FA", "ink-2": "#B0BCD2", "ink-3": "#8290A8", accent: "#60A5FA", "accent-ink": "#06142A", trust: "#34D399", warn: "#FBBF24", danger: "#F87171" } },
  { key: "carbon-red", name: "Carbon Red", is_dark: true, is_active: false, tokens: { bg: "#0B0909", "surface-1": "#141010", "surface-2": "#1C1616", line: "#2E2424", ink: "#F3EDED", "ink-2": "#C9B9B9", "ink-3": "#9A8A8A", accent: "#F43F5E", "accent-ink": "#FFFFFF", trust: "#34D399", warn: "#FBBF24", danger: "#FB7185" } },
  { key: "daylight", name: "Daylight", is_dark: false, is_active: false, tokens: { bg: "#F7F8FA", "surface-1": "#FFFFFF", "surface-2": "#EEF1F5", line: "#DDE2EA", ink: "#0C1118", "ink-2": "#3C4655", "ink-3": "#5F6B7B", accent: "#0E7490", "accent-ink": "#FFFFFF", trust: "#047857", warn: "#B45309", danger: "#B91C1C" } },
  { key: "eid-emerald", name: "Eid Emerald", is_dark: true, is_active: false, tokens: { bg: "#04100C", "surface-1": "#0A1A14", "surface-2": "#10241C", line: "#1C3A2E", ink: "#EEF7F2", "ink-2": "#B6CFC2", "ink-3": "#87A496", accent: "#E8C766", "accent-ink": "#1A1404", trust: "#34D399", warn: "#FBBF24", danger: "#F87171" } },
];

/** Default homepage — identical to the seeded CMS content (§4.6 order). */
export const defaultHomeSections: Section[] = [
  { id: "hero", type: "hero", data: {
    eyebrow: "Sarena Mobile Mall · Since 2003",
    headline_en: "The inside of your phone, done right.",
    headline_ur: "آپ کے فون کا اندرونی حصہ، درست طریقے سے۔",
    sub_en: "Genuine and graded parts that fit your exact model, repairs you can track live, and a warranty that lives on your phone number.",
    primary_cta: { label_en: "Shop parts that fit", href: "/shop" },
    secondary_cta: { label_en: "See our repairs", href: "#portfolio" },
    trust: [{ value: "22 yrs", label_en: "at Sarena Mobile Mall" }, { value: "Genuine Proof", label_en: "on every graded part" }, { value: "Live", label_en: "repair tracking" }],
  } },
  { id: "ps", type: "problem_solution", data: {
    title_en: "The mobile market has four problems. We fixed each one.",
    items: [
      { problem_en: "“Original” parts that aren't", solution_en: "Genuine Proof™ — every part graded; high-value parts carry a scannable authenticity code.", icon: "shield-check" },
      { problem_en: "Parts that don't fit your model", solution_en: "Fit Finder — set your phone once and the whole store shows only what fits.", icon: "smartphone" },
      { problem_en: "Warranty on a paper slip you'll lose", solution_en: "Warranty Wallet — every warranty lives under your phone number. Claim in two taps.", icon: "wallet" },
      { problem_en: "No price until you visit", solution_en: "Instant Repair Quote — model + problem = price per grade, time and warranty.", icon: "zap" },
    ],
  } },
  { id: "cats", type: "category_grid", data: { title_en: "Shop by part", subtitle_en: "Every part graded. Every grade explained." } },
  { id: "picks", type: "product_row", data: { title_en: "Picked for your phone", subtitle_en: "Set your device above and this row reshapes around it." } },
  { id: "quote", type: "repair_quote", data: { title_en: "Instant repair quote", subtitle_en: "Tap where it hurts. Prices per grade, no shop visit needed." } },
  { id: "stories", type: "case_studies", data: { title_en: "Repair stories", subtitle_en: "Real devices from our bench, with the customer's permission." } },
  { id: "testimonials", type: "testimonials", data: { title_en: "What Karachi says", show_google: true } },
  { id: "portfolio", type: "portfolio", data: { title_en: "From the bench", subtitle_en: "Before and after, unfiltered.", show_reels: true } },
  { id: "proof", type: "genuine_proof", data: { title_en: "Genuine Proof™", subtitle_en: "Five grades. Fixed meanings. Scan any serialized part to verify it." } },
  { id: "why", type: "why_us", data: {
    title_en: "Why StarTech",
    points: [
      { title_en: "22 years, same mall", body_en: "We've been at Sarena Mobile Mall since 2003. We'll be here when you need the warranty." },
      { title_en: "We show the grade", body_en: "Original, pulled, OEM, premium or standard — written on the invoice and the QR code." },
      { title_en: "Technicians buy from us", body_en: "Karachi repair shops stock their benches with our parts." },
    ],
    comparison: { columns: ["StarTech", "Typical mall stall", "Online marketplace"], rows: [
      ["Part grade disclosed", "Yes, on invoice + QR", "Rarely", "Unclear"],
      ["Fits-your-model check", "Fit Finder", "Ask the seller", "No"],
      ["Digital warranty", "Yes, on your number", "Paper slip", "Varies"],
      ["Repair tracking", "Live, with photos", "Call and ask", "—"],
      ["Price before visiting", "Instant quote", "No", "Parts only"],
    ] },
  } },
  { id: "pro", type: "technician_pro", data: { title_en: "Technician Pro", body_en: "Run a repair shop? Get trade pricing, a credit line with a digital khata, WhatsApp statements and quick reorder.", cta: { label_en: "Apply for a trade account", href: "/trade/apply" } } },
  { id: "faq", type: "faq", data: { title_en: "Questions, answered" } },
  { id: "cta", type: "final_cta", data: { title_en: "Bring it in, or let us come to you.", body_en: "iPhone and Android repairs, screen replacements and complex hardware faults like Wi-Fi IC repair. Book a repair, shop parts, or just ask on WhatsApp — we reply fast." } },
];
