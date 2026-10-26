import test from "node:test";
import assert from "node:assert/strict";
import { tally, view, nodeQuality } from "../dist/quality.js";

const f = (hit, total, sources = []) => ({ hit, total, sources });
const rec = (o = {}) => ({
  ip: "1.2.*.*", asn: "906", org: "DMIT", country: "HK", countryName: "Hong Kong", registered: "US", city: "Brasília", timezone: "America/Sao_Paulo", geo: "Geo-discrepant",
  usage: { IPinfo: "Hosting", ipregistry: "Hosting", ipapi: "ISP" },
  scores: { IP2LOCATION: 3, SCAMALYTICS: 40, IPQS: null, AbuseIPDB: 0 },
  factors: { proxy: f(0, 8), vpn: f(2, 7, ["IPinfo", "ipapi"]), tor: f(0, 0), server: f(5, 8), abuser: f(0, 8), robot: f(0, 6) },
  mail: { Port25: true, Gmail: true, QQ: false, Yahoo: true },
  blacklist: { total: 423, clean: 400, marked: 20, blacklisted: 3 },
  checkedAt: "2026-10-26 08:16:52 UTC", ...o,
});

test("tally picks the most common value and notices disagreement", () => {
  assert.deepEqual(tally({ a: "Hosting", b: "Hosting", c: "ISP" }), { top: "Hosting", n: 2, all: [["Hosting", 2], ["ISP", 1]], mixed: true });
  assert.equal(tally({ a: "ISP", b: "ISP" }).mixed, false);
  assert.equal(tally({}), null);
  assert.equal(tally(null), null);
});

test("a record becomes a view: scores sorted, null scores and empty factors dropped", () => {
  const v = view(rec());
  assert.deepEqual(v.scores.map((s) => s.name), ["SCAMALYTICS", "IP2LOCATION", "AbuseIPDB"]);
  assert.deepEqual(v.factors.map((x) => x.key), ["proxy", "vpn", "server", "abuser", "robot"]);
  assert.deepEqual(v.factors[1], { key: "vpn", hit: 2, total: 7, sources: ["IPinfo", "ipapi"] });
  assert.equal(v.geoOk, false);
  assert.equal(v.usage.top, "Hosting");
  assert.equal(v.port25, true);
  assert.equal(v.mailOk, 2);
  assert.equal(v.mailTotal, 3);
  assert.deepEqual(v.blacklist, { total: 423, clean: 400, marked: 20, listed: 3 });
});

test("a consistent record is geoOk and a missing blacklist stays null", () => {
  const v = view(rec({ geo: "Geo-consistent", blacklist: { total: 0 }, mail: {} }));
  assert.equal(v.geoOk, true);
  assert.equal(v.blacklist, null);
  assert.equal(v.port25, null);
});

test("nodeQuality keeps only the stacks that have data", () => {
  const snap = { updatedAt: "T", nodes: { a: { ipv4: rec(), ipv6: null, updatedAt: "N" }, b: { ipv4: null, ipv6: null } } };
  const q = nodeQuality(snap, "a");
  assert.deepEqual(Object.keys(q.stacks), ["ipv4"]);
  assert.equal(q.updatedAt, "N");
  assert.equal(nodeQuality(snap, "b"), null);
  assert.equal(nodeQuality(snap, "zzz"), null);
  assert.equal(nodeQuality(null, "a"), null);
});
