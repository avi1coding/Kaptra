import type { Cue, Word } from "./types";

/** A pause longer than this starts a new caption line even mid-count. */
const GAP_BREAK = 0.55;
/** Never leave a line on screen longer than this. */
const MAX_CUE_DURATION = 3.2;
/**
 * A cue this brief reads as a flash rather than a line. Short cues get merged
 * into a neighbour where the word count allows.
 */
const MIN_CUE_DURATION = 0.65;
/** One- and two-word cues between full ones are what make captions strobe. */
const MIN_CUE_WORDS = 2;
/**
 * Roughly how many characters a word of budget buys. Word count alone is a poor
 * proxy for how many lines a cue occupies — "the first" and "because nobody
 * turned" are both three words but one and three lines — so cues are also
 * capped on total length, which tracks rendered width far more closely.
 */
const CHARS_PER_WORD_BUDGET = 7;

/**
 * Turn a flat list of timed words into on-screen lines.
 *
 * Shorts captions live or die on chunking: too many words and the eye has to
 * read, too few and it flickers. The work happens in two passes — split at
 * natural boundaries, then even out the pieces — because greedy filling is what
 * produces the strobing. Greedily packing "Not because the content is bad." at
 * four words per cue leaves ["Not because the content", "is bad."], and a
 * three-line cue followed by a one-line cue makes the caption block jump.
 */
export function buildCues(words: Word[], maxWords: number): Cue[] {
  if (words.length === 0) return [];
  const limit = Math.max(1, maxWords);

  // ── pass 1: split only where the speech itself says to ──────────────────
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

  // ── pass 2: divide each run into evenly sized cues ──────────────────────
  const cues: Cue[] = [];
  for (const group of runs) {
    // Balanced rather than greedy: 5 words at a limit of 4 becomes 3 + 2, not
    // 4 + 1, so consecutive cues occupy a similar number of lines.
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

  // One word per line is a deliberate choice, not an accident to be smoothed
  // out: merging "stubby" cues here quietly turned word-by-word mode into
  // two-words-at-a-time, which is what it had been doing.
  if (limit === 1) return cues;

  return mergeStragglers(cues, limit);
}

/**
 * Fold cues that are too brief or too short to read into a neighbour.
 *
 * A sentence like "Is bad." is a legitimate run of its own, but on screen for a
 * third of a second between two full lines it just blinks. Merging it into the
 * line before keeps the caption block a steadier size.
 */
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
      // Never past the limit. Allowing one over made a slightly steadier block
      // but meant "2 words per line" put three on screen, which reads as the
      // control being ignored — and a control that lies is worse than a flash.
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

/** The cue visible at time `t`, or null between lines. */
export function cueAt(cues: Cue[], t: number): Cue | null {
  for (const cue of cues) {
    if (t >= cue.start && t <= cue.end) return cue;
  }
  return null;
}

/**
 * Cues are held on screen until the next one starts, so there is no flicker in
 * the gaps between phrases. Returns the cue to paint at time `t`.
 */
export function heldCueAt(cues: Cue[], t: number): Cue | null {
  let held: Cue | null = null;
  for (const cue of cues) {
    if (cue.start > t) break;
    held = cue;
  }
  if (!held) return null;
  // Drop the line if the speaker has been silent for a while after it ended.
  if (t - held.end > 1.2) return null;
  return held;
}

export function activeWordIndex(cue: Cue, t: number): number {
  for (let i = cue.words.length - 1; i >= 0; i--) {
    if (t >= cue.words[i].start) return i;
  }
  return -1;
}
