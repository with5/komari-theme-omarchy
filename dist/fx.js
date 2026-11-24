// ASCII banner + the 37 text effects of Omarchy's screensaver (omacom/ttfx, a port of TTE).
// Everything is drawn on one small canvas of character cells; the rAF loop
// only runs while an effect is playing.
(() => {
  "use strict";

  // ANSI Shadow style block font: each glyph is 5 rows of solid blocks. The
  // shadow (box-drawing lines on the right and bottom edges) is not stored but
  // traced by bigText, so every glyph casts the same shadow.
  const F = {
    A: [" █████ ", "██   ██", "███████", "██   ██", "██   ██"], B: ["██████ ", "██   ██", "██████ ", "██   ██", "██████ "],
    C: [" ██████", "██     ", "██     ", "██     ", " ██████"], D: ["██████ ", "██   ██", "██   ██", "██   ██", "██████ "],
    E: ["███████", "██     ", "█████  ", "██     ", "███████"], F: ["███████", "██     ", "█████  ", "██     ", "██     "],
    G: [" ██████ ", "██      ", "██   ███", "██    ██", " ██████ "], H: ["██   ██", "██   ██", "███████", "██   ██", "██   ██"],
    I: ["██", "██", "██", "██", "██"], J: ["     ██", "     ██", "     ██", "██   ██", " █████ "],
    K: ["██   ██", "██  ██ ", "█████  ", "██  ██ ", "██   ██"], L: ["██     ", "██     ", "██     ", "██     ", "███████"],
    M: ["███    ███", "████  ████", "██ ████ ██", "██  ██  ██", "██      ██"], N: ["███   ██", "████  ██", "██ ██ ██", "██  ████", "██   ███"],
    O: [" ██████ ", "██    ██", "██    ██", "██    ██", " ██████ "], P: ["██████ ", "██   ██", "██████ ", "██     ", "██     "],
    Q: [" ██████ ", "██    ██", "██    ██", "██ ██ ██", " ███████"], R: ["██████ ", "██   ██", "██████ ", "██   ██", "██   ██"],
    S: ["███████", "██     ", "███████", "     ██", "███████"], T: ["████████", "   ██   ", "   ██   ", "   ██   ", "   ██   "],
    U: ["██    ██", "██    ██", "██    ██", "██    ██", " ██████ "], V: ["██    ██", "██    ██", "██    ██", " ██  ██ ", "  ████  "],
    W: ["██     ██", "██     ██", "██  █  ██", "██ ███ ██", " ███ ███ "], X: ["██   ██", " ██ ██ ", "  ███  ", " ██ ██ ", "██   ██"],
    Y: ["██    ██", " ██  ██ ", "  ████  ", "   ██   ", "   ██   "], Z: ["███████", "   ███ ", "  ███  ", " ███   ", "███████"],
    0: [" ██████ ", "██  ████", "██ ██ ██", "████  ██", " ██████ "], 1: [" ██", "███", " ██", " ██", " ██"],
    2: ["██████ ", "     ██", " █████ ", "██     ", "███████"], 3: ["██████ ", "     ██", " █████ ", "     ██", "██████ "],
    4: ["██   ██", "██   ██", "███████", "     ██", "     ██"], 5: ["███████", "██     ", "██████ ", "     ██", "██████ "],
    6: [" ██████ ", "██      ", "███████ ", "██    ██", " ██████ "], 7: ["███████", "     ██", "    ██ ", "   ██  ", "   ██  "],
    8: [" █████ ", "██   ██", " █████ ", "██   ██", " █████ "], 9: [" █████ ", "██   ██", " ██████", "     ██", " █████ "],
    "-": ["      ", "      ", "█████ ", "      ", "      "], _: ["       ", "       ", "       ", "       ", "███████"],
    ".": ["  ", "  ", "  ", "  ", "██"], " ": ["   ", "   ", "   ", "   ", "   "],
  };
  const BOX = { 12: "║", 3: "═", 6: "╗", 5: "╔", 10: "╝", 9: "╚", 15: "╬" };

  // Traces the ANSI Shadow under rows of "█" blocks and returns one more row than it got.
  // The shadow is the block outline shifted half a cell right and down. For a
  // non-block cell, the blocks above (U), left (L) and above-left (UL) decide
  // which outline edges meet at its center: up, down, left, right.
  function shade(rows) {
    const W = Math.max(...rows.map((l) => l.length)) + 1, b = (r, c) => rows[r] !== undefined && rows[r][c] === "█";
    return [...rows, ""].map((_, r) => Array.from({ length: W }, (_, c) => {
      if (b(r, c)) return "█";
      const U = b(r - 1, c), L = b(r, c - 1), UL = b(r - 1, c - 1);
      const e = [UL !== U, L, UL !== L, U];
      return BOX[e.reduce((k, on) => k * 2 + on, 0)] || " ";
    }).join("").replace(/\s+$/, ""));
  }

  // Returns 6 strings (5 block rows + the shadow row), or null if the name has glyphs we lack.
  function bigText(str) {
    const chars = [...String(str).toUpperCase().trim()];
    if (!chars.length || !chars.every((c) => F[c])) return null;
    return shade([0, 1, 2, 3, 4].map((r) => chars.map((c) => F[c][r] + " ").join("").trimEnd()));
  }

  // Names with glyphs outside the block font (CJK, accents...) are rasterized with a
  // system font at 16px; each lit pixel becomes a "██" block and gets the same shadow.
  function rasterText(str) {
    const text = String(str).trim(), S = 16;
    if (!text) return null;
    const cv = document.createElement("canvas"), x = cv.getContext("2d", { willReadFrequently: true });
    const font = `500 ${S}px "Noto Sans CJK SC","Noto Sans SC","Source Han Sans SC","PingFang SC","Microsoft YaHei","WenQuanYi Micro Hei",sans-serif`;
    x.font = font;
    const w = Math.ceil(x.measureText(text).width) + 2, h = S + 6;
    cv.width = w; cv.height = h;
    x.font = font; x.textBaseline = "alphabetic"; x.fillStyle = "#000";
    x.fillText(text, 1, S);
    const d = x.getImageData(0, 0, w, h).data;
    const lit = (c, r) => d[(r * w + c) * 4 + 3] > 128;
    const any = (r) => { for (let c = 0; c < w; c++) if (lit(c, r)) return true; return false; };
    let r0 = 0, r1 = h - 1;
    while (r0 < h && !any(r0)) r0++;
    while (r1 > r0 && !any(r1)) r1--;
    if (r0 >= h) return null;
    const rows = [];
    for (let r = r0; r <= r1; r++) {
      let line = "";
      for (let c = 0; c < w; c++) line += lit(c, r) ? "██" : "  ";
      rows.push(line.trimEnd());
    }
    const left = Math.min(...rows.filter(Boolean).map((l) => l.search(/\S/)));
    return shade(rows.map((l) => l.slice(left)));
  }

  const NOISE = ["▀", "▄", "█", "░", "▒", "▓"], SMOKE = ["░", "▒", "▓"], DROPS = ["o", ".", "'", "|", ","];
  const MX = [..."0123456789ABCDEF:.=*+-<>|"], WV = [..."▁▂▃▄▅▆▇█"], SPARK = ["*", "'", ".", "`"];
  const HUES = ["red", "orange", "yellow", "green", "cyan", "blue", "magenta"];
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const rnd = () => pick(NOISE);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = (p) => 1 - Math.pow(1 - p, 3);
  const inOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(2 - 2 * p, 3) / 2);
  const bounce = (p) => {
    const n = 7.5625, d = 2.75;
    return p < 1 / d ? n * p * p : p < 2 / d ? n * (p -= 1.5 / d) * p + 0.75 : p < 2.5 / d ? n * (p -= 2.25 / d) * p + 0.9375 : n * (p -= 2.625 / d) * p + 0.984375;
  };
  const hash = (a, b) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };
  const hue = (v) => HUES[((Math.floor(v) % 7) + 7) % 7];
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const at = (c, ch, tok, a = 1) => [ch, c.x, c.y, tok, a];
  // the cell flies home from (sx, sy) during [t0, t0 + d]; hidden before t0 unless hide is false
  const fly = (c, t, t0, d, sx, sy, tok, hide = true, e = ease) => {
    const p = (t - t0) / d;
    if (p < 0 && hide) return null;
    if (p >= 1) return at(c, c.ch, "main");
    const q = e(clamp(p, 0, 1));
    return [c.ch, lerp(sx, c.x, q), lerp(sy, c.y, q), p < 1 ? tok : "main", 1];
  };
  // appears at t0 with a tok flash
  const land = (c, t, t0, tok = "bright", d = 0.2) => (t < t0 ? null : at(c, c.ch, t < t0 + d ? tok : "main"));
  // a point on the canvas border, s in [0, 1) going clockwise from the top-left
  const perim = (S, s) => {
    const w = S.W - 1, h = S.H - 1;
    let d = (s - Math.floor(s)) * 2 * (w + h);
    if (d < w) return [d, 0];
    if ((d -= w) < h) return [w, d];
    if ((d -= h) < w) return [w - d, h];
    return [0, h - (d - w)];
  };
  // groups cells into vertical bands of `size` columns: c.g is the band, c.gk the index in it
  const bands = (S, cells, size, mk) => {
    S.G = [];
    for (const c of cells) {
      const g = (c.x / size) | 0, G = S.G[g] || (S.G[g] = { x: 0, y: 0, n: 0, ...mk(g) });
      c.g = g; c.gk = G.n++; G.x += c.x; G.y += c.y;
    }
    for (const G of S.G) if (G) { G.x /= G.n; G.y /= G.n; }
  };

  // Effects after omacom/ttfx (TerminalTextEffects). Each maps (cell, t) to
  // [char, x, y, colorToken, alpha] or null (hidden). Optional init(S, cells)
  // runs once per play; optional pre(t, S, emit) draws extra glyphs behind the cells.
  // Cells carry per-play randoms: r, r2, ox/oy (offsets), nx/ny (0..1 position),
  // a/dist/d (angle, distance and 0..1 distance from the center), i (index).
  const EFFECTS = {
    // row beams sweep in and light the text, then a diagonal brightens it
    beams: { dur: 2.6,
      pre: (t, S, emit) => {
        for (let y = 0; y < S.H; y++) {
          const x = Math.floor((t - (y / S.H) * 0.6 - S.rowR[y] * 0.25) * S.W);
          if (x >= 0 && x < S.W + 3) for (let k = 0; k < 3; k++) emit(k ? "─" : "━", x - k, y, "cyan", 1 - k * 0.3);
        }
      },
      f: (c, t, S) => {
        const dt = t - (c.ny * 0.6 + S.rowR[c.y] * 0.25 + c.nx);
        if (dt < 0) return null;
        return at(c, c.ch, Math.abs(t - 1.7 - (c.nx + c.ny) * 0.3) < 0.05 ? "bright" : dt < 0.3 ? "cyan" : "main");
      } },
    // bits travel an orthogonal path home, then become the character
    binarypath: { dur: 2.6, f: (c, t) => {
      const t0 = c.r * 0.9, p = (t - t0) / 1.1;
      if (p < 0) return null;
      if (p >= 1) return land(c, t, t0 + 1.1);
      const q = ease(p), sx = c.x + c.ox, sy = c.y + c.oy;
      return [hash(c.i, (t * 10) | 0) < 0.5 ? "0" : "1", Math.round(q < 0.5 ? lerp(sx, c.x, q * 2) : c.x), Math.round(q < 0.5 ? sy : lerp(sy, c.y, q * 2 - 1)), "green", 0.9];
    } },
    // the text spirals into a ring at the center, then bursts back out
    blackhole: { dur: 3.2,
      pre: (t, S, emit) => {
        const r = Math.min(1, (t - 0.2) * 3, (1.6 - t) * 4);
        if (r > 0) for (let k = 0; k < 16; k++) { const a = (k / 16) * 6.283 + t * 3; emit(k % 2 ? "·" : "*", S.cx + Math.cos(a) * r * 3, S.cy + Math.sin(a) * r * 1.5, "magenta", 1); }
      },
      f: (c, t, S) => {
        const s0 = 0.3 + c.r * 0.8;
        if (t < s0) return at(c, c.ch, "dim", 0.6);
        if (t < s0 + 0.5) { const q = ((t - s0) / 0.5) ** 2, a = c.a + q * 4, r = (1 - q) * c.dist; return [c.ch, S.cx + Math.cos(a) * r, S.cy + (Math.sin(a) * r) / 2, "magenta", 1]; }
        if (t < 1.7) return null;
        const p = clamp((t - 1.7 - c.r2 * 0.3) / 0.9, 0, 1), e = ease(p), o = Math.sin(p * Math.PI) * 0.6;
        if (p >= 1) return at(c, c.ch, "main");
        return [c.ch, lerp(S.cx, c.x, e) + (c.x - S.cx) * o, lerp(S.cy, c.y, e) + (c.y - S.cy) * o, p < 1 ? hue(c.i) : "main", 1];
      } },
    // balls drop from the top and bounce into place
    bouncyballs: { dur: 2.6, f: (c, t) => {
      const p = (t - c.r * 1.3) / 1.0;
      if (p < 0) return null;
      if (p >= 1) return at(c, c.ch, "main");
      return [p < 0.85 ? "●" : c.ch, c.x, lerp(-1 - c.r2 * 3, c.y, bounce(p)), hue(c.i), 1];
    } },
    // bubbles of characters float down and pop
    bubbles: { dur: 3.0,
      init: (S, cells) => bands(S, cells, 10, () => ({ t: Math.random() * 1.1 })),
      f: (c, t, S) => {
        const G = S.G[c.g], tp = G.t + 1.1;
        if (t < G.t) return null;
        const pos = (u) => { const a = (c.gk / G.n) * 6.283 + u * 1.5, by = lerp(-2, G.y, ease(clamp((u - G.t) / 1.1, 0, 1))); return [G.x + Math.cos(a) * 3, by + Math.sin(a) * 1.5]; };
        if (t < tp) return [c.ch, ...pos(t), c.gk % 2 ? "cyan" : "blue", 0.9];
        return fly(c, t, tp, 0.5, ...pos(tp), "bright");
      } },
    // reveals bottom-up through yellow, orange and red
    burn: { dur: 2.0, f: (c, t, S) => {
      const dt = t - ((1 - c.ny - 1 / S.th) * 0.9 + c.r * 0.4);
      if (dt < 0) return null;
      if (dt < 0.5) return at(c, SMOKE[2 - (((dt * 6) | 0) % 3)], dt < 0.17 ? "yellow" : dt < 0.34 ? "orange" : "red");
      return at(c, c.ch, "main");
    } },
    // a rainbow gradient flows across the text
    colorshift: { dur: 3.0, f: (c, t) => (t > 2.5 ? at(c, c.ch, "main") : at(c, c.ch, hue(c.x * 0.15 + c.y * 0.4 - t * 5), Math.min(1, t * 3))) },
    // characters crumble to dust at the bottom and are pulled back up
    crumble: { dur: 3.0, f: (c, t, S) => {
      const f0 = 0.2 + c.r * 0.8, fy = S.H - 1;
      if (t < f0) return at(c, c.ch, "dim", 0.7);
      if (t < f0 + 0.4) { const p = (t - f0) / 0.4; return [p < 0.5 ? "▒" : "░", c.x, lerp(c.y, fy, p * p), "dim", 1 - p * 0.4]; }
      const r0 = 1.6 + c.r2 * 0.6;
      return t < r0 ? [".", c.x, fy, "dim", 0.6] : fly(c, t, r0, 0.6, c.x, fy, "bright");
    } },
    // glyph soup that resolves cell by cell, with a bright flash on arrival
    decrypt: { dur: 2.1, f: (c, t) => {
      const t0 = 0.15 + c.r * 1.2 + c.nx * 0.4;
      return t < t0 ? at(c, rnd(), "dim") : at(c, c.ch, t < t0 + 0.2 ? "bright" : "main");
    } },
    // swapped pairs are highlighted, then swap back into place one by one
    errorcorrect: { dur: 2.8,
      init: (S, cells) => {
        const ix = shuffle(cells.map((_, i) => i)), m = Math.min(14, (cells.length * 0.06) | 0);
        for (const c of cells) c.ts = -1;
        for (let j = 0; j < m; j++) {
          const a = cells[ix[2 * j]], b = cells[ix[2 * j + 1]];
          a.sx = b.x; a.sy = b.y; b.sx = a.x; b.sy = a.y; a.ts = b.ts = 0.5 + (j / m) * 1.6;
        }
      },
      f: (c, t) => (c.ts < 0 ? at(c, c.ch, "main", Math.min(1, t * 3)) : t < c.ts ? [c.ch, c.sx, c.sy, "red", 1] : fly(c, t, c.ts, 0.45, c.sx, c.sy, "green")) },
    // everything unfolds from the center point
    expand: { dur: 1.8, f: (c, t, S) => fly(c, t, 0.1, 1.3, S.cx, S.cy, "blue", false, inOut) },
    // shells launch from below, burst, and the sparks fall into place
    fireworks: { dur: 3.2,
      init: (S, cells) => bands(S, cells, 12, (g) => ({ t: clamp((g * 12 - S.tx) / S.tw, 0, 1) + Math.random() * 0.3, h: hue(g * 2) })),
      f: (c, t, S) => {
        const G = S.G[c.g], t1 = G.t + 0.5, t2 = t1 + 0.4, ay = S.cy - 1;
        if (t < G.t) return null;
        if (t < t1) return ["|", G.x, lerp(S.H + 1, ay, ease((t - G.t) / 0.5)), "bright", 1];
        const bx = G.x + c.ox * 0.25, by = ay + c.oy * 0.25;
        if (t < t2) { const e = ease((t - t1) / 0.4); return [c.ch, lerp(G.x, bx, e), lerp(ay, by, e), G.h, 1]; }
        return fly(c, t, t2, 0.7, bx, by, G.h, true, (p) => p * p);
      } },
    // a specular bar sweeps diagonally across the text
    highlight: { dur: 2.0, f: (c, t) => {
      const g = Math.abs((c.nx * 2 + c.ny) / 3 - ((t - 0.3) / 1.4) * 1.4 + 0.2);
      return at(c, c.ch, t < 1.8 && g < 0.05 ? "bright" : "main", Math.min(1, 0.4 + t * 2));
    } },
    // a laser from the corner etches the text, throwing sparks
    laseretch: { dur: 2.8,
      init: (S, cells) => { S.ord = [...cells].sort((a, b) => a.x + a.y * 2 - b.x - b.y * 2); S.ord.forEach((c, i) => (c.te = 0.1 + (i / S.ord.length) * 1.9)); },
      pre: (t, S, emit) => {
        const c = S.ord[Math.floor(((t - 0.1) / 1.9) * S.ord.length)];
        if (!c) return;
        const ex = S.W + 1, ey = -1, n = Math.ceil(Math.hypot(ex - c.x, (ey - c.y) * 2));
        for (let k = 1; k < n; k++) emit("·", lerp(c.x, ex, k / n), lerp(c.y, ey, k / n), "red", 0.6);
        for (let k = 0; k < 3; k++) emit(pick(SPARK), c.x + (Math.random() - 0.5) * 3, c.y + Math.random() * 1.5, "yellow", 0.9);
      },
      f: (c, t) => (t < c.te ? null : at(c, c.ch, t < c.te + 0.1 ? "bright" : t < c.te + 0.35 ? "orange" : "main")) },
    // digital rain, then the text resolves out of it
    matrix: { dur: 3.0,
      pre: (t, S, emit) => {
        const a = Math.min(1, (2.2 - t) * 2);
        const L = clamp(S.H / 4, 5, 12) | 0;
        if (a > 0) for (let x = 0; x < S.W; x += 2) {
          const hy = Math.floor(((t * (0.6 + S.colR[x] * 0.8) * (S.H + 6) + S.colR[x] * 20) % (S.H + 6)) - 3);
          for (let k = 0; k < L; k++) emit(MX[(hash(x, hy - k + ((t * 8) | 0)) * MX.length) | 0], x, hy - k, k ? "green" : "bright", a * (1 - k / L));
        }
      },
      f: (c, t) => {
        const r = 1.0 + c.r * 1.2;
        if (t < r) return null;
        return t < r + 0.25 ? at(c, MX[(hash(c.i, (t * 20) | 0) * MX.length) | 0], "green") : at(c, c.ch, t < r + 0.4 ? "bright" : "main");
      } },
    // a point opens into the middle row, then into the full text
    middleout: { dur: 2.0, f: (c, t, S) => {
      const p1 = inOut(clamp(t / 0.8, 0, 1)), p2 = inOut(clamp((t - 0.9) / 0.8, 0, 1));
      return [c.ch, lerp(S.cx, c.x, p1), lerp(S.cy, c.y, p2), p2 < 1 ? (p1 < 1 ? "dim" : "cyan") : "main", 1];
    } },
    // four launchers orbit the border and volley characters home
    orbittingvolley: { dur: 3.0,
      pre: (t, S, emit) => { for (let k = 0; k < 4; k++) emit("◆", ...perim(S, k / 4 + t * 0.12), hue(k * 2), 1); },
      f: (c, t, S) => { const tl = 0.3 + c.d * 1.5 + c.r * 0.15, k = c.i % 4; return t < tl ? null : fly(c, t, tl, 0.5, ...perim(S, k / 4 + tl * 0.12), hue(k * 2)); } },
    // shuffled colored rows overflow upward, then the real rows scroll in
    overflow: { dur: 2.4,
      init: (S) => { S.rowP = shuffle([...Array(S.th).keys()]); },
      f: (c, t, S) => {
        const k = S.rowP[c.y - S.ty];
        if (t < 1.4) { const m = S.th + 2, v = k + S.th - t * 14; return [c.ch, c.x, S.ty + Math.floor(((v % m) + m) % m), hue(k - Math.floor(v / m)), 1]; }
        const p = clamp((t - 1.4) / 0.7, 0, 1);
        return [c.ch, c.x, c.y + S.th * (1 - ease(p)), p < 1 ? "bright" : "main", 1];
      } },
    // characters pour down and stack row by row from the bottom
    pour: { dur: 2.4, f: (c, t, S) => {
      const row = S.th - 1 - (c.y - S.ty), t0 = (row / S.th) * 1.2 + (row % 2 ? 1 - c.nx : c.nx) * 0.5, p = (t - t0) / 0.4;
      if (p < 0) return null;
      return p < 1 ? [c.ch, c.x, lerp(-1, c.y, p * p), "dim", 1] : at(c, c.ch, t < t0 + 0.55 ? "bright" : "main");
    } },
    // a print head types each row, with a carriage return
    print: { dur: 2.6,
      init: (S) => { S.rt = 2.2 / S.th; S.ct = (S.rt * 0.85) / S.tw; },
      pre: (t, S, emit) => { const r = Math.floor(t / S.rt); if (r < S.th) emit("█", S.tx + Math.min(S.tw, Math.floor((t - r * S.rt) / S.ct)), S.ty + r, "cyan", 0.8); },
      f: (c, t, S) => land(c, t, (c.y - S.ty) * S.rt + (c.x - S.tx) * S.ct, "bright", 0.12) },
    // raindrops fall down each column and leave the text behind
    rain: { dur: 2.4, f: (c, t, S) => {
      const dt = t - (S.colR[c.x] + c.ny * 0.4);
      if (dt < -0.3) return null;
      if (dt < 0) return [pick(DROPS), c.x, lerp(-1, c.y, (dt + 0.3) / 0.3), "blue", 1];
      return at(c, c.ch, dt < 0.5 ? "cyan" : "main");
    } },
    // characters fade in one at a time in random order
    randomsequence: { dur: 2.0, f: (c, t) => { const p = (t - c.r * 1.5) / 0.25; return p < 0 ? null : at(c, c.ch, p < 1 ? "dim" : "main", Math.min(1, p)); } },
    // the text spins into counter-rotating rings, then settles
    rings: { dur: 3.0, f: (c, t, S) => {
      const ring = (c.r2 * 3) | 0, rr = (ring + 1) / 3, tr = 1.6 + c.r * 0.4;
      const pos = (u) => { const a = c.r * 6.283 + u * (ring % 2 ? -1.6 : 1.6); return [S.cx + Math.cos(a) * rr * Math.min(S.W * 0.4, S.tw * 0.6), S.cy + Math.sin(a) * rr * Math.min(S.H * 0.5, S.th * 1.5)]; };
      if (t < 0.5) { const e = ease(t / 0.5), [px, py] = pos(t); return [c.ch, lerp(c.x, px, e), lerp(c.y, py, e), "dim", 1]; }
      return t < tr ? [c.ch, ...pos(t), hue(ring * 2 + 1), 1] : fly(c, t, tr, 0.8, ...pos(tr), "bright");
    } },
    // cells fly in from random places and settle
    scattered: { dur: 1.7, f: (c, t) => {
      const p = clamp((t - c.r * 0.3) / 1.2, 0, 1), e = ease(p);
      return [c.ch, c.x + c.ox * (1 - e), c.y + c.oy * (1 - e), p < 1 ? "blue" : "main", p];
    } },
    // the text is cut in half and the halves slide in from opposite sides
    slice: { dur: 1.8, f: (c, t, S) => { const top = c.y - S.ty < S.th / 2; return fly(c, t, top ? 0.1 : 0.25, 1.2, c.x + (top ? -S.W : S.W), c.y, "cyan", false, inOut); } },
    // rows slide in from the left, one after another
    slide: { dur: 2.2, f: (c, t, S) => fly(c, t, c.ny * 0.6, 1.0, c.x * 0.25 - S.W * 0.6, c.y, c.y % 2 ? "blue" : "cyan") },
    // smoke spreads from a point and colors the text as it passes
    smoke: { dur: 2.6,
      init: (S, cells) => { S.sx = S.tx + Math.random() * S.tw; S.sy = S.ty + Math.random() * S.th; S.dm = 1 + Math.max(...cells.map((c) => Math.hypot((c.x - S.sx) / 2, c.y - S.sy))); },
      f: (c, t, S) => {
        const ta = 0.2 + (Math.hypot((c.x - S.sx) / 2, c.y - S.sy) / S.dm) * 1.4 + c.r * 0.3;
        return t < ta ? at(c, c.ch, "dim", 0.25) : t < ta + 0.3 ? at(c, pick(SMOKE), "dim", 0.8) : at(c, c.ch, t < ta + 0.45 ? "bright" : "main");
      } },
    // spotlights search the dark text, then gather in the middle and open up
    spotlights: { dur: 3.0,
      init: (S) => { S.sp = [0, 1, 2].map(() => [Math.random() * 6.283, 0.6 + Math.random() * 0.8, Math.random() * 6.283]); },
      pre: (t, S) => {
        const m = clamp((t - 1.7) / 0.6, 0, 1);
        S.L = S.sp.map(([a, w, b]) => [lerp(S.cx + Math.cos(a + t * w * 2) * S.tw * 0.4, S.cx, m), lerp(S.cy + Math.sin(b + t * w * 2.6) * S.th * 0.5, S.cy, m)]);
        S.R = lerp(Math.max(4, S.tw * 0.12), S.tw * 0.75, clamp((t - 2.2) / 0.6, 0, 1));
      },
      f: (c, t, S) => {
        let l = 0;
        for (const [x, y] of S.L) l = Math.max(l, 1 - Math.hypot(c.x - x, (c.y - y) * 2) / S.R);
        return at(c, c.ch, l > 0.5 && t < 2.5 ? "bright" : "main", Math.max(0.15 + 0.85 * clamp(l, 0, 1), clamp((t - 2.4) / 0.4, 0, 1)));
      } },
    // characters spray out of one point at different speeds
    spray: { dur: 2.4,
      init: (S) => { [S.sx, S.sy] = pick([[0, S.cy], [S.W - 1, S.cy], [S.cx, S.H - 1], [S.cx, S.cy]]); },
      f: (c, t, S) => fly(c, t, c.r * 0.9, 0.5 + c.r2 * 0.7, S.sx, S.sy, hue(c.i)) },
    // swarms wander along curved paths and land one swarm at a time
    swarm: { dur: 3.2,
      init: (S, cells) => {
        const n = Math.max(1, Math.min(5, Math.ceil(cells.length / 40))), p = () => [Math.random() * S.W, Math.random() * S.H];
        S.sw = Array.from({ length: n }, (_, g) => ({ p: [[Math.random() < 0.5 ? -4 : S.W + 3, Math.random() * S.H], p(), p()], t: 1.0 + (g / n) * 1.2, h: hue(g * 2 + 1) }));
        for (const c of cells) c.g = c.i % n;
      },
      f: (c, t, S) => {
        const G = S.sw[c.g], [a, b, d] = G.p;
        const pos = (u0) => {
          const u = clamp(u0 / G.t, 0, 1), q = (k) => (1 - u) * (1 - u) * a[k] + 2 * (1 - u) * u * b[k] + u * u * d[k];
          return [q(0) + c.ox * 0.08 + Math.sin(u0 * 4 + c.r * 6.283) * 1.5, q(1) + c.oy * 0.06 + Math.cos(u0 * 3.3 + c.r2 * 6.283) * 0.6];
        };
        return t < G.t ? [c.ch, ...pos(t), G.h, 1] : fly(c, t, G.t, 0.8, ...pos(G.t), G.h);
      } },
    // one sweep reveals the text dim, a second sweep back colors it
    sweep: { dur: 2.4, f: (c, t) => {
      const s1 = 0.1 + c.nx * 0.9 + c.r * 0.08, s2 = 1.2 + (1 - c.nx) * 0.9;
      if (t < s1) return null;
      return t < s1 + 0.1 ? at(c, rnd(), "dim") : at(c, c.ch, t < s2 ? "dim" : t < s2 + 0.12 ? "bright" : "main");
    } },
    // a synthwave grid opens, the text dissolves in, the grid folds away
    synthgrid: { dur: 2.8,
      pre: (t, S, emit) => {
        const g = Math.min(clamp(t / 0.6, 0, 1), clamp((2.6 - t) / 0.5, 0, 1)), ex = (g * S.W) / 2 + 0.5, ey = (g * S.H) / 2 + 0.5, gx = (S.W - 1) / 2, gy = (S.H - 1) / 2;
        if (g > 0) for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) {
          const v = x % 8 === 0, h = y % 6 === 0 || y === S.H - 1;
          if ((v || h) && !S.occ.has(y * S.W + x) && Math.abs(x - gx) <= ex && Math.abs(y - gy) <= ey) emit(v && h ? "┼" : v ? "│" : "─", x, y, x % 16 ? "blue" : "magenta", 0.7);
        }
      },
      f: (c, t) => { const d0 = 0.6 + c.r; return t < d0 ? null : t < d0 + 0.3 ? at(c, rnd(), "cyan") : at(c, c.ch, t < d0 + 0.45 ? "bright" : "main"); } },
    // rain and lightning; each strike lights up the text
    thunderstorm: { dur: 3.0,
      init: (S) => {
        S.bolts = [0.6, 1.3, 1.9].map((t0) => {
          let x = Math.random() * S.W;
          return { t0, p: Array.from({ length: S.H }, () => { const d = ((Math.random() * 3) | 0) - 1, p = [x, d]; x += d * 1.5; return p; }) };
        });
      },
      pre: (t, S, emit) => {
        S.fl = 0;
        if (t < 2.4) for (let k = 0, n = clamp((S.W * S.H) / 6, 30, 400); k < n; k++) {
          const y = ((hash(k, 2) * (S.H + 2) + t * 12) % (S.H + 2)) - 1;
          emit("/", hash(k, 1) * (S.W + S.H) - y * 0.5, y, "blue", 0.5);
        }
        for (const b of S.bolts) {
          if (t >= b.t0) S.fl = Math.max(S.fl, Math.exp(-(t - b.t0) * 5));
          if (t >= b.t0 && t < b.t0 + 0.18) b.p.forEach(([x, d], y) => emit(d < 0 ? "/" : d > 0 ? "\\" : "|", x, y, "bright", 1));
        }
      },
      f: (c, t, S) => (t >= 2.4 ? at(c, c.ch, t < 2.55 ? "bright" : "main", clamp((t - 2.4) * 4 + 0.3, 0, 1)) : at(c, c.ch, S.fl > 0.6 ? "bright" : "main", 0.3 + 0.7 * S.fl)) },
    // characters shake, blow out to the edges, then reassemble
    unstable: { dur: 2.8, f: (c, t, S) => {
      if (t < 0.9) { const j = t / 0.9; return [c.ch, c.x + (Math.random() - 0.5) * j * 1.5, c.y + (Math.random() - 0.5) * j * 0.6, Math.random() < j * 0.4 ? pick(["red", "orange"]) : "main", 1]; }
      const ex = c.x < S.cx ? 0 : S.W - 1, ey = c.y + c.oy * 0.3;
      if (t < 1.3) { const e = ease((t - 0.9) / 0.4); return [c.ch, lerp(c.x, ex, e), lerp(c.y, ey, e), "red", 1]; }
      return fly(c, t, 1.5 + c.r * 0.3, 0.8, ex, ey, "orange", false);
    } },
    // tracking glitches and snow, then the rows are redrawn clean
    vhstape: { dur: 2.8,
      pre: (t, S, emit) => {
        const n = (S.W * S.H * 0.04 * (1 - clamp((t - 1.4) / 0.8, 0, 1))) | 0;
        for (let k = 0; k < n; k++) emit(pick(["░", "▒", "·", "."]), (Math.random() * S.W) | 0, (Math.random() * S.H) | 0, "dim", 0.7);
      },
      f: (c, t, S) => {
        const fr = (t * 14) | 0, rs = 1.5 + c.ny * 0.9;
        if (t >= rs) return at(c, c.ch, t < rs + 0.12 ? "bright" : "main");
        const off = hash(c.y, fr) > 0.7 ? Math.round((hash(fr, c.y) - 0.5) * S.tw * 0.25) : 0;
        return [hash(c.i, fr) < 0.06 ? rnd() : c.ch, c.x + off, c.y, off > 0 ? "red" : off < 0 ? "blue" : "main", 0.85];
      } },
    // a band of sine waves crosses the canvas and leaves the text behind
    waves: { dur: 2.4,
      pre: (t, S, emit) => {
        const xf = ((t - 0.1) / 1.6) * (S.W + 14) - 2;
        for (let x = Math.max(0, Math.ceil(xf - 8)); x <= Math.min(S.W - 1, xf); x++)
          for (let y = 0; y < S.H; y++) emit(WV[(((Math.sin(x * 0.6 - t * 9 + y * 0.8) + 1) / 2) * 7.99) | 0], x, y, (x + y) % 3 ? "blue" : "cyan", 0.9);
      },
      f: (c, t, S) => { const d = ((t - 0.1) / 1.6) * (S.W + 14) - 10 - c.x; return d < 0 ? null : at(c, c.ch, d < 4 ? "cyan" : "main"); } },
    // a diagonal wipe reveals the text
    wipe: { dur: 1.8, f: (c, t) => { const t0 = 0.1 + (c.nx + c.ny) * 0.65; return t < t0 ? null : at(c, t < t0 + 0.08 ? "█" : c.ch, t < t0 + 0.2 ? "bright" : "main"); } },
  };
  const ALIAS = { scatter: "scattered" };
  const NAMES = Object.keys(EFFECTS);
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Draws the text on a canvas of character cells. Options:
  //   full: the canvas itself covers the viewport and the text is centered (screensaver);
  //   stage: a fixed full-viewport canvas the effects play on, with the text over the
  //          banner canvas. When the effect ends the stage keeps the static text (so the
  //          last frame never shifts by a pixel) and hands it back to the banner canvas
  //          on the next scroll or resize, when the page is moving anyway.
  // Effects get the whole field (S.W x S.H cells) and the text box inside it
  // (S.tx, S.ty, S.tw, S.th); cell timings use the text box, so the pace stays the same.
  class Banner {
    constructor(canvas, getColor, opts = {}) {
      this.cv = canvas;
      this.ctx = canvas.getContext("2d");
      this.gc = getColor;
      this.full = !!opts.full;
      this.stage = opts.stage || null;
      this.lines = [];
      this.cells = [];
      this.raf = 0;
      this.onDone = null;
      this._tick = this._tick.bind(this);
      this._release = this._release.bind(this);
    }

    set(lines, availW, maxFs, maxH = Infinity) {
      this.stop();
      this.lines = lines;
      this.W = Math.max(1, ...lines.map((l) => [...l].length));
      this.H = lines.length;
      this.cells = [];
      lines.forEach((l, y) => [...l].forEach((ch, x) => ch !== " " && this.cells.push({ ch, x0: x, y0: y, x, y })));
      let fs = maxFs;
      for (; fs > 6; fs--) { this._font(fs); if (this.W * this.cw <= availW && this.H * this.lh <= maxH) break; }
      this._fit(this.cv, this.ctx, Math.ceil(this.W * this.cw), Math.ceil(this.H * this.lh));
      this.drawStatic();
    }

    _font(fs) {
      this.fs = fs;
      this.font = `700 ${fs}px "JetBrainsMono Nerd Font","JetBrains Mono",ui-monospace,"Liberation Mono",monospace`;
      this.ctx.font = this.font;
      const m = this.ctx.measureText("█");
      this.cw = m.width;
      this.asc = m.fontBoundingBoxAscent || fs * 0.9;
      this.lh = m.fontBoundingBoxAscent ? m.fontBoundingBoxAscent + m.fontBoundingBoxDescent : fs * 1.3;
    }

    // sizes the bitmap in whole device pixels and the element to match exactly, so nothing is resampled
    _fit(cv, ctx, w, h) {
      const dpr = (this.dpr = window.devicePixelRatio || 1);
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      cv.style.width = cv.width / dpr + "px";
      cv.style.height = cv.height / dpr + "px";
      ctx.font = this.font;
      ctx.textBaseline = "alphabetic";
    }

    // Where the next frames go: the banner canvas itself, or the whole viewport with
    // the text box at cell (ox, oy) and the cell grid shifted by (px, py) pixels.
    _field(stage) {
      const own = { cv: this.cv, ctx: this.ctx, W: this.W, H: this.H, ox: 0, oy: 0, px: 0, py: 0 };
      if (!this.full && !stage) return own;
      const vw = window.innerWidth, vh = window.innerHeight, cw = this.cw, lh = this.lh;
      let x = (vw - this.W * cw) / 2, y = (vh - this.H * lh) / 2;
      // the browser paints the banner canvas on whole device pixels, so the stage text must land there too
      if (stage) { const r = this.cv.getBoundingClientRect(), d = window.devicePixelRatio || 1; x = Math.round(r.left * d) / d; y = Math.round(r.top * d) / d; }
      if (!(x >= 0 && y >= 0)) { if (this.full) this._fit(this.cv, this.ctx, Math.ceil(this.W * cw), Math.ceil(this.H * lh)); return own; }
      const cv = stage || this.cv, ctx = stage ? stage.getContext("2d") : this.ctx, ox = Math.floor(x / cw), oy = Math.floor(y / lh);
      this._fit(cv, ctx, vw, vh);
      return { cv, ctx, W: Math.max(ox + this.W, Math.ceil(vw / cw) + 1), H: Math.max(oy + this.H, Math.ceil(vh / lh) + 1), ox, oy, px: x - ox * cw, py: y - oy * lh };
    }

    _draw(t) {
      const F = this.F, x = F.ctx, d = this.dpr;
      x.setTransform(d, 0, 0, d, 0, 0);
      x.clearRect(0, 0, F.cv.width, F.cv.height);
      x.setTransform(d, 0, 0, d, F.px * d, F.py * d);
      const S = this.S, put = (r) => {
        x.globalAlpha = r[4];
        x.fillStyle = this.gc(r[3]);
        x.fillText(r[0], r[1] * this.cw, r[2] * this.lh + this.asc);
      };
      if (t !== Infinity && this.eff.pre) this.eff.pre(t, S, (...r) => put(r));
      for (const c of this.cells) {
        const r = t === Infinity ? [c.ch, c.x0 + F.ox, c.y0 + F.oy, "main", 1] : this.eff.f(c, t, S);
        if (r) put(r);
      }
      x.globalAlpha = 1;
    }

    drawStatic() {
      if (!this.holding && (!this.raf || !this.F)) this.F = this._field();
      this._draw(Infinity);
    }

    play(name) {
      this.stop();
      if (reduced() || !this.cells.length) { this.drawStatic(); this.onDone && this.onDone(); return; }
      this.eff = EFFECTS[ALIAS[name] || name] || EFFECTS[pick(NAMES)];
      const F = (this.F = this._field(this.stage)), { W, H, ox, oy } = F, tw = this.W, th = this.H, cells = this.cells;
      if (F.cv === this.stage) { this.ctx.clearRect(0, 0, this.cv.width, this.cv.height); this.stage.style.display = "block"; }
      const cx = ox + (tw - 1) / 2, cy = oy + (th - 1) / 2, R = Math.hypot(tw / 2, th) || 1;
      for (const c of cells) { c.x = c.x0 + ox; c.y = c.y0 + oy; }
      const S = (this.S = { W, H, cx, cy, tx: ox, ty: oy, tw, th, colR: Array.from({ length: W }, Math.random), rowR: Array.from({ length: H }, Math.random), occ: new Set(cells.map((c) => c.y * W + c.x)) });
      cells.forEach((c, i) => {
        const dx = c.x - cx, dy = (c.y - cy) * 2;
        Object.assign(c, { i, r: Math.random(), r2: Math.random(), ox: (Math.random() - 0.5) * W * 1.2, oy: (Math.random() - 0.5) * Math.max(14, H * 0.8),
          nx: c.x0 / tw, ny: c.y0 / th, a: Math.atan2(dy, dx), dist: Math.hypot(dx, dy), d: Math.hypot(dx, dy) / R });
      });
      if (this.eff.init) this.eff.init(S, cells);
      this.t0 = 0;
      this.raf = requestAnimationFrame(this._tick);
    }

    _tick(now) {
      if (!this.t0) this.t0 = now;
      const t = (now - this.t0) / 1000;
      if (t < this.eff.dur) { this._draw(t); this.raf = requestAnimationFrame(this._tick); return; }
      this.raf = 0;
      if (this.F.cv === this.stage) {
        this.holding = true;
        window.addEventListener("scroll", this._release, { passive: true, capture: true });
        window.addEventListener("resize", this._release);
      }
      this.drawStatic();
      this.onDone && this.onDone();
    }

    // moves the static text from the stage back to the banner canvas
    _release() {
      if (!this.stage || !this.F || this.F.cv !== this.stage) return;
      window.removeEventListener("scroll", this._release, { capture: true });
      window.removeEventListener("resize", this._release);
      this.holding = false;
      this.stage.style.display = "none";
      this.stage.width = this.stage.height = 0;
      this.F = null;
      this.drawStatic();
    }

    stop() {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
      this._release();
    }
  }

  window.OFX = { bigText, rasterText, Banner, EFFECTS: NAMES };
})();
