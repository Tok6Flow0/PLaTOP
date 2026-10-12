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
ICON_MASTER="$ROOT_DIR/public/brand/platop-logo.png"
if [[ ! -f "$ICON_MASTER" ]]; then
  printf '%s\n' 'The app logo public/brand/platop-logo.png is missing.' >&2
  exit 1
fi
ICON_METADATA="$(/usr/bin/sips -g format -g pixelWidth -g pixelHeight "$ICON_MASTER")"
ICON_FORMAT="$(printf '%s\n' "$ICON_METADATA" | /usr/bin/awk '$1 == "format:" { print $2 }')"
ICON_WIDTH="$(printf '%s\n' "$ICON_METADATA" | /usr/bin/awk '$1 == "pixelWidth:" { print $2 }')"
ICON_HEIGHT="$(printf '%s\n' "$ICON_METADATA" | /usr/bin/awk '$1 == "pixelHeight:" { print $2 }')"
if [[ "$ICON_FORMAT" != "png" || "$ICON_WIDTH" != "1024" || "$ICON_HEIGHT" != "1024" ]]; then
  printf '%s\n' 'The app logo must be a 1024 × 1024 PNG.' >&2
  exit 1
fi

mkdir -p "$ROOT_DIR/build"
TEMP_BUILD_DIR="$(/usr/bin/mktemp -d "$ROOT_DIR/build/.PLaTOP-build.XXXXXX")"
trap 'rm -rf "$TEMP_BUILD_DIR"' EXIT
TEMP_BINARY="$TEMP_BUILD_DIR/PLaTOP"
ICONSET_DIR="$TEMP_BUILD_DIR/PLaTOP.iconset"
mkdir -p "$ICONSET_DIR"
for ICON_VARIANT in \
  '16:icon_16x16.png' '32:icon_16x16@2x.png' \
  '32:icon_32x32.png' '64:icon_32x32@2x.png' \
  '128:icon_128x128.png' '256:icon_128x128@2x.png' \
  '256:icon_256x256.png' '512:icon_256x256@2x.png' \
  '512:icon_512x512.png' '1024:icon_512x512@2x.png'; do
  ICON_SIZE="${ICON_VARIANT%%:*}"
  ICON_FILENAME="${ICON_VARIANT#*:}"
  /usr/bin/sips --resampleHeightWidth "$ICON_SIZE" "$ICON_SIZE" "$ICON_MASTER" \
    --out "$ICONSET_DIR/$ICON_FILENAME" >/dev/null
done
/usr/bin/iconutil --convert icns "$ICONSET_DIR" --output "$TEMP_BUILD_DIR/PLaTOP.icns"
if [[ ! -s "$TEMP_BUILD_DIR/PLaTOP.icns" ]]; then
  printf '%s\n' 'The macOS app icon could not be generated.' >&2
  exit 1
fi

mkdir -p "$APP_DIR/Contents/MacOS" "$APP_DIR/Contents/Resources"
"$SWIFTC_BIN" -O -whole-module-optimization \
  -sdk "$SDK_PATH" -target "$ARCHITECTURE-apple-macosx12.0" \
  -module-name PLaTOP "$ROOT_DIR/native/PLaTOP.swift" \
  -framework AppKit -framework WebKit -framework CoreLocation -o "$TEMP_BINARY"
cp "$ROOT_DIR/native/Info.plist" "$APP_DIR/Contents/Info.plist"
/usr/bin/plutil -lint "$APP_DIR/Contents/Info.plist"
cp "$TEMP_BUILD_DIR/PLaTOP.icns" "$APP_DIR/Contents/Resources/PLaTOP.icns"
mv -f "$TEMP_BINARY" "$APP_DIR/Contents/MacOS/PLaTOP"
chmod +x "$APP_DIR/Contents/MacOS/PLaTOP"
/usr/bin/codesign --force --sign - --identifier com.platop.desktop "$APP_DIR"
/usr/bin/codesign --verify --strict "$APP_DIR"
touch "$APP_DIR"
printf 'Built %s\n' "$APP_DIR"
