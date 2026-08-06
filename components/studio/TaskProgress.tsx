"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  PROGRESS_LABEL,
  hasRealPercent,
  isBusy,
  progressPercent,
} from "@/lib/progress";
import type { RenderStatus } from "@/lib/types";

/** How long the bar stays up after finishing, so short jobs aren't a flicker. */
const LINGER_MS = 1600;

/**
 * Floating progress readout, pinned top-centre.
 *
 * Portalled to <body> rather than rendered in place: a transform, filter or
 * containment on any ancestor re-bases `position: fixed` to that ancestor, and
 * the Studio grid is full of candidates. This way it can't be repositioned or
 * clipped by anything.
 */
export function TaskProgress({ status }: { status: RenderStatus }) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const busy = isBusy(status);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (busy) {
      setVisible(true);
      return;
    }
    // A 3-second clip encodes almost instantly; without this the bar would
    // appear and vanish before anyone could read it.
    const timer = setTimeout(() => setVisible(false), LINGER_MS);
    return () => clearTimeout(timer);
  }, [busy]);

  if (!mounted || !visible) return null;

  const finished = !busy;
  const percent = finished ? 100 : progressPercent(status);
  const measured = hasRealPercent(status);
  const shown =
    status.state === "uploading"
      ? status.progress * 100
      : status.state === "rendering"
        ? status.percent
        : 0;

  const label = finished
    ? status.state === "error"
      ? "Failed"
      : "Done"
    : `${PROGRESS_LABEL[status.state]}…`;

  const failed = finished && status.state === "error";

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="animate-rise pointer-events-none fixed left-1/2 top-[76px] z-[100] w-[min(430px,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-line bg-ink-2/95 px-4 py-3 shadow-[0_20px_60px_-20px_rgba(0,0,0,.9)] backdrop-blur-xl"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-2 text-[13px] font-medium">
          <span className="relative flex h-2 w-2">
            {!finished ? (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-volt opacity-70" />
            ) : null}
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${
                failed ? "bg-[#ff8a7a]" : finished ? "bg-mint" : "bg-volt"
              }`}
            />
          </span>
          {label}
        </span>
        <span className="font-mono text-[13px] tabular-nums text-chalk">
          {finished ? (failed ? "" : "100%") : measured ? `${Math.round(shown)}%` : ""}
        </span>
      </div>

      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ease-out ${
            failed ? "bg-[#ff8a7a]" : finished ? "bg-mint" : "bg-volt"
          } ${!finished && !measured ? "animate-pulse" : ""}`}
          style={{ width: `${failed ? 100 : percent}%` }}
        />
      </div>

    </div>,
    document.body,
  );
}
