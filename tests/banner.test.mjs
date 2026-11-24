import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const listeners = {};
const win = {
  matchMedia: () => ({ matches: false }), innerWidth: 1280, innerHeight: 720,
  addEventListener: (ev, f) => { (listeners[ev] ||= new Set()).add(f); },
  removeEventListener: (ev, f) => { listeners[ev]?.delete(f); },
};
const fire = (ev) => { for (const f of [...(listeners[ev] || [])]) f(); };
let rafCb = null;
const ctx = {
  window: win, matchMedia: win.matchMedia,
  requestAnimationFrame: (cb) => { rafCb = cb; return 1; },
  cancelAnimationFrame: () => { rafCb = null; },
  // rasterText draws on a canvas and reads its pixels back: serve a fixed bitmap instead
  document: { createElement: () => ({ getContext: () => rasterCtx }) },
};
// a 2-pixel-wide "T" at x 3..7, y 2..6 of a 10x8 image ("#" = opaque)
const T = ["          ", "          ", "   #####  ", "   #####  ", "     ##   ", "     ##   ", "     ##   ", "          "];
const rasterCtx = {
  measureText: () => ({ width: 8 }), fillText() {},
  getImageData: (x, y, w, h) => ({ data: Uint8ClampedArray.from({ length: w * h * 4 }, (_, i) => (i % 4 === 3 && (T[(i >> 2) / w | 0] || "")[(i >> 2) % w] === "#" ? 255 : 0)) }),
};
vm.runInNewContext(readFileSync(new URL("../dist/fx.js", import.meta.url), "utf8"), ctx);
const { bigText, rasterText, Banner, EFFECTS } = win.OFX;

// A canvas whose 2D context records every glyph drawn in the last frame.
function mockCanvas() {
  const frame = [];
  const g = {
    font: "", fillStyle: "", globalAlpha: 1, textBaseline: "",
    measureText: () => ({ width: 10, fontBoundingBoxAscent: 12, fontBoundingBoxDescent: 4 }),
    setTransform() {}, clearRect() { frame.length = 0; },
    fillText(ch, x, y) { frame.push({ ch, x, y, style: g.fillStyle, alpha: g.globalAlpha }); },
  };
  return { cv: { style: {}, getContext: () => g, getBoundingClientRect: () => ({ left: 203, top: 14 }) }, frame };
}

// Plays an effect at 30 fps; returns the number of seconds it ran and the final frame.
// mode: "own" (the banner canvas), "full" (screensaver) or "stage" (overlay canvas).
function run(name, lines = bigText("Komari"), mode = "own") {
  const { cv, frame } = mockCanvas(), st = mockCanvas();
  const b = new Banner(cv, (tok) => tok, mode === "full" ? { full: true } : mode === "stage" ? { stage: st.cv } : {});
  let outside = false;
  b.set(lines, 10000, 16);
  let done = false, now = 1000, frames = 0;
  b.onDone = () => { done = true; };
  b.play(name);
  while (rafCb && frames < 400) {
    const cb = rafCb; rafCb = null; cb(now); now += 1000 / 30; frames++;
    for (const d of [...frame, ...st.frame]) {
      if (b.S && (d.y < b.S.ty * 16 || d.y > (b.S.ty + b.S.th) * 16 + 12)) outside = true;
      assert.ok(Number.isFinite(d.x) && Number.isFinite(d.y), `${name}: non-finite position`);
      assert.ok(typeof d.ch === "string" && d.ch.length > 0, `${name}: empty glyph`);
      assert.ok(typeof d.style === "string" && d.style, `${name}: missing color token`);
    }
  }
  return { done, secs: (frames - 1) / 30, frame: [...frame], stage: [...st.frame], stageCv: st.cv, b, outside };
}

const TTFX = ["beams", "binarypath", "blackhole", "bouncyballs", "bubbles", "burn", "colorshift", "crumble", "decrypt",
  "errorcorrect", "expand", "fireworks", "highlight", "laseretch", "matrix", "middleout", "orbittingvolley", "overflow",
  "pour", "print", "rain", "randomsequence", "rings", "scattered", "slice", "slide", "smoke", "spotlights", "spray",
  "swarm", "sweep", "synthgrid", "thunderstorm", "unstable", "vhstape", "waves", "wipe"];

test("all 37 ttfx effects are registered", () => {
  assert.deepEqual([...EFFECTS].sort(), [...TTFX].sort());
});

test("the manifest offers every effect plus random and off", () => {
  const m = JSON.parse(readFileSync(new URL("../komari-theme.json", import.meta.url), "utf8"));
  const find = (o) => (o && typeof o === "object" ? (o.key === "intro" ? o : Object.values(o).map(find).find(Boolean)) : null);
  const intro = find(m).options.split(",");
  assert.deepEqual(intro, ["random", ...TTFX, "off"]);
});

for (const name of TTFX) {
  test(`${name} runs 1.6-3.2 s and ends on the clean banner`, () => {
    const lines = bigText("Komari"), { done, secs, frame } = run(name, lines);
    assert.ok(done, "onDone was called");
    assert.ok(secs >= 1.5 && secs <= 3.3, `duration ${secs}s`);
    const cells = lines.flatMap((l) => [...l].filter((ch) => ch !== " "));
    assert.equal(frame.length, cells.length);
    assert.ok(frame.every((d) => d.style === "main" && d.alpha === 1));
  });
}

test("effects cope with tall rasterized and single-row banners", () => {
  const tall = Array.from({ length: 12 }, (_, y) => "█▀▄ ".repeat(20 + y));
  for (const name of TTFX) for (const lines of [tall, ["", " KOMARI", ""]]) assert.ok(run(name, lines).done, name);
});

test("the old scatter setting still plays the scattered effect", () => {
  const a = run("scatter").b.eff, b = run("scattered").b.eff;
  assert.equal(a, b);
});

test("latin names are 5 block rows plus a shadow row", () => {
  assert.equal(bigText("Omarchy").length, 6);
});

test("every row uses only blocks and shadow lines", () => {
  for (const row of bigText("Komari 0-9_.")) assert.match(row, /^[ █║═╗╔╝╚╬]*$/);
});

test("renders the ANSI Shadow lettering", () => {
  assert.deepEqual([...bigText("komari")], [
    "██╗  ██╗ ██████╗ ███╗   ███╗ █████╗ ██████╗ ██╗",
    "██║ ██╔╝██╔═══██╗████╗ ████║██╔══██╗██╔══██╗██║",
    "█████╔╝ ██║   ██║██╔████╔██║███████║██████╔╝██║",
    "██╔═██╗ ██║   ██║██║╚██╔╝██║██╔══██║██╔══██╗██║",
    "██║ ╚██╗╚██████╔╝██║ ╚═╝ ██║██║  ██║██║  ██║██║",
    "╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝",
  ]);
});

test("shadows only fall right of or below a block", () => {
  const all = bigText("ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789-_.");
  const b = (r, c) => (all[r] || "")[c] === "█";
  all.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch !== " " && ch !== "█") assert.ok(b(r, c - 1) || b(r - 1, c) || b(r - 1, c - 1), `stray ${ch} at ${r},${c}`);
  }));
});

test("names are case-insensitive", () => {
  assert.deepEqual(bigText("omarchy"), bigText("OMARCHY"));
});

test("unsupported glyphs return null so the caller can rasterize", () => {
  assert.equal(bigText("牛逼站点"), null);
  assert.equal(bigText(""), null);
});

test("the screensaver field covers the viewport with the text centered", () => {
  const lines = bigText("Komari"), n = lines.flatMap((l) => [...l].filter((ch) => ch !== " ")).length;
  for (const name of TTFX) {
    const { done, frame, b } = run(name, lines, "full");
    assert.ok(done, name);
    assert.ok(b.S.W >= 1280 / 10 && b.S.H >= 720 / 16, `${name}: field ${b.S.W}x${b.S.H}`);
    assert.equal(b.S.tx, Math.floor((1280 - b.W * 10) / 2 / 10));
    assert.equal(b.S.ty, Math.floor((720 - b.H * 16) / 2 / 16));
    assert.equal(frame.length, n, name);
  }
});

test("effects reach beyond the text box in full-screen mode", () => {
  for (const name of ["rain", "matrix", "fireworks", "thunderstorm", "swarm", "synthgrid", "orbittingvolley", "bouncyballs"])
    assert.ok(run(name, bigText("Komari"), "full").outside, name);
});

test("the intro plays on the stage, keeps its last frame there, and hands it back on scroll", () => {
  const lines = bigText("Komari"), n = lines.flatMap((l) => [...l].filter((ch) => ch !== " ")).length;
  for (const name of TTFX) {
    const { done, frame, stage, stageCv, b } = run(name, lines, "stage");
    assert.ok(done, name);
    assert.equal(b.S.tx, Math.floor(203 / 10));
    assert.equal(b.S.ty, Math.floor(14 / 16));
    // the stage holds the static text, which is the last frame: nothing moves when the effect ends
    assert.equal(stageCv.style.display, "block");
    assert.equal(frame.length, 0);
    assert.equal(stage.length, n);
    assert.ok(stage.every((d) => d.style === "main" && d.alpha === 1));
    fire("scroll");
    assert.equal(stageCv.style.display, "none", `${name}: released on scroll`);
    assert.ok(!listeners.scroll?.size && !listeners.resize?.size, `${name}: listeners removed`);
  }
});

test("replaying or resetting the banner releases a held stage", () => {
  const { b, stageCv } = run("wipe", bigText("Komari"), "stage");
  assert.equal(stageCv.style.display, "block");
  b.set(bigText("Omarchy"), 10000, 16);
  assert.equal(stageCv.style.display, "none");
  assert.ok(!listeners.scroll?.size);
});

test("rasterized names get the same block art and shadow, cropped to the ink", () => {
  assert.deepEqual([...rasterText("中")], [
    "██████████╗",
    "██████████║",
    "╚═══████╔═╝",
    "    ████║",
    "    ████║",
    "    ╚═══╝",
  ]);
});
