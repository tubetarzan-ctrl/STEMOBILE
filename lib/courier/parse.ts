export type RemittanceLine = { trackingNo: string; codAmount: number; charge: number };

/** Parses "tracking,cod_amount_rs,charge_rs" CSV (header optional). */
export function parseSimpleRemittanceCsv(csv: string): RemittanceLine[] {
  return csv.split(/\r?\n/).map((l) => l.split(",").map((c) => c.trim().replace(/^"|"$/g, ""))).filter((c) => c.length >= 2 && /\d/.test(c[1] ?? ""))
    .map(([trackingNo, cod, charge]) => ({ trackingNo, codAmount: Math.round(Number(cod) * 100), charge: Math.round(Number(charge || 0) * 100) }));
}
