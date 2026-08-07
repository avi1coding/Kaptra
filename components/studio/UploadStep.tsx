"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type YouTubeStatus,
  youtubeAuthorizeUrl,
  youtubeStatus,
  youtubeUpload,
  youtubeUploadFile,
} from "@/lib/api";

type Phase =
  | { state: "idle" }
  | { state: "uploading"; percent: number }
  | { state: "done"; url: string; studioUrl: string }
  | { state: "error"; message: string };

export function UploadStep({
  videoUrl,
  fileName,
  jobId,
  sourceFile,
  captioned,
  hasCaptions,
  title,
  description,
  privacy,
  onTitle,
  onDescription,
  onPrivacy,
  onBackToCaptions,
  onRestart,
}: {
  videoUrl: string | null;
  fileName: string;
  jobId: string | null;
  sourceFile: File | null;
  captioned: boolean;
  hasCaptions: boolean;
  title: string;
  description: string;
  privacy: string;
  onTitle: (value: string) => void;
  onDescription: (value: string) => void;
  onPrivacy: (value: string) => void;
  onBackToCaptions: () => void;
  onRestart: () => void;
}) {
  const [status, setStatus] = useState<YouTubeStatus | null>(null);
  const [phase, setPhase] = useState<Phase>({ state: "idle" });

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
    if (!jobId && !sourceFile) return;
    setPhase({ state: "uploading", percent: 0 });
    try {
      const onProgress = (percent: number) =>
        setPhase({ state: "uploading", percent });
      const result = jobId
        ? await youtubeUpload({ jobId, title, privacy, description }, onProgress)
        : await youtubeUploadFile(
            sourceFile as File,
            { title, privacy, description },
            onProgress,
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

  const hasSomethingToPost = Boolean(jobId) || Boolean(sourceFile);
  const needsExport = !jobId && hasCaptions && Boolean(sourceFile);

  const canPost =
    hasSomethingToPost &&
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
                onChange={(e) => onTitle(e.target.value)}
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
                onChange={(e) => onDescription(e.target.value)}
                rows={3}
                placeholder="Optional"
                className="mb-3 w-full resize-y rounded-lg border border-line bg-ink px-3 py-2.5 text-[13px] leading-relaxed text-chalk outline-none transition-colors placeholder:text-muted/60 focus:border-muted/60"
              />

              <div className="mb-3 flex gap-2">
                {["public", "unlisted", "private"].map((option) => (
                  <button
                    key={option}
                    onClick={() => onPrivacy(option)}
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

              {needsExport ? (
                <button
                  onClick={onBackToCaptions}
                  className="w-full rounded-xl bg-volt px-4 py-3.5 text-[14px] font-semibold text-ink transition-transform hover:-translate-y-px"
                >
                  Export your captions first →
                </button>
              ) : (
                <button
                  onClick={post}
                  disabled={!canPost}
                  className="w-full rounded-xl bg-[#FF0033] px-4 py-3.5 text-[14px] font-semibold text-white transition-transform enabled:hover:-translate-y-px disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
                >
                  {phase.state === "uploading"
                    ? `Posting ${Math.round(phase.percent)}%`
                    : !hasSomethingToPost
                      ? "Nothing to post yet"
                      : !title.trim()
                        ? "Give it a title first"
                        : jobId
                          ? "Post to YouTube"
                          : "Post the clip as it is"}
                </button>
              )}

              {needsExport ? (
                <button
                  onClick={post}
                  disabled={!canPost}
                  className="mt-2 w-full rounded-xl border border-line bg-ink px-4 py-3 text-[13.5px] font-semibold text-chalk transition-colors enabled:hover:border-muted/50 disabled:cursor-not-allowed disabled:text-muted"
                >
                  {phase.state === "uploading"
                    ? `Posting ${Math.round(phase.percent)}%`
                    : "Post without captions anyway"}
                </button>
              ) : !jobId && sourceFile ? (
                <button
                  onClick={onBackToCaptions}
                  className="mt-2 w-full rounded-xl border border-line bg-ink px-4 py-3 text-[13.5px] font-semibold text-chalk transition-colors hover:border-muted/50"
                >
                  Add captions first →
                </button>
              ) : null}

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
                  {needsExport
                    ? "Your captions haven't been burned in yet, so posting now would send the clip without them."
                    : "This posts the clip exactly as you dropped it in, with no captions burned on."}
                </p>
              ) : null}

            </>
          ) : (
            <>
              <button
                onClick={connect}
                disabled={!status?.configured}
                className="w-full rounded-xl bg-[#FF0033] px-4 py-3.5 text-[14px] font-semibold text-white transition-transform enabled:hover:-translate-y-px disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
              >
                {status?.configured
                  ? "Sign in to YouTube"
                  : "YouTube posting isn't set up"}
              </button>
              <p className="mt-2.5 text-center text-[12px] leading-relaxed text-muted">
                {status?.configured
                  ? "Sign in to your channel once and Kaptra posts to it by itself."
                  : "Add your Google client ID and secret to the backend to post from here."}
              </p>
            </>
          )}

          {phase.state === "error" ? (
            <p className="mt-2.5 text-[12px] leading-relaxed text-[#ff8a7a]">
              {phase.message}
            </p>
          ) : null}
        </div>
      )}

      {phase.state !== "done" ? (
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
