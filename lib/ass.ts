import { buildCues } from "./cues";
import { FONTS } from "./fonts";
import type { CaptionStyle, Cue, Word } from "./types";

/**
 * Advanced SubStation Alpha (.ass) generation.
 *
 * This file is the whole architectural bet: instead of drawing text with a
 * video filter graph or compositing frames ourselves, we describe the styling
 * declaratively in a subtitle format that already understands fonts, colours,
 * outlines, alignment and per-word timing — then hand it to ffmpeg, which burns
 * it in with libass in a single pass. Everything the user changes in the Studio
 * is ultimately a diff in this text file.
 */

/**
 * The canvas the subtitle script is authored against. libass maps PlayResX ×
 * PlayResY onto the real frame, so if the two aspect ratios disagree the text
 * is stretched — a 9:16 script on a 16:9 clip comes out squashed and wide.
 * Callers pass the clip's true dimensions; this is only the fallback.
 */
export type Frame = { width: number; height: number };

export const DEFAULT_FRAME: Frame = { width: 1080, height: 1920 };

/** ASS colours are &HAABBGGRR — alpha first, then *reversed* RGB. */
export function toAssColor(hex: string, alpha = 0): string {
  const h = hex.replace("#", "").trim();
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h.padEnd(6, "0").slice(0, 6);
  const r = full.slice(0, 2);
  const g = full.slice(2, 4);
  const b = full.slice(4, 6);
  const a = alpha.toString(16).padStart(2, "0");
  return `&H${a}${b}${g}${r}`.toUpperCase();
}

/**
 * Inline colour override. Drops the alpha byte (which \c ignores) and closes
 * with `&` — without the terminator libass keeps reading, and swallows the tag
 * that follows.
 */
function inlineColor(hex: string): string {
  return `\\c${toAssColor(hex).replace("&H00", "&H")}&`;
}

function inlineBorderColor(hex: string): string {
  return `\\3c${toAssColor(hex).replace("&H00", "&H")}&`;
}

/** ASS timestamps are h:mm:ss.cc — one digit of hours, centiseconds only. */
export function toAssTime(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = Math.floor(clamped % 60);
  const cs = Math.round((clamped - Math.floor(clamped)) * 100);
  // Rounding centiseconds can carry into the next second; normalise.
  const carry = cs === 100 ? 1 : 0;
  const cs2 = cs === 100 ? 0 : cs;
  const s2 = s + carry;
  return `${h}:${String(m).padStart(2, "0")}:${String(s2 % 60).padStart(2, "0")}.${String(
    cs2,
  ).padStart(2, "0")}`;
}

/** Braces and backslashes are markup in ASS — neutralise them in dialogue. */
function escapeText(text: string): string {
  return text.replace(/\\/g, "/").replace(/[{}]/g, "");
}

const ALIGNMENT: Record<CaptionStyle["position"], number> = {
  bottom: 2,
  middle: 5,
  top: 8,
};

/** Caption sizes are percentages of frame height, at any resolution. */
const pct = (value: number, frame: Frame) =>
  Math.round((value / 100) * frame.height);

function styleBlock(style: CaptionStyle, frame: Frame): string {
  const font = FONTS[style.font];
  const fontSize = pct(style.size, frame);
  const outline = style.highlightBox ? 0 : (style.outline / 100) * frame.height;
  const shadow = (style.shadow / 100) * frame.height;
  // BorderStyle 3 draws OutlineColour as a filled box, which is how the
  // per-word highlight is achieved without any compositing.
  const borderStyle = style.highlightBox ? 3 : 1;
  const marginV = style.position === "middle" ? 0 : pct(style.margin, frame);

  const fields = [
    "Kaptra",
    font.ass,
    fontSize,
    toAssColor(style.color),
    toAssColor(style.activeColor),
    toAssColor(style.outlineColor),
    toAssColor("#000000", 0x80),
    -1, // Bold
    0, // Italic
    0, // Underline
    0, // StrikeOut
    100, // ScaleX
    100, // ScaleY
    0, // Spacing
    0, // Angle
    borderStyle,
    outline.toFixed(1),
    shadow.toFixed(1),
    ALIGNMENT[style.position],
    Math.round(frame.width * 0.06), // MarginL
    Math.round(frame.width * 0.06), // MarginR
    marginV,
    1, // Encoding
  ];

  return `Style: ${fields.join(",")}`;
}

/** Colour a word should be drawn in at the moment `activeIndex` is speaking. */
function colorFor(
  style: CaptionStyle,
  word: Word,
  index: number,
  activeIndex: number,
): string {
  const isActive = index === activeIndex;
  const isSpoken = index <= activeIndex;

  if (style.animation === "karaoke") {
    // Karaoke: unspoken words sit dim, spoken words light up and stay lit.
    if (word.emphasis && isSpoken) return style.emphasisColor;
    return isSpoken ? style.activeColor : style.color;
  }
  if (isActive) return word.emphasis ? style.emphasisColor : style.activeColor;
  return word.emphasis ? style.emphasisColor : style.color;
}

/**
 * A dragged position becomes `\an5\pos(x,y)` — anchor 5 is middle-centre, which
 * matches the browser preview's translate(-50%,-50%). It overrides the style
 * block's Alignment and MarginV, so the two positioning modes can't fight.
 */
function positionTag(style: CaptionStyle, frame: Frame): string {
  if (!style.anchor) return "";
  const x = Math.round((style.anchor.x / 100) * frame.width);
  const y = Math.round((style.anchor.y / 100) * frame.height);
  return `{\\an5\\pos(${x},${y})}`;
}

function renderCueEvents(cue: Cue, style: CaptionStyle, frame: Frame): string[] {
  const events: string[] = [];
  const words = cue.words;
  // Every Dialogue line is independent, so the position rides on each one.
  const pos = positionTag(style, frame);

  for (let active = 0; active < words.length; active++) {
    const start = active === 0 ? cue.start : words[active].start;
    const end = active === words.length - 1 ? cue.end : words[active + 1].start;
    if (end <= start) continue;

    const spans = words.map((word, i) => {
      const text = escapeText(
        style.uppercase ? word.text.toUpperCase() : word.text,
      );
      const tags: string[] = [];

      if (style.highlightBox && i === active) {
        // The box carries the emphasis, so the glyphs themselves stay legible.
        tags.push(inlineColor(style.activeColor));
        tags.push(
          inlineBorderColor(word.emphasis ? style.emphasisColor : style.boxColor),
        );
        tags.push(`\\bord${Math.round((style.size / 100) * frame.height * 0.18)}`);
      } else {
        tags.push(inlineColor(colorFor(style, word, i, active)));
        if (style.highlightBox) tags.push("\\bord0");
      }

      if (style.animation === "pop" && i === active) {
        // A short scale-down from 112% reads as a hit on the beat.
        tags.push("\\fscx112\\fscy112\\t(0,90,\\fscx100\\fscy100)");
      }

      return `{${tags.join("")}}${text}`;
    });

    const lead = active === 0 && style.animation !== "none" ? "{\\fad(70,0)}" : "";
    events.push(
      `Dialogue: 0,${toAssTime(start)},${toAssTime(end)},Kaptra,,0,0,0,,${pos}${lead}${spans.join(" ")}`,
    );
  }

  return events;
}

/** Build a complete, ffmpeg-ready .ass file from words + style. */
export function buildAss(
  words: Word[],
  style: CaptionStyle,
  frame: Frame = DEFAULT_FRAME,
): string {
  const cues = buildCues(words, style.mode === "word" ? 1 : style.maxWords);

  const header = [
    "[Script Info]",
    "; Generated by Kaptra",
    "ScriptType: v4.00+",
    `PlayResX: ${Math.round(frame.width)}`,
    `PlayResY: ${Math.round(frame.height)}`,
    // 0 = smart wrapping with evenly balanced lines. WrapStyle 2 means "never
    // wrap", which let long cues run straight off both edges of the frame —
    // invisible in the preview, where flexbox wraps them for free.
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "YCbCr Matrix: TV.709",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    styleBlock(style, frame),
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  const events = cues.flatMap((cue) => renderCueEvents(cue, style, frame));

  return [...header, ...events, ""].join("\n");
}
