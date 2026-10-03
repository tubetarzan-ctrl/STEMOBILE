// Genuine Proof grades (§5.3): labels configurable, meanings fixed.
export type Grade = "ORIG_NEW" | "ORIG_PULL" | "OEM" | "PREMIUM" | "STANDARD" | "NA";

export const GRADES: Record<Exclude<Grade, "NA">, { label: string; labelUr: string; meaning: string; rank: number; tone: string }> = {
  ORIG_NEW: { label: "Original (New)", labelUr: "اوریجنل (نیا)", meaning: "Manufacturer part, new", rank: 1, tone: "var(--trust)" },
  ORIG_PULL: { label: "Original (Pulled)", labelUr: "اوریجنل (نکالا ہوا)", meaning: "Manufacturer part removed from another device, tested", rank: 2, tone: "var(--trust)" },
  OEM: { label: "OEM Grade", labelUr: "او ای ایم", meaning: "Made to manufacturer spec by a third party", rank: 3, tone: "var(--accent)" },
  PREMIUM: { label: "Premium Copy", labelUr: "پریمیم کاپی", meaning: "High-quality aftermarket", rank: 4, tone: "var(--warn)" },
  STANDARD: { label: "Standard Copy", labelUr: "اسٹینڈرڈ کاپی", meaning: "Budget aftermarket", rank: 5, tone: "var(--ink-3)" },
};

export function gradeLabel(g: Grade | string | null | undefined): string {
  if (!g || g === "NA") return "";
  return GRADES[g as Exclude<Grade, "NA">]?.label ?? String(g);
}

export const ISSUES = [
  { key: "screen", label: "Screen", icon: "smartphone" },
  { key: "battery", label: "Battery", icon: "battery" },
  { key: "charging_port", label: "Charging port", icon: "plug" },
  { key: "camera", label: "Camera", icon: "camera" },
  { key: "back_glass", label: "Back glass", icon: "square" },
  { key: "speaker", label: "Speaker", icon: "volume" },
] as const;
export type IssueKey = (typeof ISSUES)[number]["key"];
