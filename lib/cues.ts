import type { Cue, Word } from "./types";

const GAP_BREAK = 0.55;
const MAX_CUE_DURATION = 3.2;
const MIN_CUE_DURATION = 0.65;
const MIN_CUE_WORDS = 2;
const CHARS_PER_WORD_BUDGET = 7;

export function buildCues(words: Word[], maxWords: number): Cue[] {
  if (words.length === 0) return [];
  const limit = Math.max(1, maxWords);

  const runs: Word[][] = [];
  let run: Word[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    run.push(word);

    const next = words[i + 1];
    if (!next) break;

    const hitGap = next.start - word.end >= GAP_BREAK;
    const hitPunctuation = /[.!?]$/.test(word.text.trim());
    const hitDuration = next.end - run[0].start > MAX_CUE_DURATION;

    if (hitGap || hitPunctuation || hitDuration) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);

  const cues: Cue[] = [];
  for (const group of runs) {
    const characters = group.reduce((sum, w) => sum + w.text.trim().length + 1, 0);
    const byWords = Math.ceil(group.length / limit);
    const byLength = Math.ceil(characters / (limit * CHARS_PER_WORD_BUDGET));
    const pieces = Math.max(1, byWords, byLength);
    const size = Math.ceil(group.length / pieces);

    for (let i = 0; i < group.length; i += size) {
      const slice = group.slice(i, i + size);
      cues.push({
        words: slice,
        start: slice[0].start,
        end: slice[slice.length - 1].end,
      });
    }
  }

  if (limit === 1) return cues;

  return mergeStragglers(cues, limit);
}

function mergeStragglers(cues: Cue[], limit: number): Cue[] {
  if (cues.length < 2) return cues;

  const out: Cue[] = [];

  for (const cue of cues) {
    const brief = cue.end - cue.start < MIN_CUE_DURATION;
    const stubby = cue.words.length < MIN_CUE_WORDS;
    const previous = out[out.length - 1];

    const canMerge =
      previous !== undefined &&
      (brief || stubby) &&
      previous.words.length + cue.words.length <= limit &&
      cue.start - previous.end < GAP_BREAK;

    if (canMerge) {
      previous.words = [...previous.words, ...cue.words];
      previous.end = cue.end;
      continue;
    }

    out.push({ ...cue, words: [...cue.words] });
  }

  return out;
}

export function cueAt(cues: Cue[], t: number): Cue | null {
  for (const cue of cues) {
    if (t >= cue.start && t <= cue.end) return cue;
  }
  return null;
}

export function heldCueAt(cues: Cue[], t: number): Cue | null {
  let held: Cue | null = null;
  for (const cue of cues) {
    if (cue.start > t) break;
    held = cue;
  }
  if (!held) return null;
  if (t - held.end > 1.2) return null;
  return held;
}

export function activeWordIndex(cue: Cue, t: number): number {
  for (let i = cue.words.length - 1; i >= 0; i--) {
    if (t >= cue.words[i].start) return i;
  }
  return -1;
}
