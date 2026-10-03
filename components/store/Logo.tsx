export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <rect x="9" y="3" width="14" height="26" rx="3.5" fill="none" stroke="var(--ink)" strokeWidth="1.6" />
        <rect x="6" y="9" width="14" height="20" rx="3" fill="none" stroke="var(--accent)" strokeWidth="1.6" opacity=".9" />
        <circle cx="16" cy="6.5" r="1" fill="var(--accent)" />
      </svg>
      {!compact && (
        <span className="leading-none">
          <span className="block font-display text-[1.05rem] font-bold tracking-[-0.03em]">StarTech</span>
          <span className="block font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-3"><span className="hidden min-[400px]:inline">Electronics · </span>Since 2003</span>
        </span>
      )}
    </span>
  );
}
