// Deterministic understanding of a customer's chat message — no AI involved.
// Extracts: phone model, part (category), grade, repair intent, and simple
// intents (greeting, thanks, shop info, tracking). Handles common Roman-Urdu
// spellings ("pannel", "bettery", "kitne ka", "asli").

import type { Grade } from "@/lib/grades";

export type DeviceLite = { id: string; name: string; brand?: string | null; model_numbers: string[] };
export type DeviceMatch = { device?: DeviceLite; near?: string; suggestions?: DeviceLite[] };

/** lowercase, unify spacing, split "iphone15" → "iphone 15", strip punctuation. */
export function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/\b(ip|i)\s?(\d{1,2})\b/g, "iphone $2") // "ip 13", "i13" → iphone 13
    .replace(/iphone(\d)/g, "iphone $1")
    .replace(/[^a-z0-9؀-ۿ+\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PARTS: [RegExp, string][] = [
  [/\bpower\s*banks?\b/, "power-banks"],
  [/\bback\s*(glass|panel|plate)\b|\bbackglass\b/, "back-glass"],
  [/\b(charging|charge|charjing)\s*(port|flex|jack|strip|ic)?\b(?!\s*(cable|adapter))|\bport\b/, "charging-ports"],
  [/\b(lcd|oled|amoled|screen|scren|screan|display|panel|pannel|panal|touch|lcd panel)\b/, "displays"],
  [/\b(battery|batteries|bettery|battry|betri|betry|bateri)\b/, "batteries"],
  [/\b(camera|cam|lens)\b/, "cameras"],
  [/\b(case|cases|cover|pouch)\b/, "cases"],
  [/\b(tempered|protector|glass)\b/, "screen-protectors"],
  [/\b(charger|chargers|adapter|adaptor|chargr|charjer)\b/, "chargers"],
  [/\b(cable|cables|wire|data cable)\b/, "cables"],
  [/\b(earbuds|airpods|handsfree|hands free|earphones?|headphones?)\b/, "audio"],
  [/\b(tool|tools|screwdriver|heat gun|separator|adhesive|b7000|b-7000)\b/, "tools"],
];
/** Categories that fit every phone — no model needed. */
export const UNIVERSAL = new Set(["chargers", "cables", "audio", "power-banks", "tools"]);

const GRADES: [RegExp, Grade][] = [
  [/\b(pulled|pull|nikla|nikala|used original)\b/, "ORIG_PULL"],
  [/\b(original|orignal|orginal|orignl|origional|asli|genuine|og|apple original)\b/, "ORIG_NEW"],
  [/\boem\b/, "OEM"],
  [/\b(premium|copy|first copy|1st copy|high copy)\b/, "PREMIUM"],
  [/\b(standard|cheap|sasta|local|budget|low price)\b/, "STANDARD"],
];

export const REPAIR_ISSUE: Record<string, string> = {
  displays: "screen", batteries: "battery", "charging-ports": "charging_port", "back-glass": "back_glass", cameras: "camera",
};

export function detectPart(text: string): string | undefined {
  const t = norm(text);
  return PARTS.find(([re]) => re.test(t))?.[1];
}
export function detectGrade(text: string): Grade | undefined {
  const t = norm(text);
  return GRADES.find(([re]) => re.test(t))?.[1];
}
export function isRepairIntent(text: string): boolean {
  return /\b(repair|repairing|fix|fixing|replace|replacement|replacing|change|changing|lagwa|lagwana|lagana|theek|thik|kharab|broken|toot|tuta|tooti|cracked|crack|not working|dead|issue|problem|fitting)\b/.test(norm(text));
}
export function isGreeting(text: string): boolean {
  const t = norm(text);
  return t.split(" ").length <= 4 && /\b(hi|hello|hey|salam|salaam|aoa|assalam|assalamualaikum|asalam|slam|helo)\b/.test(t);
}
export function isThanks(text: string): boolean {
  return /\b(thanks|thank you|thx|shukriya|shukria|jazakallah|ok thanks)\b/.test(norm(text));
}
export function isShopInfo(text: string): boolean {
  return /\b(where|location|address|kahan|kidhar|timing|timings|time|open|opening|close|closing|closed|hours|sunday|directions|map|contact|visit|shop kab)\b/.test(norm(text));
}
export function wantsHuman(text: string): boolean {
  return /\b(human|person|agent|staff|call me|talk to|baat|representative|owner|manager|complaint|refund)\b/.test(norm(text));
}
export function orderRef(text: string): string | undefined {
  return text.toUpperCase().match(/\bST-?\d{3,}\b/)?.[0].replace(/^ST-?/, "ST-");
}
export function repairRef(text: string): string | undefined {
  return text.toUpperCase().match(/\b[0-9A-F]{10}\b/)?.[0];
}

const QUALIFIERS = new Set(["pro", "max", "plus", "ultra", "mini", "lite", "fe", "prime", "neo", "edge"]);

/**
 * Finds the phone model in the text. Exact model numbers win; otherwise the
 * longest model name that appears word-for-word. If the text names a variant we
 * don't list (e.g. "iPhone 15 Pro" when only "iPhone 15" and "iPhone 15 Pro Max"
 * exist) it returns `near` instead of guessing — accuracy over convenience.
 */
export function matchDevice(text: string, devices: DeviceLite[]): DeviceMatch {
  const tokens = norm(text).split(" ").filter(Boolean);
  const compact = new Set(tokens.map((t) => t.replace(/-/g, "")));
  const byModel = devices.find((d) => d.model_numbers.some((m) => compact.has(m.toLowerCase().replace(/-/g, ""))));
  if (byModel) return { device: byModel };

  let best: { d: DeviceLite; len: number } | undefined;
  let near: { label: string; base: DeviceLite } | undefined;
  for (const d of devices) {
    const full = norm(d.name).split(" ");
    const variants = [full];
    if (full[0] === "galaxy" && full.length > 1) variants.push(full.slice(1)); // "a54" alone
    if (d.brand && !full.includes(norm(d.brand))) variants.push([norm(d.brand), ...full]); // "oppo a78"
    for (const dt of variants) {
      if (dt.length === 1 && !/[a-z]\d|\d[a-z]/.test(dt[0])) continue; // a bare "20" is not a model
      for (let i = 0; i + dt.length <= tokens.length; i++) {
        if (!dt.every((w, j) => tokens[i + j] === w)) continue;
        const extra: string[] = [];
        for (let k = i + dt.length; k < tokens.length && QUALIFIERS.has(tokens[k]) && !full.includes(tokens[k]); k++) extra.push(tokens[k]);
        if (extra.length) {
          const label = [...tokens.slice(i, i + dt.length), ...extra].join(" ");
          if (!near || label.length > near.label.length) near = { label, base: d };
          continue;
        }
        if (!best || dt.length > best.len) best = { d, len: dt.length };
      }
    }
  }
  if (best) {
    // a longer unmatched variant wins over a shorter exact match ("15 pro" must not become "15")
    if (near && near.label.split(" ").length > best.len && near.base.id === best.d.id) {
      return nearResult(near, devices);
    }
    return { device: best.d };
  }
  return near ? nearResult(near, devices) : {};
}

function nearResult(near: { label: string; base: DeviceLite }, devices: DeviceLite[]): DeviceMatch {
  const pretty = near.label.split(" ")
    .map((w) => (w === "iphone" ? "iPhone" : /\d/.test(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
  const baseTokens = norm(near.base.name).split(" ");
  const suggestions = devices.filter((d) => {
    const n = norm(d.name).split(" ");
    return baseTokens.every((w, i) => n[i] === w);
  }).slice(0, 4);
  return { near: pretty, suggestions };
}

/** Brand mentioned without a model, e.g. "samsung lcd price". */
export function detectBrand(text: string, devices: DeviceLite[]): string | undefined {
  const t = ` ${norm(text)} `;
  const brands = [...new Set(devices.map((d) => d.brand).filter(Boolean))] as string[];
  return brands.find((b) => t.includes(` ${norm(b)} `)) ?? (t.includes(" iphone ") ? "Apple" : undefined);
}
