import { PRESETS } from "@/lib/presets";
import { VIDEO_EXTENSIONS } from "@/lib/video-formats";

const TILES = [
  {
    figure: String(VIDEO_EXTENSIONS.length),
    label: "video formats",
    note: "MP4, MOV, MKV, AVI, WebM and more",
  },
  {
    figure: String(PRESETS.length),
    label: "presets",
    note: "Or build your own from scratch",
  },
  {
    figure: "0.01s",
    label: "timing precision",
    note: "Every word lands exactly on the beat",
  },
  {
    figure: "AI",
    label: "picks the words to hit",
    note: "Highlights what each line turns on",
  },
  {
    figure: "1",
    label: "click to publish",
    note: "Saves the clip and opens YouTube's uploader",
  },
];

export function Capabilities() {
  return (
    <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {TILES.map((tile) => (
        <div
          key={tile.label}
          className="rounded-2xl border border-line bg-ink-2 p-6 transition-colors hover:border-muted/40"
        >
          <p className="text-[clamp(28px,3.4vw,38px)] font-black leading-none tracking-[-0.04em] text-volt">
            {tile.figure}
          </p>
          <p className="mt-2.5 text-[14px] font-semibold tracking-[-0.01em]">
            {tile.label}
          </p>
          <p className="mt-1.5 text-[12.5px] leading-snug text-muted">
            {tile.note}
          </p>
        </div>
      ))}
    </div>
  );
}
