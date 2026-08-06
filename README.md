# Kaptra

Kaptra turns unsubtitled YouTube Shorts into captioned, ready-to-post videos in
seconds. It takes your speech, burns on styled captions and highlights the most
important words. Once you're ready, you're only a few clicks from uploading
straight to YouTube.

Under the hood: a vertical clip goes in → Whisper transcribes it with word-level
timestamps → an emphasis pass marks the words that carry each line → your style
choices template into an `.ass` subtitle file → ffmpeg burns it onto the frames
in one pass.

---

## Run it

### 1. Front end

```bash
npm install
npm run dev        # http://localhost:3111
```

With no backend configured it boots in **demo mode** — a sample transcript, a
working style picker, a live preview and a real `.ass` export. Everything
except transcription and the MP4 render works offline.

### 2. Backend (real transcription)

```bash
cd backend
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
./.venv/bin/uvicorn main:app --port 8000
```

The Whisper weights download on the first `/transcribe` call (~150 MB for
`base`), not at boot. Then point the front end at it and restart `npm run dev`:

```bash
cp .env.example .env.local        # NEXT_PUBLIC_KAPTRA_API=http://127.0.0.1:8000
```

`GET /health` reports what the backend can actually do:

```json
{"ok": true, "model": "base", "ffmpeg": null, "can_render": false, "llm_emphasis": false}
```

### 3. ffmpeg **with libass** (burn-in)

Transcription needs no system ffmpeg — `faster-whisper` bundles PyAV and
decodes the audio out of the MP4 itself. **Burning captions into the video**
does, and specifically needs the `ass` filter, which only exists in builds
compiled with libass.

> ⚠️ **`brew install ffmpeg` is not enough.** Homebrew's current core formula
> (8.1.2) ships a slim build with no libass — `brew deps ffmpeg` doesn't even
> list it. The `ass` filter is absent and burn-in fails with an opaque
> `Error parsing filterchain`.

```bash
brew uninstall ffmpeg                        # the slim core build collides
brew tap homebrew-ffmpeg/ffmpeg
brew install homebrew-ffmpeg/ffmpeg/ffmpeg   # libass is a hard dependency here

# confirm — this must print a line
ffmpeg -filters | grep ' ass '
```

No `--with-libass` flag: the tap's formula depends on libass unconditionally,
so passing it errors with `invalid option`. There's no bottle either, so expect
a 20–40 minute source build.

`GET /health` reports `libass` and `can_render` separately, so you can tell
"no ffmpeg" apart from "ffmpeg without libass". `/render` returns a 503 with the
install command rather than passing ffmpeg's error through. Everything else —
transcription, styling, preview, `.ass` export — works regardless.

### Configuration

| Variable | Default | What it does |
| --- | --- | --- |
| `WHISPER_MODEL` | `base` | `tiny` · `base` · `small` · `medium` · `large-v3` |
| `WHISPER_DEVICE` | `cpu` | `cuda` if you have a GPU |
| `FFMPEG_BIN` | *(PATH)* | Explicit ffmpeg path |
| `KAPTRA_ALLOW_ORIGINS` | `*` | CORS allowlist for your Vercel origin |
| `KAPTRA_MAX_UPLOAD_MB` | `200` | Upload ceiling |
| `ANTHROPIC_API_KEY` | *(unset)* | Enables LLM emphasis, non-English translation and style suggestions |
| `KAPTRA_EMPHASIS_MODEL` | `claude-opus-5` | Model for that pass |
| `KAPTRA_MUSIC_MIN_LOGPROB` | `-1.0` | Confidence floor for the music retry |
| `KAPTRA_MUSIC_MAX_NO_SPEECH` | `0.6` | Non-speech ceiling for the music retry |

---

## Upload to YouTube

Once a render finishes, the Export panel offers to publish it. The backend still
holds the rendered file, so this is a **server-to-YouTube** transfer — the
browser never re-sends the video.

Setup (one time):

1. Google Cloud Console → new project → enable **YouTube Data API v3**
2. OAuth consent screen → add your Google account as a **test user**, scope
   `https://www.googleapis.com/auth/youtube.upload`
3. Credentials → **OAuth client ID** → *Web application* → redirect URI
   `http://localhost:8000/youtube/callback`
4. Start the backend with the credentials exported:

```bash
export GOOGLE_CLIENT_ID=...apps.googleusercontent.com
export GOOGLE_CLIENT_SECRET=...
./.venv/bin/uvicorn main:app --port 8000
```

Without those the panel explains what's missing instead of showing a dead
button. OAuth and the resumable upload are implemented over plain `requests`
(`backend/youtube.py`) rather than pulling in `google-api-python-client`.

> ⚠️ **Google locks API uploads to private** until the Cloud project passes
> verification, whatever privacy you select. That's Google's policy for
> unverified projects. Quota is also 1,600 units per upload against a default
> 10,000/day — roughly six uploads a day.

---

## Progress reporting

A floating readout pins to the top-centre of the Studio whenever work is in
flight, because the Export panel's own bar is easy to lose once you scroll the
style column or go fullscreen.

Upload and encode report **measured** percentages — browser upload progress and
ffmpeg's `out_time_us` against the clip duration. Transcription doesn't: Whisper
reports nothing until a pass completes, so that stage pulses at a fixed point
and says so rather than faking movement.

It's portalled to `<body>`, because a transform or filter on any ancestor
re-bases `position: fixed` to that ancestor, and it lingers ~1.6s after
finishing so a short job isn't a flicker you miss.

**Playback locks while work is in flight.** The transcript and style are already
committed to the running job, so play, scrub and click-to-play are all disabled
and a playing clip is paused — otherwise the preview would show something the
output won't match.

---

## Layout

| Width | Studio |
| --- | --- |
| `< 768` | Single column — preview, then source, transcript, style |
| `768–1023` | Two columns — preview pinned left, controls scrolling right |
| `≥ 1024` | Three-column app shell; the page itself doesn't scroll |

Verified free of horizontal overflow at 320, 390, 430, 768, 820, 1024, 1280 and
1920 px on both routes.

---

## Suggest a style (optional)

A button in the Studio's style panel. It samples four frames evenly across your
clip, sends them to Claude with the transcript, and gets back a full caption
style chosen for *that* footage — position that avoids the busy part of the
shot, a highlight colour that pops against the palette, outline weight matched
to how noisy the background is. It explains its reasoning in a sentence, and it
lands as a single undo step so rejecting it costs one ⌘Z.

Entirely optional — every control still works by hand, and the button is simply
disabled with an explanation when no key is set.

> Frames are sampled by seeking **and then decoding forward** to the target.
> Seeking alone lands on the nearest preceding keyframe, and a clip encoded with
> a long GOP can have exactly one — at frame 0 — which silently makes every
> "sample" the opening frame.

Needs `ANTHROPIC_API_KEY`.

---

## Caption language

Pick any target from the Source panel. Two different mechanisms sit behind it:

| Target | How | Needs |
| --- | --- | --- |
| Same as the audio | Plain transcription | — |
| **English** | Whisper's own `translate` task, one pass | — |
| **Any other language** | Transcribe natively, then translate segment-by-segment | `ANTHROPIC_API_KEY` |

Whisper can only ever output English, so every other target needs a real
translation step. Choosing one without a key returns a 503 saying exactly that
rather than silently captioning in the wrong language.

**Timing across a translation.** Word-level timings can't survive it — word
order and count both change. Segment boundaries do survive, so each translated
line is re-spread across its own segment's time span, proportionally to word
length. Sync holds at segment granularity; individual words are approximations.
Verified to span the segment exactly and stay monotonic.

Changing the language re-runs transcription, since it's an input to the model
rather than something applicable to words already returned.

---

## Undo / redo

⌘Z and ⇧⌘Z (Ctrl on Windows), or the buttons above the Export panel. Style,
transcript emphasis and preset share one history, so one keystroke steps back
whatever you last changed, wherever you changed it.

Continuous controls coalesce: a slider sweep or a caption drag is **one** undo
step, not thirty. Loading a new transcript clears the history rather than
letting undo restore words from a clip that is no longer open.

---

## Video formats and aspect ratios

Transcription and rendering go through ffmpeg's demuxers (via PyAV), so the
input list is essentially "whatever ffmpeg reads" — MP4, MOV, WebM, MKV, AVI,
WMV, FLV, MPEG-TS, MPEG-PS, 3GP, MXF, OGV and more. Output is always H.264/AAC
MP4, which every platform accepts.

Two things the browser can't match:

- **Playback.** A browser plays a much shorter list than ffmpeg reads. When a
  clip won't play, the Studio swaps in a stand-in backdrop, says so, and keeps
  the transport running off the backend's reported duration — styling and the
  final render still use your real footage.
- **MIME types.** Browsers report them inconsistently (a `.mkv` can arrive as
  `video/x-matroska`, `video/webm`, or an empty string), so the dropzone accepts
  on extension too, and defers to the backend when both are unknown.

**Any aspect ratio works.** The `.ass` script is authored against the clip's
real pixel dimensions rather than a fixed 1080×1920 — libass stretches the
script canvas onto the frame, so a portrait script on a landscape clip would
render the text squashed. The preview frame matches the clip's shape for the
same reason.

---

## Music and sung vocals

Whisper is trained on speech, and stock settings throw lyrics away — voice
activity detection classifies singing as non-speech, and the "is this even
speech?" guard discards what survives. `/transcribe` handles it in three steps:

1. **Speech pass**, with VAD loosened (`threshold: 0.3`, `speech_pad_ms: 800`).
   Stock settings were measured clipping the first 0.4s of a clip — on a Short
   that's the hook.
2. **Music retry**, only if the first pass found nothing: VAD off,
   `no_speech_threshold` 0.9, `compression_ratio_threshold` 3.0 (choruses repeat,
   and the default treats repetition as a decode failure),
   `condition_on_previous_text` off (stops the decoder looping a hook line).
3. **Hallucination guard** on that retry. Relaxing those thresholds makes
   Whisper invent words over instrumentals, and the invented text differs every
   run — `"Music Music You"`, `"www .mesmerism .info"`. String matching can't
   catch that, so segments are filtered on Whisper's own confidence instead:
   measured `avg_logprob` ≈ **-0.15** for real sung vocals versus ≈ **-1.3**
   for an instrumental.

The response carries `"mode": "speech" | "music"` so you can see which path ran.

If lyrics still come back empty, the model is usually the limit — `base` is
chosen for speed. Restart with `WHISPER_MODEL=small` (or `medium`) and it will
catch vocals that `base` misses.

---

## Where the "AI" is

Two separate models, and they degrade independently:

1. **Whisper** (`faster-whisper`) transcribes the speech with word-level
   timestamps. This is what makes the captions line up with the audio.
2. **Emphasis** picks which words get the highlight colour. If
   `ANTHROPIC_API_KEY` is set the backend asks Claude to read each sentence and
   choose the word it turns on; otherwise the front end's own scorer
   ([lib/emphasis.ts](lib/emphasis.ts)) runs instead.

   Both work **sentence by sentence**, not by sliding window — a caption reads
   as one thought, and creators colour the one word that thought turns on. A
   long sentence can take a second hook; a sentence with no real hook gets
   none, because highlighting everything highlights nothing. The scorer weighs
   quantities and absolutes highest, discounts weak verbs, rewards words the
   speaker audibly held, and excludes connectives outright — "because"
   introduces the payload, it isn't the payload.

So the highlight feature works with no key, no backend, and no network. The
LLM makes it better; it isn't load-bearing.

---

## Routes

| Route     | What it is                                                          |
| --------- | ------------------------------------------------------------------- |
| `/`       | Landing page — pitch, pipeline, live auto-emphasis playground        |
| `/studio` | The app — upload, style, preview, export                             |

---

## The one idea worth knowing

**The preview and the render share a single source of truth.**

`components/CaptionOverlay.tsx` (DOM) and `lib/ass.ts` (subtitle file) are two
renderers over the same style model, the same cue-chunking function
(`lib/cues.ts`) and the same colour rules. Sizes are expressed as a *percentage
of video height*, so a 6.5% caption is identical at 720p and 4K, and identical
in the browser and in ffmpeg.

That is why what the creator tunes on screen is literally the file that gets
burned in.

```
lib/types.ts      the style model everything agrees on
lib/cues.ts       words → on-screen lines (word count, pauses, punctuation)
lib/emphasis.ts   scores each word; marks ~1 in 5 as the highlight
lib/ass.ts        style + words → a complete .ass file
lib/api.ts        the two calls to the Python backend
```

---

## Backend contract

Two endpoints. That's the entire API.

### `POST /transcribe`

Multipart body with a single `file` field (the video).

```jsonc
// 200 OK
{
  "words": [
    { "text": "Most",   "start": 0.40, "end": 0.63, "emphasis": false },
    { "text": "Shorts", "start": 0.68, "end": 1.02, "emphasis": true  }
  ],
  "language": "en",
  "duration": 18.4
}
```

`emphasis` is optional — the backend only sets it when the LLM pass ran. If
every word comes back without it, the front end runs its own scorer
(`lib/emphasis.ts`) so the feature still works.

Errors return `{"detail": "..."}`; the Studio surfaces that string verbatim.

### `POST /render`

Multipart body with:

| Field       | Contents                                         |
| ----------- | ------------------------------------------------ |
| `file`      | the original video                               |
| `subtitles` | `captions.ass` — the exact file that was previewed |

Responds with `video/mp4` bytes. The server does not need to know anything about
fonts, colours or positioning — all of that is already inside the `.ass`.

```bash
ffmpeg -i input.mp4 \
  -vf "ass=captions.ass:fontsdir=./fonts" \
  -c:v libx264 -preset veryfast -crf 20 \
  -c:a copy -movflags +faststart \
  output.mp4
```

Errors should return a JSON body with a `detail` string; the Studio surfaces it
verbatim.

CORS must allow the Vercel origin.

---

## Fonts

`lib/fonts.ts` maps each font option to a CSS stack (for the preview) **and** the
family name libass will look up on the render machine. If the backend runs in a
container, install the matching fonts or ship them in `./fonts` and keep
`fontsdir` pointed at it — otherwise ffmpeg silently substitutes and the output
won't match the preview.

---

## Deploy

Front end → Vercel. Import the repo, set `NEXT_PUBLIC_KAPTRA_API`, done.
Backend → anywhere with real CPU and a writable temp dir (Render, Fly, a Hugging
Face Space, or your laptop over a tunnel for the demo).

---

## Stack

Next.js 16 · React 19 · Tailwind CSS 4 · TypeScript · Whisper · ffmpeg/libass
