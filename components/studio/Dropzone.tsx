"use client";

import { useRef, useState } from "react";
import { VIDEO_EXTENSIONS } from "@/lib/video-formats";

/**
 * Browsers report MIME types inconsistently — a .mkv can arrive as
 * `video/x-matroska`, `video/webm`, or an empty string depending on the OS. So
 * the extension list is what actually opens these files in the picker, and the
 * check below trusts extensions as much as the reported type.
 */

const ACCEPT = ["video/*", ...VIDEO_EXTENSIONS.map((e) => `.${e}`)].join(",");

function extensionOf(name: string) {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

/**
 * Deliberately permissive: the backend decodes with ffmpeg's demuxers, which
 * handle far more than any browser will admit to. Anything that isn't
 * obviously a document or an image gets a chance.
 */
function looksLikeVideo(file: File) {
  if (file.type.startsWith("video/")) return true;
  if (VIDEO_EXTENSIONS.includes(extensionOf(file.name))) return true;
  // Unknown type and unknown extension — let the backend be the judge.
  return file.type === "";
}

export function Dropzone({ onFile }: { onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = (file: File | undefined) => {
    if (!file) return;
    if (!looksLikeVideo(file)) {
      setError(
        `${file.name} doesn't look like a video. Try MP4, MOV, WebM, MKV, AVI, or most other formats.`,
      );
      return;
    }
    setError(null);
    onFile(file);
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-5 py-9 text-center transition-colors ${
          dragging
            ? "border-volt bg-volt/[0.06]"
            : "border-line bg-ink hover:border-muted/50"
        }`}
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={dragging ? "text-volt" : "text-muted"}
        >
          <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
          <path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" />
        </svg>
        <p className="mt-3 text-[14px] font-medium">
          Drop a vertical clip, or click to browse
        </p>
        <p className="mt-1 text-[12px] text-muted">
          MP4 · MOV · WebM · MKV · AVI and more — any aspect ratio
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => accept(e.target.files?.[0] ?? undefined)}
      />

      {error ? (
        <p className="mt-2 text-[12px] text-[#ff8a7a]">{error}</p>
      ) : null}
    </div>
  );
}
