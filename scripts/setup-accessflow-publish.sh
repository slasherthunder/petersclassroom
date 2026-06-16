#!/usr/bin/env bash
# One-time setup + first publish for @axolassist/accessflow
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG="$ROOT/packages/accessflow"
REPO="slasherthunder/petersclassroom"
TAG="accessflow-v1.0.0"

echo "=== AccessFlow npm publish setup ==="
echo ""

# --- npm login ---
if ! npm whoami >/dev/null 2>&1; then
  echo "Step 1: Log in to npm (browser or credentials)"
  echo "  Create org first: https://www.npmjs.com/org/create  → name: axolassist"
  echo ""
  npm login
else
  echo "✓ npm logged in as $(npm whoami)"
fi

echo ""
echo "Step 2: Verify @axolassist org (optional)"
if npm org ls axolassist >/dev/null 2>&1; then
  echo "✓ npm org @axolassist exists"
else
  echo "⚠ Org @axolassist not found under your account."
  echo "  Create it: https://www.npmjs.com/org/create (free public packages)"
  echo "  Press Enter when done, or Ctrl+C to abort."
  read -r _
fi

echo ""
echo "Step 3: Build and validate package"
cd "$PKG"
npm ci
npm run typecheck
npm run build
npm publish --dry-run
echo "✓ Dry-run publish OK"

echo ""
echo "Step 4: GitHub secret NPM_TOKEN"
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI detected. Set NPM_TOKEN now?"
  echo "Create token: https://www.npmjs.com/settings/tokens (granular, @axolassist read/write)"
  read -r -p "Set NPM_TOKEN via gh secret set? [y/N] " yn
  if [[ "${yn,,}" == "y" ]]; then
    gh secret set NPM_TOKEN --repo "$REPO"
    echo "✓ NPM_TOKEN set on $REPO"
  fi
else
  echo "Install GitHub CLI (https://cli.github.com/) or add the secret manually:"
  echo "  https://github.com/$REPO/settings/secrets/actions"
  echo "  Name: NPM_TOKEN  Value: your npm granular token"
  read -r -p "Press Enter when NPM_TOKEN is saved in GitHub..."
fi

echo ""
echo "Step 5: Tag and push to trigger GitHub Actions publish"
cd "$ROOT"
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Tag $TAG already exists locally."
else
  git tag "$TAG"
  echo "✓ Created tag $TAG"
fi

read -r -p "Push tag $TAG to origin now? [y/N] " push_tag
if [[ "${push_tag,,}" == "y" ]]; then
  git push origin "$TAG"
  echo "✓ Pushed $TAG — watch: https://github.com/$REPO/actions"
fi

echo ""
echo "Optional: publish from this machine now (skips CI)"
read -r -p "Run npm publish locally? [y/N] " local_pub
if [[ "${local_pub,,}" == "y" ]]; then
  cd "$PKG"
  npm publish
  echo "✓ Published @axolassist/accessflow@$(node -p "require('./package.json').version")"
fi

echo ""
echo "Done. Full docs: packages/accessflow/PUBLISHING.md"
