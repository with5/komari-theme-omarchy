# Omarchy theme for Komari

A terminal-style theme for [Komari](https://github.com/komari-monitor/komari) in the spirit of the Omarchy desktop: monospace, square corners, one accent color, ASCII text effects.

> Unofficial. This is an independent project that imitates Omarchy's visual style. It is not affiliated with or endorsed by Omarchy or its authors.

一个 Komari 探针主题，致敬 Omarchy 桌面的视觉风格：等宽字体、直角、单一强调色、ASCII 文字动画。非官方项目，与 Omarchy 及其作者无关。

## Features

- ASCII banner of the site name with random effects (decrypt, rain, beams, scatter, burn); click it or press `r` to replay
- Screensaver after 90 s idle, looping the same effects on black
- btop-style cards: gradient meters and braille history graphs for CPU and network
- 23 Omarchy palettes; follows light/dark by default, visitors can switch, admins set the defaults
- Vim-style keyboard navigation
- No dependencies, no build step, about 45 KB in total
- Public-safe: no processes, IPs, kernel versions or remarks are shown

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
| `Enter` | go in (expand) |
| `u` `Esc` | back: collapse, clear search, clear group |
| `/` | search by name or group |
| `H` `L` | previous / next group |
| `t` `T` | next / previous palette |
| `r` | replay banner effect |
| `s` | screensaver |
| `?` | help |

## Settings

Configurable in the admin panel: default dark and light palette, whether visitors may switch palettes, group filter, banner text, intro effect, and the screensaver.

## Palettes

`dist/palettes.js` is generated from Omarchy's `colors.toml` files by `tools/gen-palettes.py` (pass the themes directory as the first argument, default `~/.local/share/omarchy/themes`).

## License

MIT
