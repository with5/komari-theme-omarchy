import test from "node:test";
import assert from "node:assert/strict";
import { nodeForecast, dailySeries } from "../dist/forecast.js";

const node = (o = {}) => ({
  node_id: "a", has_quota: true, traffic_limit_bytes: 1000, traffic_limit_type: "max", traffic_reset_day: 8, usage_ratio: 0.5, status: "WARNING",
  cycle: { cycleStart: "2026-10-08", cycleEnd: "2026-11-07", daysTotal: 4, daysElapsed: 2, daysRemaining: 2 },
  cumulative: { billable_bytes: 500, in_bytes: 300, out_bytes: 400 }, daily_avg: { billable_bytes: 100 }, projected: { billable_bytes: 700 },
  chart_series: [{ date: "2026-10-08", in_bytes: 1, out_bytes: 2, total_bytes: 3 }, { date: "2026-10-09", in_bytes: 2, out_bytes: 2, is_today: true }, { date: "2026-10-10", total_bytes: 9, is_forecast: true }],
  ...o,
});

test("a node with a quota is normalized", () => {
  const f = nodeForecast({ ok: true, nodes: [node()] }, "a");
  assert.equal(f.status, "WARNING");
  assert.equal(f.limit, 1000);
  assert.equal(f.used, 500);
  assert.equal(f.projected, 700);
  assert.equal(f.resetDay, 8);
  assert.equal(f.exhaustDays, null);
  assert.equal(f.days[1].total, 4);
});

test("without a limit the node is NO_QUOTA", () => {
  const f = nodeForecast({ nodes: [node({ has_quota: false, traffic_limit_bytes: 0, status: "SAFE" })] }, "a");
  assert.equal(f.status, "NO_QUOTA");
  assert.equal(f.hasQuota, false);
  assert.equal(f.ratio, 0);
});

test("missing node, failed fetch or no plugin data yield null", () => {
  assert.equal(nodeForecast(null, "a"), null);
  assert.equal(nodeForecast({ nodes: [node()] }, "b"), null);
  assert.equal(nodeForecast({ nodes: [node({ fetch_failed: true })] }, "a"), null);
  assert.equal(nodeForecast({ nodes: [node({ cycle: undefined })] }, "a"), null);
});

test("dailySeries skips forecast days and pads to the cycle length", () => {
  const s = dailySeries(nodeForecast({ nodes: [node()] }, "a"));
  assert.deepEqual(s, [3, 4, null, null]);
});
