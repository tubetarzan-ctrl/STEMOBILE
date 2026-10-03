// The five layers of the StarTech phone, top (screen) to bottom (back).
// `z` is the exploded offset multiplier; labels link to the matching category.
export const LAYERS = [
  { key: "display", label: "Display", href: "/shop?category=displays", category: "displays", z: 2, color: "#0b0d12" },
  { key: "frame", label: "Mid-frame", href: "/shop?category=back-glass", category: "back-glass", z: 1, color: "#9aa3ad" },
  { key: "board", label: "Logic board", href: "/repair", category: "charging-ports", z: 0, color: "#0f3b2e" },
  { key: "battery", label: "Battery", href: "/shop?category=batteries", category: "batteries", z: -1, color: "#20242c" },
  { key: "back", label: "Back glass", href: "/shop?category=back-glass", category: "back-glass", z: -2, color: "#1b2a33" },
] as const;

export type HeroMode = "auto" | "exploded" | "assembled";
export type LayerCounts = Partial<Record<string, number>>;

// Flagship phone finishes (iPhone 17 Pro Max–style colours).
export const PHONE_COLORS = {
  "cosmic-orange": { label: "Cosmic Orange", body: "#D9692B", plateau: "#E07734", frame: "#C9612A" },
  "deep-blue": { label: "Deep Blue", body: "#2B3A55", plateau: "#33456A", frame: "#24324A" },
  silver: { label: "Silver", body: "#D7D9DC", plateau: "#E3E5E8", frame: "#BFC3C8" },
} as const;
export type PhoneColor = keyof typeof PHONE_COLORS;
