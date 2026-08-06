"use client";

import { useEffect, useRef } from "react";
import type { Word } from "@/lib/types";
import { Panel } from "./controls";

type Props = {
  words: Word[];
  time: number;
  onToggleEmphasis: (index: number) => void;
  onSeek: (seconds: number) => void;
};

/** How long to stop following the playhead after the user scrolls by hand. */
const FOLLOW_PAUSE_MS = 2500;
/** Window in which incoming scroll events are assumed to be our own doing. */
const PROGRAMMATIC_MS = 700;

/**
 * The transcript doubles as the emphasis editor: the model's picks are shown
 * as highlights, and any of them can be overruled with a click.
 */
export function TranscriptPanel({
  words,
  time,
  onToggleEmphasis,
  onSeek,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const programmaticUntil = useRef(0);
  const followPausedUntil = useRef(0);

  const activeIndex = words.findLastIndex((w) => time >= w.start);
  const hits = words.filter((w) => w.emphasis).length;

  useEffect(() => {
    const box = scrollRef.current;
    const el = activeRef.current;
    if (!box || !el) return;

    const now = performance.now();
    if (now < followPausedUntil.current) return;

    // Centre the active word by scrolling *this box only*. scrollIntoView would
    // walk up and scroll every ancestor too, which hijacks the page while the
    // user is trying to scroll it themselves.
    const target = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2;
    const max = box.scrollHeight - box.clientHeight;
    const next = Math.max(0, Math.min(target, max));
    if (Math.abs(next - box.scrollTop) < 4) return;

    programmaticUntil.current = now + PROGRAMMATIC_MS;
    box.scrollTo({ top: next, behavior: "smooth" });
  }, [activeIndex]);

  return (
    <Panel
      title="Transcript"
      tourId="transcript"
      action={
        <span className="font-mono text-[10.5px] text-muted">
          {words.length} words · {hits} highlighted
        </span>
      }
    >
      <p className="mb-3 text-[11.5px] leading-relaxed text-muted">
        Click a word to add or remove the AI highlight. Double-click to jump the
        playhead there.
      </p>
      <div
        ref={scrollRef}
        onScroll={() => {
          if (performance.now() < programmaticUntil.current) return;
          followPausedUntil.current = performance.now() + FOLLOW_PAUSE_MS;
        }}
        className="scroll-thin relative max-h-[240px] overflow-y-auto overscroll-contain pr-1 leading-[2.2]"
      >
        {words.map((word, i) => {
          const isActive = i === activeIndex;
          return (
            <button
              key={i}
              ref={isActive ? activeRef : undefined}
              onClick={() => onToggleEmphasis(i)}
              onDoubleClick={() => onSeek(word.start)}
              className={`mr-0.5 rounded-md px-1 py-0.5 text-[13.5px] transition-colors ${
                word.emphasis
                  ? "bg-volt/90 font-semibold text-ink"
                  : isActive
                    ? "bg-line text-chalk"
                    : "text-muted hover:bg-ink hover:text-chalk"
              } ${isActive && word.emphasis ? "ring-1 ring-chalk" : ""}`}
              title={`${word.start.toFixed(2)}s → ${word.end.toFixed(2)}s`}
            >
              {word.text}
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
