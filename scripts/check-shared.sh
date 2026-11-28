#!/usr/bin/env bash
# The @devdigest/shared contracts are COPIED into server/ and client/ (tsconfig
# path alias, not a package). server/src/vendor/shared is canonical.
#   ./scripts/check-shared.sh         fail if the copies differ (CI)
#   ./scripts/check-shared.sh --fix   overwrite the client copy from server
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=server/src/vendor/shared/
DST=client/src/vendor/shared/
if [[ "${1:-}" == "--fix" ]]; then
  rsync -a --delete "$SRC" "$DST"
  echo "synced $DST from $SRC"
  exit 0
fi
if ! diff -r "$SRC" "$DST"; then
  echo >&2 "✗ $DST drifted from $SRC. Edit the server copy, then run ./scripts/check-shared.sh --fix"
  exit 1
fi
echo "✓ shared contracts in sync"
