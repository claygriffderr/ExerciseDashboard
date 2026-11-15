export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight text-ink ${className}`}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className="h-7 w-7">
        <rect x="2" y="10" width="4" height="12" rx="1" className="fill-accent" />
        <rect x="7" y="7" width="4" height="18" rx="1" className="fill-accent" />
        <rect x="11" y="14.5" width="10" height="3" rx="1" className="fill-ink" />
        <rect x="21" y="7" width="4" height="18" rx="1" className="fill-accent" />
        <rect x="26" y="10" width="4" height="12" rx="1" className="fill-accent" />
      </svg>
      <span className="text-lg">Exercise Dashboard</span>
    </span>
  );
}
