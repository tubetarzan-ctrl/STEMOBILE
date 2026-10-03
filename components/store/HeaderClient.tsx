"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Languages, Moon, ShoppingBag, Sun } from "lucide-react";
import { useCart } from "@/lib/client/stores";

export function CartButton() {
  const { count } = useCart();
  return (
    <Link href="/cart" className="relative grid size-9 place-items-center rounded-xl border border-line hover:bg-surface-2 sm:size-10" aria-label={`Cart, ${count} items`}>
      <ShoppingBag className="size-[18px]" />
      {count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-ink tabular">
          {count}
        </span>
      )}
    </Link>
  );
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}

export function PrefsToggles({ lang, mode }: { lang: "en" | "ur"; mode: "light" | "dark" | "" }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className="grid size-9 place-items-center rounded-xl text-ink-2 hover:bg-surface-2 hover:text-ink sm:size-10"
        aria-label={lang === "ur" ? "Switch to English" : "اردو میں دیکھیں"}
        onClick={() => { setCookie("st_lang", lang === "ur" ? "en" : "ur"); router.refresh(); }}
      >
        <Languages className="size-[18px]" />
      </button>
      <button
        type="button"
        className="grid size-9 place-items-center rounded-xl text-ink-2 hover:bg-surface-2 hover:text-ink sm:size-10"
        aria-label={mode === "light" ? "Switch to dark theme" : "Switch to light theme"}
        onClick={() => { setCookie("st_mode", mode === "light" ? "dark" : "light"); router.refresh(); }}
      >
        {mode === "light" ? <Moon className="size-[18px]" /> : <Sun className="size-[18px]" />}
      </button>
    </div>
  );
}
