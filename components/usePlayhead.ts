"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A controllable playhead driven by requestAnimationFrame.
 *
 * The Studio needs this because in demo mode there is no <video> to read
 * currentTime from — but the creator still expects play, pause and scrub to
 * work while they're tuning a style. Time accumulates from frame deltas rather
 * than from a fixed start point, so pausing and seeking don't desync it.
 */
export function usePlayhead(duration: number, enabled = true) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timeRef = useRef(0);
  const lastRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !playing || duration <= 0) {
      lastRef.current = null;
      return;
    }

    let frame = 0;
    const tick = (now: number) => {
      if (lastRef.current === null) lastRef.current = now;
      const delta = (now - lastRef.current) / 1000;
      lastRef.current = now;
      timeRef.current = (timeRef.current + delta) % duration;
      setTime(timeRef.current);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      lastRef.current = null;
    };
  }, [enabled, playing, duration]);

  const seek = useCallback(
    (seconds: number) => {
      timeRef.current = Math.max(0, Math.min(seconds, duration));
      setTime(timeRef.current);
    },
    [duration],
  );

  const toggle = useCallback(() => setPlaying((p) => !p), []);

  return { time, playing, seek, toggle, setPlaying };
}
