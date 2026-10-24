#!/bin/sh
# Pack the theme into a zip installable from Komari's admin panel.
set -e
cd "$(dirname "$0")/.."
python3 tools/gen-palettes.py
ver=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' komari-theme.json | head -1)
if git rev-parse -q --verify "refs/tags/v$ver" >/dev/null 2>&1 || git ls-remote --exit-code --tags origin "v$ver" >/dev/null 2>&1; then
  echo "warning: tag v$ver already exists; bump the version in komari-theme.json before releasing" >&2
fi
rm -f omarchy.zip
zip -qr omarchy.zip komari-theme.json preview.png dist
echo "built $(pwd)/omarchy.zip"
