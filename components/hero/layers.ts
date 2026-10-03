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
