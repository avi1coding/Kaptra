"use client";

import { useEffect, useRef, useState } from "react";

type Stat = {
  value: number;
  decimals?: number;
  suffix?: string;
  label: string;
};

/**
 * Every number here is derived from the code or from Whisper itself — no
 * invented market statistics. `languages` comes from faster-whisper's tokenizer
 * table, `formats` from lib/video-formats.ts, `precision` from the .ass
 * timestamp format, which is centisecond-resolution by specification.
 */
export function Stats({ formats, languages }: { formats: number; languages: number }) {
  const STATS: Stat[] = [
    {
      value: languages,
      label: "languages",
    },
    {
      value: 0.01,
      decimals: 2,
      suffix: "s",
      label: "timing resolution",
    },
    {
      value: formats,
      label: "video formats in",
    },
    {
      value: 3,
      label: "steps to posted",
    },
  ];

  const ref = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRun(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRun(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="grid grid-cols-2 border-y border-line lg:grid-cols-4"
    >
      {STATS.map((stat, i) => (
        <div
          key={stat.label}
          // Explicit per-cell borders: `divide-x` plus nth-child overrides
          // fought each other and dropped two of the three dividers.
          className={[
            "border-line px-5 py-8 sm:px-7",
            i % 2 === 1 ? "border-l" : "",
            i < 2 ? "border-b" : "",
            "lg:border-b-0",
            i > 0 ? "lg:border-l" : "lg:border-l-0",
          ].join(" ")}
          style={{
            opacity: run ? 1 : 0,
            transform: run ? "none" : "translateY(14px)",
            transition: `opacity .5s ease ${i * 80}ms, transform .5s ease ${i * 80}ms`,
          }}
        >
          <p className="text-[clamp(30px,4.5vw,44px)] font-black leading-none tracking-[-0.04em] tabular-nums">
            <Counter
              value={stat.value}
              decimals={stat.decimals ?? 0}
              run={run}
            />
            {stat.suffix ? (
              <span className="text-volt">{stat.suffix}</span>
            ) : null}
          </p>
          <p className="mt-2.5 text-[13px] font-medium uppercase tracking-[0.1em] text-volt">
            {stat.label}
          </p>
        </div>
      ))}
    </div>
  );
}

function Counter({
  value,
  decimals,
  run,
}: {
  value: number;
  decimals: number;
  run: boolean;
}) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!run) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }

    let frame = 0;
    let start: number | null = null;
    const DURATION = 900;

    const tick = (now: number) => {
      if (start === null) start = now;
      const t = Math.min(1, (now - start) / DURATION);
      // ease-out-cubic: fast off the mark, settles on the number
      setShown(value * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [run, value]);

  return <>{shown.toFixed(decimals)}</>;
}
