#!/bin/sh
# Takota container entrypoint.
#
# Runs the Go backend and Nginx together inside one container. If either
# process dies, the other is stopped and the container exits with a non-zero
# status so the orchestrator (Docker restart policy) restarts the whole
# thing instead of serving a broken half-started app.

set -u

BACKEND_BIN=/usr/local/bin/takota-api
BACKEND_PID=
NGINX_PID=

cleanup() {
  trap - EXIT INT TERM
  if [ -n "$BACKEND_PID" ]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [ -n "$NGINX_PID" ]; then
    kill "$NGINX_PID" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
}

trap cleanup EXIT INT TERM

"$BACKEND_BIN" &
BACKEND_PID=$!

nginx -g 'daemon off;' &
NGINX_PID=$!

echo "[entrypoint] started backend (pid $BACKEND_PID) and nginx (pid $NGINX_PID)"

while :; do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "[entrypoint] backend exited, shutting down container"
    exit 1
  fi
  if ! kill -0 "$NGINX_PID" 2>/dev/null; then
    echo "[entrypoint] nginx exited, shutting down container"
    exit 1
  fi
  sleep 2
done
