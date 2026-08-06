export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        aria-hidden
        className="grid h-7 w-7 place-items-center rounded-[9px] bg-volt text-[15px] font-black text-ink"
        style={{ letterSpacing: "-0.06em" }}
      >
        K
      </span>
      <span className="text-[17px] font-semibold tracking-[-0.02em]">
        Kaptra
      </span>
    </span>
  );
}
