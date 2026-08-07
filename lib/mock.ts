import { autoEmphasize } from "./emphasis";
import type { Word } from "./types";

const SCRIPT =
  "Four score and seven years ago our fathers brought forth on this continent, " +
  "a new nation, conceived in Liberty, and dedicated to the proposition that " +
  "all men are created equal. Now we are engaged in a great civil war, testing " +
  "whether that nation, or any nation so conceived and so dedicated, can long " +
  "endure.";

const SEC_PER_CHAR = 0.058;
const MIN_WORD = 0.16;
const WORD_GAP = 0.045;
const SENTENCE_PAUSE = 0.34;

export function wordsFromText(script: string, offset = 0.4): Word[] {
  const tokens = script.trim().split(/\s+/);
  const words: Word[] = [];
  let t = offset;

  for (const token of tokens) {
    const duration = Math.max(MIN_WORD, token.length * SEC_PER_CHAR);
    words.push({ text: token, start: t, end: t + duration });
    t += duration + WORD_GAP;
    if (/[.!?]$/.test(token)) t += SENTENCE_PAUSE;
    else if (/[,;:]$/.test(token)) t += SENTENCE_PAUSE / 2;
  }

  return words;
}

export const MOCK_WORDS: Word[] = autoEmphasize(wordsFromText(SCRIPT));

export const MOCK_DURATION =
  MOCK_WORDS.length > 0 ? MOCK_WORDS[MOCK_WORDS.length - 1].end + 0.6 : 0;

export function fitToDuration(words: Word[], duration: number): Word[] {
  if (!duration || !isFinite(duration) || words.length === 0) return words;
  const span = words[words.length - 1].end - words[0].start;
  if (span <= 0) return words;

  const target = Math.max(1, duration - 0.6);
  const scale = target / span;
  const origin = words[0].start;

  return words.map((w) => ({
    ...w,
    start: (w.start - origin) * scale + 0.3,
    end: (w.end - origin) * scale + 0.3,
  }));
}
