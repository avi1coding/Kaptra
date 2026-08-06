"""
YouTube upload — OAuth 2.0 + the resumable upload protocol, over plain HTTP.

Deliberately no google-api-python-client: the flow is two token calls and two
uploads, and `requests` is already a dependency. Tokens live in memory, which
suits a locally-run studio — restart the backend and you reconnect.

Setup (one time, in Google Cloud Console):

  1. Create a project and enable **YouTube Data API v3**
  2. Configure the OAuth consent screen, adding your Google account as a
     test user, with scope `.../auth/youtube.upload`
  3. Create an **OAuth client ID** of type *Web application* with redirect URI
     http://localhost:8000/youtube/callback
  4. Export the credentials before starting the backend:

        export GOOGLE_CLIENT_ID=...apps.googleusercontent.com
        export GOOGLE_CLIENT_SECRET=...

⚠️ Until the Google project passes API verification, videos uploaded through the
API are **locked to private** regardless of the privacy setting sent. That is
Google's policy for unverified projects, not a Kaptra limitation.
"""

from __future__ import annotations

import logging
import os
import threading
import time

import requests

log = logging.getLogger("kaptra.youtube")

CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
REDIRECT_URI = os.getenv(
    "GOOGLE_REDIRECT_URI", "http://localhost:8000/youtube/callback"
)

SCOPE = "https://www.googleapis.com/auth/youtube.upload"
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
UPLOAD_URL = (
    "https://www.googleapis.com/upload/youtube/v3/videos"
    "?uploadType=resumable&part=snippet,status"
)

# Chunked so upload progress can be reported; must be a multiple of 256 KiB.
CHUNK_SIZE = 1024 * 1024 * 4

_tokens: dict = {}
_lock = threading.Lock()


def is_configured() -> bool:
    return bool(CLIENT_ID and CLIENT_SECRET)


def is_authorized() -> bool:
    with _lock:
        return bool(_tokens.get("refresh_token") or _tokens.get("access_token"))


def forget() -> None:
    with _lock:
        _tokens.clear()


def authorize_url(state: str = "") -> str:
    params = {
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": SCOPE,
        # offline + consent is what actually yields a refresh_token; without
        # both, a second authorisation returns only a short-lived access token.
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
    }
    if state:
        params["state"] = state
    return AUTH_URL + "?" + requests.compat.urlencode(params)


def exchange_code(code: str) -> None:
    response = requests.post(
        TOKEN_URL,
        data={
            "code": code,
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "redirect_uri": REDIRECT_URI,
            "grant_type": "authorization_code",
        },
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    with _lock:
        _tokens.update(payload)
        _tokens["expires_at"] = time.time() + payload.get("expires_in", 3500)


def access_token() -> str:
    """Current access token, refreshed if it's within a minute of expiring."""
    with _lock:
        token = _tokens.get("access_token")
        expires_at = _tokens.get("expires_at", 0)
        refresh = _tokens.get("refresh_token")

    if token and time.time() < expires_at - 60:
        return token

    if not refresh:
        raise RuntimeError("Not connected to YouTube — authorise first.")

    response = requests.post(
        TOKEN_URL,
        data={
            "refresh_token": refresh,
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "grant_type": "refresh_token",
        },
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    with _lock:
        _tokens.update(payload)
        _tokens["expires_at"] = time.time() + payload.get("expires_in", 3500)
        return _tokens["access_token"]


def upload(
    path,
    *,
    title: str,
    description: str = "",
    privacy: str = "private",
    on_progress=None,
) -> str:
    """
    Resumable upload. Returns the new video id.

    Step one POSTs the metadata and gets back a one-shot session URL; step two
    PUTs the bytes to it in chunks, which is what makes progress reportable and
    lets a dropped connection resume rather than restart.
    """
    token = access_token()
    size = path.stat().st_size

    metadata = {
        "snippet": {
            "title": title[:100] or "Untitled",
            "description": description[:5000],
            # 22 = People & Blogs, the safest default for creator uploads.
            "categoryId": "22",
        },
        "status": {
            "privacyStatus": privacy if privacy in
            ("private", "unlisted", "public") else "private",
            "selfDeclaredMadeForKids": False,
        },
    }

    start = requests.post(
        UPLOAD_URL,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Length": str(size),
            "X-Upload-Content-Type": "video/mp4",
        },
        json=metadata,
        timeout=60,
    )
    start.raise_for_status()

    session_url = start.headers.get("Location")
    if not session_url:
        raise RuntimeError("YouTube did not return an upload session URL.")

    sent = 0
    with path.open("rb") as handle:
        while sent < size:
            chunk = handle.read(CHUNK_SIZE)
            if not chunk:
                break
            last = sent + len(chunk) - 1
            response = requests.put(
                session_url,
                headers={
                    "Content-Length": str(len(chunk)),
                    "Content-Range": f"bytes {sent}-{last}/{size}",
                },
                data=chunk,
                timeout=600,
            )

            # 308 means "keep going"; 200/201 means the upload finished.
            if response.status_code in (200, 201):
                sent = size
                if on_progress:
                    on_progress(100.0)
                return response.json().get("id", "")
            if response.status_code != 308:
                response.raise_for_status()
                raise RuntimeError(
                    f"Unexpected status {response.status_code} from YouTube."
                )

            sent = last + 1
            if on_progress:
                on_progress(sent / size * 100)

    raise RuntimeError("Upload ended without YouTube confirming the video.")
