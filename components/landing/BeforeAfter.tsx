"use client";

import { useEffect, useRef, useState } from "react";
import { CaptionOverlay } from "@/components/CaptionOverlay";
import { ShortFrame, SyntheticFootage } from "@/components/ShortFrame";
import { DEMO_WORDS } from "@/lib/demo-captions";
import { PRESETS } from "@/lib/presets";

/** Swap this file to show your own footage on the landing page. */
const CLIP = "/messi-edit.mp4";

/**
 * Two frames of the same clip playing in step — one as a muted scroller sees
 * it, one with Kaptra. Side by side rather than a drag-slider: a slider clips
 * through the middle of a word, which reads as broken text rather than as an
 * absence of captions.
 */
export function BeforeAfter() {
  const plainRef = useRef<HTMLVideoElement>(null);
  const captionedRef = useRef<HTMLVideoElement>(null);
  const [time, setTime] = useState(0);
  const [broken, setBroken] = useState(false);
  // No fitting or stretching — these are the clip's own words at the times
  // they were actually said.
  const words = DEMO_WORDS;

  // The `autoPlay` attribute alone is unreliable — iOS Safari in particular
  // wants an explicit call, and it can be missed if metadata lands late.
  useEffect(() => {
    if (broken) return;
    const start = () => {
      for (const ref of [plainRef, captionedRef]) {
        ref.current?.play().catch(() => {
          /* a blocked autoplay just leaves the poster frame up */
        });
      }
    };
    start();
    // Retry once media is actually ready, and on the first interaction, for
    // browsers that hold playback until the user touches the page.
    const onReady = () => start();
    plainRef.current?.addEventListener("canplay", onReady);
    captionedRef.current?.addEventListener("canplay", onReady);
    window.addEventListener("pointerdown", start, { once: true });
    return () => {
      plainRef.current?.removeEventListener("canplay", onReady);
      captionedRef.current?.removeEventListener("canplay", onReady);
      window.removeEventListener("pointerdown", start);
    };
  }, [broken]);

  // The captioned side drives the clock; the plain side is nudged back into
  // step if it drifts, so the two panels stay the same moment of the same clip.
  useEffect(() => {
    if (broken) return;
    let frame = 0;
    const tick = () => {
      const lead = captionedRef.current;
      const follow = plainRef.current;
      if (lead) {
        setTime(lead.currentTime);
        if (follow && Math.abs(follow.currentTime - lead.currentTime) > 0.12) {
          follow.currentTime = lead.currentTime;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [broken]);

  const videoProps = {
    className: "h-full w-full object-cover",
    autoPlay: true,
    muted: true,
    loop: true,
    playsInline: true,
    preload: "auto" as const,
    onError: () => setBroken(true),
  };

  return (
    <div className="mx-auto grid w-full max-w-[540px] grid-cols-2 gap-4 sm:gap-6">
      <figure>
        <ShortFrame rounded={18}>
          {broken ? (
            <SyntheticFootage />
          ) : (
            <video ref={plainRef} src={CLIP} {...videoProps} />
          )}
        </ShortFrame>
        <figcaption className="mt-3 text-center">
          <span className="text-[13px] font-semibold text-muted">Without</span>
          <span className="mt-0.5 block text-[11.5px] leading-snug text-muted/70">
            Nothing to read. Thumb keeps moving.
          </span>
        </figcaption>
      </figure>

      <figure>
        <ShortFrame
          rounded={18}
          className="ring-1 ring-volt/40"
          overlay={
            <CaptionOverlay
              words={words}
              style={PRESETS[0].style}
              time={time}
            />
          }
        >
          {broken ? (
            <SyntheticFootage />
          ) : (
            <video ref={captionedRef} src={CLIP} {...videoProps} />
          )}
        </ShortFrame>
        <figcaption className="mt-3 text-center">
          <span className="text-[13px] font-semibold text-volt">
            With Kaptra
          </span>
          <span className="mt-0.5 block text-[11.5px] leading-snug text-muted/70">
            Same clip. Readable on mute.
          </span>
        </figcaption>
      </figure>
    </div>
  );
}
