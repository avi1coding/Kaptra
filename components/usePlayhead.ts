"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
