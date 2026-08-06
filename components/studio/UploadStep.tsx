"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type YouTubeStatus,
  youtubeAuthorizeUrl,
  youtubeStatus,
  youtubeUpload,
} from "@/lib/api";

type Phase =
  | { state: "idle" }
  | { state: "uploading"; percent: number }
  | { state: "done"; url: string; studioUrl: string }
  | { state: "error"; message: string };

/**
 * Posts the finished Short straight to YouTube.
 *
 * The video is already on the machine that renders it, so this hands it over
 * server-to-server — the browser never re-sends the file and there is nothing
 * to drag anywhere. Saving the MP4 by hand stays available underneath for
 * anyone who'd rather post it themselves.
 */
export function UploadStep({
  videoUrl,
  fileName,
  jobId,
  captioned,
  onBackToCaptions,
  onRestart,
}: {
  videoUrl: string | null;
  /** the clip's own name, used when saving the file */
  fileName: string;
  /** identifies the render the backend still holds */
  jobId: string | null;
  captioned: boolean;
  onBackToCaptions: () => void;
  onRestart: () => void;
}) {
  const [status, setStatus] = useState<YouTubeStatus | null>(null);
  const [phase, setPhase] = useState<Phase>({ state: "idle" });
  const [privacy, setPrivacy] = useState("public");
  // Deliberately empty. Guessing a title from the file name meant uploads went
  // out called "IMG_4821" unless you noticed and changed it.
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const refresh = useCallback(async () => {
    try {
      setStatus(await youtubeStatus());
    } catch {
      setStatus({ configured: false, authorized: false });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = async () => {
    try {
      const url = await youtubeAuthorizeUrl();
      const popup = window.open(url, "kaptra-youtube", "width=520,height=680");
      // Google redirects back to the backend, which closes the tab; poll for
      // the resulting token rather than trying to read across origins.
      const timer = setInterval(async () => {
        await refresh();
        if (popup?.closed) clearInterval(timer);
      }, 1500);
      setTimeout(() => clearInterval(timer), 120_000);
    } catch (error) {
      setPhase({
        state: "error",
        message: error instanceof Error ? error.message : "Sign-in failed.",
      });
    }
  };

  const post = async () => {
    if (!jobId) return;
    setPhase({ state: "uploading", percent: 0 });
    try {
      const result = await youtubeUpload({ jobId, title, privacy, description }, (percent) =>
        setPhase({ state: "uploading", percent }),
      );
      setPhase({ state: "done", url: result.url, studioUrl: result.studio_url });
    } catch (error) {
      setPhase({
        state: "error",
        message: error instanceof Error ? error.message : "Upload failed.",
      });
    }
  };

  const saveByHand = () => {
    if (!videoUrl) return;
    const link = document.createElement("a");
    link.href = videoUrl;
    link.download = fileName;
    link.click();
  };

  const canPost =
    Boolean(jobId) &&
    title.trim().length > 0 &&
    status?.authorized &&
    phase.state !== "uploading";

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 py-8 sm:px-6">
      <header className="mb-5 text-center">
        <h1 className="text-[19px] font-semibold tracking-tight">
          Upload to YouTube
        </h1>
        <p className="mt-1 text-[13px] text-muted">
          {captioned ? "Your captioned Short is ready." : "Your clip, uncaptioned."}
        </p>
      </header>

      {phase.state === "done" ? (
        <div className="rounded-2xl border border-mint/30 bg-mint/[0.06] p-4 text-center">
          <p className="text-[13.5px] font-semibold text-mint">It&apos;s up.</p>
          <p className="mt-1 text-[12.5px] text-muted">Posted as “{title}”.</p>
          <div className="mt-3 flex justify-center gap-2">
            <a
              href={phase.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-mint px-3 py-2 text-[12.5px] font-semibold text-ink"
            >
              Watch it
            </a>
            <a
              href={phase.studioUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-line px-3 py-2 text-[12.5px] text-muted transition-colors hover:text-chalk"
            >
              Open in Studio
            </a>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-ink-2 p-4">
          {status?.authorized ? (
            <>
              <label
                htmlFor="yt-title"
                className="mb-1.5 block text-[12px] font-semibold"
              >
                Title
              </label>
              <input
                id="yt-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                placeholder="What people see under your Short"
                className="mb-3 w-full rounded-lg border border-line bg-ink px-3 py-2.5 text-[13.5px] text-chalk outline-none transition-colors placeholder:text-muted/60 focus:border-muted/60"
              />

              <label
                htmlFor="yt-desc"
                className="mb-1.5 block text-[12px] font-semibold"
              >
                Description
              </label>
              <textarea
                id="yt-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Optional"
                className="mb-3 w-full resize-y rounded-lg border border-line bg-ink px-3 py-2.5 text-[13px] leading-relaxed text-chalk outline-none transition-colors placeholder:text-muted/60 focus:border-muted/60"
              />

              <div className="mb-3 flex gap-2">
                {["public", "unlisted", "private"].map((option) => (
                  <button
                    key={option}
                    onClick={() => setPrivacy(option)}
                    className={`flex-1 rounded-lg border px-2 py-2 text-[12.5px] capitalize transition-colors ${
                      privacy === option
                        ? "border-volt/50 bg-volt/[0.07] text-chalk"
                        : "border-line text-muted hover:text-chalk"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>

              {jobId ? (
                <button
                  onClick={post}
                  disabled={!canPost}
                  className="w-full rounded-xl bg-[#FF0033] px-4 py-3.5 text-[14px] font-semibold text-white transition-transform enabled:hover:-translate-y-px disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
                >
                  {phase.state === "uploading"
                    ? `Posting ${Math.round(phase.percent)}%`
                    : title.trim()
                      ? "Post to YouTube"
                      : "Give it a title first"}
                </button>
              ) : (
                <button
                  onClick={onBackToCaptions}
                  className="w-full rounded-xl border border-line bg-ink px-4 py-3.5 text-[13.5px] font-semibold text-chalk transition-colors hover:border-muted/50"
                >
                  Download the clip first →
                </button>
              )}

              {phase.state === "uploading" ? (
                <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full bg-[#FF0033] transition-[width] duration-300"
                    style={{ width: `${phase.percent}%` }}
                  />
                </div>
              ) : null}

              {!jobId ? (
                <p className="mt-2.5 text-center text-[12px] leading-relaxed text-muted">
                  Posting sends the captioned file, so it has to be made first.
                </p>
              ) : null}
            </>
          ) : (
            /*
             * Not signed in — lead with the manual handoff rather than a
             * sign-in button. Google shows an unverified-app warning on the
             * way through, and a demo that lands on it because a token quietly
             * expired is worse than one that just saves the file. Connecting
             * stays available, deliberately quiet.
             */
            <>
              <a
                href="https://www.youtube.com/upload"
                target="_blank"
                rel="noreferrer"
                onClick={saveByHand}
                className="block rounded-xl bg-[#FF0033] px-4 py-3.5 text-center text-[14px] font-semibold text-white transition-transform hover:-translate-y-px"
              >
                Save it &amp; open YouTube
              </a>
              <p className="mt-2.5 text-center text-[12px] text-muted">
                Saves the MP4 and opens YouTube, ready to drop in.
              </p>
              {status?.configured ? (
                <>
                  <div className="my-3 flex items-center gap-3">
                    <span className="h-px flex-1 bg-line" />
                    <span className="text-[11px] uppercase tracking-wider text-muted">
                      or
                    </span>
                    <span className="h-px flex-1 bg-line" />
                  </div>
                  <button
                    onClick={connect}
                    className="w-full rounded-xl border border-line bg-ink px-4 py-3 text-[13.5px] font-semibold text-chalk transition-colors hover:border-muted/50"
                  >
                    Post automatically instead
                  </button>
                  <p className="mt-2 text-center text-[11.5px] leading-relaxed text-muted">
                    Sign in to your channel once and Kaptra posts straight to
                    it — no saving, no dragging.
                  </p>
                </>
              ) : null}
            </>
          )}

          {phase.state === "error" ? (
            <p className="mt-2.5 text-[12px] leading-relaxed text-[#ff8a7a]">
              {phase.message}
            </p>
          ) : null}
        </div>
      )}

      {status?.authorized && phase.state !== "done" ? (
        <button
          onClick={saveByHand}
          disabled={!videoUrl}
          className="mt-3 w-full rounded-lg border border-line px-3 py-2 text-[12.5px] text-muted transition-colors enabled:hover:border-muted/50 enabled:hover:text-chalk disabled:text-muted/40"
        >
          Save the file instead
        </button>
      ) : null}

      <button
        onClick={onRestart}
        className="mt-2 w-full rounded-lg px-3 py-2 text-[12.5px] text-muted transition-colors hover:text-chalk"
      >
        Start over with a new clip
      </button>
    </div>
  );
}
