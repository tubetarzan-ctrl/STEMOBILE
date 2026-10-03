// Answer-bank first (§5.16): FAQ + keyword answers are checked before any
// model call, so AI cost keeps falling as the owner adds FAQs.
export type BankEntry = { q: string; a: string; keywords?: string[] };

const STOP = new Set(["the", "a", "an", "is", "are", "do", "you", "i", "my", "ka", "ki", "ke", "hai", "kya", "how", "what", "can", "me", "to", "for", "of", "in", "on"]);

function tokens(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9؀-ۿ\s]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));
}

/** Returns the best FAQ answer when the overlap is convincing, else null. */
export function answerFromBank(question: string, bank: BankEntry[]): { answer: string; score: number } | null {
  const q = new Set(tokens(question));
  if (q.size === 0) return null;
  let best: { answer: string; score: number } | null = null;
  for (const e of bank) {
    const kw = (e.keywords ?? []).map((k) => k.toLowerCase());
    const kwHits = kw.filter((k) => question.toLowerCase().includes(k)).length;
    const qt = tokens(e.q);
    const overlap = qt.filter((w) => q.has(w)).length / Math.max(qt.length, 1);
    const score = overlap + kwHits * 0.35;
    if (!best || score > best.score) best = { answer: e.a, score };
  }
  return best && best.score >= 0.6 ? best : null;
}

/** Questions about price/stock/orders must hit live data, never the bank. */
export function needsLiveData(question: string): boolean {
  return /\b(price|kitne|kitna|rs|rupee|stock|available|order|track|status|quote|cost|qeemat|mil jaye)\b/i.test(question) || /\d{3,}/.test(question);
}
