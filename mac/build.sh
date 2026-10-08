#!/bin/sh
# Builds "Studio de Nuance.app" (and a zip of it) into dist/ from the web files in this repo.
set -e
cd "$(dirname "$0")/.."
APP="dist/Studio de Nuance.app"
rm -rf "$APP" dist/iconset.iconset
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/web"

# Universal: runs on Apple-silicon and Intel Macs
swiftc -O -target arm64-apple-macos12.0 -o dist/nuance-arm64 mac/main.swift
swiftc -O -target x86_64-apple-macos12.0 -o dist/nuance-x86_64 mac/main.swift
lipo -create dist/nuance-arm64 dist/nuance-x86_64 -output "$APP/Contents/MacOS/Studio de Nuance"
rm dist/nuance-arm64 dist/nuance-x86_64

cp -R index.html manifest.webmanifest css js icons "$APP/Contents/Resources/web/"

# App icon from the 512px PNG
mkdir -p dist/iconset.iconset
for s in 16 32 128 256 512; do
  sips -z $s $s icons/icon-512.png --out "dist/iconset.iconset/icon_${s}x${s}.png" >/dev/null
  d=$((s * 2)); [ $d -le 512 ] && sips -z $d $d icons/icon-512.png --out "dist/iconset.iconset/icon_${s}x${s}@2x.png" >/dev/null
done
cp icons/icon-512.png "dist/iconset.iconset/icon_256x256@2x.png"
iconutil -c icns dist/iconset.iconset -o "$APP/Contents/Resources/AppIcon.icns"
rm -rf dist/iconset.iconset

VER=$(git rev-list --count HEAD 2>/dev/null || echo 1)
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Studio de Nuance</string>
  <key>CFBundleDisplayName</key><string>Studio de Nuance</string>
  <key>CFBundleIdentifier</key><string>io.github.kimpelota.studio-de-nuance</string>
  <key>CFBundleExecutable</key><string>Studio de Nuance</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0.$VER</string>
  <key>CFBundleVersion</key><string>$VER</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>LSApplicationCategoryType</key><string>public.app-category.photography</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSMicrophoneUsageDescription</key><string>Reel Studio records voiceovers with your microphone.</string>
  <key>NSPrincipalClass</key><string>NSApplication</string>
</dict></plist>
PLIST

# Ad-hoc signature so macOS will run it on this Mac
codesign --force --deep --sign - "$APP"
(cd dist && rm -f "Studio-de-Nuance-mac.zip" && ditto -c -k --keepParent "Studio de Nuance.app" "Studio-de-Nuance-mac.zip")
echo "Built $APP"
