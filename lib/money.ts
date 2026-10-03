// Money is integer paisa everywhere. Format only at the UI edge.

const fmt = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });
const fmt2 = new Intl.NumberFormat("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 125000 -> "Rs 1,250" (drops paisa when whole). */
export function formatPKR(paisa: number | bigint | null | undefined, opts: { decimals?: boolean } = {}): string {
  if (paisa === null || paisa === undefined) return "—";
  const n = Number(paisa);
  const rupees = n / 100;
  const neg = rupees < 0 ? "−" : "";
  const abs = Math.abs(rupees);
  const body = opts.decimals || !Number.isInteger(abs) ? fmt2.format(abs) : fmt.format(abs);
  return `${neg}Rs ${body}`;
}

/** Compact for dashboards: 1250000000 -> "Rs 1.25 Cr", 15000000 -> "Rs 1.5 L". */
export function formatPKRCompact(paisa: number | bigint): string {
  const r = Number(paisa) / 100;
  const abs = Math.abs(r);
  const sign = r < 0 ? "−" : "";
  if (abs >= 1e7) return `${sign}Rs ${(abs / 1e7).toFixed(2).replace(/\.?0+$/, "")} Cr`;
  if (abs >= 1e5) return `${sign}Rs ${(abs / 1e5).toFixed(1).replace(/\.0$/, "")} L`;
  if (abs >= 1e3) return `${sign}Rs ${(abs / 1e3).toFixed(1).replace(/\.0$/, "")}k`;
  return `${sign}Rs ${fmt.format(abs)}`;
}

/** Parse user input "1,250.50" (rupees) -> 125050 paisa. Returns null if invalid. */
export function rupeesToPaisa(input: string | number): number | null {
  const s = String(input).replace(/[,\s]|rs\.?/gi, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.replace("-", "").split(".");
  const v = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return s.startsWith("-") ? -v : v;
}

/** Allocate `total` paisa across weights with exact sum (largest remainder). */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum === 0) return weights.map((_, i) => (i === weights.length - 1 ? total : 0));
  const raw = weights.map((w) => (total * w) / sum);
  const floors = raw.map(Math.floor);
  let rem = total - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (rem <= 0) break;
    floors[i] += 1;
    rem -= 1;
  }
  return floors;
}
