import type { FontKey } from "./types";

export const FONTS: Record<
  FontKey,
  { label: string; css: string; ass: string; weight: number; tracking: string }
> = {
  impact: {
    label: "Impact",
    css: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif",
    ass: "Impact",
    weight: 400,
    tracking: "0.01em",
  },
  black: {
    label: "Heavy",
    css: "'Arial Black', 'Helvetica Neue', Helvetica, sans-serif",
    ass: "Arial Black",
    weight: 900,
    tracking: "-0.01em",
  },
  grotesk: {
    label: "Grotesk",
    css: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    ass: "Helvetica Neue",
    weight: 800,
    tracking: "-0.02em",
  },
  rounded: {
    label: "Rounded",
    css: "'Avenir Next', 'Trebuchet MS', Verdana, sans-serif",
    ass: "Avenir Next",
    weight: 800,
    tracking: "0em",
  },
  serif: {
    label: "Editorial",
    css: "Georgia, 'Times New Roman', serif",
    ass: "Georgia",
    weight: 700,
    tracking: "0em",
  },
  mono: {
    label: "Mono",
    css: "Menlo, Consolas, 'Courier New', monospace",
    ass: "Menlo",
    weight: 700,
    tracking: "-0.03em",
  },
};

export const FONT_KEYS = Object.keys(FONTS) as FontKey[];
