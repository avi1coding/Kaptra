import type { RenderStatus } from "./types";

export const PROGRESS_LABEL: Record<RenderStatus["state"], string> = {
  idle: "",
  uploading: "Uploading clip",
  transcribing: "Transcribing",
  rendering: "Burning captions with ffmpeg",
  done: "Done",
  error: "Failed",
};

export function isBusy(status: RenderStatus) {
  return (
    status.state === "uploading" ||
    status.state === "transcribing" ||
    status.state === "rendering"
  );
}

/**
 * Upload is the first third of the bar, the encode the rest. Transcription has
 * no measurable progress — Whisper reports nothing until it's finished — so it
 * sits at a fixed point and pulses instead of pretending to advance.
 */
export function progressPercent(status: RenderStatus): number {
  if (status.state === "uploading") return status.progress * 33;
  if (status.state === "transcribing") return 55;
  if (status.state === "rendering") return 33 + status.percent * 0.67;
  if (status.state === "done") return 100;
  return 0;
}

/** True when the number shown is measured rather than a placeholder. */
export function hasRealPercent(status: RenderStatus) {
  return status.state === "uploading" || status.state === "rendering";
}
