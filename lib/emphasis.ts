import type { Word } from "./types";

export const STOPWORDS = new Set([
  "a","an","and","as","at","be","been","being","but","by","can","could","did",
  "do","does","for","from","had","has","have","he","her","him","his","i","if",
  "in","into","is","it","its","me","my","of","on","or","our","out","she","so",
  "than","that","the","their","them","then","there","these","they","this",
  "those","to","up","us","was","we","were","what","when","which","who","will",
  "with","would","your","am","are","just","like","get","got","go","going","im",
  "dont","thats","gonna","really","very","kind","sort","because","since",
  "while","although","though","however","also","about","after","before","over",
  "some","any","much","many","more","most","other","such","own","same","been",
  "here","how","why","where","all","both","each","few","now","even","still",
  "back","take","make","made","want","know","think","see","say","said","one",
  "two","way","thing","things","lot","bit","actually","basically","literally",
]);

export const HOOK_WORDS = new Set([
  "never","always","every","everyone","everything","nobody","nothing","none",
  "best","worst","first","last","only","zero","free","instantly","forever",
  "guaranteed","guarantee","proof","secret","insane","crazy","huge","massive",
  "tiny","fastest","slowest","biggest","smallest","hardest","easiest","stop",
  "double","triple","half","twice","million","billion","thousand","hundred",
  "percent","wrong","broken","fail","failed","dead","impossible","instant",
]);

const WEAK_VERBS = new Set([
  "use","using","used","need","needs","put","give","gives","let","lets","come",
  "comes","look","looking","seem","seems","try","trying","start","starts",
]);

function normalise(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9%$€£]/g, "");
}

function expectedDuration(length: number) {
  return 0.09 + length * 0.055;
}

function score(word: Word, index: number, sentence: Word[]): number {
  const raw = word.text.trim();
  const clean = normalise(raw);
  if (!clean) return 0;
  if (STOPWORDS.has(clean)) return 0;
  if (clean.length < 2 && !/\d/.test(clean)) return 0;

  let value = 0;

  if (/^\d+([.,]\d+)?$/.test(clean)) value += 7;
  else if (/\d/.test(clean)) value += 5;
  if (/[%$€£]/.test(raw)) value += 5;

  if (HOOK_WORDS.has(clean)) value += 5;

  value += Math.min(clean.length, 11) / 3.2;

  if (WEAK_VERBS.has(clean)) value -= 2;

  const spoken = word.end - word.start;
  const expected = expectedDuration(clean.length);
  if (spoken > expected * 1.75) value += 2.5;
  else if (spoken > expected * 1.3) value += 1.2;

  if (index > 0 && /^[A-Z][a-z]{2,}/.test(raw)) value += 2;

  if (/[.!?,;:]$/.test(raw)) value += 1.5;
  if (index === sentence.length - 1) value += 1;

  return value;
}

function toSentences(words: Word[]): Word[][] {
  const sentences: Word[][] = [];
  let current: Word[] = [];

  words.forEach((word, i) => {
    current.push(word);
    const next = words[i + 1];
    const ended = /[.!?]$/.test(word.text.trim());
    const bigPause = next ? next.start - word.end > 0.7 : false;
    if (ended || bigPause || !next) {
      if (current.length) sentences.push(current);
      current = [];
    }
  });

  return sentences;
}

const THRESHOLD = 1.5;
const MIN_GAP = 2;
const WORDS_PER_HIGHLIGHT = 4;

export function autoEmphasize(words: Word[]): Word[] {
  const out = words.map((w) => ({ ...w, emphasis: false }));
  if (words.length === 0) return out;

  let offset = 0;
  for (const sentence of toSentences(words)) {
    const scored = sentence
      .map((word, i) => ({ index: offset + i, value: score(word, i, sentence) }))
      .filter((entry) => entry.value >= THRESHOLD)
      .sort((a, b) => b.value - a.value);

    const allowance = Math.max(
      1,
      Math.round(sentence.length / WORDS_PER_HIGHLIGHT),
    );
    const chosen: number[] = [];

    for (const entry of scored) {
      if (chosen.length >= allowance) break;
      if (chosen.some((i) => Math.abs(i - entry.index) < MIN_GAP)) continue;
      chosen.push(entry.index);
    }

    for (const index of chosen) out[index].emphasis = true;
    offset += sentence.length;
  }

  return out;
}

export function ensureEmphasis(words: Word[]): Word[] {
  const alreadyMarked = words.some((w) => w.emphasis);
  return alreadyMarked ? words : autoEmphasize(words);
}
