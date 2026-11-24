# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An unofficial Omarchy-style theme for the [Komari](https://github.com/komari-monitor/komari) monitoring dashboard. It is plain ES modules served as static files: no dependencies, no bundler, no build step. Everything shipped lives in `dist/`; Komari loads `dist/index.html`.

## Commands

- Tests: `node --test tests/` (single file: `node --test tests/unlock.test.mjs`). Tests import directly from `dist/*.js`, so keep modules testable under Node (no top-level DOM access in `unlock.js`, `util.js`, etc.).
- Package: `tools/pack.sh` regenerates `dist/palettes.js`, then zips `komari-theme.json`, `preview.png` and `dist/` into `omarchy.zip`. It warns if the version's git tag already exists, so bump `version` in `komari-theme.json` before a release.
- Regenerate palettes: `python3 tools/gen-palettes.py [themes-dir]` (default `~/.local/share/omarchy/themes`). Never hand-edit `dist/palettes.js`.
- No lint, no dev server. To try a change, pack and import the zip in Komari's admin **Themes** page (not the plugin upload).

## Architecture

- `dist/index.html` defines the static DOM (banner canvas, `#fx-stage` full-screen effect layer, list view, `#detail` section, status bar, help, screensaver). `palettes.js` is a classic script (sets a global); the rest are ES modules.
- `app.js` is the entry point: fetches nodes via `api.js`, renders the btop-style card grid, owns vim-style key handling, search/group filtering, palette and theme switching, the screensaver, and the hash router. `createDetail(app)` from `detail.js` is injected with the app and renders the `#/node/<uuid>` page (overview, ping, unlock tabs, time ranges).
- `api.js` wraps Komari's public endpoints: `unwrap` strips the `{status,data}` envelope, `rpc` calls the JSON-RPC endpoint, and records are cached (use `invalidate(uuid)` to refresh).
- `util.js` holds the text-drawing primitives (box, meter, braille `graph`, `bucketize`, `wcw` display width, formatters). The UI is drawn as monospaced text, so all width math must use `wcw` (CJK = 2 cells), never `.length`.
- `fx.js` has the ASCII banner and the 37 ttfx screensaver effects (`EFFECTS`; each is `{ dur, init?, pre?, f }`; `Banner` plays them on a full-viewport field: the screensaver with `{ full: true }`, the header intro on the `stage` canvas, which keeps the final static frame until the next scroll or resize so the end of an effect never shifts by a pixel; effects time cells by the text box `S.tx/ty/tw/th` and place extras on the field `S.W×S.H`; `scatter` is an alias of `scattered`, and the `intro` options in `komari-theme.json` must list them all). The banner font is ANSI Shadow style: `F` stores only the solid blocks and `shade` traces the box-drawing shadow. Site names the font lacks (CJK, accents) are rasterized by `rasterText` from a 16px system font, one `██` per pixel, and shaded the same way.
- `i18n.js` has the en/zh strings; language resolution order is saved choice, admin default, Komari `language` cookie, browser.
- `unlock.js` is pure logic (`pick`, `group`, `nodeEntry`) over the snapshot of the third-party unlock-test plugin; the tab is absent when the plugin is missing.
- `forecast.js` is pure logic (`nodeForecast`, `dailySeries`) over the NetForecast plugin's `/api/plugin/net-forecast/overview`; like unlock, its tab is absent when the plugin is missing.
- `quality.js` is pure logic (`nodeQuality`, `view`, `tally`) over the ip-quality plugin snapshot (`/api/plugin/ip-quality/snapshot`, the sibling repo `../komari-plugin-ipquality`); its tab is absent when the plugin is missing. In the detail page `v` switches IPv4/IPv6.
- `gfw.js` is pure logic (`nodeGfw`, `cardFlag`) over the gfw-check plugin snapshot (`/api/plugin/gfw-check/snapshot`, the sibling repo `../komari-plugin-gfwcheck`); the `w` tab is absent when the plugin is missing, and `app.js` polls the snapshot every minute to mark blocked/suspect cards.
- `komari-theme.json` is the theme manifest and the schema for admin-configurable settings (select options for palettes must match the palettes in `palettes.js`).
- `style.css` declares the `cjk-fit` font that scales local CJK fonts so Chinese glyphs fit exactly two cells.

## Constraints

- Public-safe: only show fields Komari already exposes publicly (no processes, IPs, private remarks).
- Keep it dependency-free and small (~80 KB total); new key bindings must be added to the README tables, the help text in `i18n.js`, and both languages.
