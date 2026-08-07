import type { ReactNode } from "react";

export function ShortFrame({
  children,
  overlay,
  className = "",
  aspect = 9 / 16,
  rounded = 26,
}: {
  children?: ReactNode;
  overlay?: ReactNode;
  className?: string;
  aspect?: number;
  rounded?: number;
}) {
  return (
    <div
      style={{ aspectRatio: aspect, borderRadius: rounded }}
      className={`relative w-full overflow-hidden border border-line bg-ink-2 shadow-[0_40px_120px_-40px_rgba(0,0,0,.9)] ${className}`}
    >
      {children}
      {overlay}
    </div>
  );
}

export function SyntheticFootage() {
  return (
    <div className="absolute inset-0" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_20%_15%,#3b2a6b_0%,transparent_55%),radial-gradient(90%_70%_at_85%_25%,#0d5c56_0%,transparent_60%),radial-gradient(120%_90%_at_50%_100%,#1b1b2e_0%,#08080b_70%)]" />
      <div
        className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      {/* Suggests a subject in frame without needing an actual asset. */}
      <div className="absolute left-1/2 top-[26%] h-[34%] w-[52%] -translate-x-1/2 rounded-full bg-white/[0.045] blur-2xl" />
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/60 to-transparent" />
    </div>
  );
}

export function ShortChrome({ progress = 0 }: { progress?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-medium text-white/70 backdrop-blur">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 9v6h4l5 4V5L8 9H4zm14.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" />
          <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2.2" fill="none" />
        </svg>
        Muted
      </div>
      <div className="absolute inset-x-4 bottom-3 h-[3px] overflow-hidden rounded-full bg-white/20">
        <div
          className="h-full rounded-full bg-white/85"
          style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
        />
      </div>
    </div>
  );
}
