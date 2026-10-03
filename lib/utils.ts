import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Pakistani mobile -> +92XXXXXXXXXX (mirrors public.normalize_phone). */
export function normalizePhone(p: string): string {
  const x = (p || "").replace(/[^0-9+]/g, "");
  if (/^03\d{9}$/.test(x)) return "+92" + x.slice(1);
  if (/^92\d{10}$/.test(x)) return "+" + x;
  if (/^3\d{9}$/.test(x)) return "+92" + x;
  return x;
}

/** +923322142141 -> "+92 332 2142141" (display only). */
export function formatPhonePK(p: string): string {
  const n = normalizePhone(p);
  return /^\+92\d{10}$/.test(n) ? `+92 ${n.slice(3, 6)} ${n.slice(6)}` : p;
}

export function isValidPKMobile(p: string): boolean {
  return /^\+923\d{9}$/.test(normalizePhone(p));
}

export function uuid(): string {
  return crypto.randomUUID();
}

export function whatsappLink(phone: string, text?: string): string {
  const num = normalizePhone(phone).replace("+", "");
  return `https://wa.me/${num}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
