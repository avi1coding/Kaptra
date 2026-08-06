#!/usr/bin/env bash
# Writes backend/.env with your Google OAuth credentials.
#
# Avoids hand-editing a dotfile — TextEdit frequently refuses to save files
# beginning with "." or quietly appends .txt, which is the usual reason the
# backend still reports configured: false.

set -euo pipefail
cd "$(dirname "$0")"

echo
echo "Kaptra — YouTube upload setup"
echo "──────────────────────────────"
echo "From Google Cloud Console → Google Auth Platform → Clients"
echo "→ your Web application client."
echo

read -r -p "Client ID     : " CLIENT_ID
read -r -s -p "Client secret : " CLIENT_SECRET   # -s so it isn't echoed
echo
echo

# Trim stray whitespace from copy-paste.
CLIENT_ID="$(printf '%s' "$CLIENT_ID" | tr -d '[:space:]')"
CLIENT_SECRET="$(printf '%s' "$CLIENT_SECRET" | tr -d '[:space:]')"

if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ]; then
  echo "Both values are required — nothing written." >&2
  exit 1
fi

case "$CLIENT_ID" in
  *.apps.googleusercontent.com) ;;
  *) echo "Heads up: a client ID normally ends in .apps.googleusercontent.com" ;;
esac

if [ -f .env ]; then
  cp .env ".env.backup.$(date +%s)"
  echo "Existing .env backed up."
  # Drop any previous Google lines so this doesn't append duplicates.
  grep -v -E '^\s*(export\s+)?GOOGLE_CLIENT_(ID|SECRET)=' .env > .env.tmp || true
  mv .env.tmp .env
fi

{
  printf 'GOOGLE_CLIENT_ID=%s\n' "$CLIENT_ID"
  printf 'GOOGLE_CLIENT_SECRET=%s\n' "$CLIENT_SECRET"
} >> .env

chmod 600 .env

echo "Wrote $(pwd)/.env"
echo
echo "Now restart the backend:"
echo "  pkill -f uvicorn"
echo "  ./.venv/bin/uvicorn main:app --port 8000"
echo
echo "Then check:  curl -s http://127.0.0.1:8000/youtube/status"
echo
