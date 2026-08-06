/**
 * Containers the backend will read. ffmpeg's demuxers do the actual work, so
 * this list exists for the file picker and for the honest count on the landing
 * page — nothing here is a capability claim the backend can't back up.
 */
export const VIDEO_EXTENSIONS = [
  "mp4", "m4v", "mov", "qt", "webm", "mkv", "avi", "wmv", "asf", "flv", "f4v",
  "ogv", "ogg", "mpg", "mpeg", "mpe", "m2v", "ts", "m2ts", "mts", "vob", "3gp",
  "3g2", "mxf", "rm", "rmvb", "divx", "dv", "gif",
];

/** Languages Whisper can transcribe (from faster-whisper's tokenizer table). */
export const WHISPER_LANGUAGES = 100;
