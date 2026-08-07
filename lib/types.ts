export type Word = {
  text: string;
  start: number;
  end: number;
  emphasis?: boolean;
};

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
  size: number;
  color: string;
  emphasisColor: string;
  activeColor: string;
  outlineColor: string;
  outline: number;
  shadow: number;
  position: Position;
  margin: number;
  anchor: { x: number; y: number } | null;
  uppercase: boolean;
  mode: CaptionMode;
  animation: Animation;
  maxWords: number;
  highlightBox: boolean;
  boxColor: string;
};

export type Preset = {
  id: string;
  name: string;
  blurb: string;
  style: CaptionStyle;
};

export type TranscriptResponse = {
  words: Word[];
  language?: string;
  duration?: number;
  mode?: string;
  translated?: boolean;
  translated_to?: string | null;
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
