# Omarchy theme for Komari

A terminal-style theme for [Komari](https://github.com/komari-monitor/komari) in the spirit of the Omarchy desktop: monospace, square corners, one accent color, ASCII text effects.

> Unofficial. This is an independent project that imitates Omarchy's visual style. It is not affiliated with or endorsed by Omarchy or its authors.

一个 Komari 探针主题，致敬 Omarchy 桌面的视觉风格：等宽字体、直角、单一强调色、ASCII 文字动画。非官方项目，与 Omarchy 及其作者无关。

## Features

- ASCII banner of the site name with random effects (decrypt, rain, beams, scatter, burn); click it or press `r` to replay
- Site names the pixel font lacks (Chinese, accents) are rasterized from a system font into the same block art, so every effect still works
- An `admin` button in the status bar (and the `a` key) opens the Komari admin panel
- Screensaver after 90 s idle, looping the same effects on black
- btop-style cards: gradient meters and braille history graphs for CPU and network
- 23 Omarchy palettes; follows light/dark by default, visitors can switch, admins set the defaults
- Node detail page (`Enter` on a node): machine config, live resources with history graphs, and ping latency
- Ping view per task: latency graph, loss markers, avg/min/max, p50/p95/p99, jitter; switchable time range
- English / Chinese UI. The language is chosen from: the visitor's saved choice, the admin default, Komari's `language` cookie, then the browser language. Press `i` or click the language button to switch
- Vim-style keyboard navigation
- No dependencies, no build step, about 80 KB in total (plain ES modules)
- Public-safe: no processes, IPs or private remarks are shown; only fields Komari already exposes publicly

## Install

1. `tools/pack.sh` builds `omarchy.zip` (or download it from a release).
2. In the Komari admin panel, open **Themes**, import the zip, then enable it. Use the theme import, not the plugin upload.

## Keys

| Key | Action |
| --- | --- |
| `h` `j` `k` `l` / arrows | move between nodes |
| `gg` `G` | first / last node |
| `0` `$` | start / end of row |
| `3j` `5G` | number prefix repeats the motion |
| `Enter` | open node detail |
| `u` `Esc` | back: clear search, clear group |
| `/` | search by name or group |
| `H` `L` | previous / next group |
| `t` `T` | next / previous palette |
| `r` | replay banner effect |
| `s` | screensaver |
| `i` | switch language (English / 中文) |
| `a` | open the admin panel (`/admin`) |
| `?` | help |

### In the detail page

| Key | Action |
| --- | --- |
| `h` `l` / `[` `]` | previous / next time range (1h, 6h, 24h, 7d, 30d; limited by the server's retention) |
| `o` / `p` / `Tab` | overview / ping / switch |
| `j` `k` | ping: select a task; overview: scroll |
| `Enter` | ping: zoom into the selected task |
| `u` `Esc` | back: unzoom, then to the node list |
| `R` | refresh now |

The detail page lives at `#/node/<uuid>`, so the browser back button and links work.

## Settings

Configurable in the admin panel: default language, default dark and light palette, whether visitors may switch palettes, group filter, banner text, intro effect, and the screensaver.

## Chinese text and fonts

The cards are drawn with text, so Chinese characters must be exactly two cells wide. `style.css` declares a `cjk-fit` font that scales a locally installed CJK font (Noto Sans CJK, Source Han Sans, PingFang SC, Microsoft YaHei, WenQuanYi) by 120% to fit. If none of them is installed, Chinese still shows but the box edges may be slightly misaligned.

## Palettes

`dist/palettes.js` is generated from Omarchy's `colors.toml` files by `tools/gen-palettes.py` (pass the themes directory as the first argument, default `~/.local/share/omarchy/themes`).

## License

MIT
