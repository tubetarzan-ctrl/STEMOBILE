import type { Grade } from "@/lib/grades";

export type Category = { id: string; name: string; name_ur?: string | null; slug: string; kind: "accessory" | "part" | "tool"; sort: number };
export type Brand = { id: string; name: string; slug: string };
export type Device = { id: string; brand_id: string; brand?: string; name: string; slug: string; model_numbers: string[]; release_year?: number | null };
export type Fit = "exact" | "check_version" | "no" | null;
export type StockStatus = "in" | "low" | "out";

export type Variant = {
  id: string;
  sku: string;
  grade: Grade;
  attributes: Record<string, string>;
  sale_price: number;
  warranty_days: number | null;
  stock: StockStatus;
  low_qty: number;
  fits: { device_id: string; confidence: Exclude<Fit, null> }[];
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: Category;
  brand?: string | null;
  warranty_days: number;
  images: { url: string; alt: string | null }[];
  variants: Variant[];
};

export type ProductCard = {
  id: string;
  name: string;
  slug: string;
  category_slug: string;
  category_kind: Category["kind"];
  from_price: number;
  grades: Grade[];
  stock: StockStatus;
  fit: Fit;
  image?: string | null;
};

export type Section = { id: string; type: string; data: Record<string, unknown> };
export type Faq = { id: string; q_en: string; q_ur?: string | null; a_en: string; a_ur?: string | null };
export type RepairQuoteRow = { grade: Grade; total: number; labour: number; part_price: number; est_minutes: number; warranty_days: number; in_stock: boolean };
export type Review = {
  id: string; rating: number; text: string | null; author_name: string; verified: boolean; owner_reply?: string | null;
  created_at: string; media: { type: "image" | "video"; url: string; poster?: string | null }[]; source: "onsite" | "google" | "admin";
};
export type RepairStory = {
  id: string; device_label: string; problem: string; replaced: string | null; grade: Grade | null; time_taken: string | null;
  quote: string | null; customer_name: string | null; before_url: string | null; after_url: string | null; video_url: string | null;
};
export type Theme = { key: string; name: string; tokens: Record<string, string>; is_dark: boolean; is_active: boolean };
export type BusinessSettings = {
  name: string; tagline: string; address: string; phone: string; whatsapp: string; email: string; hours: string; years: number; map_url: string;
};
export type HeroSettings = { mode: "3d" | "3d_video" | "video" | "image" | "offers"; media?: { url: string; poster?: string | null; source: string; external_id?: string | null } | null; settings: Record<string, unknown> };
