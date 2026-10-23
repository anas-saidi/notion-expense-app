#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
DEV=${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}
COMPILER="$DEV/Toolchains/XcodeDefault.xctoolchain/usr/bin/swiftc"
SDK="$DEV/Platforms/iPhoneSimulator.platform/Developer/SDKs/iPhoneSimulator.sdk"
# Type checking does not link assets, build a simulator bundle, or test device behavior.
find "$ROOT/CoupleFinance" -name '*.swift' -print0 | xargs -0 "$COMPILER" \
  -typecheck -parse-as-library -module-name CoupleFinance -swift-version 6 \
  -strict-concurrency=complete -target arm64-apple-ios26.0-simulator -sdk "$SDK"
