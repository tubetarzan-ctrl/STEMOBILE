// Free stock photos (Pexels/Pixabay) used as placeholders until the owner
// uploads real shop photos. Filled by `npm run stock:fetch`; see
// public/stock/CREDITS.md for photographers.
import manifest from "./stock-manifest.json";

type Entry = { src: string; alt: string; credit: string; source: string };
const M = manifest as Record<string, Entry>;

export function stockImage(key: string): Entry | null {
  return M[key] ?? null;
}
export function categoryImage(slug: string): Entry | null {
  return M[`cat-${slug}`] ?? null;
}
export const BENCH = [
  { key: "bench-1", label: "Screen swap at the bench" },
  { key: "bench-2", label: "Board-level diagnosis" },
  { key: "bench-3", label: "Micro-soldering" },
  { key: "bench-4", label: "Tools of the trade" },
].map((b) => ({ ...b, img: M[b.key] ?? null }));
export function storyImages(i: number): { before: Entry | null; after: Entry | null } {
  return { before: M[`story-before-${i + 1}`] ?? null, after: M[`story-after-${i + 1}`] ?? null };
}
