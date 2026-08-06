"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CaptionOverlay } from "@/components/CaptionOverlay";
import { ShortFrame, SyntheticFootage } from "@/components/ShortFrame";
import { usePlayhead } from "@/components/usePlayhead";
import { useUndoable } from "@/components/useUndoable";
import {
  isBackendConfigured,
  render,
  suggestStyle,
  transcribe,
} from "@/lib/api";
import { DEFAULT_FRAME, type Frame, buildAss } from "@/lib/ass";
import { ensureEmphasis } from "@/lib/emphasis";
import { MOCK_DURATION, MOCK_WORDS, fitToDuration } from "@/lib/mock";
import { DEFAULT_PRESET, PRESETS } from "@/lib/presets";
import { isBusy } from "@/lib/progress";
import type { CaptionStyle, RenderStatus, Word } from "@/lib/types";
import { ClipStep } from "./ClipStep";
import { Dropzone } from "./Dropzone";
import { ExportCard } from "./ExportCard";
import { STEP_ORDER, type Step, type StepState, StepBar } from "./StepBar";
import { StylePanel } from "./StylePanel";
import { TaskProgress } from "./TaskProgress";
import { Tour } from "./Tour";
import { TranscriptPanel } from "./TranscriptPanel";
import { UploadStep } from "./UploadStep";
import { Panel, Toggle } from "./controls";

const backendReady = isBackendConfigured();

/** Everything a single undo step can move. */
type Doc = {
  style: CaptionStyle;
  words: Word[];
  presetId: string | null;
};

/**
 * Controls that fire continuously — a slider sweep or a caption drag. Edits to
 * these merge into one undo step so a gesture doesn't cost thirty of them.
 */
const CONTINUOUS_CONTROLS = new Set([
  "anchor", "size", "margin", "outline", "shadow", "maxWords",
  "color", "activeColor", "emphasisColor", "outlineColor", "boxColor",
]);

export function Studio() {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(MOCK_DURATION);
  // Style, transcript and preset move together under one undo history — a
  // single Cmd+Z should step back whatever the last edit was, wherever it was.
  const doc = useUndoable<Doc>({
    style: DEFAULT_PRESET.style,
    words: MOCK_WORDS,
    presetId: DEFAULT_PRESET.id,
  });
  const { style, words, presetId } = doc.value;
  // "" = caption in whatever language was spoken.
  const [language, setLanguage] = useState<string | null>(null);
  const [transcriptWarning, setTranscriptWarning] = useState<string | null>(null);
  const [status, setStatus] = useState<RenderStatus>({ state: "idle" });
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoTime, setVideoTime] = useState(0);
  // The clip's true pixel dimensions. They set both the preview's shape and
  // the .ass canvas, so captions keep their proportions on any aspect ratio.
  const [frame, setFrame] = useState<Frame>(DEFAULT_FRAME);
  /**
   * ffmpeg decodes far more containers than any browser will play — MKV, AVI,
   * WMV and friends upload and render fine but can't be shown in a <video>.
   * When that happens we fall back to the synthetic backdrop so styling still
   * works, rather than leaving a dead black rectangle.
   */
  const [previewUnsupported, setPreviewUnsupported] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [step, setStep] = useState<Step>("clip");
  // Captioning is opt-in: plenty of Shorts don't want burned-in text, and
  // transcribing a clip nobody asked to caption is work for nothing.
  const [captionsAsked, setCaptionsAsked] = useState(false);
  const [transcribed, setTranscribed] = useState(false);
  const [tourPreview, setTourPreview] = useState(false);
  // Identifies the render the backend still holds, so it can post it directly.
  const [renderJobId, setRenderJobId] = useState<string | null>(null);
  // Skipping is a deliberate choice worth showing back to the user, so it is
  // tracked separately from "not done yet".
  const [skipped, setSkipped] = useState<Record<Step, boolean>>({
    clip: false,
    captions: false,
    upload: false,
  });
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const outputUrlRef = useRef<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const hasVideo = videoUrl !== null;
  const canPlay = hasVideo && !previewUnsupported;
  const aspect = frame.width / frame.height;
  // While a clip is uploading, transcribing or rendering, the transcript and
  // style are already committed to that job — letting playback or edits run
  // would show something the output won't match.
  const locked = isBusy(status);

  // Without a playable <video> — demo mode, or an unsupported container — a
  // synthetic playhead drives the preview so the transport behaves the same.
  const demo = usePlayhead(duration, !canPlay);
  const time = canPlay ? videoTime : demo.time;
  const playing = canPlay ? videoPlaying : demo.playing;

  /* ── playback clock ──────────────────────────────────────────────── */
  useEffect(() => {
    if (!canPlay || !videoPlaying) return;
    let frame = 0;
    const tick = () => {
      const video = videoRef.current;
      if (video) setVideoTime(video.currentTime);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [canPlay, videoPlaying]);

  /* ── object URL lifecycle ────────────────────────────────────────── */
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  useEffect(() => {
    return () => {
      if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
    };
  }, []);

  /* ── loading a clip ──────────────────────────────────────────────── */
  const runTranscription = useCallback(
    async (target: File) => {
      try {
        setStatus({ state: "uploading", progress: 0 });
        const result = await transcribe(
          target,
          // Once the bytes are up, Whisper is what we're waiting on — showing
          // "Uploading 100%" for the whole model pass reads as a stall.
          (progress) =>
            setStatus(
              progress >= 1
                ? { state: "transcribing" }
                : { state: "uploading", progress },
            ),
        );
        const fresh = ensureEmphasis(result.words ?? []);
        setTranscribed(true);
        // A new transcript is a new document — keeping the old history would
        // let undo restore words from a clip that is no longer loaded.
        doc.reset((d) => ({ ...d, words: fresh }));
        setLanguage(result.language ?? null);
        setTranscriptWarning(result.warning ?? null);
        if (result.duration) setDuration(result.duration);
        setStatus({ state: "idle" });
        return fresh;
      } catch (error) {
        setStatus({
          state: "error",
          message:
            error instanceof Error
              ? error.message
              : "Couldn't read that clip's audio. Try another one.",
        });
      }
      return null;
    },
    // doc.reset is stable; listing `doc` would re-create this every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const retranscribe = runTranscription;

  const handleFile = useCallback(
    async (nextFile: File) => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      setFile(nextFile);
      setVideoUrl(URL.createObjectURL(nextFile));
      setVideoTime(0);
      setVideoPlaying(false);
      setPreviewUnsupported(false);
      setStatus({ state: "idle" });
      setCaptionsAsked(false);
      setTranscribed(false);
    },
    [videoUrl],
  );

  /**
   * With no backend the sample transcript is stretched to the clip's length,
   * so the captions still track real footage during a demo.
   */
  const handleMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.videoWidth && video.videoHeight) {
      setFrame({ width: video.videoWidth, height: video.videoHeight });
    }
    if (!isFinite(video.duration)) return;
    setDuration(video.duration);
    if (!backendReady)
      doc.reset((d) => ({ ...d, words: fitToDuration(MOCK_WORDS, video.duration) }));
  };

  /* ── style ───────────────────────────────────────────────────────── */
  const patchStyle = (patch: Partial<CaptionStyle>) => {
    const keys = Object.keys(patch);
    // Continuous controls collapse a whole gesture into one undo step.
    const coalesce =
      keys.length === 1 && CONTINUOUS_CONTROLS.has(keys[0]) ? keys[0] : undefined;
    doc.update(
      (d) => ({ ...d, style: { ...d.style, ...patch }, presetId: null }),
      coalesce,
    );
  };

  const applyPreset = (id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    doc.update((d) => ({ ...d, style: preset.style, presetId: preset.id }));
  };

  const toggleEmphasis = (index: number) => {
    doc.update((d) => ({
      ...d,
      words: d.words.map((w, i) =>
        i === index ? { ...w, emphasis: !w.emphasis } : w,
      ),
    }));
  };

  /* ── freeze playback while work is in flight ─────────────────────── */
  useEffect(() => {
    if (!locked) return;
    const video = videoRef.current;
    if (video && !video.paused) video.pause();
    setVideoPlaying(false);
    if (demo.playing) demo.setPlaying(false);
    // demo is recreated each render; only the locked transition matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

  /* ── fullscreen ──────────────────────────────────────────────────── */
  const openFullscreen = () => {
    // Promote the stage node that already holds the <video>. Rendering a
    // second <video> in an overlay instead meant a fresh element starting at
    // time 0 while the original kept decoding behind it — the picture
    // restarted and its audio carried on. One element can't desync from
    // itself. Must fire inside the click: the API refuses calls made outside
    // a user gesture.
    stageRef.current?.requestFullscreen?.().catch(() => {});
    setFullscreen(true);
  };

  const closeFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    setFullscreen(false);
  };


  /* ── AI style suggestion ─────────────────────────────────────────── */
  const askForStyle = async () => {
    if (!file) return;
    setSuggesting(true);
    setSuggestError(null);
    setSuggestion(null);
    try {
      const { reason, ...patch } = await suggestStyle(
        file,
        words.map((w) => w.text).join(" "),
      );
      // One undo step: the whole suggestion is a single decision to reject.
      doc.update((d) => ({
        ...d,
        style: { ...d.style, ...(patch as Partial<CaptionStyle>), anchor: null },
        presetId: null,
      }));
      setSuggestion(reason);
    } catch (error) {
      setSuggestError(
        error instanceof Error ? error.message : "Couldn't suggest a style.",
      );
    } finally {
      setSuggesting(false);
    }
  };

  /* ── undo / redo ─────────────────────────────────────────────────── */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== "z" && event.key.toLowerCase() !== "y")
        return;

      // Don't hijack undo inside a text field or colour picker.
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }

      event.preventDefault();
      const redoing = event.key.toLowerCase() === "y" || event.shiftKey;
      if (redoing) doc.redo();
      else doc.undo();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doc]);

  /* ── transport — drives the video or the demo playhead ───────────── */
  const seek = (seconds: number) => {
    if (locked) return;
    if (!canPlay) {
      demo.seek(seconds);
      return;
    }
    const video = videoRef.current;
    if (video) {
      video.currentTime = seconds;
      setVideoTime(seconds);
    }
  };

  const togglePlay = () => {
    if (locked) return;
    if (!canPlay) {
      demo.toggle();
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      setVideoPlaying(true);
    } else {
      video.pause();
      setVideoPlaying(false);
    }
  };

  // Read through a ref so this binds once per fullscreen session rather than
  // per render — re-subscribing every frame of playback is what used to tear
  // fullscreen back down.
  const togglePlayRef = useRef(togglePlay);
  togglePlayRef.current = togglePlay;

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
      if (e.key === " ") {
        e.preventDefault();
        togglePlayRef.current();
      }
    };
    // Chrome swallows the Escape keydown when it exits fullscreen itself, so
    // this — not onKey — is what usually closes us.
    const onFsChange = () => {
      if (!document.fullscreenElement) setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFsChange);
    };
  }, [fullscreen]);

  /* ── export ──────────────────────────────────────────────────────── */
  const ass = useMemo(() => buildAss(words, style, frame), [words, style, frame]);



  const startRender = async () => {
    if (!file) return;
    try {
      setStatus({ state: "uploading", progress: 0 });
      setRenderJobId(null);
      const blob = await render(file, ass, {
        onJobId: setRenderJobId,
        onUpload: (progress) =>
          setStatus(
            progress >= 1
              ? { state: "rendering", percent: 0 }
              : { state: "uploading", progress },
          ),
        // Real percentage straight from ffmpeg, not a staged guess.
        onRender: (percent) => setStatus({ state: "rendering", percent }),
      });
      if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
      const url = URL.createObjectURL(blob);
      outputUrlRef.current = url;
      setStatus({ state: "done", url });

      // The button says "Download clip", so it downloads. Leaving the file
      // sitting behind a second click made the label a promise the step didn't
      // keep.
      const link = document.createElement("a");
      link.href = url;
      link.download = downloadName;
      link.click();
    } catch (error) {
      setStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Rendering failed.",
      });
    }
  };

  const startCaptioning = async () => {
    setCaptionsAsked(true);
    if (file && backendReady && !transcribed) {
      await runTranscription(file);
    }
  };

  const reset = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
    outputUrlRef.current = null;
    setFile(null);
    setVideoUrl(null);
    doc.reset((d) => ({ ...d, words: MOCK_WORDS }));
    setLanguage(null);
    setTranscriptWarning(null);
    setSuggestion(null);
    setSuggestError(null);
    setCaptionsAsked(false);
    setTranscribed(false);
    setDuration(MOCK_DURATION);
    setVideoTime(0);
    setVideoPlaying(false);
    setPreviewUnsupported(false);
    setFrame(DEFAULT_FRAME);
    setStatus({ state: "idle" });
  };

  const settle = (id: Step, done: boolean): StepState =>
    done ? "done" : skipped[id] ? "skipped" : "todo";

  const stepStates: Record<Step, StepState> = {
    clip: settle("clip", Boolean(file)),
    // Ticked once captions actually exist. Waiting for a render meant styling
    // a clip and moving on left the step looking untouched.
    captions: settle(
      "captions",
      status.state === "done" || (captionsAsked && transcribed),
    ),
    upload: "todo",
  };

  // Without a backend there is nothing to wait for — the sample transcript is
  // already loaded, so the controls can appear the moment captions are asked for.
  const captionsReady =
    (captionsAsked && (transcribed || !backendReady)) || tourPreview;

  const position = STEP_ORDER.indexOf(step);
  const isLast = position === STEP_ORDER.length - 1;

  const advance = (asSkip: boolean) => {
    setSkipped((prev) => ({ ...prev, [step]: asSkip }));
    if (!isLast) setStep(STEP_ORDER[position + 1]);
  };
  const goBack = () => {
    if (position > 0) setStep(STEP_ORDER[position - 1]);
  };

  // You can't caption a clip you haven't picked, so step one is the one thing
  // that has to be done rather than skipped.
  const canAdvance = step !== "clip" || Boolean(file);
  // Nothing on the captions step is mandatory, but leaving mid-render would
  // strand the job, so Next waits for it.
  const nextBlocked = step === "captions" && locked;

  /* The captioned render if there is one, otherwise the clip as it came in —
     skipping the captions step still has to leave something to upload. */
  const finalVideoUrl = status.state === "done" ? status.url : videoUrl;

  /* YouTube takes its default title straight from the file name, so the export
     keeps yours. Naming every download "kaptra-short" meant every upload
     arrived pre-titled "kaptra-short". Extension is forced to .mp4 because
     that is what the render produces, whatever went in. */
  const downloadName = file
    ? `${file.name.replace(/\.[^.]+$/, "")}.mp4`
    : "video.mp4";

  return (
    <>
      <StepBar
        current={step}
        states={stepStates}
        onSelect={setStep}
        onBack={position > 0 ? goBack : undefined}
        // Only the genuinely optional steps offer it.
        onSkip={
          step === "captions" ? () => advance(true) : undefined
        }
        onNext={isLast ? undefined : () => advance(false)}
        canNext={canAdvance && !nextBlocked}
        nextLabel={step === "clip" ? "Start captioning" : "Next"}
      />
      {step === "clip" ? (
        <ClipStep
          file={file}
          duration={duration}
          onFile={handleFile}
          onClear={reset}
        />
      ) : null}
      {step === "upload" ? (
        <UploadStep
          videoUrl={finalVideoUrl}
          fileName={downloadName}
          jobId={renderJobId}
          captioned={status.state === "done"}
          onBackToCaptions={() => setStep("captions")}
          onRestart={() => {
            reset();
            setStep("clip");
          }}
        />
      ) : null}
      {/* Kept mounted rather than unmounted while you're on another step: the
          <video>, its object URL and the whole undo history live in here, and
          remounting would reload the clip and lose the playhead. */}
      <div className={step === "captions" ? "" : "hidden"}>
        {/* Desktop is an app shell: the page itself never scrolls, each column
            scrolls on its own. Below lg it collapses back to normal page flow.
            The height budget also has to clear the step bar above it. */}
        <div className="mx-auto grid w-full max-w-[1400px] gap-4 px-4 py-6 md:grid-cols-2 md:grid-rows-[auto_auto] lg:h-[calc(100dvh-8rem)] lg:grid-cols-[300px_minmax(0,1fr)_320px] lg:grid-rows-1 lg:overflow-hidden lg:py-4">
      {/* ── Source ──────────────────────────────────────────────────── */}
      <div className="scroll-thin space-y-4 md:col-start-2 md:row-start-1 lg:col-start-1 lg:row-start-1 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
        <Panel title="Source" tourId="source">
          {file ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-lg border border-line bg-ink p-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-line text-[11px] font-bold">
                  MP4
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">
                    {file.name}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted">
                    {(file.size / 1_048_576).toFixed(1)} MB ·{" "}
                    {duration.toFixed(1)}s
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  reset();
                  setStep("clip");
                }}
                className="w-full rounded-lg border border-line px-3 py-2 text-[12.5px] text-muted transition-colors hover:border-muted/50 hover:text-chalk"
              >
                Choose a different clip
              </button>
            </div>
          ) : (
            <Dropzone onFile={handleFile} />
          )}

          {backendReady && language ? (
            <p className="mt-3 border-t border-line pt-3 text-[12px] text-muted">
              Captions in{" "}
              <span className="text-chalk">{languageName(language)}</span>, the
              language of your audio.
            </p>
          ) : null}
        </Panel>

        {captionsReady ? (
          <TranscriptPanel
            words={words}
            time={time}
            onToggleEmphasis={toggleEmphasis}
            onSeek={seek}
          />
        ) : null}
      </div>

      {/* ── Preview ─────────────────────────────────────────────────── */}
      <div className="scroll-thin order-first md:order-none md:col-start-1 md:row-span-2 md:row-start-1 lg:col-start-2 lg:row-span-1 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain">
        {/* Vertical centring is right in the desktop app shell, where the cell
            is exactly viewport height. On tablet the cell spans two tall rows,
            so centring buried the preview a thousand pixels down — there it
            pins to the top and sticks instead. */}
        <div className="flex min-h-full flex-col items-center justify-center gap-3 md:sticky md:top-20 md:min-h-0 md:justify-start lg:min-h-full lg:justify-center">
          {/* Width follows the clip's aspect so the whole frame fits the
              column's height, whatever shape the video is. */}
          <div
            data-tour="preview"
            // The viewport-height fit only makes sense in the desktop app
            // shell; as an inline style it also applied on phones, where the
            // column scrolls and it just made the preview needlessly small.
            className="w-full max-w-[340px] lg:w-[min(340px,var(--preview-w))]"
            style={
              { "--preview-w": `calc((100dvh - 15rem) * ${aspect.toFixed(4)})` } as React.CSSProperties
            }
          >
            <div
              ref={stageRef}
              className={
                fullscreen
                  ? "flex h-full w-full flex-col items-center justify-center gap-4 bg-black p-4"
                  : "relative"
              }
            >
              <div
                className="relative w-full"
                style={
                  fullscreen
                    ? {
                        // Fit whichever dimension runs out first.
                        height: `min(calc(100vh - 9rem), 100vw / ${aspect})`,
                        width: "auto",
                        aspectRatio: aspect,
                        maxWidth: "100%",
                      }
                    : undefined
                }
              >
              <ShortFrame
                aspect={aspect}
                overlay={
                  // Nothing to preview until captions have been asked for —
                  // showing the sample words over the clip while the panel next
                  // to it asks "Add captions?" reads as already done.
                  captionsReady ? (
                    <CaptionOverlay
                      words={words}
                      style={style}
                      time={time}
                      onAnchorChange={(anchor) => patchStyle({ anchor })}
                      onSizeChange={(size) => patchStyle({ size })}
                      showGuide={!playing}
                    />
                  ) : null
                }
              >
                {videoUrl && !previewUnsupported ? (
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    className={`h-full w-full ${fullscreen ? "object-contain" : "object-cover"}`}
                    onLoadedMetadata={handleMetadata}
                    onPlay={() => setVideoPlaying(true)}
                    onPause={() => setVideoPlaying(false)}
                    onEnded={() => setVideoPlaying(false)}
                    onError={() => setPreviewUnsupported(true)}
                    onClick={togglePlay}
                    playsInline
                    style={locked ? { pointerEvents: "none" } : undefined}
                  />
                ) : (
                  <SyntheticFootage />
                )}
              </ShortFrame>
              </div>

              {fullscreen ? (
                <FullscreenChrome
                  playing={playing}
                  time={time}
                  duration={duration}
                  onTogglePlay={togglePlay}
                  onSeek={seek}
                  onClose={closeFullscreen}
                />
              ) : null}

              <button
                onClick={openFullscreen}
                aria-label="Preview fullscreen"
                title="Preview fullscreen"
                className={`absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg bg-black/55 text-chalk backdrop-blur transition-colors hover:bg-black/80 ${
                  fullscreen ? "hidden" : ""
                }`}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                </svg>
              </button>
            </div>

            <div className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-ink-2 px-3 py-2.5">
              <button
                onClick={togglePlay}
                disabled={locked}
                aria-label={playing ? "Pause" : "Play"}
                title={locked ? "Paused while Kaptra is working" : undefined}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-chalk text-ink transition-transform enabled:hover:scale-105 disabled:bg-line disabled:text-muted"
              >
                {playing ? (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="currentColor"
                  >
                    <rect x="1.5" y="1" width="3" height="10" rx="1" />
                    <rect x="7.5" y="1" width="3" height="10" rx="1" />
                  </svg>
                ) : (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="currentColor"
                  >
                    <path d="M2.5 1.4v9.2a.6.6 0 0 0 .92.5l7-4.6a.6.6 0 0 0 0-1l-7-4.6a.6.6 0 0 0-.92.5z" />
                  </svg>
                )}
              </button>

              <input
                type="range"
                min={0}
                max={Math.max(0.1, duration)}
                step={0.01}
                value={Math.min(time, duration)}
                onChange={(e) => seek(Number(e.target.value))}
                disabled={locked}
                aria-label="Seek"
                className="min-w-0 flex-1 disabled:opacity-40"
              />

              <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted">
                {time.toFixed(1)} / {duration.toFixed(1)}s
              </span>
            </div>

            {!hasVideo ? (
              <p className="mt-3 text-center text-[12px] leading-relaxed text-muted">
                A preview you can play, pause and scrub. Add your own clip to
                caption it.
              </p>
            ) : null}

            {previewUnsupported ? (
              <p className="mt-3 rounded-lg border border-line bg-ink px-3 py-2.5 text-center text-[12px] leading-relaxed text-muted">
                Your browser can&apos;t play{" "}
                <span className="text-chalk">{file?.name.split(".").pop()?.toUpperCase()}</span>{" "}
                files, so the backdrop is a stand-in. Transcription, styling and
                the final render all still work — the exported MP4 uses your
                real footage.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Style + export ──────────────────────────────────────────── */}
      <div className="scroll-thin space-y-4 md:col-start-2 md:row-start-2 lg:col-start-3 lg:row-start-1 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
        {!captionsReady ? (
          <div className="rounded-2xl border border-line bg-ink-2 p-4">
            <p className="text-[13px] font-semibold">Add captions</p>
            <button
              onClick={startCaptioning}
              disabled={!hasVideo || captionsAsked}
              className="mt-3 w-full rounded-xl bg-volt px-4 py-3 text-[14px] font-semibold text-ink transition-transform enabled:hover:-translate-y-px disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
            >
              {captionsAsked ? "Reading the audio…" : "Caption this video"}
            </button>

          </div>
        ) : null}

        <div className={captionsReady ? "space-y-4" : "hidden"}>
        <div className="flex gap-2">
          <HistoryButton
            label="Undo"
            hint="⌘Z"
            disabled={!doc.canUndo}
            onClick={doc.undo}
            flip
          />
          <HistoryButton
            label="Redo"
            hint="⇧⌘Z"
            disabled={!doc.canRedo}
            onClick={doc.redo}
          />
        </div>

        <ExportCard
          fileName={downloadName}
          status={status}
          hasVideo={hasVideo}
          backendConfigured={backendReady}
          onRender={startRender}
          onReset={reset}
        />
        <div data-tour="style" className="space-y-4">
          <StylePanel
            style={style}
            presetId={presetId}
            onPreset={applyPreset}
            onChange={patchStyle}
            onSuggest={file && backendReady && !locked ? askForStyle : null}
            suggesting={suggesting}
            suggestion={suggestion}
            suggestError={suggestError}
          />
        </div>
        </div>
        </div>
        </div>
      </div>

      <TaskProgress status={status} />
      <Tour
        currentStep={step}
        onNavigate={setStep}
        onPreview={setTourPreview}
      />
    </>
  );
}

function HistoryButton({
  label,
  hint,
  disabled,
  onClick,
  flip = false,
}: {
  label: string;
  hint: string;
  disabled: boolean;
  onClick: () => void;
  flip?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={`${label} (${hint})`}
      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-ink-2 px-3 py-2.5 text-[13px] text-chalk transition-colors enabled:hover:border-muted/50 disabled:cursor-not-allowed disabled:text-muted/40"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={flip ? undefined : { transform: "scaleX(-1)" }}
      >
        <path d="M9 14L4 9l5-5" />
        <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
      </svg>
      {label}
    </button>
  );
}

/** Best-effort pretty name for a Whisper language code. */
function languageName(code: string): string {
  try {
    return (
      new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code
    );
  } catch {
    return code;
  }
}

/**
 * Full-viewport review pass — the last look before committing to a render.
 * The same CaptionOverlay draws here, sized off the container, so the captions
 * scale up with the frame instead of staying preview-sized.
 */
/**
 * Close button and transport for fullscreen. Deliberately holds no <video> of
 * its own — it renders *inside* the stage element the browser has promoted, so
 * the clip playing behind it is the same DOM node that was playing inline.
 */
function FullscreenChrome({
  playing,
  time,
  duration,
  onTogglePlay,
  onSeek,
  onClose,
}: {
  playing: boolean;
  time: number;
  duration: number;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onClose: () => void;
}) {
  return (
    <>
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-[13px] text-chalk backdrop-blur transition-colors hover:bg-white/20"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
        Close
      </button>

      <div className="flex w-full max-w-xl items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 backdrop-blur">
        <button
          onClick={onTogglePlay}
          aria-label={playing ? "Pause" : "Play"}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-chalk text-ink transition-transform hover:scale-105"
        >
          {playing ? (
            <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor">
              <rect x="1.5" y="1" width="3" height="10" rx="1" />
              <rect x="7.5" y="1" width="3" height="10" rx="1" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor">
              <path d="M2.5 1.4v9.2a.6.6 0 0 0 .92.5l7-4.6a.6.6 0 0 0 0-1l-7-4.6a.6.6 0 0 0-.92.5z" />
            </svg>
          )}
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(0.1, duration)}
          step={0.01}
          value={Math.min(time, duration)}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Seek"
          className="min-w-0 flex-1"
        />
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-white/60">
          {time.toFixed(1)} / {duration.toFixed(1)}s
        </span>
      </div>

      <p className="text-[12px] text-white/40">
        Space to play or pause · Esc to close
      </p>
    </>
  );
}
