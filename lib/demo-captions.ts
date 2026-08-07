import { autoEmphasize } from "./emphasis";
import type { Word } from "./types";

const TRANSCRIBED: Word[] = [
  { text: "The", start: 0.26, end: 0.98 },
  { text: "morning", start: 0.98, end: 1.44 },
  { text: "light", start: 1.44, end: 1.86 },
  { text: "is", start: 1.86, end: 2.1 },
  { text: "turning", start: 2.1, end: 2.48 },
  { text: "blue,", start: 2.48, end: 2.88 },
  { text: "the", start: 2.96, end: 3.1 },
  { text: "feeling", start: 3.1, end: 3.54 },
  { text: "is", start: 3.54, end: 3.96 },
  { text: "bizarre,", start: 3.96, end: 4.46 },
  { text: "the", start: 4.8, end: 5.16 },
  { text: "night", start: 5.16, end: 5.54 },
  { text: "is", start: 5.54, end: 5.9 },
  { text: "almost", start: 5.9, end: 6.26 },
  { text: "over,", start: 6.26, end: 6.7 },
  { text: "I", start: 6.92, end: 7.1 },
  { text: "still", start: 7.1, end: 7.3 },
  { text: "don't", start: 7.3, end: 7.6 },
  { text: "know", start: 7.6, end: 7.8 },
  { text: "where", start: 7.8, end: 8.12 },
  { text: "you", start: 8.12, end: 8.34 },
  { text: "are", start: 8.34, end: 8.64 },
];

export const DEMO_WORDS: Word[] = autoEmphasize(TRANSCRIBED);
