import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const win = { matchMedia: () => ({ matches: false }) };
vm.runInNewContext(readFileSync(new URL("../dist/fx.js", import.meta.url), "utf8"), { window: win, matchMedia: win.matchMedia });
const { bigText } = win.OFX;

test("latin names are 4 text rows tall", () => {
  assert.equal(bigText("Omarchy").length, 4);
});

test("every row uses only block characters", () => {
  for (const row of bigText("Komari 0-9_.")) assert.match(row, /^[ ▀▄█]*$/);
});

test("names are case-insensitive", () => {
  assert.deepEqual(bigText("omarchy"), bigText("OMARCHY"));
});

test("unsupported glyphs return null so the caller can rasterize", () => {
  assert.equal(bigText("牛逼站点"), null);
  assert.equal(bigText(""), null);
});

test("Y keeps a stem of at least 4 pixel rows", () => {
  const rows = bigText("Y");
  assert.ok(rows.slice(1).every((r) => r.includes("██") || r.includes("▀") || r.includes("▄")));
});
