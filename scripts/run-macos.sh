#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
APP_DIR="$ROOT_DIR/build/PLaTOP.app"
APP_BINARY="$APP_DIR/Contents/MacOS/PLaTOP"
APP_ICON="$APP_DIR/Contents/Resources/PLaTOP.icns"
ICON_MASTER="$ROOT_DIR/public/brand/platop-logo.png"
LOCAL_DIR="$ROOT_DIR/.local"
PID_FILE="$LOCAL_DIR/server.pid"
OWNER_FILE="$LOCAL_DIR/server.started-at"
MODE="${1:-open}"

if [[ "$#" -gt 1 ]] || [[ "$MODE" != "open" && "$MODE" != "--no-open" && "$MODE" != "--stop-server" && "$MODE" != "--help" ]]; then
  printf '%s\n' 'Usage: bash scripts/run-macos.sh [--no-open | --stop-server | --help]' >&2
  exit 2
fi
if [[ "$MODE" == "--help" ]]; then
  printf '%s\n' 'Open PLaTOP and start its local bridge if needed.' \
    '  --no-open      Build and check the local bridge without opening a window.' \
    '  --stop-server  Stop only the bridge started and recorded by this launcher.' \
    'Optional environment: PLATOP_PORT (default 4317).'
  exit 0
fi
if [[ "$(/usr/bin/uname -s)" != "Darwin" ]]; then
  printf '%s\n' 'The native companion requires macOS. Use npm start for the browser playground.' >&2
  exit 1
fi
NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" ]]; then
  printf '%s\n' 'Node.js is required. Install the version in package.json, then run npm install.' >&2
  exit 1
fi

if [[ "$MODE" == "--stop-server" ]]; then
  if [[ ! -f "$PID_FILE" || ! -f "$OWNER_FILE" ]]; then
    printf '%s\n' 'This launcher has no recorded bridge to stop.'
    exit 0
  fi
  IFS= read -r OWNED_PID < "$PID_FILE"
  IFS= read -r OWNED_STARTED_AT < "$OWNER_FILE"
  if [[ ! "$OWNED_PID" =~ ^[0-9]+$ ]]; then
    printf '%s\n' 'Invalid bridge PID record; no process was stopped.' >&2
    exit 1
  fi
  if ! kill -0 "$OWNED_PID" 2>/dev/null; then
    rm -f "$PID_FILE" "$OWNER_FILE"
    printf '%s\n' 'The recorded bridge has already stopped.'
    exit 0
  fi
  CURRENT_COMMAND="$(/bin/ps -p "$OWNED_PID" -o command= 2>/dev/null || true)"
  CURRENT_STARTED_AT="$(/bin/ps -p "$OWNED_PID" -o lstart= 2>/dev/null || true)"
  if [[ "$CURRENT_COMMAND" != "$NODE_BIN $ROOT_DIR/server/index.mjs" || "$CURRENT_STARTED_AT" != "$OWNED_STARTED_AT" ]]; then
    printf '%s\n' 'The recorded PID no longer matches this launcher’s bridge; no process was stopped.' >&2
    exit 1
  fi
  kill "$OWNED_PID"
  rm -f "$PID_FILE" "$OWNER_FILE"
  printf '%s\n' 'Stopped the bridge started by this launcher. The desktop app can be quit separately.'
  exit 0
fi

PORT_NUMBER="${PLATOP_PORT:-4317}"
if [[ ! "$PORT_NUMBER" =~ ^[0-9]{1,5}$ ]]; then
  printf '%s\n' 'PLATOP_PORT must be a number between 1 and 65535.' >&2
  exit 2
fi
PORT_NUMBER="$((10#$PORT_NUMBER))"
if (( PORT_NUMBER < 1 || PORT_NUMBER > 65535 )); then
  printf '%s\n' 'PLATOP_PORT must be a number between 1 and 65535.' >&2
  exit 2
fi
PLAYGROUND_URL="http://127.0.0.1:$PORT_NUMBER"

cd "$ROOT_DIR"
if ! "$NODE_BIN" "$ROOT_DIR/scripts/build-fingerprint.mjs" --check; then
  if [[ ! -d "$ROOT_DIR/node_modules" ]]; then
    printf '%s\n' 'Run npm install once before opening the desktop playground.' >&2
    exit 1
  fi
  printf '%s\n' 'Building the current playground source and assets.'
  npm run build
fi
if [[ ! -x "$APP_BINARY" || ! -s "$APP_ICON" || ! -f "$ICON_MASTER" || "$ICON_MASTER" -nt "$APP_ICON" || "$ROOT_DIR/native/PLaTOP.swift" -nt "$APP_BINARY" || "$ROOT_DIR/native/Info.plist" -nt "$APP_DIR/Contents/Info.plist" || "$ROOT_DIR/scripts/build-macos.sh" -nt "$APP_BINARY" ]]; then
  bash "$ROOT_DIR/scripts/build-macos.sh"
fi

mkdir -p "$LOCAL_DIR"
PROBE_FILE="$LOCAL_DIR/server-probe-$$.json"
trap 'rm -f "$PROBE_FILE"' EXIT
bridge_is_ready() {
  /usr/bin/curl --silent --fail --noproxy '*' --max-time 2 --max-filesize 262144 \
    "$PLAYGROUND_URL/api/state" -o "$PROBE_FILE" || return 1
  "$NODE_BIN" --input-type=module -e '
    import { readFileSync } from "node:fs";
    try {
      const state = JSON.parse(readFileSync(process.argv[1], "utf8"));
      const teamIds = new Set(state.teams?.map((team) => team.teamId));
      const expected = ["merchant", "hr", "intake", "support", "reflection", "email"];
      process.exit(state.app === "platop" && state.schemaVersion === 1 &&
        state.teams?.length === expected.length && expected.every((id) => teamIds.has(id)) ? 0 : 1);
    } catch { process.exit(1); }
  ' "$PROBE_FILE" >/dev/null 2>&1
}

if bridge_is_ready; then
  printf 'Using PLaTOP bridge at %s\n' "$PLAYGROUND_URL"
else
  if /usr/sbin/lsof -nP -iTCP:"$PORT_NUMBER" -sTCP:LISTEN >/dev/null 2>&1; then
    printf 'Port %s is occupied by a service that is not a healthy PLaTOP bridge. No process was changed.\n' "$PORT_NUMBER" >&2
    exit 1
  fi
  if [[ ! -f "$ROOT_DIR/server/index.mjs" ]]; then
    printf '%s\n' 'The local bridge entry server/index.mjs is missing.' >&2
    exit 1
  fi
  PLATOP_PORT="$PORT_NUMBER" /usr/bin/nohup "$NODE_BIN" "$ROOT_DIR/server/index.mjs" \
    >"$LOCAL_DIR/server.log" 2>&1 </dev/null &
  OWNED_PID="$!"
  printf '%s\n' "$OWNED_PID" > "$PID_FILE"
  if ! /bin/ps -p "$OWNED_PID" -o lstart= > "$OWNER_FILE"; then
    rm -f "$PID_FILE" "$OWNER_FILE"
    printf 'The PLaTOP bridge exited during startup. Inspect %s\n' "$LOCAL_DIR/server.log" >&2
    exit 1
  fi
  BRIDGE_READY=false
  for _ in {1..50}; do
    if bridge_is_ready; then
      BRIDGE_READY=true
      break
    fi
    if ! kill -0 "$OWNED_PID" 2>/dev/null; then break; fi
    sleep 0.2
  done
  if [[ "$BRIDGE_READY" != true ]]; then
    printf 'The PLaTOP bridge did not become ready. Inspect %s\n' "$LOCAL_DIR/server.log" >&2
    exit 1
  fi
  printf 'Started PLaTOP bridge at %s\n' "$PLAYGROUND_URL"
fi

if [[ "$MODE" == "--no-open" ]]; then
  printf '%s\n' 'Desktop bundle and bridge are ready. No window was opened.'
else
  /usr/bin/open -a "$APP_DIR" --args --url "$PLAYGROUND_URL"
  printf '%s\n' 'Opened PLaTOP. Its menu bar icon can reopen or float the window.'
fi
