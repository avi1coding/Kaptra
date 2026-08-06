"use client";

import { PROGRESS_LABEL as LABEL, isBusy, progressPercent } from "@/lib/progress";
import type { RenderStatus } from "@/lib/types";
import { Panel } from "./controls";

type Props = {
  status: RenderStatus;
  hasVideo: boolean;
  backendConfigured: boolean;
  onRender: () => void;
  onReset: () => void;
  /** The clip's own name, kept so the download isn't generically titled. */
  fileName: string;
};

export function ExportCard({
  status,
  hasVideo,
  backendConfigured,
  onRender,
  onReset,
  fileName,
}: Props) {
  const busy = isBusy(status);

  return (
    <Panel title="Export" tourId="export">
      <div className="space-y-2.5">
        <button
          onClick={onRender}
          disabled={!hasVideo || !backendConfigured || busy}
          className="w-full rounded-xl bg-volt px-4 py-3 text-[14px] font-semibold text-ink transition-transform enabled:hover:-translate-y-px disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
        >
          {busy ? LABEL[status.state] + "…" : "Download clip"}
        </button>
      </div>

      {busy ? (
        <div className="mt-4">
          <div className="h-1 overflow-hidden rounded-full bg-line">
            <div
              className={`h-full rounded-full bg-volt transition-[width] duration-300 ${
                status.state === "transcribing" ? "animate-pulse" : ""
              }`}
              style={{ width: `${Math.round(progressPercent(status))}%` }}
            />
          </div>
          <p className="mt-2 flex items-baseline justify-between gap-3 text-[11.5px] text-muted">
            <span>{LABEL[status.state]}…</span>
            {status.state === "rendering" ? (
              <span className="font-mono tabular-nums text-chalk">
                {Math.round(status.percent)}%
              </span>
            ) : status.state === "uploading" ? (
              <span className="font-mono tabular-nums text-chalk">
                {Math.round(status.progress * 100)}%
              </span>
            ) : null}
          </p>
        </div>
      ) : null}

      {status.state === "done" ? (
        <div className="mt-4 rounded-xl border border-mint/30 bg-mint/[0.06] p-3">
          <p className="text-[12.5px] font-medium text-mint">
            Your captioned Short is ready.
          </p>
          <div className="mt-2.5 flex gap-2">
            <a
              href={status.url}
              download={fileName}
              className="rounded-lg bg-mint px-3 py-1.5 text-[12.5px] font-semibold text-ink"
            >
              Download again
            </a>
            <button
              onClick={onReset}
              className="rounded-lg border border-line px-3 py-1.5 text-[12.5px] text-muted transition-colors hover:text-chalk"
            >
              Start over
            </button>
          </div>
          <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted">
            Next: add a title and thumbnail on the steps above, or head straight
            to Upload.
          </p>
        </div>
      ) : null}

      {status.state === "error" ? (
        <div className="mt-4 rounded-xl border border-[#ff8a7a]/30 bg-[#ff8a7a]/[0.06] p-3">
          <p className="text-[12.5px] leading-relaxed text-[#ff8a7a]">
            {status.message}
          </p>
        </div>
      ) : null}

      {!backendConfigured ? (
        <div className="mt-4 border-t border-line pt-3">
          <p className="text-[11.5px] leading-relaxed text-muted">
            <span className="text-chalk">Preview mode.</span> Styling works, but
            captions can&apos;t be added to a clip right now.
          </p>
        </div>
      ) : null}
    </Panel>
  );
}
