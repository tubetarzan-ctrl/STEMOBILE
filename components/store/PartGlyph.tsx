// Line illustrations for parts (used until real product photos are uploaded).
export function PartGlyph({ kind, className }: { kind: string; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (kind) {
    case "displays":
    case "screen-protectors":
      return (
        <svg viewBox="0 0 100 100" className={className} aria-hidden>
          <rect x="28" y="8" width="44" height="84" rx="8" {...common} />
          <rect x="32" y="14" width="36" height="72" rx="4" {...common} opacity=".5" />
          <path d="M44 11h12" {...common} />
          <path d="M36 30l28-10M36 46l28-10M36 62l28-10" {...common} opacity=".25" />
        </svg>
      );
    case "batteries":
      return (
        <svg viewBox="0 0 100 100" className={className} aria-hidden>
          <rect x="30" y="14" width="40" height="72" rx="6" {...common} />
          <path d="M44 10h12" {...common} />
          <path d="M52 34l-8 16h12l-8 16" {...common} />
        </svg>
      );
    case "charging-ports":
    case "cables":
      return (
        <svg viewBox="0 0 100 100" className={className} aria-hidden>
          <rect x="34" y="18" width="32" height="18" rx="5" {...common} />
          <path d="M42 26h16M50 36v18c0 10-8 12-8 22v8" {...common} />
          <rect x="22" y="60" width="56" height="10" rx="3" {...common} opacity=".5" />
        </svg>
      );
    case "back-glass":
    case "cases":
      return (
        <svg viewBox="0 0 100 100" className={className} aria-hidden>
          <rect x="28" y="8" width="44" height="84" rx="10" {...common} />
          <rect x="34" y="14" width="18" height="18" rx="5" {...common} />
          <circle cx="40" cy="20" r="3" {...common} />
          <circle cx="47" cy="27" r="3" {...common} />
        </svg>
      );
    case "cameras":
      return (
        <svg viewBox="0 0 100 100" className={className} aria-hidden>
          <circle cx="50" cy="50" r="22" {...common} />
          <circle cx="50" cy="50" r="12" {...common} />
          <circle cx="50" cy="50" r="4" {...common} />
        </svg>
      );
    case "chargers":
    case "power-banks":
      return (
        <svg viewBox="0 0 100 100" className={className} aria-hidden>
          <rect x="30" y="30" width="40" height="44" rx="8" {...common} />
          <path d="M42 30V16M58 30V16M50 44l-6 10h12l-6 10" {...common} />
        </svg>
      );
    case "audio":
      return (
        <svg viewBox="0 0 100 100" className={className} aria-hidden>
          <path d="M26 58v-8a24 24 0 0 1 48 0v8" {...common} />
          <rect x="22" y="56" width="12" height="22" rx="5" {...common} />
          <rect x="66" y="56" width="12" height="22" rx="5" {...common} />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 100 100" className={className} aria-hidden>
          <path d="M30 70l26-26M56 44l8-8 10 10-8 8z" {...common} />
          <path d="M24 76l6-6" {...common} />
          <circle cx="68" cy="30" r="10" {...common} opacity=".5" />
        </svg>
      );
  }
}
