// Downloads free stock photos (Pexels first, Pixabay as fallback) for every
// image slot on the storefront, converts them to compressed WebP in
// /public/stock, and writes lib/data/stock-manifest.json (+ CREDITS.md).
//   npm run stock:fetch            → fill missing slots
//   npm run stock:fetch -- --force → re-download everything
// Both licences allow free commercial use. Photos are placeholders: the owner
// replaces them with real shop photos from the admin panel.
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const env = Object.fromEntries((existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "").split(/\r?\n/)
  .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^"|"$/g, "")]));
const PEXELS = process.env.PEXELS_API_KEY || env.PEXELS_API_KEY;
const PIXABAY = process.env.PIXABAY_API_KEY || env.PIXABAY_API_KEY;
if (!PEXELS && !PIXABAY) { console.error("Set PEXELS_API_KEY or PIXABAY_API_KEY in .env.local"); process.exit(1); }
const force = process.argv.includes("--force");

// slot → search terms (first result that isn't already used wins) and output size
const TILE = [960, 720], TALL = [800, 1000], SQ = [800, 800], WIDE = [1600, 700];
const SLOTS = {
  "cat-displays": [["cracked phone screen", "smartphone screen repair"], TILE],
  "cat-batteries": [["phone battery", "smartphone battery replacement"], TILE],
  "cat-back-glass": [["back of smartphone camera", "smartphone rear camera"], TILE],
  "cat-charging-ports": [["usb c port smartphone", "phone charging port"], TILE],
  "cat-cameras": [["smartphone camera lens close up", "phone camera lens"], TILE],
  "cat-cases": [["phone case", "smartphone cover"], TILE],
  "cat-screen-protectors": [["screen protector smartphone", "tempered glass phone"], TILE],
  "cat-chargers": [["phone charger adapter", "usb charger"], TILE],
  "cat-cables": [["usb cable", "charging cable"], TILE],
  "cat-audio": [["wireless earbuds", "earphones"], TILE],
  "cat-power-banks": [["power bank", "portable charger"], TILE],
  "cat-tools": [["electronics repair tools", "precision screwdriver set"], TILE],
  "bench-1": [["phone repair technician", "smartphone repair"], TALL],
  "bench-2": [["smartphone disassembled", "phone parts repair"], TALL],
  "bench-3": [["soldering circuit board", "pcb soldering"], TALL],
  "bench-4": [["electronics repair workbench", "repair microscope electronics"], TALL],
  "story-before-1": [["shattered smartphone screen", "cracked iphone screen"], SQ],
  "story-after-1": [["iphone on table", "smartphone lock screen"], SQ],
  "story-before-2": [["cracked phone screen close up", "broken screen smartphone"], SQ],
  "story-after-2": [["new smartphone", "smartphone in hand"], SQ],
  "story-before-3": [["usb port close up", "phone charging port close up"], SQ],
  "story-after-3": [["smartphone charging on table", "phone plugged in charging"], SQ],
  "repair-hero": [["mobile phone repair shop", "phone repair workbench"], WIDE],
};

const outDir = "public/stock";
mkdirSync(outDir, { recursive: true });
const manifestPath = "lib/data/stock-manifest.json";
const manifest = existsSync(manifestPath) && !force ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
const used = new Set(Object.values(manifest).map((m) => m.id));
// --only=a,b re-picks just those slots (their current photos are excluded)
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",") ?? [];
for (const k of only) delete manifest[k];

async function pexels(q, orientation) {
  if (!PEXELS) return [];
  const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=15&orientation=${orientation}`, { headers: { Authorization: PEXELS } });
  if (!r.ok) { console.warn(`  pexels ${r.status} for "${q}"`); return []; }
  return (await r.json()).photos.map((p) => ({ id: `pexels-${p.id}`, url: p.src.large2x, alt: p.alt || q, credit: p.photographer, creditUrl: p.url, source: "Pexels" }));
}
async function pixabay(q, orientation) {
  if (!PIXABAY) return [];
  const r = await fetch(`https://pixabay.com/api/?key=${PIXABAY}&q=${encodeURIComponent(q)}&image_type=photo&orientation=${orientation === "portrait" ? "vertical" : "horizontal"}&safesearch=true&per_page=15`);
  if (!r.ok) { console.warn(`  pixabay ${r.status} for "${q}"`); return []; }
  return (await r.json()).hits.map((h) => ({ id: `pixabay-${h.id}`, url: h.largeImageURL, alt: h.tags || q, credit: h.user, creditUrl: h.pageURL, source: "Pixabay" }));
}

for (const [key, [queries, [w, h]]] of Object.entries(SLOTS)) {
  const file = `${outDir}/${key}.webp`;
  if (only.length && !only.includes(key)) continue;
  if (!force && manifest[key] && existsSync(file)) { console.log(`skip ${key}`); continue; }
  const orientation = h > w ? "portrait" : w > h ? "landscape" : "square";
  let pick;
  for (const q of queries) {
    const candidates = [...await pexels(q, orientation), ...await pixabay(q, orientation)];
    pick = candidates.find((c) => !used.has(c.id));
    if (pick) break;
  }
  if (!pick) { console.warn(`MISS ${key}`); continue; }
  const img = Buffer.from(await (await fetch(pick.url)).arrayBuffer());
  await sharp(img).resize(w, h, { fit: "cover", position: "attention" }).webp({ quality: 74 }).toFile(file);
  used.add(pick.id);
  manifest[key] = { src: `/stock/${key}.webp`, id: pick.id, alt: pick.alt, credit: pick.credit, creditUrl: pick.creditUrl, source: pick.source };
  console.log(`ok   ${key}  ← ${pick.source} / ${pick.credit}`);
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
writeFileSync(`${outDir}/CREDITS.md`, "# Stock photo credits\n\nFree-to-use photos (Pexels / Pixabay licences). Replace with real shop photos any time.\n\n" +
  Object.entries(manifest).map(([k, m]) => `- \`${k}\`: ${m.alt} — ${m.credit} on ${m.source} (${m.creditUrl})`).join("\n") + "\n");
console.log(`\n${Object.keys(manifest).length}/${Object.keys(SLOTS).length} slots filled → ${manifestPath}`);
