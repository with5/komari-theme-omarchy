import test from "node:test";
import assert from "node:assert/strict";
import { pick, group, nodeEntry } from "../dist/unlock.js";

const yes = (region) => ({ status: "YES", unlocked: true, region, raw: "YES" });
const no = (region = "NO") => ({ status: "NO", unlocked: false, region, raw: "NO" });

test("IPv4 result wins when it unlocks", () => {
  assert.deepEqual(pick({ ipv4: yes("US"), ipv6: no() }), { unlocked: true, v6: false, code: "US", status: "YES" });
});

test("IPv6 is shown only when it unlocks what IPv4 does not", () => {
  const p = pick({ ipv4: no(), ipv6: yes("JP") });
  assert.equal(p.unlocked, true);
  assert.equal(p.v6, true);
  assert.equal(p.code, "JP");
  assert.equal(pick({ ipv4: yes("US"), ipv6: yes("JP") }).v6, false);
});

test("dual-stack auto result is used when there is no ipv4", () => {
  assert.equal(pick({ auto: yes("SG") }).code, "SG");
});

test("locked and empty services get a placeholder code", () => {
  assert.deepEqual(pick({ ipv4: no() }), { unlocked: false, v6: false, code: "NO", status: "NO" });
  assert.equal(pick({}).code, "--");
  assert.equal(pick({ ipv4: { status: "YES", unlocked: true, region: "" } }).code, "OK");
});

test("services group by region in plugin order, AI right after global", () => {
  const svc = (name, regionId) => ({ name, regionId, regionKey: "k" + regionId, ipv4: yes("US") });
  const g = group([svc("Abema", "3"), svc("ChatGPT", "11"), svc("Netflix", "0"), svc("Disney+", "0")]);
  assert.deepEqual(g.map((x) => x.id), ["0", "11", "3"]);
  assert.deepEqual(g[0].items.map((x) => x.name), ["Netflix", "Disney+"]);
});

test("displayName is preferred over the full name", () => {
  const g = group([{ name: "Amazon Prime Video", displayName: "Prime Video", regionId: "0", ipv4: yes("US") }]);
  assert.equal(g[0].items[0].name, "Prime Video");
});

test("garbage input yields no groups", () => {
  assert.deepEqual(group(null), []);
  assert.deepEqual(group([null, {}]), []);
});

test("nodeEntry is null for missing nodes, empty services or no plugin data", () => {
  assert.equal(nodeEntry(null, "a"), null);
  assert.equal(nodeEntry({ nodes: {} }, "a"), null);
  assert.equal(nodeEntry({ nodes: { a: { services: [] } } }, "a"), null);
});

test("nodeEntry falls back to the snapshot time", () => {
  const snap = { updatedAt: "T", nodes: { a: { services: [{ name: "X", regionId: "0", ipv4: yes("US") }] } } };
  assert.equal(nodeEntry(snap, "a").updatedAt, "T");
  assert.equal(nodeEntry(snap, "a").groups.length, 1);
});
