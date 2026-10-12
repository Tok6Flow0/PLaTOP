#!/usr/bin/env bash
set -euo pipefail

if [[ "$(/usr/bin/uname -s)" != "Darwin" ]]; then
  printf '%s\n' 'The native companion requires macOS. Use npm start for the browser playground.' >&2
  exit 1
fi

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
APP_DIR="$ROOT_DIR/build/PLaTOP.app"
SWIFTC_BIN="$(/usr/bin/xcrun --find swiftc)"
SDK_PATH="$(/usr/bin/xcrun --sdk macosx --show-sdk-path)"
ARCHITECTURE="$(/usr/bin/uname -m)"
TEMP_BINARY="$ROOT_DIR/build/.PLaTOP-$$"
trap 'rm -f "$TEMP_BINARY"' EXIT

mkdir -p "$APP_DIR/Contents/MacOS" "$APP_DIR/Contents/Resources"
"$SWIFTC_BIN" -O -whole-module-optimization \
  -sdk "$SDK_PATH" -target "$ARCHITECTURE-apple-macosx12.0" \
  -module-name PLaTOP "$ROOT_DIR/native/PLaTOP.swift" \
  -framework AppKit -framework WebKit -o "$TEMP_BINARY"
cp "$ROOT_DIR/native/Info.plist" "$APP_DIR/Contents/Info.plist"
/usr/bin/plutil -lint "$APP_DIR/Contents/Info.plist"
mv -f "$TEMP_BINARY" "$APP_DIR/Contents/MacOS/PLaTOP"
chmod +x "$APP_DIR/Contents/MacOS/PLaTOP"
touch "$APP_DIR"
printf 'Built %s\n' "$APP_DIR"
