/** The ▲▼ ticker mark. Same shapes as public/favicon.svg. */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect x="0.5" y="0.5" width="31" height="31" rx="7" fill="none" stroke="currentColor" strokeOpacity="0.25" />
      <path d="M5 21 10 11 15 21Z M17 11H27L22 21Z" fill="currentColor" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2 text-[17px] font-semibold tracking-tight">
      <LogoMark className="size-7 text-ink" />
      <span>
        isthemarket<span className="font-normal text-ink-3">cooked</span>
      </span>
    </span>
  );
}
