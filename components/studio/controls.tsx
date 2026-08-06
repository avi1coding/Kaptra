"use client";

import type { ReactNode } from "react";

export function Panel({
  title,
  action,
  children,
  className = "",
  tourId,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** marks this panel as a stop on the Studio tour */
  tourId?: string;
}) {
  return (
    <section
      data-tour={tourId}
      className={`rounded-2xl border border-line bg-ink-2 ${className}`}
    >
      {title ? (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            {title}
          </h2>
          {action}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="py-2.5">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-chalk">{label}</span>
        {hint ? (
          <span className="font-mono text-[11px] text-muted">{hint}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-line bg-ink p-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-md px-2 py-1.5 text-[12.5px] font-medium transition-colors ${
            option.value === value
              ? "bg-chalk text-ink"
              : "text-muted hover:text-chalk"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

export function ColorInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2.5 rounded-lg border border-line bg-ink px-2.5 py-2 transition-colors hover:border-muted/40">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-6 shrink-0"
        aria-label={label}
      />
      <span className="min-w-0 flex-1 truncate text-[12px] text-muted">
        {label}
      </span>
      <span className="font-mono text-[10.5px] uppercase text-muted/70">
        {value}
      </span>
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-ink px-3 py-2.5 text-left transition-colors hover:border-muted/40"
    >
      <span className="text-[13px] text-chalk">{label}</span>
      <span
        className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors ${
          checked ? "bg-volt" : "bg-line"
        }`}
      >
        <span
          className={`absolute top-[3px] h-4 w-4 rounded-full bg-ink transition-transform ${
            checked ? "translate-x-[19px]" : "translate-x-[3px]"
          }`}
        />
      </span>
    </button>
  );
}
