"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STEPS = [
  {
    n: "01",
    title: "Your clip",
    note: "Drop a clip or choose a file.",
    visual: <UploadVisual />,
  },
  {
    n: "02",
    title: "Captions",
    note: "With a click of a button, automatic synced captions.",
    visual: <StyleVisual />,
  },
  {
    n: "03",
    title: "Upload",
    note: "Straight to YouTube.",
    visual: <PublishVisual />,
  },
];

export function HowItWorks() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const stride = () => {
    const track = trackRef.current;
    const first = track?.firstElementChild as HTMLElement | null;
    if (!track || !first) return 0;
    const second = first.nextElementSibling as HTMLElement | null;
    return second ? second.offsetLeft - first.offsetLeft : first.offsetWidth;
  };

  const onScroll = useCallback(() => {
    const track = trackRef.current;
    const step = stride();
    if (!track || !step) return;

    const atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
    setIndex(atEnd ? STEPS.length - 1 : Math.round(track.scrollLeft / step));
  }, []);

  const startSwipe = (event: React.PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (!track || event.pointerType === "touch") return;
    const startX = event.clientX;
    const startLeft = track.scrollLeft;
    let moved = false;

    const move = (e: PointerEvent) => {
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 3) moved = true;
      track.style.scrollSnapType = "none";
      track.scrollLeft = startLeft - dx;
    };

    const end = () => {
      track.style.scrollSnapType = "";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      if (moved) goTo(Math.round(track.scrollLeft / (stride() || 1)));
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  const goTo = (i: number) => {
    const track = trackRef.current;
    const step = stride();
    if (!track || !step) return;
    const clamped = Math.max(0, Math.min(STEPS.length - 1, i));
    track.scrollTo({ left: clamped * step, behavior: "smooth" });
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  return (
    <div className="mt-10">
      <div className="relative">
        <div
          ref={trackRef}
          tabIndex={0}
          role="group"
          aria-label="How Kaptra works, step by step"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              e.preventDefault();
              goTo(index + 1);
            }
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              goTo(index - 1);
            }
          }}
          onPointerDown={startSwipe}
          className="no-scrollbar flex cursor-grab snap-x snap-mandatory gap-4 overflow-x-auto pb-2 outline-none active:cursor-grabbing"
        >
          {STEPS.map((step) => (
            <article
              key={step.n}
              className="w-[86%] shrink-0 snap-start overflow-hidden rounded-2xl border border-line bg-ink-2 sm:w-[60%] lg:w-[46%]"
            >
              <div className="grid h-[280px] place-items-center border-b border-line bg-ink p-6">
                {step.visual}
              </div>
              <div className="p-5">
                <span className="font-mono text-[11px] text-volt">{step.n}</span>
                <h3 className="mt-1 text-[17px] font-semibold tracking-[-0.02em]">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-[13.5px] leading-snug text-muted">
                  {step.note}
                </p>
              </div>
            </article>
          ))}
        </div>

        <Arrow side="left" disabled={index === 0} onClick={() => goTo(index - 1)} />
        <Arrow
          side="right"
          disabled={index >= STEPS.length - 1}
          onClick={() => goTo(index + 1)}
        />
      </div>

      <div className="mt-5 flex items-center justify-center gap-2">
        {STEPS.map((step, i) => (
          <button
            key={step.n}
            onClick={() => goTo(i)}
            aria-label={`Step ${step.n}: ${step.title}`}
            aria-current={i === index}
            className="grid h-9 place-items-center px-1.5"
          >
            <span
              className={`block h-1.5 rounded-full transition-all ${
                i === index ? "w-6 bg-volt" : "w-1.5 bg-line hover:bg-muted"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function Arrow({
  side,
  disabled,
  onClick,
}: {
  side: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Previous step" : "Next step"}
      className={`absolute top-[140px] hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-line bg-ink-2/90 text-chalk backdrop-blur transition-opacity sm:grid ${
        side === "left" ? "-left-4" : "-right-4"
      } ${disabled ? "pointer-events-none opacity-0" : "opacity-100 hover:border-muted/60"}`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={side === "left" ? { transform: "scaleX(-1)" } : undefined}
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  );
}

const LOOKS = [
  { label: "Punch", cls: "bg-volt text-ink", plain: "text-chalk" },
  { label: "Neon", cls: "bg-[#FF4D6D] text-white", plain: "text-chalk" },
  { label: "Clean", cls: "text-volt", plain: "text-chalk" },
];

function StyleVisual() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      {LOOKS.map((look) => (
        <div key={look.label} className="flex items-center gap-3">
          <span className="w-12 shrink-0 text-right text-[10.5px] text-muted">
            {look.label}
          </span>
          <span className="flex items-center gap-1.5 rounded-lg border border-line bg-ink px-2.5 py-1.5 text-[12px] font-black tracking-tight">
            <span className={look.plain}>FOUR SCORE AND</span>
            <span className={`rounded px-1 ${look.cls}`}>SEVEN</span>
            <span className={look.plain}>YEARS AGO</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function PublishVisual() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <svg width="46" height="33" viewBox="0 0 24 17" aria-hidden>
        <path
          d="M23.5 2.7A3 3 0 0 0 21.4.6C19.5 0 12 0 12 0S4.5 0 2.6.6A3 3 0 0 0 .5 2.7 31 31 0 0 0 0 8.5c0 2 .2 4 .5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.3-1.9.5-3.8.5-5.8s-.2-4-.5-5.8z"
          fill="#FF0033"
        />
        <path d="M9.6 12.1V4.9l6.3 3.6-6.3 3.6z" fill="#fff" />
      </svg>
      <div className="w-full max-w-[190px] space-y-1.5">
        <div className="h-2 rounded-full bg-chalk/70" />
        <div className="h-2 w-4/5 rounded-full bg-line" />
        <div className="flex gap-1.5 pt-1">
          <span className="h-4 w-12 rounded bg-line" />
          <span className="h-4 w-10 rounded bg-line" />
          <span className="h-4 w-14 rounded bg-line" />
        </div>
      </div>
    </div>
  );
}

function UploadVisual() {
  return (
    <div className="w-full max-w-[240px]">
      <div className="flex flex-col items-center rounded-xl border border-dashed border-line px-5 py-7 text-center">
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-volt"
        >
          <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
          <path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" />
        </svg>
        <p className="mt-2.5 text-[13px] font-medium">Drop a clip</p>
        <p className="mt-1 font-mono text-[10.5px] text-muted">
          MP4 · MOV · MKV · AVI
        </p>
      </div>
      <div className="mt-3 flex items-center gap-3 rounded-lg border border-line bg-ink-2 p-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-line text-[9.5px] font-bold">
          MP4
        </span>
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-medium">my-short.mp4</p>
          <p className="mt-0.5 font-mono text-[10.5px] text-muted">
            0:28 · 1080×1920
          </p>
        </div>
      </div>
    </div>
  );
}
