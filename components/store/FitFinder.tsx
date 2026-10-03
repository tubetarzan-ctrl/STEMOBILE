"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Smartphone, X } from "lucide-react";
import { useDevice } from "@/lib/client/stores";
import type { Device } from "@/lib/data/types";
import { cn } from "@/lib/utils";

/** Score devices by name / model number (handles "SM-A546E", "a54", "iphone 13"). */
function match(devices: Device[], q: string): Device[] {
  const s = q.trim().toLowerCase();
  if (!s) return devices.slice(0, 8);
  const compact = s.replace(/[\s-]/g, "");
  return devices
    .map((d) => {
      const name = `${d.brand ?? ""} ${d.name}`.toLowerCase();
      let score = 0;
      if (d.model_numbers.some((m) => m.toLowerCase().replace(/[\s-]/g, "") === compact)) score = 100;
      else if (name.includes(s)) score = 60 - name.indexOf(s);
      else if (name.replace(/[\s-]/g, "").includes(compact)) score = 40;
      else if (s.split(/\s+/).every((w) => name.includes(w))) score = 30;
      return { d, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((x) => x.d);
}

/** Floating glass command bar: "What phone do you have?" */
export function FitFinder({ devices, variant = "hero" }: { devices: Device[]; variant?: "hero" | "inline" }) {
  const [device, setDevice] = useDevice();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [, start] = useTransition();
  const router = useRouter();
  const results = useMemo(() => match(devices, q), [devices, q]);
  const listRef = useRef<HTMLUListElement>(null);

  const choose = (d: Device) => {
    setDevice({ id: d.id, name: d.name });
    setQ("");
    setOpen(false);
    start(() => router.refresh());
  };

  return (
    <div className={cn("relative w-full", variant === "hero" ? "max-w-xl" : "max-w-md")}>
      <div
        className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3 backdrop-blur-xl"
        style={{ background: "color-mix(in srgb, var(--surface-1) 72%, transparent)" }}
      >
        <Smartphone className="size-5 shrink-0 text-accent" aria-hidden />
        <label htmlFor={`ff-${variant}`} className="sr-only">What phone do you have?</label>
        <input
          id={`ff-${variant}`}
          role="combobox"
          aria-expanded={open}
          aria-controls={`ff-list-${variant}`}
          aria-autocomplete="list"
          autoComplete="off"
          value={q}
          placeholder={device ? `Shopping for ${device.name} — change?` : "What phone do you have? e.g. Galaxy A54 or SM-A546E"}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            if (e.key === "Enter" && results[active]) { e.preventDefault(); choose(results[active]); }
            if (e.key === "Escape") setOpen(false);
          }}
          className="min-w-0 flex-1 bg-transparent text-[0.95rem] text-ink placeholder:text-ink-3 focus:outline-none"
        />
        <Search className="size-4 text-ink-3" aria-hidden />
      </div>
      {open && results.length > 0 && (
        <ul
          id={`ff-list-${variant}`}
          ref={listRef}
          role="listbox"
          className="absolute z-40 mt-2 max-h-80 w-full overflow-auto rounded-2xl border border-line bg-surface-1 p-1.5 shadow-2xl"
        >
          {results.map((d, i) => (
            <li key={d.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(d)}
                onMouseEnter={() => setActive(i)}
                className={cn("flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm", i === active && "bg-surface-2")}
              >
                <span><span className="text-ink-3">{d.brand} </span>{d.name}</span>
                <span className="font-mono text-xs text-ink-3">{d.model_numbers[0]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Slim "Shopping for: Galaxy A54 ✕" bar that follows on every page. */
export function DeviceBar() {
  const [device, setDevice] = useDevice();
  const router = useRouter();
  if (!device) return null;
  return (
    <div className="border-b border-line bg-surface-1/60">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-1.5 text-sm">
        <span className="size-1.5 rounded-full bg-trust pulse-dot" aria-hidden />
        <span className="text-ink-3">Shopping for:</span>
        <span className="font-medium">{device.name}</span>
        <button
          type="button"
          aria-label="Clear selected device"
          className="ml-1 rounded-md p-1 text-ink-3 hover:bg-surface-2 hover:text-ink"
          onClick={() => { setDevice(null); router.refresh(); }}
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
