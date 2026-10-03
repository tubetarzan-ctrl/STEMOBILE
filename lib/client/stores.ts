"use client";
import { useSyncExternalStore } from "react";

// --- tiny external store helper ------------------------------------------------
function createStore<T>(key: string, initial: T, persist: (v: T) => void, load: () => T) {
  let value: T | null = null;
  const listeners = new Set<() => void>();
  const get = () => {
    if (value === null) value = typeof window === "undefined" ? initial : load();
    return value;
  };
  const set = (next: T) => {
    value = next;
    persist(next);
    listeners.forEach((l) => l());
  };
  const subscribe = (l: () => void) => {
    listeners.add(l);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) { value = load(); l(); }
    };
    window.addEventListener("storage", onStorage);
    return () => { listeners.delete(l); window.removeEventListener("storage", onStorage); };
  };
  return { get, set, subscribe, initial };
}

// --- Fit Finder device (cookie so Server Components can read it) ---------------
export type ActiveDevice = { id: string; name: string } | null;
const DEVICE_COOKIE = "st_device";

function readDeviceCookie(): ActiveDevice {
  const m = document.cookie.match(/(?:^|; )st_device=([^;]*)/);
  if (!m) return null;
  try { return JSON.parse(decodeURIComponent(m[1])); } catch { return null; }
}
const deviceStore = createStore<ActiveDevice>(DEVICE_COOKIE, null, (v) => {
  document.cookie = v
    ? `${DEVICE_COOKIE}=${encodeURIComponent(JSON.stringify(v))}; path=/; max-age=31536000; samesite=lax`
    : `${DEVICE_COOKIE}=; path=/; max-age=0`;
}, readDeviceCookie);

export function useDevice() {
  const device = useSyncExternalStore(deviceStore.subscribe, deviceStore.get, () => null);
  return [device, deviceStore.set] as const;
}

// --- Cart (localStorage). Prices here are display-only; the server reprices. ---
export type CartLine = { variantId: string; productSlug: string; name: string; sku: string; grade: string; price: number; qty: number };
const CART_KEY = "st_cart_v1";
const EMPTY: CartLine[] = [];
const cartStore = createStore<CartLine[]>(CART_KEY, EMPTY, (v) => {
  try { localStorage.setItem(CART_KEY, JSON.stringify(v)); } catch { /* private mode */ }
}, () => {
  try { return JSON.parse(localStorage.getItem(CART_KEY) ?? "[]"); } catch { return EMPTY; }
});

export function useCart() {
  const lines = useSyncExternalStore(cartStore.subscribe, cartStore.get, () => EMPTY);
  const add = (line: Omit<CartLine, "qty">, qty = 1) => {
    const cur = cartStore.get();
    const found = cur.find((l) => l.variantId === line.variantId);
    cartStore.set(found ? cur.map((l) => (l.variantId === line.variantId ? { ...l, qty: Math.min(l.qty + qty, 20) } : l)) : [...cur, { ...line, qty }]);
  };
  const setQty = (variantId: string, qty: number) =>
    cartStore.set(qty <= 0 ? cartStore.get().filter((l) => l.variantId !== variantId) : cartStore.get().map((l) => (l.variantId === variantId ? { ...l, qty } : l)));
  const clear = () => cartStore.set([]);
  const count = lines.reduce((a, l) => a + l.qty, 0);
  const subtotal = lines.reduce((a, l) => a + l.qty * l.price, 0);
  return { lines, add, setQty, clear, count, subtotal };
}
