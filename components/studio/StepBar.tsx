"use client";

export type Step = "clip" | "captions" | "upload";

export const STEPS: { id: Step; label: string; blurb: string }[] = [
  { id: "clip", label: "Your clip", blurb: "Pick a video" },
  { id: "captions", label: "Captions", blurb: "Add and style them" },
  { id: "upload", label: "Upload", blurb: "Post it" },
];

export const STEP_ORDER: Step[] = STEPS.map((s) => s.id);

/** Every step reports one of these, so the bar can show progress at a glance. */
export type StepState = "done" | "skipped" | "todo";

/**
 * The spine of the Studio: where you are, and the only way to move.
 *
 * Every step is clickable, in any order. Next and Skip walk it in sequence for
 * anyone who wants that, but nothing is locked — arriving at the upload screen
 * with nothing to upload is recoverable, and being unable to get back to a step
 * is not.
 */
export function StepBar({
  current,
  states,
  onBack,
  onSkip,
  onNext,
  canNext,
  nextLabel = "Next",
  onSelect,
}: {
  current: Step;
  states: Record<Step, StepState>;
  /** Jump straight to any step. */
  onSelect?: (step: Step) => void;
  onBack?: () => void;
  onSkip?: () => void;
  onNext?: () => void;
  canNext: boolean;
  nextLabel?: string;
}) {
  const index = STEP_ORDER.indexOf(current);

  return (
    <nav
      aria-label="Publishing steps"
      data-tour="steps"
      className="border-b border-line bg-ink-2/60 backdrop-blur"
    >
      <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-2.5 sm:px-6">
        <ol className="flex min-w-0 flex-1 items-center gap-1 sm:gap-1.5">
          {STEPS.map((step, i) => {
            const active = step.id === current;
            const state = states[step.id];
            const passed = i < index;
            const reachable = !active && Boolean(onSelect);
            const Tag = reachable ? "button" : "div";
            return (
              <li
                key={step.id}
                aria-current={active ? "step" : undefined}
                className={`min-w-0 ${active ? "flex-1" : "shrink-0 sm:flex-1"}`}
              >
                <Tag
                  onClick={reachable ? () => onSelect?.(step.id) : undefined}
                  className={`flex w-full min-w-0 items-center gap-2 rounded-xl border px-2 py-1.5 text-left transition-colors sm:px-2.5 ${
                    active
                      ? "border-volt/50 bg-volt/[0.07]"
                      : reachable
                        ? "border-transparent hover:border-line hover:bg-ink"
                        : "border-transparent"
                  }`}
                >
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                    state === "done"
                      ? "bg-mint text-ink"
                      : state === "skipped"
                        ? "border border-line text-muted"
                        : active
                          ? "bg-volt text-ink"
                          : passed
                            ? "border border-line text-muted"
                            : "border border-line text-muted/60"
                  }`}
                >
                  {state === "done" ? (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12.5l5.5 5.5L20 6.5" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                {/* On a phone only the current step keeps its label; three
                    side by side squeezed the active one out entirely. */}
                <span className={`min-w-0 ${active ? "block" : "hidden sm:block"}`}>
                  <span
                    className={`block truncate text-[13px] font-semibold ${
                      active ? "text-chalk" : "text-muted"
                    }`}
                  >
                    {step.label}
                  </span>
                  <span className="hidden truncate text-[11px] text-muted xl:block">
                    {state === "skipped" ? "Skipped" : step.blurb}
                  </span>
                </span>
                </Tag>
              </li>
            );
          })}
        </ol>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {onBack ? (
            <button
              onClick={onBack}
              className="rounded-lg border border-line px-2.5 py-2 text-[12.5px] text-muted transition-colors hover:border-muted/50 hover:text-chalk sm:px-3"
            >
              Back
            </button>
          ) : null}
          {onSkip ? (
            <button
              onClick={onSkip}
              className="rounded-lg px-2 py-2 text-[12.5px] text-muted transition-colors hover:text-chalk sm:px-3"
            >
              Skip
            </button>
          ) : null}
          {onNext ? (
            <button
              onClick={onNext}
              disabled={!canNext}
              className="rounded-lg bg-chalk px-3 py-2 text-[12.5px] font-semibold text-ink transition-transform enabled:hover:-translate-y-px disabled:cursor-not-allowed disabled:bg-line disabled:text-muted sm:px-4"
            >
              {nextLabel}
            </button>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
