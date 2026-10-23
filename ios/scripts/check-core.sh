#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
swiftc -parse-as-library "$ROOT"/CoupleFinance/Models/*.swift \
  "$ROOT/CoupleFinance/Services/FinanceError.swift" \
  "$ROOT/CoupleFinance/Services/FinanceDate.swift" \
  "$ROOT/Verification/CoreChecks.swift" -o "$TMP/core-checks"
"$TMP/core-checks"
