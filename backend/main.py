from __future__ import annotations

import json
import logging
import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
from pathlib import Path
from typing import NamedTuple

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.responses import HTMLResponse
from starlette.background import BackgroundTask

def load_env_file(path: Path = Path(__file__).parent / ".env") -> None:
    if not path.is_file():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        line = line.removeprefix("export ").strip()
        key, sep, value = line.partition("=")
        if not sep:
            continue
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        os.environ.setdefault(key, value)

load_env_file()

import youtube

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s")
log = logging.getLogger("kaptra")

WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")

FFMPEG_BIN = os.getenv("FFMPEG_BIN") or shutil.which("ffmpeg")

def ffmpeg_has_ass(binary: str | None) -> bool:
    if not binary:
        return False
    try:
        listing = subprocess.run(
            [binary, "-hide_banner", "-filters"],
            capture_output=True,
            text=True,
            timeout=20,
        ).stdout
    except Exception:
        return False
    return re.search(r"^\s*\S+\s+ass\s", listing, re.MULTILINE) is not None

FFMPEG_HAS_ASS = ffmpeg_has_ass(FFMPEG_BIN)
ALLOW_ORIGINS = os.getenv("KAPTRA_ALLOW_ORIGINS", "*").split(",")

EMPHASIS_MODEL = os.getenv("KAPTRA_EMPHASIS_MODEL", "claude-opus-5")

def anthropic_available() -> bool:
    if os.getenv("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_AUTH_TOKEN"):
        return True

    config_dir = Path(
        os.getenv("ANTHROPIC_CONFIG_DIR", Path.home() / ".config" / "anthropic")
    )
    credentials = config_dir / "credentials"
    return credentials.is_dir() and any(credentials.glob("*.json"))

EMPHASIS_ENABLED = anthropic_available()

MAX_UPLOAD_BYTES = int(os.getenv("KAPTRA_MAX_UPLOAD_MB", "200")) * 1024 * 1024

MUSIC_MIN_LOGPROB = float(os.getenv("KAPTRA_MUSIC_MIN_LOGPROB", "-1.0"))
MUSIC_MAX_NO_SPEECH = float(os.getenv("KAPTRA_MUSIC_MAX_NO_SPEECH", "0.6"))

SUNG_MIN_NO_SPEECH = float(os.getenv("KAPTRA_SUNG_MIN_NO_SPEECH", "0.45"))

app = FastAPI(title="Kaptra", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOW_ORIGINS],
    allow_methods=["*"],
    allow_headers=["*"],
)

_model = None
_model_lock = threading.Lock()

def get_model():
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                from faster_whisper import WhisperModel

                log.info("loading whisper model %r (%s/%s)…", WHISPER_MODEL,
                         WHISPER_DEVICE, WHISPER_COMPUTE)
                _model = WhisperModel(
                    WHISPER_MODEL,
                    device=WHISPER_DEVICE,
                    compute_type=WHISPER_COMPUTE,
                )
                log.info("model ready")
    return _model

class Probe(NamedTuple):
    decodable: bool
    has_audio: bool
    duration: float

def probe(path: Path) -> Probe:
    import av

    try:
        with av.open(str(path)) as container:
            duration = (container.duration or 0) / 1_000_000
            return Probe(True, bool(container.streams.audio), duration)
    except Exception as error:
        log.warning("could not open %s: %s", path.name, error)
        return Probe(False, False, 0.0)

MEANINGFUL_SYMBOLS = set("%$€£&+#@")

def is_real_word(text: str) -> bool:
    return any(c.isalnum() or c in MEANINGFUL_SYMBOLS for c in text)

def collect_segments(
    segments,
    *,
    min_avg_logprob: float | None = None,
    max_no_speech: float | None = None,
    stats: list | None = None,
) -> list[dict]:
    grouped: list[dict] = []
    for segment in segments:
        if stats is not None:
            stats.append((segment.no_speech_prob, segment.avg_logprob))
        if min_avg_logprob is not None and segment.avg_logprob < min_avg_logprob:
            log.info("dropping low-confidence segment (logprob %.2f): %r",
                     segment.avg_logprob, segment.text.strip()[:60])
            continue
        if max_no_speech is not None and segment.no_speech_prob > max_no_speech:
            log.info("dropping non-speech segment (no_speech %.2f): %r",
                     segment.no_speech_prob, segment.text.strip()[:60])
            continue

        words: list[dict] = []
        for word in segment.words or []:
            text = word.word.strip()
            if not text or not is_real_word(text):
                continue
            words.append(
                {
                    "text": text,
                    "start": round(word.start, 3),
                    "end": round(word.end, 3),
                }
            )
        if words:
            grouped.append(
                {"start": words[0]["start"], "end": words[-1]["end"], "words": words}
            )
    return grouped

def flatten(grouped: list[dict]) -> list[dict]:
    return [word for group in grouped for word in group["words"]]

HALLUCINATION_FILLER = {
    "music", "musica", "applause", "laughter", "foreign", "you", "thanks",
    "thank", "subtitles", "subtitle", "subscribe", "bye", "oh", "ah", "uh",
    "um", "hmm", "mm", "yeah", "watching", "amara", "org", "by",
}

def looks_like_hallucination(words: list[dict]) -> bool:
    tokens = [
        "".join(c for c in w["text"].lower() if c.isalnum()) for w in words
    ]
    tokens = [t for t in tokens if t]
    if not tokens:
        return True
    return all(t in HALLUCINATION_FILLER for t in tokens)

def run_whisper(path: Path, *, music: bool, translate: bool = False):
    common = dict(
        word_timestamps=True,
        beam_size=1,
        task="translate" if translate else "transcribe",
    )

    if not music:
        return get_model().transcribe(
            path,
            vad_filter=True,
            vad_parameters={
                "threshold": 0.3,
                "speech_pad_ms": 800,
                "min_silence_duration_ms": 1500,
            },
            **common,
        )

    return get_model().transcribe(
        path,
        vad_filter=False,
        no_speech_threshold=0.9,
        compression_ratio_threshold=3.0,
        condition_on_previous_text=False,
        **common,
    )

def save_upload(upload: UploadFile, destination: Path) -> int:
    size = 0
    with destination.open("wb") as out:
        while chunk := upload.file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail=f"Clip is larger than {MAX_UPLOAD_BYTES // 1024 // 1024} MB.",
                )
            out.write(chunk)
    return size

EMPHASIS_SCHEMA = {
    "type": "json_schema",
    "schema": {
        "type": "object",
        "properties": {
            "indices": {
                "type": "array",
                "items": {"type": "integer"},
                "description": "0-based indices of the words to highlight.",
            }
        },
        "required": ["indices"],
        "additionalProperties": False,
    },
}

EMPHASIS_PROMPT = """\
You are choosing which words get the highlight colour in a short-form video \
caption. This is a creative judgement, not a keyword search.

The transcript, one word per line with its index:

{numbered}

Pick the word in each sentence that the sentence turns on — the one a viewer \
scrolling on mute needs to land on for the line to do its job. Read for meaning: \
the payload of a claim, the number that makes it concrete, the noun that names \
the surprise, the word the speaker is clearly building toward.

Strong picks:
- Quantities and magnitudes: "60", "$4,000", "twice", "zero"
- Absolutes and extremes: "never", "everyone", "impossible", "best"
- The specific noun a sentence exists to deliver
- A twist or reversal — the word where the meaning flips

Never pick:
- Function words, connectives or fillers: "the", "because", "so", "actually"
- Verbs doing grammatical work rather than carrying meaning: "is", "use", "get"
- A word only because it is long or unusual — length is not emphasis
- Two adjacent words. One lit word is a hit; two is just a phrase in colour

Roughly one word per sentence. A long sentence can take a second if it genuinely \
carries two beats, and a sentence with no real hook should get none at all — \
restraint reads as intent, and highlighting everything highlights nothing.

Return only the indices."""

def llm_emphasis(words: list[dict]) -> list[int]:
    from anthropic import Anthropic

    numbered = "\n".join(f"{i}: {w['text']}" for i, w in enumerate(words))
    client = Anthropic()

    message = client.messages.create(
        model=EMPHASIS_MODEL,
        max_tokens=8000,
        output_config={"effort": "low", "format": EMPHASIS_SCHEMA},
        messages=[{"role": "user", "content": EMPHASIS_PROMPT.format(numbered=numbered)}],
    )

    if message.stop_reason == "refusal":
        log.warning("emphasis pass refused; falling back to the local scorer")
        return []

    text = "".join(block.text for block in message.content if block.type == "text")
    indices = json.loads(text)["indices"]
    return [i for i in indices if isinstance(i, int) and 0 <= i < len(words)]

TRANSLATE_SCHEMA = {
    "type": "json_schema",
    "schema": {
        "type": "object",
        "properties": {
            "lines": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "index": {"type": "integer"},
                        "text": {"type": "string"},
                    },
                    "required": ["index", "text"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["lines"],
        "additionalProperties": False,
    },
}

TRANSLATE_PROMPT = """\
Translate each numbered line into {language}. These are captions for a short \
video, so keep them tight and idiomatic rather than literal — a viewer reads \
them in under two seconds.

Keep one output line per input line, with the same index. Preserve numbers and \
proper nouns. Do not merge, split, reorder, or add lines.

{numbered}"""

def retime(group: dict, text: str) -> list[dict]:
    pieces = text.split()
    if not pieces:
        return []
    total = sum(len(piece) for piece in pieces) or 1
    span = max(0.001, group["end"] - group["start"])
    cursor = group["start"]

    out: list[dict] = []
    for piece in pieces:
        duration = span * (len(piece) / total)
        out.append(
            {
                "text": piece,
                "start": round(cursor, 3),
                "end": round(cursor + duration, 3),
            }
        )
        cursor += duration
    return out

def translate_groups(grouped: list[dict], language: str) -> list[dict]:
    from anthropic import Anthropic

    numbered = "\n".join(
        f"{i}: {' '.join(w['text'] for w in g['words'])}"
        for i, g in enumerate(grouped)
    )

    client = Anthropic()
    message = client.messages.create(
        model=EMPHASIS_MODEL,
        max_tokens=16000,
        output_config={"effort": "low", "format": TRANSLATE_SCHEMA},
        messages=[
            {
                "role": "user",
                "content": TRANSLATE_PROMPT.format(
                    language=language, numbered=numbered
                ),
            }
        ],
    )

    if message.stop_reason == "refusal":
        raise RuntimeError("The translation request was declined.")

    text = "".join(b.text for b in message.content if b.type == "text")
    lines = {item["index"]: item["text"] for item in json.loads(text)["lines"]}

    out: list[dict] = []
    for i, group in enumerate(grouped):
        translated = lines.get(i)
        if not translated:
            out.extend(group["words"])
            continue
        out.extend(retime(group, translated))
    return out

STYLE_SCHEMA = {
    "type": "json_schema",
    "schema": {
        "type": "object",
        "properties": {
            "font": {"type": "string", "enum": ["impact", "black", "grotesk", "rounded", "serif", "mono"]},
            "size": {"type": "number"},
            "color": {"type": "string"},
            "emphasisColor": {"type": "string"},
            "activeColor": {"type": "string"},
            "outlineColor": {"type": "string"},
            "outline": {"type": "number"},
            "shadow": {"type": "number"},
            "position": {"type": "string", "enum": ["top", "middle", "bottom"]},
            "margin": {"type": "number"},
            "uppercase": {"type": "boolean"},
            "maxWords": {"type": "integer"},
            "animation": {"type": "string", "enum": ["pop", "karaoke", "none"]},
            "highlightBox": {"type": "boolean"},
            "boxColor": {"type": "string"},
            "reason": {"type": "string"},
        },
        "required": [
            "font", "size", "color", "emphasisColor", "activeColor",
            "outlineColor", "outline", "shadow", "position", "margin",
            "uppercase", "maxWords", "animation", "highlightBox", "boxColor",
            "reason",
        ],
        "additionalProperties": False,
    },
}

STYLE_PROMPT = """\
You are art-directing burned-in captions for this specific vertical video. The \
images are frames sampled evenly across it, in order. Look at them properly — \
this recommendation has to sit on *this* footage, not on a generic clip.

What the speaker says:
"{transcript}"

Judge from the frames:
- Where is the busy part of the shot? Put captions where they cover the least \
  of it. Anything important low in frame means captions belong higher, and vice \
  versa.
- How bright and how contrasty is the background where captions will sit? Dark \
  or noisy footage needs a heavier outline; clean footage can take a lighter one.
- What is the palette? Pick a highlight colour that pops against it rather than \
  blending in. Avoid a hue that already dominates the frame.
- What is the tone — energetic, calm, editorial? Match font weight, uppercase \
  and animation to it rather than defaulting to the loudest option.

Rules:
- Base text is almost always near-white with a dark outline. It is the most \
  legible combination on unpredictable footage; deviate only with good reason.
- `emphasisColor` must be clearly distinct from `activeColor`, or the AI's word \
  picks are invisible.
- size is a percentage of frame height: 4–6 reads calm, 6–8 punchy, 8+ shouts.
- outline is also a percentage of height; 0.3 is subtle, 0.8 is heavy.
- margin is the percentage inset from the top or bottom edge. On a Short, keep \
  captions clear of the bottom ~15%, where the platform's own UI sits.
- Colours are hex, like "#FFE600".

In `reason`, say in one sentence what you saw in the footage that drove the \
choice. Be concrete about the frames — not generic caption advice."""

ACCENTS = [
    ("#FFE600", 54),
    ("#FF4D6D", 347),
    ("#7DF9C3", 153),
    ("#B388FF", 260),
    ("#FF9E7D", 17),
    ("#4DD2FF", 195),
]

def hue_distance(a: float, b: float) -> float:
    gap = abs(a - b) % 360
    return min(gap, 360 - gap)

def analyse_style(images, transcript: str = "") -> dict:
    import numpy as np

    bands = {"top": [], "middle": [], "bottom": []}
    hues: list[np.ndarray] = []
    saturations: list[np.ndarray] = []

    for image in images:
        rgb = np.asarray(image.convert("RGB").resize((160, 284)), dtype=np.float32)
        luma = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]

        third = luma.shape[0] // 3
        for name, slab in (
            ("top", luma[:third]),
            ("middle", luma[third : third * 2]),
            ("bottom", luma[third * 2 :]),
        ):
            gy = np.abs(np.diff(slab, axis=0)).mean()
            gx = np.abs(np.diff(slab, axis=1)).mean()
            bands[name].append((slab.mean(), (gy + gx) / 2))

        hsv = np.asarray(image.convert("HSV").resize((80, 142)), dtype=np.float32)
        hues.append(hsv[..., 0] * 360 / 255)
        saturations.append(hsv[..., 1] / 255)

    summary = {
        name: (
            float(np.mean([b[0] for b in vals])),
            float(np.mean([b[1] for b in vals])),
        )
        for name, vals in bands.items()
    }

    top_busy = summary["top"][1]
    bottom_busy = summary["bottom"][1]
    position = "bottom" if bottom_busy <= top_busy * 1.25 else "top"
    brightness, busyness = summary[position]

    hue_stack = np.concatenate([h.ravel() for h in hues])
    sat_stack = np.concatenate([s.ravel() for s in saturations])
    if sat_stack.sum() > 1e-3:
        radians = np.deg2rad(hue_stack)
        x = float((np.cos(radians) * sat_stack).sum())
        y = float((np.sin(radians) * sat_stack).sum())
        dominant = (np.rad2deg(np.arctan2(y, x)) + 360) % 360
        colourfulness = float(sat_stack.mean())
    else:
        dominant, colourfulness = 0.0, 0.0

    def accent_score(hex_colour: str, hue: float) -> float:
        r = int(hex_colour[1:3], 16)
        g = int(hex_colour[3:5], 16)
        b = int(hex_colour[5:7], 16)
        luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
        contrast = abs(luma - brightness) / 255.0
        separation = hue_distance(hue, dominant) / 180.0
        return contrast * 2.0 + separation

    ranked = sorted(ACCENTS, key=lambda a: -accent_score(a[0], a[1]))
    active_color, active_hue = ranked[0]

    emphasis_color = next(
        (c for c, h in ranked[1:] if hue_distance(h, active_hue) >= 60),
        ranked[1][0],
    )

    busy_norm = min(1.0, busyness / 12.0)
    bright_norm = min(1.0, brightness / 200.0)

    boxed = brightness > 165 or busy_norm > 0.75
    outline = round((0.22 if boxed else 0.30) + 0.45 * busy_norm + 0.25 * bright_norm, 2)
    shadow = round(0.20 + 0.35 * bright_norm, 2)

    if busy_norm > 0.6:
        font, uppercase = "impact", True
    elif busy_norm > 0.3:
        font, uppercase = "black", True
    else:
        font, uppercase = "grotesk", False

    spoken = [w for w in (transcript or "").split() if w]
    long_words = (
        sum(len(w) for w in spoken) / len(spoken) if spoken else 4.5
    )
    max_words = 5 if busy_norm < 0.35 else 4 if busy_norm < 0.7 else 3
    if long_words > 6.0:
        max_words = max(2, max_words - 1)

    size = 7.2 if busy_norm < 0.35 else 6.4 if busy_norm < 0.7 else 5.8

    animation = "pop" if busy_norm < 0.7 else "none"

    tone = "busy" if busy_norm > 0.6 else "fairly clean" if busy_norm > 0.3 else "clean"
    light = "dark" if brightness < 90 else "bright" if brightness > 165 else "mid-toned"
    weight = "heavy" if outline > 0.6 else "medium" if outline > 0.45 else "light"
    if uppercase and font == "impact":
        face = "the heaviest face in caps"
    elif uppercase:
        face = "a bold face in caps"
    else:
        face = "a cleaner face in sentence case"
    backing = (
        "on a solid block so they stay readable"
        if boxed
        else f"with a {weight} outline"
    )

    reason = (
        f"The {position} third is the calmest part of the frame and reads {light}, "
        f"so the captions sit there. The footage is {tone}, so they use {face} at "
        f"{max_words} words a line, {backing}. The highlight is {active_color} — "
        f"the accent with the most contrast against that band, not just the one "
        f"furthest from the clip's {int(dominant)}° cast."
    )

    return {
        "font": font,
        "size": size,
        "color": "#FFFFFF",
        "activeColor": active_color,
        "emphasisColor": emphasis_color,
        "outlineColor": "#000000",
        "outline": outline,
        "shadow": shadow,
        "position": position,
        "margin": 18 if position == "bottom" else 12,
        "uppercase": uppercase,
        "maxWords": max_words,
        "animation": animation,
        "highlightBox": boxed,
        "boxColor": active_color,
        "reason": reason,
    }

def sample_frames(path: Path, count: int = 4):
    import base64
    import io

    import av

    shots: list[str] = []
    images: list = []
    with av.open(str(path)) as container:
        stream = container.streams.video[0]
        stream.thread_type = "AUTO"
        duration = (container.duration or 0) / 1_000_000
        if duration <= 0:
            duration = 10.0

        for i in range(count):
            target = duration * (i + 1) / (count + 1)
            try:
                container.seek(int(target * 1_000_000), any_frame=False, backward=True)
                frame = None
                for candidate in container.decode(video=0):
                    frame = candidate
                    if candidate.time is not None and candidate.time >= target:
                        break
            except Exception:
                frame = None
            if frame is None:
                continue

            image = frame.to_image()
            image.thumbnail((512, 512))
            images.append(image)
            buffer = io.BytesIO()
            image.save(buffer, format="JPEG", quality=80)
            shots.append(base64.b64encode(buffer.getvalue()).decode())

    return shots, images

@app.post("/suggest-style")
def suggest_style(
    file: UploadFile = File(...),
    transcript: str = Form(""),
):
    with tempfile.TemporaryDirectory(prefix="kaptra-style-") as tmp:
        source = Path(tmp) / (file.filename or "input.mp4")
        save_upload(file, source)

        if not probe(source).decodable:
            raise HTTPException(status_code=422, detail="Couldn't open that clip.")

        frames, images = sample_frames(source)

    if not frames:
        raise HTTPException(
            status_code=422, detail="Couldn't read any frames from that clip."
        )

    if not EMPHASIS_ENABLED:
        style = analyse_style(images, transcript)
        log.info("suggested style locally: %s", style["reason"][:80])
        return style

    content: list[dict] = [
        {
            "type": "image",
            "source": {"type": "base64", "media_type": "image/jpeg", "data": shot},
        }
        for shot in frames
    ]
    content.append(
        {
            "type": "text",
            "text": STYLE_PROMPT.format(transcript=(transcript or "")[:1200]),
        }
    )

    from anthropic import Anthropic

    try:
        message = Anthropic().messages.create(
            model=EMPHASIS_MODEL,
            max_tokens=16000,
            output_config={"format": STYLE_SCHEMA},
            messages=[{"role": "user", "content": content}],
        )
        if message.stop_reason == "refusal":
            raise RuntimeError("The request was declined.")
        text = "".join(b.text for b in message.content if b.type == "text")
        style = json.loads(text)
    except HTTPException:
        raise
    except Exception as error:
        log.warning("model suggestion failed (%s); analysing locally", error)
        style = analyse_style(images, transcript)
        return style

    log.info("suggested style from %d frames: %s", len(frames), style.get("reason", "")[:80])
    return style

@app.on_event("startup")
def warm_model() -> None:

    def load() -> None:
        try:
            get_model()
            log.info("whisper model warm")
        except Exception as error:
            log.warning("could not preload model: %s", error)

    threading.Thread(target=load, name="warm-model", daemon=True).start()

@app.get("/")
def root():
    return {
        "service": "Kaptra",
        "status": "ok",
        "docs": "/docs",
        "health": "/health",
    }

@app.get("/health")
def health():
    return {
        "ok": True,
        "model": WHISPER_MODEL,
        "model_loaded": _model is not None,
        "ffmpeg": FFMPEG_BIN,
        "libass": FFMPEG_HAS_ASS,
        "youtube": {
            "configured": youtube.is_configured(),
            "authorized": youtube.is_authorized(),
        },
        "can_render": bool(FFMPEG_BIN) and FFMPEG_HAS_ASS,
        "llm_emphasis": EMPHASIS_ENABLED,
    }

@app.post("/transcribe")
def transcribe(
    file: UploadFile = File(...),
    translate: str = Form("false"),
    target_language: str = Form(""),
    target_language_name: str = Form(""),
):
    target = (target_language or "").strip().lower()
    legacy_english = translate.lower() in ("1", "true", "yes", "on")
    if legacy_english and not target:
        target = "en"

    to_english = target == "en"
    needs_llm = bool(target) and not to_english

    with tempfile.TemporaryDirectory(prefix="kaptra-") as tmp:
        source = Path(tmp) / (file.filename or "input.mp4")
        size = save_upload(file, source)
        log.info("transcribing %s (%.1f MB)", source.name, size / 1_048_576)

        info_probe = probe(source)
        if not info_probe.decodable:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Couldn't open {file.filename or 'that file'} — it may be "
                    "corrupt, still uploading, or not a video."
                ),
            )
        if not info_probe.has_audio:
            raise HTTPException(
                status_code=422,
                detail="That clip has no audio track, so there's nothing to transcribe.",
            )

        mode = "speech"
        try:
            segments, info = run_whisper(str(source), music=False, translate=to_english)
            confidence: list = []
            grouped = collect_segments(segments, stats=confidence)
            words = flatten(grouped)

            if words and confidence:
                mean_no_speech = sum(c[0] for c in confidence) / len(confidence)
                sung = mean_no_speech >= SUNG_MIN_NO_SPEECH
                log.info(
                    "mean no_speech %.2f (threshold %.2f) -> %s",
                    mean_no_speech,
                    SUNG_MIN_NO_SPEECH,
                    "music" if sung else "speech",
                )
                if sung:
                    mode = "music"

            if not words:
                log.info("no speech on the first pass; retrying in music mode")
                mode = "music"
                segments, info = run_whisper(str(source), music=True, translate=to_english)
                grouped = collect_segments(
                    segments,
                    min_avg_logprob=MUSIC_MIN_LOGPROB,
                    max_no_speech=MUSIC_MAX_NO_SPEECH,
                )
                words = flatten(grouped)

                if looks_like_hallucination(words):
                    log.info("music pass returned only filler; discarding")
                    grouped, words = [], []
        except HTTPException:
            raise
        except Exception as error:
            log.exception("transcription failed")
            raise HTTPException(
                status_code=500, detail=f"Transcription failed: {error}"
            ) from error

    if not words:
        raise HTTPException(
            status_code=422,
            detail=(
                "Couldn't make out any words in that clip — the audio may be "
                "instrumental, too quiet, or heavily processed. A larger model "
                f"often catches lyrics the current one ({WHISPER_MODEL}) "
                "misses: restart the backend with WHISPER_MODEL=small."
            ),
        )

    translated_to = None
    warning = None
    if needs_llm:
        label = target_language_name or target
        try:
            words = translate_groups(grouped, label)
            translated_to = label
            log.info("translated %d segments into %s", len(grouped), label)
        except Exception as error:
            log.warning("translation to %s failed (%s); keeping the original",
                        label, error)
            warning = (
                f"Couldn't translate to {label} — these captions are in the "
                "language spoken. Only English translation is free; other "
                "languages need a funded Anthropic API key."
            )
    elif to_english:
        translated_to = "English"

    if EMPHASIS_ENABLED:
        try:
            for index in llm_emphasis(words):
                words[index]["emphasis"] = True
        except Exception:
            log.exception("emphasis pass failed; using the local scorer instead")

    log.info("transcribed %d words in %s mode (%s%s, %.1fs)", len(words), mode,
             info.language, " → en" if to_english else "", info.duration)
    return {
        "words": words,
        "language": info.language,
        "language_probability": round(getattr(info, "language_probability", 0) or 0, 3),
        "duration": round(info.duration, 3),
        "mode": mode,
        "translated": bool(translated_to),
        "translated_to": translated_to,
        "warning": warning,
    }

_progress: dict[str, dict] = {}
_progress_lock = threading.Lock()
PROGRESS_LIMIT = 64

def set_progress(job_id: str | None, **fields) -> None:
    if not job_id:
        return
    with _progress_lock:
        if job_id not in _progress and len(_progress) >= PROGRESS_LIMIT:
            _progress.pop(next(iter(_progress)), None)
        _progress.setdefault(job_id, {"percent": 0.0, "state": "starting"})
        _progress[job_id].update(fields)

def clear_progress(job_id: str | None) -> None:
    if not job_id:
        return
    with _progress_lock:
        _progress.pop(job_id, None)

@app.get("/progress/{job_id}")
def get_progress(job_id: str):
    with _progress_lock:
        return _progress.get(job_id, {"percent": 0.0, "state": "unknown"})

def run_ffmpeg_with_progress(
    command: list[str],
    workdir: Path,
    duration: float,
    job_id: str | None,
    timeout: float = 900,
) -> tuple[int, str]:
    log_path = workdir / "ffmpeg.log"
    started = time.monotonic()

    with log_path.open("w") as errlog:
        process = subprocess.Popen(
            command,
            cwd=workdir,
            stdout=subprocess.PIPE,
            stderr=errlog,
            text=True,
            bufsize=1,
        )

        assert process.stdout is not None
        for line in process.stdout:
            line = line.strip()
            if line.startswith("out_time_us=") and duration > 0:
                raw = line.split("=", 1)[1]
                if raw.lstrip("-").isdigit():
                    seconds = int(raw) / 1_000_000
                    percent = max(0.0, min(99.0, seconds / duration * 100))
                    set_progress(job_id, percent=percent, state="rendering")
            elif line == "progress=end":
                set_progress(job_id, percent=100.0, state="finishing")

            if time.monotonic() - started > timeout:
                process.kill()
                return 1, f"Render exceeded {timeout:.0f}s and was stopped."

        process.wait()

    stderr = log_path.read_text(errors="replace") if log_path.exists() else ""
    return process.returncode, stderr

@app.post("/render")
def render(
    file: UploadFile = File(...),
    subtitles: UploadFile = File(...),
    job_id: str = Form(""),
):
    if not FFMPEG_BIN:
        raise HTTPException(
            status_code=503,
            detail=(
                "ffmpeg is not installed on the backend, so burn-in is "
                "unavailable. Install it and restart the server. Transcription "
                "and the .ass export still work."
            ),
        )

    if not FFMPEG_HAS_ASS:
        raise HTTPException(
            status_code=503,
            detail=(
                "This ffmpeg was built without libass, so it can't draw "
                "subtitles. Install a build that has it — on macOS:\n"
                "  brew tap homebrew-ffmpeg/ffmpeg\n"
                "  brew install homebrew-ffmpeg/ffmpeg/ffmpeg --with-libass\n"
                "Verify with: ffmpeg -filters | grep ' ass '\n"
                "Transcription and the .ass export still work without it."
            ),
        )

    workdir = Path(tempfile.mkdtemp(prefix="kaptra-render-"))
    cleanup = BackgroundTask(shutil.rmtree, workdir, ignore_errors=True)

    try:
        suffix = Path(file.filename or "").suffix.lower() or ".mp4"
        if not suffix.isascii() or len(suffix) > 6:
            suffix = ".mp4"
        source = workdir / f"input{suffix}"
        save_upload(file, source)
        (workdir / "captions.ass").write_bytes(subtitles.file.read())
        output = workdir / "kaptra-short.mp4"

        set_progress(job_id, percent=0.0, state="starting")
        duration = probe(source).duration

        command = [
            FFMPEG_BIN, "-y",
            "-i", source.name,
            "-vf", "ass=captions.ass",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart",
            "-progress", "pipe:1", "-nostats",
            output.name,
        ]

        log.info("rendering %s (%.1fs)", file.filename, duration)
        code, stderr = run_ffmpeg_with_progress(command, workdir, duration, job_id)

        if code != 0 or not output.exists():
            tail = "\n".join(stderr.strip().splitlines()[-6:])
            log.error("ffmpeg failed:\n%s", stderr)
            raise HTTPException(status_code=500, detail=f"ffmpeg failed:\n{tail}")

        log.info("rendered %.1f MB", output.stat().st_size / 1_048_576)
        set_progress(job_id, percent=100.0, state="done")
        cleanup = BackgroundTask(_finish_render, workdir, job_id, output)
        return FileResponse(
            output,
            media_type="video/mp4",
            filename="kaptra-short.mp4",
            background=cleanup,
        )
    except HTTPException:
        cleanup()
        clear_progress(job_id)
        raise
    except Exception as error:
        cleanup()
        clear_progress(job_id)
        log.exception("render failed")
        raise HTTPException(status_code=500, detail=f"Render failed: {error}") from error

_renders: dict[str, dict] = {}
RENDER_TTL = float(os.getenv("KAPTRA_RENDER_TTL", "3600"))

def sweep_renders() -> None:
    now = time.time()
    for key, entry in list(_renders.items()):
        if now - entry["at"] > RENDER_TTL:
            shutil.rmtree(entry["dir"], ignore_errors=True)
            _renders.pop(key, None)

def _finish_render(workdir: Path, job_id: str, output: Path) -> None:
    clear_progress(job_id)
    sweep_renders()
    if job_id:
        _renders[job_id] = {"dir": workdir, "file": output, "at": time.time()}
    else:
        shutil.rmtree(workdir, ignore_errors=True)

@app.get("/youtube/status")
def youtube_status():
    return {
        "configured": youtube.is_configured(),
        "authorized": youtube.is_authorized(),
        "redirect_uri": youtube.REDIRECT_URI,
    }

@app.get("/youtube/authorize")
def youtube_authorize():
    if not youtube.is_configured():
        raise HTTPException(
            status_code=503,
            detail=(
                "YouTube upload isn't configured. Create an OAuth client in "
                "Google Cloud Console (YouTube Data API v3), then start the "
                "backend with GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET set. "
                "See backend/youtube.py for the full walkthrough."
            ),
        )
    return {"url": youtube.authorize_url()}

@app.get("/youtube/callback")
def youtube_callback(code: str = "", error: str = ""):
    if error or not code:
        body = f"<p>YouTube authorisation failed: {error or 'no code returned'}.</p>"
    else:
        try:
            youtube.exchange_code(code)
            body = "<p>Connected. You can close this tab and return to Kaptra.</p>"
        except Exception as exc:
            log.exception("token exchange failed")
            body = f"<p>Could not complete authorisation: {exc}</p>"

    return HTMLResponse(
        "<!doctype html><meta charset=utf-8>"
        "<title>Kaptra × YouTube</title>"
        "<body style=\"font:15px system-ui;background:#08080b;color:#f5f5f7;"
        "display:grid;place-items:center;height:100vh;margin:0\">"
        f"<div style=\"text-align:center\">{body}</div>"
        "<script>setTimeout(()=>window.close(),2500)</script>"
    )

@app.post("/youtube/disconnect")
def youtube_disconnect():
    youtube.forget()
    return {"ok": True}

@app.post("/youtube/upload-file")
def youtube_upload_file(
    file: UploadFile = File(...),
    job_id: str = Form(""),
    title: str = Form(...),
    description: str = Form(""),
    privacy: str = Form("private"),
):
    if not youtube.is_configured():
        raise HTTPException(status_code=503, detail="YouTube upload isn't configured.")
    if not youtube.is_authorized():
        raise HTTPException(status_code=401, detail="Connect your YouTube account first.")

    if not title.strip():
        raise HTTPException(
            status_code=422,
            detail="Give the video a title before posting.",
        )

    with tempfile.TemporaryDirectory(prefix="kaptra-yt-") as tmp:
        source = Path(tmp) / (file.filename or "clip.mp4")
        size = save_upload(file, source)
        log.info("uploading %s (%.1f MB) straight to youtube", source.name, size / 1_048_576)

        if not probe(source).decodable:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Couldn't open {file.filename or 'that file'} — it may be "
                    "corrupt, still uploading, or not a video."
                ),
            )

        upload_job = f"{job_id or source.stem}:yt"
        set_progress(upload_job, percent=0.0, state="uploading")
        try:
            video_id = youtube.upload(
                source,
                title=title,
                description=description,
                privacy=privacy,
                on_progress=lambda pct: set_progress(
                    upload_job, percent=pct, state="uploading"
                ),
            )
        except Exception as exc:
            clear_progress(upload_job)
            log.exception("youtube upload failed")
            raise HTTPException(status_code=502, detail=f"YouTube upload failed: {exc}") from exc

    clear_progress(upload_job)
    log.info("uploaded to youtube: %s", video_id)
    return {
        "video_id": video_id,
        "url": f"https://youtu.be/{video_id}",
        "studio_url": f"https://studio.youtube.com/video/{video_id}/edit",
    }


@app.post("/youtube/upload")
def youtube_upload(
    job_id: str = Form(...),
    title: str = Form(...),
    description: str = Form(""),
    privacy: str = Form("private"),
):
    if not youtube.is_configured():
        raise HTTPException(status_code=503, detail="YouTube upload isn't configured.")
    if not youtube.is_authorized():
        raise HTTPException(status_code=401, detail="Connect your YouTube account first.")

    if not title.strip():
        raise HTTPException(
            status_code=422,
            detail="Give the video a title before posting.",
        )

    entry = _renders.get(job_id)
    if not entry or not entry["file"].exists():
        raise HTTPException(
            status_code=404,
            detail="That render has expired. Render again, then upload.",
        )

    upload_job = f"{job_id}:yt"
    set_progress(upload_job, percent=0.0, state="uploading")
    try:
        video_id = youtube.upload(
            entry["file"],
            title=title,
            description=description,
            privacy=privacy,
            on_progress=lambda pct: set_progress(
                upload_job, percent=pct, state="uploading"
            ),
        )
    except Exception as exc:
        clear_progress(upload_job)
        log.exception("youtube upload failed")
        raise HTTPException(status_code=502, detail=f"YouTube upload failed: {exc}") from exc

    clear_progress(upload_job)
    log.info("uploaded to youtube: %s", video_id)
    return {
        "video_id": video_id,
        "url": f"https://youtu.be/{video_id}",
        "studio_url": f"https://studio.youtube.com/video/{video_id}/edit",
    }
