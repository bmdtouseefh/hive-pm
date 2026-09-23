#!/usr/bin/env bash
# Hive PM — production starter (home PC / server).
#
# Starts, in production mode:
#   1. the SQLite sync server (phone <-> PC auto sync), and
#   2. the built web UI served from dist/ (so any LAN device can use a browser)
#
# Usage:
#   ./start-prod.sh [start|stop|restart|status|logs] [options]
#   bun run prod -- start            # same via npm script
#
# Options:
#   --build        force a fresh frontend build (tsc + vite)
#   --skip-build   skip the build even if dist/ is missing (fail if missing)
#   --no-web       don't serve the web UI, sync server only
#   -h, --help     show help
#
# Env overrides:
#   PORT=8091 WEB_PORT=8080 HOST=0.0.0.0 SYNC_DB=./sync-server/hive-pm-sync.db
#   WEB=0  (same as --no-web)   SKIP_BUILD=1  (same as --skip-build)
#
# Processes run daemonized with pid files in .run/ and logs in logs/.
# For boot-on-login instead, use: bun run sync:service (systemd, sync + web).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-8091}"
WEB_PORT="${WEB_PORT:-8080}"
HOST="${HOST:-0.0.0.0}"
SYNC_DB="${SYNC_DB:-$ROOT/sync-server/hive-pm-sync.db}"
WEB="${WEB:-1}"
SKIP_BUILD="${SKIP_BUILD:-0}"
LOG_DIR="$ROOT/logs"
RUN_DIR="$ROOT/.run"
SYNC_PID="$RUN_DIR/sync-server.pid"
WEB_PID="$RUN_DIR/web.pid"
FORCE_BUILD=0

usage() {
  sed -n '2,/^set -euo/p' "$0" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    start|stop|restart|status|logs) CMD="${CMD:-$1}" ;;
    --build) FORCE_BUILD=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    --no-web) WEB=0 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "error: unknown argument '$1' (try --help)" >&2; exit 1 ;;
  esac
  shift
done
CMD="${CMD:-start}"

need_bun() {
  command -v bun >/dev/null 2>&1 || { echo "error: 'bun' not found on PATH. Install it first: https://bun.sh" >&2; exit 1; }
}

alive() { # alive <pidfile> -> 0/1, cleans stale pidfiles
  local f="$1"
  [[ -f "$f" ]] || return 1
  local pid
  pid="$(cat "$f")"
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then return 0; fi
  rm -f "$f"
  return 1
}

# Single owner per port: the systemd units (Restart=always) and this script
# fight over the ports otherwise — one is killed, the other revives in 3s.
unit_active() { systemctl --user is-active --quiet "$1" 2>/dev/null; }
take_ports() {
  for u in pulse-pm-sync.service pulse-pm-web.service; do
    if unit_active "$u"; then
      echo "Stopping conflicting $u (script takes over; reinstall the service to hand back)…"
      systemctl --user stop "$u" 2>/dev/null || true
    fi
  done
}

build_frontend() {
  if [[ "$SKIP_BUILD" == "1" ]]; then
    [[ -f "$ROOT/dist/index.html" ]] || { echo "error: dist/ missing and --skip-build set. Run without it to build." >&2; exit 1; }
    return 0
  fi
  if [[ "$FORCE_BUILD" == "1" || ! -f "$ROOT/dist/index.html" ]]; then
    echo "Building frontend (tsc + vite)…"
    [[ -d "$ROOT/node_modules" ]] || { echo "Installing dependencies…"; bun install --cwd "$ROOT"; }
    bun run --cwd "$ROOT" build
  else
    echo "Frontend build present in dist/ (use --build to rebuild)."
  fi
}

do_start() {
  need_bun
  mkdir -p "$LOG_DIR" "$RUN_DIR"
  build_frontend
  take_ports

  if alive "$SYNC_PID"; then
    echo "Sync server already running (pid $(cat "$SYNC_PID"), port $PORT)."
  else
    echo "Starting sync server on $HOST:$PORT (db: $SYNC_DB)…"
    PORT="$PORT" SYNC_DB="$SYNC_DB" nohup bun "$ROOT/sync-server/server.ts" >>"$LOG_DIR/sync-server.log" 2>&1 &
    echo $! > "$SYNC_PID"
    sleep 2
    alive "$SYNC_PID" || { echo "error: sync server failed to start — see $LOG_DIR/sync-server.log" >&2; exit 1; }
  fi

  if [[ "$WEB" == "1" ]]; then
    if alive "$WEB_PID"; then
      echo "Web UI already running (pid $(cat "$WEB_PID"), port $WEB_PORT)."
    else
      echo "Serving web UI on $HOST:$WEB_PORT…"
      # Run vite directly (not via bunx) so the daemonized pid is the server itself.
      nohup bun "$ROOT/node_modules/vite/bin/vite.js" preview --host "$HOST" --port "$WEB_PORT" --strictPort >>"$LOG_DIR/web.log" 2>&1 &
      echo $! > "$WEB_PID"
      sleep 2
      alive "$WEB_PID" || { echo "error: web server failed to start — see $LOG_DIR/web.log" >&2; exit 1; }
    fi
  fi

  echo
  do_status
}

do_stop() {
  local stopped=0
  take_ports
  for f in "$SYNC_PID" "$WEB_PID"; do
    if alive "$f"; then
      local pid
      pid="$(cat "$f")"
      echo "Stopping pid $pid…"
      kill "$pid" 2>/dev/null || true
      for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.25; done
      kill -9 "$pid" 2>/dev/null || true
      rm -f "$f"
      stopped=1
    fi
  done
  [[ "$stopped" == "1" ]] || echo "Nothing running (no pid files in .run/)."
}

do_status() {
  if alive "$SYNC_PID"; then
    echo "✓ sync server: running (pid $(cat "$SYNC_PID"))"
    if command -v curl >/dev/null 2>&1; then
      curl -s -m 5 "http://127.0.0.1:$PORT/health" 2>/dev/null && echo || echo "  (health check unreachable)"
    fi
  else
    echo "✗ sync server: stopped"
  fi
  if [[ "$WEB" == "1" ]]; then
    if alive "$WEB_PID"; then
      echo "✓ web UI:        running (pid $(cat "$WEB_PID")) → http://127.0.0.1:$WEB_PORT"
    else
      echo "✗ web UI:        stopped"
    fi
  fi
  for ip in $(hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' || true); do
    echo "  LAN: http://$ip:$WEB_PORT (app) · http://$ip:$PORT (sync)"
  done
  for u in pulse-pm-sync.service pulse-pm-web.service; do
    if unit_active "$u"; then echo "● $u: active under systemd (conflicts with this script — stop runs take_ports)"; fi
  done
}

do_logs() {
  tail -n 100 -F "$LOG_DIR/sync-server.log" "$LOG_DIR/web.log" 2>/dev/null || tail -n 100 -F "$LOG_DIR"/*.log
}

case "$CMD" in
  start) do_start ;;
  stop) do_stop ;;
  restart) do_stop; sleep 1; do_start ;;
  status) do_status ;;
  logs) do_logs ;;
esac
