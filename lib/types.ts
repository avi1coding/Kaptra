/** A single word with timing, as returned by Whisper's word-level timestamps. */
export type Word = {
  text: string;
  /** seconds from start of clip */
  start: number;
  /** seconds from start of clip */
  end: number;
  /** true when the AI marked this word as the one to hit */
  emphasis?: boolean;
};

/** A group of words shown on screen together (one subtitle line). */
export type Cue = {
  words: Word[];
  start: number;
  end: number;
};

export type Position = "top" | "middle" | "bottom";
export type CaptionMode = "word" | "phrase";
export type Animation = "pop" | "none" | "karaoke";

export type FontKey =
  | "impact"
  | "black"
  | "grotesk"
  | "rounded"
  | "serif"
  | "mono";

export type CaptionStyle = {
  font: FontKey;
  /** font size as a percentage of video height — resolution independent */
  size: number;
  /** base colour for inactive / normal words */
  color: string;
  /** colour applied to AI-emphasised words */
  emphasisColor: string;
  /** colour applied to the word currently being spoken */
  activeColor: string;
  outlineColor: string;
  /** outline thickness as a percentage of video height */
  outline: number;
  shadow: number;
  position: Position;
  /** vertical inset from the chosen edge, as a percentage of video height */
  margin: number;
  /**
   * Free position, set by dragging the captions on the preview. Percentages of
   * frame width/height, marking the centre of the caption block. When set it
   * overrides `position` and `margin` entirely.
   */
  anchor: { x: number; y: number } | null;
  uppercase: boolean;
  mode: CaptionMode;
  animation: Animation;
  maxWords: number;
  /** highlight the active word with a filled box behind it */
  highlightBox: boolean;
  /** fill of that box; emphasised words use emphasisColor instead */
  boxColor: string;
};

export type Preset = {
  id: string;
  name: string;
  blurb: string;
  style: CaptionStyle;
};

/** Shape of the transcription response from the Python backend. */
export type TranscriptResponse = {
  words: Word[];
  language?: string;
  duration?: number;
  /** which decoding profile ran — "speech" or "music" */
  mode?: string;
  /** true when the captions were translated out of the source language */
  translated?: boolean;
  /** the language they were translated into, if any */
  translated_to?: string | null;
  /** set when something optional failed but the transcript is still usable */
  warning?: string | null;
};

export type RenderStatus =
  | { state: "idle" }
  | { state: "uploading"; progress: number }
  | { state: "transcribing" }
  /** `percent` is ffmpeg's own encode progress, 0–100. */
  | { state: "rendering"; percent: number }
  | { state: "done"; url: string }
  | { state: "error"; message: string };
