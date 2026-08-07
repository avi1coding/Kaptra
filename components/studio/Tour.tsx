"use client";

import { useCallback, useEffect, useState } from "react";
import type { Step as StudioStep } from "./StepBar";

const SEEN_KEY = "kaptra.tour.v5";
export const TOUR_EVENT = "kaptra:tour";

type Step = {
  target: string | null;
  at?: StudioStep;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    target: "source",
    at: "captions",
    title: "Reads almost any video, in 100 languages",
    body: "MP4, MOV, MKV, AVI, WebM and 24 more, any shape, up to 200 MB. It understands 100 languages, and your captions can come out in a different one from the audio.",
  },
  {
    target: "transcript",
    at: "captions",
    title: "AI picks the words that matter",
    body: "AI automatically selects the words that hold the most value in a sentence, and chooses to highlight them. If you disagree, just click any word to highlight or unhighlight it.",
  },
  {
    target: "preview",
    at: "captions",
    title: "In sync automatically, and drag them anywhere",
    body: "Instead of spending hours delicately editing your own captions so they line up, Kaptra makes yours sync automatically — the most tedious part of the process, gone. You can also drag them anywhere on the screen, proving just how customisable it is.",
  },
  {
    target: "style",
    at: "captions",
    title: "Endless customisation",
    body: "Fonts, sizes, words per line, colours, shadow, and so much more. An endless amount of customisation for you to pick the one that matches your video perfectly.",
  },
  {
    target: "suggest",
    at: "captions",
    title: "Or let the AI style it for you",
    body: "Press one button and Kaptra looks at your footage, then suggests a caption style that suits it. Take it, change it, or ignore it.",
  },
  {
    target: "export",
    at: "captions",
    title: "Ready to upload",
    body: "Once you're ready, one click saves your newly captioned video and opens YouTube's uploader with it, so you can post it straight away.",
  },
];

const PAD = 10;
const CARD_W = 360;

export function Tour({
  currentStep,
  armed = true,
  onNavigate,
  onPreview,
}: {
  currentStep?: StudioStep;
  armed?: boolean;
  onNavigate?: (step: StudioStep) => void;
  onPreview?: (on: boolean) => void;
} = {}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [returnTo, setReturnTo] = useState<StudioStep | null>(null);

  const finish = useCallback(() => {
    setOpen(false);
    onPreview?.(false);
    if (returnTo) onNavigate?.(returnTo);
    setReturnTo(null);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // private browsing — showing the tour again is a fine failure mode
    }
  }, [returnTo, onNavigate, onPreview]);

  useEffect(() => {
    const reopen = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(TOUR_EVENT, reopen);
    return () => window.removeEventListener(TOUR_EVENT, reopen);
  }, []);

  useEffect(() => {
    if (currentStep !== "captions" || !armed) return;
    try {
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {
      /* private browsing — showing it again is a fine failure mode */
    }
  }, [currentStep, armed]);

  useEffect(() => {
    if (!open) return;
    onPreview?.(true);
    setReturnTo((prev) => prev ?? currentStep ?? null);
    const at = STEPS[step].at;
    if (at && at !== currentStep) onNavigate?.(at);
    // currentStep changing is the *result* of this, not a reason to re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  useEffect(() => {
    if (!open) return;

    const target = STEPS[step].target;
    if (!target) {
      setRect(null);
      return;
    }

    const el = document.querySelector(`[data-tour="${target}"]`);
    if (!el || el.getBoundingClientRect().width === 0) {
      setRect(null);
      const retry = setTimeout(() => {
        const later = document.querySelector(`[data-tour="${target}"]`);
        if (later && later.getBoundingClientRect().width > 0) {
          setRect(later.getBoundingClientRect());
        }
      }, 90);
      return () => clearTimeout(retry);
    }

    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const update = () => setRect(el.getBoundingClientRect());
    update();
    const timer = setTimeout(update, 400); // settle after the smooth scroll

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight" || e.key === "Enter") {
        setStep((s) => (s < STEPS.length - 1 ? s + 1 : s));
        if (step === STEPS.length - 1) finish();
      }
      if (e.key === "ArrowLeft") setStep((s) => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step, finish]);

  if (!open) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const card = cardPosition(rect);

  return (
    <div className="fixed inset-0 z-50">
      {rect ? (
        <>
          {/* One element does both jobs: the ring marks the target, and the
              huge spread dims everything outside it without four overlay divs. */}
          <div
            className="pointer-events-none absolute rounded-2xl border-2 border-volt transition-all duration-300"
            style={{
              left: rect.left - PAD,
              top: rect.top - PAD,
              width: rect.width + PAD * 2,
              height: rect.height + PAD * 2,
              boxShadow: "0 0 0 9999px rgba(4,4,7,.78)",
            }}
          />
          {/* Four catchers around the cutout rather than one over everything —
              that leaves the spotlit panel genuinely clickable, so you can try
              each step as it's described instead of watching a dead overlay. */}
          <div
            className="absolute inset-x-0 top-0"
            style={{ height: Math.max(0, rect.top - PAD) }}
            onClick={finish}
          />
          <div
            className="absolute inset-x-0 bottom-0"
            style={{ top: rect.bottom + PAD }}
            onClick={finish}
          />
          <div
            className="absolute left-0"
            style={{
              top: rect.top - PAD,
              height: rect.height + PAD * 2,
              width: Math.max(0, rect.left - PAD),
            }}
            onClick={finish}
          />
          <div
            className="absolute right-0"
            style={{
              top: rect.top - PAD,
              height: rect.height + PAD * 2,
              left: rect.right + PAD,
            }}
            onClick={finish}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-[rgba(4,4,7,.78)]" onClick={finish} />
      )}

      <div
        className="animate-rise absolute rounded-2xl border border-line bg-ink-2 p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,.9)]"
        style={{ width: CARD_W, ...card }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                aria-label={`Step ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-5 bg-volt" : "w-1.5 bg-line hover:bg-muted"
                }`}
              />
            ))}
          </div>
          <button
            onClick={finish}
            className="text-[12px] text-muted transition-colors hover:text-chalk"
          >
            Skip
          </button>
        </div>

        <h3 className="text-[16px] font-semibold tracking-[-0.02em]">
          {current.title}
        </h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          {current.body}
        </p>

        <div className="mt-5 flex items-center gap-2">
          {step > 0 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="rounded-lg border border-line px-3 py-2 text-[13px] text-muted transition-colors hover:border-muted/50 hover:text-chalk"
            >
              Back
            </button>
          ) : null}
          <button
            onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
            className="flex-1 rounded-lg bg-volt px-4 py-2 text-[13px] font-semibold text-ink transition-transform hover:-translate-y-px"
          >
            {isLast ? "Start captioning" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

function cardPosition(rect: DOMRect | null): React.CSSProperties {
  if (typeof window === "undefined" || !rect) {
    return {
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
    };
  }

  const { innerWidth: vw, innerHeight: vh } = window;
  const CARD_H = 290;
  const gap = 18;

  const below = rect.bottom + gap;
  const above = rect.top - gap - CARD_H;

  const top =
    below + CARD_H < vh ? below : above > 0 ? above : Math.max(16, vh / 2 - CARD_H / 2);

  const rightRoom = vw - rect.right - gap;
  const leftRoom = rect.left - gap;
  if (below + CARD_H >= vh && above <= 0) {
    if (rightRoom > CARD_W + 16) {
      return { left: rect.right + gap, top: Math.max(16, rect.top) };
    }
    if (leftRoom > CARD_W + 16) {
      return { left: rect.left - gap - CARD_W, top: Math.max(16, rect.top) };
    }
  }

  const left = clamp(rect.left + rect.width / 2 - CARD_W / 2, 16, vw - CARD_W - 16);
  return { left, top };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
