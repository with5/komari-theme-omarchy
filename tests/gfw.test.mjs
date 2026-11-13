import test from "node:test";
import assert from "node:assert/strict";
import { nodeGfw, cardFlag } from "../dist/gfw.js";

const snap = {
  updatedAt: "2026-10-29T01:00:00Z",
  nodes: {
    a: { status: "blocked", updatedAt: "2026-10-29T01:00:00Z", ipv4: { status: "blocked", cn: { ok: 0, total: 2 }, foreign: { ok: 3, total: 3 }, since: "s", checkedAt: "c" }, ipv6: { status: "ok", cn: { ok: 1, total: 1 }, foreign: { ok: 1, total: 1 } } },
    b: { status: "suspect", ipv4: { status: "suspect" } },
    c: { status: "ok", ipv4: { status: "ok" } },
    d: { status: "weird" },
  },
};

test("a node becomes a per-stack status with probe counts", () => {
  const g = nodeGfw(snap, "a");
  assert.equal(g.status, "blocked");
  assert.deepEqual(Object.keys(g.stacks), ["ipv4", "ipv6"]);
  assert.deepEqual(g.stacks.ipv4.cn, { ok: 0, total: 2 });
  assert.deepEqual(g.stacks.ipv4.foreign, { ok: 3, total: 3 });
  assert.deepEqual(nodeGfw(snap, "b").stacks.ipv4.cn, { ok: 0, total: 0 });
});

test("missing plugin data, unknown nodes and unknown statuses mean no data", () => {
  assert.equal(nodeGfw(null, "a"), null);
  assert.equal(nodeGfw(snap, "zzz"), null);
  assert.equal(nodeGfw(snap, "d"), null);
});

test("the card only flags blocked and suspect nodes", () => {
  assert.equal(cardFlag(snap, "a"), "blocked");
  assert.equal(cardFlag(snap, "b"), "suspect");
  assert.equal(cardFlag(snap, "c"), null);
  assert.equal(cardFlag(null, "a"), null);
});
