import type { TranscriptResponse } from "./types";

export const API_BASE = (process.env.NEXT_PUBLIC_KAPTRA_API ?? "").replace(
  /\/$/,
  "",
);

export const isBackendConfigured = () => API_BASE.length > 0;

type ProgressFn = (fraction: number) => void;

function upload<T>(
  path: string,
  form: FormData,
  responseType: "json" | "blob",
  onProgress?: ProgressFn,
): { promise: Promise<T>; xhr: XMLHttpRequest } {
  const xhr = new XMLHttpRequest();

  const promise = new Promise<T>((resolve, reject) => {
    xhr.open("POST", `${API_BASE}${path}`);
    xhr.responseType = responseType === "blob" ? "blob" : "json";

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(event.loaded / event.total);
      }
    };

    xhr.onerror = () =>
      reject(
        new Error(
          `Could not reach the Kaptra backend at ${API_BASE}. Is it running?`,
        ),
      );

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response as T);
        return;
      }
      let detail = `HTTP ${xhr.status}`;
      try {
        const body =
          xhr.response instanceof Blob
            ? JSON.parse(await xhr.response.text())
            : xhr.response;
        if (body && typeof body === "object" && "detail" in body) {
          detail = String((body as { detail: unknown }).detail);
        }
      } catch {
        /* keep the status-code fallback */
      }
      reject(new Error(detail));
    };

    xhr.send(form);
  });

  return { promise, xhr };
}

export async function transcribe(
  file: File,
  onProgress?: ProgressFn,

): Promise<TranscriptResponse> {
  const form = new FormData();
  form.append("file", file);
  return upload<TranscriptResponse>("/transcribe", form, "json", onProgress)
    .promise;
}

function newJobId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `job-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

export async function render(
  file: File,
  ass: string,
  handlers: {
    onUpload?: ProgressFn;
    onRender?: (percent: number) => void;
    onJobId?: (jobId: string) => void;
  } = {},
): Promise<Blob> {
  const jobId = newJobId();
  handlers.onJobId?.(jobId);

  const form = new FormData();
  form.append("file", file);
  form.append("job_id", jobId);
  form.append(
    "subtitles",
    new Blob([ass], { type: "text/plain" }),
    "captions.ass",
  );

  const { promise } = upload<Blob>("/render", form, "blob", handlers.onUpload);

  let polling = true;
  const poll = async () => {
    while (polling) {
      await new Promise((r) => setTimeout(r, 500));
      if (!polling) break;
      try {
        const response = await fetch(`${API_BASE}/progress/${jobId}`);
        if (!response.ok) continue;
        const data = await response.json();
        if (data.state === "rendering" || data.state === "finishing") {
          handlers.onRender?.(data.percent ?? 0);
        }
      } catch {
        // A dropped poll is not a failed render — the upload promise decides.
      }
    }
  };
  void poll();

  try {
    return await promise;
  } finally {
    polling = false;
  }
}

export type YouTubeStatus = { configured: boolean; authorized: boolean };

export async function youtubeStatus(): Promise<YouTubeStatus> {
  const response = await fetch(`${API_BASE}/youtube/status`);
  if (!response.ok) throw new Error("Could not read YouTube status.");
  return response.json();
}

export async function youtubeAuthorizeUrl(): Promise<string> {
  const response = await fetch(`${API_BASE}/youtube/authorize`);
  const body = await response.json();
  if (!response.ok) throw new Error(body.detail ?? "Could not start sign-in.");
  return body.url;
}

export type YouTubeResult = { video_id: string; url: string; studio_url: string };

export async function youtubeUploadFile(
  file: File,
  options: { title: string; privacy: string; description?: string },
  onProgress?: (percent: number) => void,
): Promise<YouTubeResult> {
  const jobId =
    globalThis.crypto?.randomUUID?.() ?? `clip-${Date.now()}`;

  const form = new FormData();
  form.append("file", file);
  form.append("job_id", jobId);
  form.append("title", options.title);
  form.append("privacy", options.privacy);
  form.append("description", options.description ?? "");

  let polling = true;
  void (async () => {
    while (polling) {
      await new Promise((r) => setTimeout(r, 600));
      if (!polling) break;
      try {
        const res = await fetch(`${API_BASE}/progress/${jobId}:yt`);
        if (!res.ok) continue;
        const data = await res.json();
        if (data.state === "uploading") onProgress?.(data.percent ?? 0);
      } catch {
        /* a dropped poll doesn't fail the upload */
      }
    }
  })();

  try {
    const response = await fetch(`${API_BASE}/youtube/upload-file`, {
      method: "POST",
      body: form,
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.detail ?? "Upload failed.");
    return body;
  } finally {
    polling = false;
  }
}

export async function youtubeUpload(
  options: { jobId: string; title: string; privacy: string; description?: string },
  onProgress?: (percent: number) => void,
): Promise<YouTubeResult> {
  const form = new FormData();
  form.append("job_id", options.jobId);
  form.append("title", options.title);
  form.append("privacy", options.privacy);
  form.append("description", options.description ?? "");

  let polling = true;
  void (async () => {
    while (polling) {
      await new Promise((r) => setTimeout(r, 600));
      if (!polling) break;
      try {
        const res = await fetch(`${API_BASE}/progress/${options.jobId}:yt`);
        if (!res.ok) continue;
        const data = await res.json();
        if (data.state === "uploading") onProgress?.(data.percent ?? 0);
      } catch {
        /* a dropped poll doesn't fail the upload */
      }
    }
  })();

  try {
    const response = await fetch(`${API_BASE}/youtube/upload`, {
      method: "POST",
      body: form,
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.detail ?? "Upload failed.");
    return body;
  } finally {
    polling = false;
  }
}

export type SuggestedStyle = Partial<{
  font: string;
  size: number;
  color: string;
  emphasisColor: string;
  activeColor: string;
  outlineColor: string;
  outline: number;
  shadow: number;
  position: "top" | "middle" | "bottom";
  margin: number;
  uppercase: boolean;
  maxWords: number;
  animation: "pop" | "karaoke" | "none";
  highlightBox: boolean;
  boxColor: string;
}> & { reason: string };

export async function suggestStyle(
  file: File,
  transcript: string,
  onUpload?: ProgressFn,
): Promise<SuggestedStyle> {
  const form = new FormData();
  form.append("file", file);
  form.append("transcript", transcript.slice(0, 1200));
  return upload<SuggestedStyle>("/suggest-style", form, "json", onUpload).promise;
}
