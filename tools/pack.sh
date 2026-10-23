#!/bin/sh
# Pack the theme into a zip installable from Komari's admin panel.
set -e
cd "$(dirname "$0")/.."
python3 tools/gen-palettes.py
rm -f omarchy.zip
zip -qr omarchy.zip komari-theme.json preview.png dist
echo "built $(pwd)/omarchy.zip"
