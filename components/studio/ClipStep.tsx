"use client";

import { Dropzone } from "./Dropzone";

/** Step one: the clip itself. Nothing is read or transcribed until asked. */
export function ClipStep({
  file,
  duration,
  onFile,
  onClear,
}: {
  file: File | null;
  duration: number;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-[720px] px-4 py-8 sm:px-6">
      <header className="mb-5 text-center">
        <h1 className="text-[19px] font-semibold tracking-tight">
          Start with your clip
        </h1>
        <p className="mt-1 text-[13px] text-muted">Any video file, any shape.</p>
      </header>

      {file ? (
        <div className="rounded-2xl border border-line bg-ink-2 p-4">
          <div className="flex items-start gap-3 rounded-xl border border-line bg-ink p-3">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md bg-line text-[11px] font-bold">
              MP4
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-medium">{file.name}</p>
              <p className="mt-0.5 font-mono text-[11px] text-muted">
                {(file.size / 1_048_576).toFixed(1)} MB · {duration.toFixed(1)}s
              </p>
            </div>
          </div>
          <button
            onClick={onClear}
            className="mt-3 w-full rounded-lg border border-line px-3 py-2 text-[12.5px] text-muted transition-colors hover:border-muted/50 hover:text-chalk"
          >
            Choose a different clip
          </button>

        </div>
      ) : (
        <Dropzone onFile={onFile} />
      )}
    </div>
  );
}
