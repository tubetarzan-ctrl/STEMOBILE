"use client";
// Remembers this browser's orders/repairs so a returning customer sees them
// on /track without logging in. Purely a convenience — the phone-number lookup
// is the real way back in.
const KEY = "st_my_tracking";
export type Saved = { no: string; url: string; kind: "order" | "repair"; at: string };

export function loadTracking(): Saved[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Saved[]; } catch { return []; }
}
export function saveTracking(item: Omit<Saved, "at">) {
  try {
    const list = loadTracking().filter((x) => x.no !== item.no);
    localStorage.setItem(KEY, JSON.stringify([{ ...item, at: new Date().toISOString() }, ...list].slice(0, 10)));
  } catch { /* storage blocked */ }
}
