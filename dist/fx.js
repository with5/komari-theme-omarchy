// ASCII banner + text effects, in the spirit of Omarchy's screensaver (TTE).
// Everything is drawn on one small canvas of character cells; the rAF loop
// only runs while an effect is playing.
(() => {
  "use strict";

  // 5x7 pixel font. '#' = lit. Two pixel rows are packed into one text row
  // with half blocks, so a name is 4 text rows tall.
  const G = {
    A: [" ### ", "#   #", "#   #", "#####", "#   #", "#   #", "#   #"], B: ["#### ", "#   #", "#   #", "#### ", "#   #", "#   #", "#### "],
    C: [" ####", "#    ", "#    ", "#    ", "#    ", "#    ", " ####"], D: ["#### ", "#   #", "#   #", "#   #", "#   #", "#   #", "#### "],
    E: ["#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#####"], F: ["#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#    "],
    G: [" ####", "#    ", "#    ", "#  ##", "#   #", "#   #", " ### "], H: ["#   #", "#   #", "#   #", "#####", "#   #", "#   #", "#   #"],
    I: ["#####", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "#####"], J: ["  ###", "   # ", "   # ", "   # ", "   # ", "#  # ", " ##  "],
    K: ["#   #", "#  # ", "# #  ", "##   ", "# #  ", "#  # ", "#   #"], L: ["#    ", "#    ", "#    ", "#    ", "#    ", "#    ", "#####"],
    M: ["#   #", "## ##", "# # #", "# # #", "#   #", "#   #", "#   #"], N: ["#   #", "##  #", "##  #", "# # #", "#  ##", "#  ##", "#   #"],
    O: [" ### ", "#   #", "#   #", "#   #", "#   #", "#   #", " ### "], P: ["#### ", "#   #", "#   #", "#### ", "#    ", "#    ", "#    "],
    Q: [" ### ", "#   #", "#   #", "#   #", "# # #", "#  # ", " ## #"], R: ["#### ", "#   #", "#   #", "#### ", "# #  ", "#  # ", "#   #"],
    S: [" ####", "#    ", "#    ", " ### ", "    #", "    #", "#### "], T: ["#####", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  "],
    U: ["#   #", "#   #", "#   #", "#   #", "#   #", "#   #", " ### "], V: ["#   #", "#   #", "#   #", "#   #", " # # ", " # # ", "  #  "],
    W: ["#   #", "#   #", "#   #", "# # #", "# # #", "## ##", "#   #"], X: ["#   #", "#   #", " # # ", "  #  ", " # # ", "#   #", "#   #"],
    Y: ["#   #", "#   #", " # # ", "  #  ", "  #  ", "  #  ", "  #  "], Z: ["#####", "    #", "   # ", "  #  ", " #   ", "#    ", "#####"],
    0: [" ### ", "#   #", "#  ##", "# # #", "##  #", "#   #", " ### "], 1: ["  #  ", " ##  ", "  #  ", "  #  ", "  #  ", "  #  ", "#####"],
    2: [" ### ", "#   #", "    #", "  ## ", " #   ", "#    ", "#####"], 3: ["#### ", "    #", "    #", " ### ", "    #", "    #", "#### "],
    4: ["#  # ", "#  # ", "#  # ", "#####", "   # ", "   # ", "   # "], 5: ["#####", "#    ", "#### ", "    #", "    #", "#   #", " ### "],
    6: [" ### ", "#    ", "#    ", "#### ", "#   #", "#   #", " ### "], 7: ["#####", "    #", "   # ", "  #  ", " #   ", " #   ", " #   "],
    8: [" ### ", "#   #", "#   #", " ### ", "#   #", "#   #", " ### "], 9: [" ### ", "#   #", "#   #", " ####", "    #", "    #", " ### "],
    "-": ["     ", "     ", "     ", " ### ", "     ", "     ", "     "], _: ["     ", "     ", "     ", "     ", "     ", "     ", "#####"],
    ".": ["     ", "     ", "     ", "     ", "     ", "     ", "  #  "], " ": ["   ", "   ", "   ", "   ", "   ", "   ", "   "],
  };

  // Returns 4 strings of block characters, or null if the name has glyphs we lack.
  // Glyph rows sit on pixel rows 1-7; row 0 stays blank so the pairs line up.
  function bigText(str) {
    const chars = [...String(str).toUpperCase().trim()];
    if (!chars.length || !chars.every((c) => G[c])) return null;
    const px = Array.from({ length: 8 }, () => "");
    chars.forEach((c, i) => {
      for (let r = 0; r < 7; r++) px[r + 1] += G[c][r].replace(/./g, (p) => (p === "#" ? "##" : "  ")) + (i < chars.length - 1 ? "  " : "");
    });
    px[0] = " ".repeat(px[1].length);
    return [0, 1, 2, 3].map((k) =>
      [...px[2 * k]].map((t, i) => {
        const top = t === "#", bot = px[2 * k + 1][i] === "#";
        return top && bot ? "█" : top ? "▀" : bot ? "▄" : " ";
      }).join("").replace(/\s+$/, "")
    );
  }

  // Names with glyphs outside the pixel font (CJK, accents...) are rasterized with a
  // system font and thresholded into the same half-block art.
  function rasterText(str) {
    const text = String(str).trim(), S = 18;
    if (!text) return null;
    const cv = document.createElement("canvas"), x = cv.getContext("2d", { willReadFrequently: true });
    const font = `500 ${S}px "Noto Sans CJK SC","Noto Sans SC","Source Han Sans SC","PingFang SC","Microsoft YaHei","WenQuanYi Micro Hei",sans-serif`;
    x.font = font;
    const w = Math.ceil(x.measureText(text).width) + 2, h = S + 6;
    cv.width = w; cv.height = h;
    x.font = font; x.textBaseline = "alphabetic"; x.fillStyle = "#000";
    x.fillText(text, 1, S);
    const d = x.getImageData(0, 0, w, h).data;
    const lit = (c, r) => d[(r * w + c) * 4 + 3] > 110;
    let r0 = 0, r1 = h - 1;
    const any = (r) => { for (let c = 0; c < w; c++) if (lit(c, r)) return true; return false; };
    while (r0 < h && !any(r0)) r0++;
    while (r1 > r0 && !any(r1)) r1--;
    if (r0 >= h) return null;
    if ((r1 - r0 + 1) % 2) r1++;
    const out = [];
    for (let r = r0; r <= r1; r += 2) {
      let line = "";
      for (let c = 0; c < w; c++) {
        const top = lit(c, r), bot = r + 1 < h && lit(c, r + 1);
        const g = top && bot ? "█" : top ? "▀" : bot ? "▄" : " ";
        line += g + g;
      }
      out.push(line.replace(/\s+$/, ""));
    }
    return out;
  }

  const NOISE = ["▀", "▄", "█", "░", "▒", "▓"];
  const rnd = () => NOISE[(Math.random() * NOISE.length) | 0];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = (p) => 1 - Math.pow(1 - p, 3);

  // Each effect maps (cell, t) to [char, x, y, colorToken, alpha] or null (hidden).
  const EFFECTS = {
    // glyph soup that resolves cell by cell, with a bright flash on arrival
    decrypt: { dur: 2.1, f: (c, t, S) => {
      const at = 0.15 + c.r * 1.2 + (c.x / S.W) * 0.4;
      if (t < at) return [rnd(), c.x, c.y, "dim", 1];
      return [c.ch, c.x, c.y, t < at + 0.2 ? "bright" : "main", 1];
    } },
    // columns of falling green heads that leave the text behind
    rain: { dur: 2.4, f: (c, t, S) => {
      const dt = t - (S.colR[c.x] * 1.0 + c.y * 0.1);
      if (dt < -0.14) return null;
      if (dt < 0) return [rnd(), c.x, c.y, "green", 1];
      return [c.ch, c.x, c.y, dt < 0.5 ? "green" : "main", 1];
    } },
    // a cyan beam sweeps each row, rows start staggered
    beams: { dur: 2.2, f: (c, t, S) => {
      const dt = t - (c.y * 0.2 + S.rowR[c.y] * 0.25 + c.x * 0.014);
      if (dt < 0) return null;
      return [c.ch, c.x, c.y, dt < 0.3 ? "cyan" : "main", 1];
    } },
    // cells fly in from random places and settle
    scatter: { dur: 1.7, f: (c, t) => {
      const p = clamp((t - c.r * 0.3) / 1.2, 0, 1), e = ease(p);
      return [c.ch, c.x + c.ox * (1 - e), c.y + c.oy * (1 - e), p < 1 ? "blue" : "main", p];
    } },
    // reveals bottom-up through yellow, orange and red
    burn: { dur: 2.0, f: (c, t, S) => {
      const dt = t - ((S.H - 1 - c.y) * 0.22 + c.r * 0.4);
      if (dt < 0) return null;
      if (dt < 0.5) return [["▓", "▒", "░"][((dt * 6) | 0) % 3], c.x, c.y, dt < 0.17 ? "yellow" : dt < 0.34 ? "orange" : "red", 1];
      return [c.ch, c.x, c.y, "main", 1];
    } },
  };
  const NAMES = Object.keys(EFFECTS);
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  class Banner {
    constructor(canvas, getColor) {
      this.cv = canvas;
      this.ctx = canvas.getContext("2d");
      this.gc = getColor;
      this.lines = [];
      this.cells = [];
      this.raf = 0;
      this.onDone = null;
      this._tick = this._tick.bind(this);
    }

    set(lines, availW, maxFs, maxH = Infinity) {
      this.stop();
      this.lines = lines;
      this.W = Math.max(1, ...lines.map((l) => [...l].length));
      this.H = lines.length;
      this.cells = [];
      lines.forEach((l, y) => [...l].forEach((ch, x) => ch !== " " && this.cells.push({ ch, x, y, r: 0, ox: 0, oy: 0 })));
      let fs = maxFs;
      for (; fs > 6; fs--) { this._font(fs); if (this.W * this.cw <= availW && this.H * this.lh <= maxH) break; }
      this._size();
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

    _size() {
      const dpr = window.devicePixelRatio || 1, w = Math.ceil(this.W * this.cw), h = Math.ceil(this.H * this.lh);
      this.cv.width = Math.ceil(w * dpr);
      this.cv.height = Math.ceil(h * dpr);
      this.cv.style.width = w + "px";
      this.cv.style.height = h + "px";
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.font = this.font;
      this.ctx.textBaseline = "alphabetic";
    }

    _draw(t) {
      const x = this.ctx;
      x.clearRect(0, 0, this.cv.width, this.cv.height);
      const S = this.S;
      for (const c of this.cells) {
        const r = t === Infinity ? [c.ch, c.x, c.y, "main", 1] : this.eff.f(c, t, S);
        if (!r) continue;
        x.globalAlpha = r[4];
        x.fillStyle = this.gc(r[3]);
        x.fillText(r[0], r[1] * this.cw, r[2] * this.lh + this.asc);
      }
      x.globalAlpha = 1;
    }

    drawStatic() { this._draw(Infinity); }

    play(name) {
      this.stop();
      if (reduced() || !this.cells.length) { this.drawStatic(); this.onDone && this.onDone(); return; }
      this.eff = EFFECTS[name] || EFFECTS[NAMES[(Math.random() * NAMES.length) | 0]];
      this.S = { W: this.W, H: this.H, colR: Array.from({ length: this.W }, Math.random), rowR: Array.from({ length: this.H }, Math.random) };
      for (const c of this.cells) {
        c.r = Math.random();
        c.ox = (Math.random() - 0.5) * this.W * 1.2;
        c.oy = (Math.random() - 0.5) * 14;
      }
      this.t0 = 0;
      this.raf = requestAnimationFrame(this._tick);
    }

    _tick(now) {
      if (!this.t0) this.t0 = now;
      const t = (now - this.t0) / 1000;
      if (t < this.eff.dur) { this._draw(t); this.raf = requestAnimationFrame(this._tick); return; }
      this.raf = 0;
      this.drawStatic();
      this.onDone && this.onDone();
    }

    stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }
  }

  window.OFX = { bigText, rasterText, Banner, EFFECTS: NAMES };
})();
