#!/bin/bash

set -e
cd "$(dirname "$0")"

PORT=""
for CANDIDATE in 8765 8766 8767 8768 8769 8770; do
  if ! lsof -nP -iTCP:"$CANDIDATE" -sTCP:LISTEN >/dev/null 2>&1; then
    PORT="$CANDIDATE"
    break
  fi
done

if [ -z "$PORT" ]; then
  echo "No free local port was found (8765-8770)."
  echo "Close an older HUA terminal window and try again."
  read -r -p "Press Return to close..."
  exit 1
fi

URL="http://127.0.0.1:${PORT}/?assets=local"

if command -v python3 >/dev/null 2>&1; then
  SERVER=(python3 -m http.server "$PORT" --bind 127.0.0.1)
elif command -v python >/dev/null 2>&1; then
  SERVER=(python -m http.server "$PORT" --bind 127.0.0.1)
elif command -v ruby >/dev/null 2>&1; then
  SERVER=(ruby -run -e httpd . -p "$PORT" -b 127.0.0.1)
else
  echo "A local web server is required. Install Python 3, then run this file again."
  echo "https://www.python.org/downloads/macos/"
  read -r -p "Press Return to close..."
  exit 1
fi

echo "Starting the fully local HUA showcase:"
echo "$URL"
echo
echo "Keep this Terminal window open. Press Control-C here to stop the server."

(sleep 1; open "$URL") &
exec "${SERVER[@]}"
