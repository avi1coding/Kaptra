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

export function progressPercent(status: RenderStatus): number {
  if (status.state === "uploading") return status.progress * 33;
  if (status.state === "transcribing") return 55;
  if (status.state === "rendering") return 33 + status.percent * 0.67;
  if (status.state === "done") return 100;
  return 0;
}

export function hasRealPercent(status: RenderStatus) {
  return status.state === "uploading" || status.state === "rendering";
}
