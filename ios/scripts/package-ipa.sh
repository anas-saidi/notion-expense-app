#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
export DEVELOPER_DIR=${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}
xcodebuild -project "$ROOT/CoupleFinance.xcodeproj" -scheme CoupleFinance \
  -configuration Release -sdk iphoneos -destination 'generic/platform=iOS' \
  -derivedDataPath "$ROOT/build/device" CODE_SIGNING_ALLOWED=NO \
  SWIFT_ACTIVE_COMPILATION_CONDITIONS='$(inherited) PERSONAL_INSTALL_SETUP' build
APP="$ROOT/build/device/Build/Products/Release-iphoneos/CoupleFinance.app"
[ -f "$APP/Info.plist" ] || { echo 'No built app found; IPA was not created.' >&2; exit 1; }
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
mkdir "$STAGE/Payload"
ditto "$APP" "$STAGE/Payload/CoupleFinance.app"
(cd "$STAGE" && ditto -c -k --keepParent Payload "$ROOT/build/CoupleFinance.ipa")
printf 'Created %s\n' "$ROOT/build/CoupleFinance.ipa"
