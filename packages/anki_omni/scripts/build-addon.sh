#!/usr/bin/env bash
# Package Anki Omni Accessibility for local install or AnkiWeb upload.
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$SRC/../.." && pwd)"
OUT="$REPO_ROOT/dist"
NAME="anki_omni_accessibility"
VERSION="$(python3 -c "import json; print(json.load(open('$SRC/manifest.json'))['human_version'])")"
ZIP="$OUT/${NAME}-v${VERSION}.ankiaddon"

mkdir -p "$OUT"
rm -f "$ZIP"

(
  cd "$SRC"
  zip -r "$ZIP" . \
    -x '*.DS_Store' \
    -x '__pycache__/*' \
    -x '*.pyc'
)

echo "Built $ZIP"
echo ""
echo "Install: Tools → Add-ons → Install from file… → select the .ankiaddon"
echo "Or symlink for development:"
echo "  ln -sf \"$SRC\" \"\$HOME/Library/Application Support/Anki2/addons21/$NAME\""
