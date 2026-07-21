#!/bin/bash
# ==========================================================================
# All-in-one entrypoint: start MediaMTX in the background, then the Node app.
# If either process exits, stop the container so Docker restarts it cleanly.
# ==========================================================================
set -u
export TZ="${TZ:-Asia/Jakarta}"

MEDIAMTX_CONFIG="${MEDIAMTX_CONFIG:-/app/mediamtx.yml}"

echo "[entrypoint] Starting MediaMTX (config: $MEDIAMTX_CONFIG)..."
/usr/local/bin/mediamtx "$MEDIAMTX_CONFIG" &
MEDIAMTX_PID=$!

# Give MediaMTX a moment to open its API before the app tries to sync.
sleep 2

if ! kill -0 "$MEDIAMTX_PID" 2>/dev/null; then
    echo "[entrypoint] ERROR: MediaMTX failed to start." >&2
    exit 1
fi
echo "[entrypoint] MediaMTX running (pid $MEDIAMTX_PID)."

# Dev mode: run via nodemon so code changes (bind-mounted source) auto-restart
# the Node app WITHOUT rebuilding the image. MediaMTX keeps running untouched.
if [ "${DEV_MODE:-0}" = "1" ]; then
    echo "[entrypoint] DEV_MODE=1 -> starting Node with nodemon (auto-reload)..."
    # --legacy-watch (polling): inotify sering tak terpicu lewat bind-mount Windows,
    # jadi pakai polling agar perubahan .js/.ejs/.json benar-benar memicu restart.
    npx nodemon --legacy-watch --watch . --ext js,ejs,json --ignore recordings/ --ignore stream_logs/ index.js &
    NODE_PID=$!
else
    echo "[entrypoint] Starting Node app..."
    node index.js &
    NODE_PID=$!
fi

# Propagate termination signals to both children.
term() {
    echo "[entrypoint] Caught signal, shutting down..."
    kill -TERM "$NODE_PID" "$MEDIAMTX_PID" 2>/dev/null
}
trap term TERM INT

# Exit as soon as EITHER process dies, so the container restarts as a unit.
wait -n "$MEDIAMTX_PID" "$NODE_PID"
EXIT_CODE=$?
echo "[entrypoint] A child process exited (code $EXIT_CODE). Stopping container."
kill -TERM "$NODE_PID" "$MEDIAMTX_PID" 2>/dev/null
exit "$EXIT_CODE"
