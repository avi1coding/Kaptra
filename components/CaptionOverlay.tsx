"use client";

import { useMemo, useRef, useState } from "react";
import { activeWordIndex, buildCues, heldCueAt } from "@/lib/cues";
import { FONTS } from "@/lib/fonts";
import type { CaptionStyle, Word } from "@/lib/types";
import { useElementSize } from "./useElementSize";

type Props = {
  words: Word[];
  style: CaptionStyle;
  /** playback position in seconds */
  time: number;
  /**
   * Enables drag-to-position. When set, the caption block can be dragged
   * anywhere on the frame and reports its new centre as percentages.
   */
  onAnchorChange?: (anchor: { x: number; y: number }) => void;
  /** Resize by dragging a corner or pinching, as a % of frame height. */
  onSizeChange?: (size: number) => void;
  /**
   * Keep a caption on screen even when the playhead is in a gap, so there is
   * always something to grab while positioning. Only sensible while paused.
   */
  showGuide?: boolean;
  className?: string;
};

/**
 * A DOM re-implementation of what libass will draw. It exists so the creator
 * sees the result before committing to a render — the styling maths here
 * deliberately mirrors lib/ass.ts (percent-of-height sizing, same colour rules,
 * same cue chunking) so the preview and the burned-in output agree.
 */
export function CaptionOverlay({
  words,
  style,
  time,
  onAnchorChange,
  onSizeChange,
  showGuide = false,
  className = "",
}: Props) {
  const { ref, width, height } = useElementSize<HTMLDivElement>();
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const grabOffset = useRef({ x: 0, y: 0 });

  const cues = useMemo(
    () => buildCues(words, style.mode === "word" ? 1 : style.maxWords),
    [words, style.mode, style.maxWords],
  );

  const live = heldCueAt(cues, time);
  /*
   * The guide cue is a positioning aid, not a claim about what renders at this
   * timestamp — it's drawn faded so it can't be mistaken for the real thing.
   *
   * It is only offered once the playhead has reached the first real cue.
   * Showing it at 0:00 put a caption over the opening frame of clips whose
   * speech starts ten seconds in, which reads as the render being wrong.
   */
  const started = cues.length > 0 && time >= cues[0].start;
  const cue = live ?? (showGuide && started ? cues[0] : null);
  const isGuide = !live && cue !== null;
  const active = cue && live ? activeWordIndex(cue, time) : -1;
  const font = FONTS[style.font];

  const px = (percent: number) => (percent / 100) * height;
  const fontSize = px(style.size);
  const strokeWidth = style.highlightBox ? 0 : px(style.outline);
  const shadow = px(style.shadow);

  const draggable = Boolean(onAnchorChange);
  const resizable = Boolean(onSizeChange);

  /** Live pointers on the caption block, so two of them can mean a pinch. */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; size: number } | null>(null);

  const SIZE_MIN = 2.5;
  const SIZE_MAX = 12;

  const spread = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  /**
   * Drag a corner to resize, the way a text box works anywhere else. Scale
   * tracks distance from the block's centre, so the corner stays under the
   * finger instead of running away from it.
   */
  const startResize = (event: React.PointerEvent<HTMLElement>) => {
    if (!onSizeChange) return;
    event.preventDefault();
    event.stopPropagation();

    const block = event.currentTarget.parentElement;
    if (!block) return;
    const box = block.getBoundingClientRect();
    const centre = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    const from = Math.hypot(event.clientX - centre.x, event.clientY - centre.y);
    if (from < 8) return;
    const base = style.size;

    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    setResizing(true);

    const move = (e: PointerEvent) => {
      const now = Math.hypot(e.clientX - centre.x, e.clientY - centre.y);
      onSizeChange(clamp((base * now) / from, SIZE_MIN, SIZE_MAX));
    };
    const end = () => {
      setResizing(false);
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  };

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggable || !onAnchorChange) return;
    event.preventDefault();
    event.stopPropagation();

    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const frame = ref.current;
    const block = event.currentTarget;
    if (!frame) return;

    const frameBox = frame.getBoundingClientRect();
    const blockBox = block.getBoundingClientRect();
    // Grab the block where the cursor landed, so it doesn't jump to centre.
    grabOffset.current = {
      x: event.clientX - (blockBox.left + blockBox.width / 2),
      y: event.clientY - (blockBox.top + blockBox.height / 2),
    };

    block.setPointerCapture(event.pointerId);
    setDragging(true);

    const move = (e: PointerEvent) => {
      if (pointers.current.has(e.pointerId)) {
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      // Two fingers down: pinch to resize rather than drag, so the caption
      // scales the way any other object on a phone does.
      if (pointers.current.size >= 2 && onSizeChange) {
        const distance = spread();
        if (!pinch.current) {
          pinch.current = { distance, size: style.size };
          setResizing(true);
        } else if (pinch.current.distance > 8) {
          onSizeChange(
            clamp(
              (pinch.current.size * distance) / pinch.current.distance,
              SIZE_MIN,
              SIZE_MAX,
            ),
          );
        }
        return;
      }

      const x = e.clientX - grabOffset.current.x - frameBox.left;
      const y = e.clientY - grabOffset.current.y - frameBox.top;
      onAnchorChange({
        x: clamp((x / frameBox.width) * 100, 6, 94),
        y: clamp((y / frameBox.height) * 100, 4, 96),
      });
    };

    const end = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) {
        pinch.current = null;
        setResizing(false);
      }
      if (pointers.current.size > 0) return;
      setDragging(false);
      block.removeEventListener("pointermove", move);
      block.removeEventListener("pointerup", end);
      block.removeEventListener("pointercancel", end);
    };

    block.addEventListener("pointermove", move);
    block.addEventListener("pointerup", end);
    block.addEventListener("pointercancel", end);
  };

  const anchored = style.anchor !== null;

  const justify = anchored
    ? "center"
    : style.position === "top"
      ? "flex-start"
      : style.position === "middle"
        ? "center"
        : "flex-end";

  const padding =
    anchored || style.position === "middle"
      ? {}
      : style.position === "top"
        ? { paddingTop: px(style.margin) }
        : { paddingBottom: px(style.margin) };

  const anchorStyle: React.CSSProperties = anchored
    ? {
        position: "absolute",
        left: `${style.anchor!.x}%`,
        top: `${style.anchor!.y}%`,
        transform: "translate(-50%, -50%)",
        maxWidth: "88%",
      }
    : {};

  return (
    <div
      ref={ref}
      // The wrapper stays transparent to pointers so clicking the video still
      // toggles playback; only the caption block itself is grabbable.
      className={`pointer-events-none absolute inset-0 flex ${className}`}
      style={{ justifyContent: "center", alignItems: justify, ...padding }}
      aria-hidden
    >
      {cue && height > 0 && width > 0 ? (
        <div
          onPointerDown={startDrag}
          className={`group flex flex-wrap justify-center px-[6%] ${
            draggable
              ? "pointer-events-auto cursor-grab active:cursor-grabbing"
              : "pointer-events-none"
          }`}
          style={{
            gap: `${fontSize * 0.12}px ${fontSize * 0.28}px`,
            fontFamily: font.css,
            fontWeight: font.weight,
            letterSpacing: font.tracking,
            fontSize,
            lineHeight: 1.08,
            textAlign: "center",
            textShadow:
              shadow > 0 ? `0 ${shadow}px ${shadow * 1.6}px rgba(0,0,0,.55)` : "none",
            opacity: isGuide ? 0.45 : 1,
            position: "relative",
            outline:
              dragging || resizing ? "2px dashed rgba(255,255,255,.55)" : undefined,
            outlineOffset: dragging || resizing ? "6px" : undefined,
            borderRadius: dragging || resizing ? 6 : undefined,
            touchAction: draggable ? "none" : undefined,
            ...anchorStyle,
          }}
        >
          {/* Corner handles, the way a text box resizes anywhere else. Hidden
              until you reach for them — four dots sitting on the preview read as
              part of the caption. The hit area stays live regardless, so a
              thumb finds them without needing hover at all. */}
          {resizable
            ? ([
                ["-top-2 -left-2", "nwse-resize"],
                ["-top-2 -right-2", "nesw-resize"],
                ["-bottom-2 -left-2", "nesw-resize"],
                ["-bottom-2 -right-2", "nwse-resize"],
              ] as const).map(([place, cursor]) => (
                <span
                  key={place}
                  onPointerDown={startResize}
                  style={{ cursor, touchAction: "none" }}
                  className={`absolute ${place} z-10 grid h-6 w-6 place-items-center`}
                >
                  <span
                    className={`block h-2.5 w-2.5 rounded-full border border-ink/70 bg-white/90 shadow transition-opacity ${
                      dragging || resizing
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100"
                    }`}
                  />
                </span>
              ))
            : null}

          {cue.words.map((word, i) => {
            const isActive = i === active;
            const isSpoken = i <= active;
            const karaoke = style.animation === "karaoke";

            const boxed = style.highlightBox && isActive;

            const color = boxed
              ? style.activeColor
              : karaoke
                ? word.emphasis && isSpoken
                  ? style.emphasisColor
                  : isSpoken
                    ? style.activeColor
                    : style.color
                : isActive
                  ? word.emphasis
                    ? style.emphasisColor
                    : style.activeColor
                  : word.emphasis
                    ? style.emphasisColor
                    : style.color;

            return (
              <span
                key={`${cue.start}-${i}`}
                style={{
                  color,
                  display: "inline-block",
                  WebkitTextStrokeWidth: strokeWidth ? `${strokeWidth}px` : undefined,
                  WebkitTextStrokeColor: strokeWidth ? style.outlineColor : undefined,
                  paintOrder: "stroke fill",
                  background: boxed
                    ? word.emphasis
                      ? style.emphasisColor
                      : style.boxColor
                    : undefined,
                  padding: boxed
                    ? `${fontSize * 0.06}px ${fontSize * 0.16}px`
                    : undefined,
                  borderRadius: boxed ? `${fontSize * 0.14}px` : undefined,
                  animation:
                    style.animation === "pop" && isActive
                      ? "kaptra-pop .13s cubic-bezier(.2,.8,.3,1)"
                      : undefined,
                  transition: karaoke ? "color .09s linear" : undefined,
                }}
              >
                {style.uppercase ? word.text.toUpperCase() : word.text}
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
