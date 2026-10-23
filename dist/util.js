import { t } from "./i18n.js";

// Text helpers shared by the node list and the detail page.
// The UI is a grid of monospace cells, so everything here counts cells, not pixels.

export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

// CJK and fullwidth characters take two cells.
const wide = (c) => (c >= 0x1100 && c <= 0x115f) || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3) ||
  (c >= 0xf900 && c <= 0xfaff) || (c >= 0xfe30 && c <= 0xfe6f) || (c >= 0xff00 && c <= 0xff60) || (c >= 0xffe0 && c <= 0xffe6);
export const wcw = (s) => { let w = 0; for (const ch of s) w += wide(ch.codePointAt(0)) ? 2 : 1; return w; };
export const clip = (s, n) => {
  if (n <= 0) return "";
  if (wcw(s) <= n) return s;
  let out = "", w = 0;
  for (const ch of s) { const k = wide(ch.codePointAt(0)) ? 2 : 1; if (w + k > n - 1) break; out += ch; w += k; }
  return out + "…";
};
export const stripEmoji = (s) => String(s || "").replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}️‍]/gu, "").trim();

export const bytes = (n) => {
  n = Number(n) || 0;
  const u = ["B", "K", "M", "G", "T", "P"];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return (n >= 100 || i === 0 ? n.toFixed(0) : n.toFixed(1)) + u[i];
};
export const uptime = (s) => {
  s = Number(s) || 0;
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  const [D, H, M] = [t("dur.d"), t("dur.h"), t("dur.m")];
  return d ? `${d}${D} ${h}${H}` : h ? `${h}${H} ${m}${M}` : `${m}${M}`;
};
export const padR = (s, n) => s + " ".repeat(Math.max(0, n - wcw(s)));
export const padL = (s, n) => " ".repeat(Math.max(0, n - wcw(s))) + s;
export const pct = (used, total) => (total > 0 ? Math.min(100, (used / total) * 100) : 0);
export const ms = (v) => (v == null ? "-" : v >= 100 ? `${Math.round(v)}ms` : `${v.toFixed(v < 10 ? 1 : 0)}ms`);

// btop-style braille area graph: 2 samples per character, 4 dots per row.
// `series` entries may be null (no data); a shorter series is right-aligned.
const BL = [0x40, 0x04, 0x02, 0x01], BR = [0x80, 0x20, 0x10, 0x08];
export function graph(series, w, rows, max) {
  const n = w * 2, s = series.slice(-n), off = n - s.length;
  const cells = Array.from({ length: rows }, () => new Uint16Array(w));
  for (let i = off; i < n; i++) {
    const raw = s[i - off];
    if (raw == null) continue;
    const v = Math.min(1, Math.max(0, raw / max));
    const h = Math.max(1, Math.round(v * rows * 4)), dots = i & 1 ? BR : BL, cx = i >> 1;
    for (let r = 0; r < rows; r++) {
      const k = Math.min(4, Math.max(0, h - (rows - 1 - r) * 4));
      for (let d = 0; d < k; d++) cells[r][cx] |= dots[d];
    }
  }
  return cells.map((row) => Array.from(row, (b) => (b ? String.fromCharCode(0x2800 + b) : " ")).join(""));
}

// Fixed time axis: n buckets over [start, end]. Returns average per bucket and the number of
// lost samples per bucket (points with v < 0). Gaps between nearby samples are linearly
// filled so sparse data still draws a continuous area; long gaps and lossy buckets stay empty.
export function bucketize(points, start, end, n) {
  const sum = new Float64Array(n), cnt = new Uint32Array(n), loss = new Uint32Array(n);
  const span = end - start;
  for (const p of points) {
    if (!(p.t >= start && p.t <= end) || span <= 0) continue;
    const i = Math.min(n - 1, Math.floor(((p.t - start) / span) * n));
    if (p.v < 0) loss[i]++;
    else { sum[i] += p.v; cnt[i]++; }
  }
  const vals = Array.from(sum, (v, i) => (cnt[i] ? v / cnt[i] : null));
  const idx = [];
  vals.forEach((v, i) => v != null && idx.push(i));
  if (idx.length > 1) {
    const gaps = [];
    for (let i = 1; i < idx.length; i++) gaps.push(idx[i] - idx[i - 1]);
    gaps.sort((a, b) => a - b);
    const lim = Math.max(2, gaps[gaps.length >> 1] * 2.5);
    for (let i = 1; i < idx.length; i++) {
      const a = idx[i - 1], b = idx[i];
      if (b - a > 1 && b - a <= lim) {
        for (let j = a + 1; j < b; j++) if (!loss[j]) vals[j] = vals[a] + ((vals[b] - vals[a]) * (j - a)) / (b - a);
      }
    }
  }
  return { vals, loss: Array.from(loss) };
}

// meter as colored zones, like btop's gradient: green -> yellow -> red by position
export function meter(frac, n) {
  const f = Math.round(Math.min(1, Math.max(0, frac)) * n), z1 = Math.floor(n * 0.6), z2 = Math.floor(n * 0.85);
  const segs = [["g", Math.min(f, z1)], ["y", Math.max(0, Math.min(f, z2) - z1)], ["r", Math.max(0, f - z2)], ["d", n - f]];
  return segs.filter((s) => s[1] > 0).map(([c, k]) => [c, (c === "d" ? "░" : "█").repeat(k)]);
}

// A box drawn with text. Top/bottom lines are glyphs; side borders come from CSS
// (class "s") so they stay continuous. `I` is the inner width in cells.
export function box(I) {
  const B = (t) => `<span class="b">${t}</span>`;
  const E = (html, k = "") => `<div class="ln ${k}">${html}</div>`;
  const row = (segs) => {
    let w = 0, out = "";
    for (const [c, t] of segs) { w += wcw(t); out += c ? `<span class="${c}">${esc(t)}</span>` : esc(t); }
    return `<div class="ln s"> ${out}${" ".repeat(Math.max(0, I - w))} </div>`;
  };
  const top = (title, right = "", cls = "w") => {
    title = clip(title, I - 2 - wcw(right));
    return E(B("┌─") + `<span class="${cls}">${esc(title)}</span>` + B("─".repeat(Math.max(0, I - 2 - wcw(title) - wcw(right)))) +
      `<span class="d">${esc(right)}</span>` + B("─┐"), "t");
  };
  const sep = () => E(B("├" + "─".repeat(I) + "┤"), "s");
  const bottom = (tag = "") => E(B("└" + "─".repeat(I - wcw(tag) - 1)) + `<span class="d">${esc(tag)}</span>` + B("─┘"), "u");
  const blank = () => row([]);
  return { I, B, E, row, top, sep, bottom, blank };
}
