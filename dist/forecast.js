// Monthly traffic quota and forecast from the Komari "NetForecast" plugin (optional).
// The plugin tracks daily traffic and serves every node's forecast at
// /api/plugin/net-forecast/overview; the theme only reads it. Without the plugin, or for a node
// it has no data for, every function here degrades to "no data".

const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);

// Normalizes one node of the overview body ({nodes:[{node_id, ...}]}) into what the tab draws,
// or null when there is nothing to show.
export function nodeForecast(overview, uuid) {
  const n = overview && Array.isArray(overview.nodes) && overview.nodes.find((x) => x && x.node_id === uuid);
  if (!n || n.fetch_failed || !n.cycle) return null;
  const cum = n.cumulative || {}, avg = n.daily_avg || {}, proj = n.projected || {};
  const hasQuota = !!n.has_quota && num(n.traffic_limit_bytes) > 0;
  const days = (Array.isArray(n.chart_series) ? n.chart_series : [])
    .filter((d) => d && d.date)
    .map((d) => ({ date: d.date, in: num(d.in_bytes), out: num(d.out_bytes), total: num(d.total_bytes) || num(d.in_bytes) + num(d.out_bytes), forecast: !!d.is_forecast, today: !!d.is_today }));
  return {
    status: hasQuota ? n.status || "SAFE" : "NO_QUOTA",
    hasQuota,
    limit: hasQuota ? num(n.traffic_limit_bytes) : 0,
    mode: n.traffic_limit_type || "sum",
    used: num(cum.billable_bytes),
    in: num(cum.in_bytes),
    out: num(cum.out_bytes),
    ratio: hasQuota ? num(n.usage_ratio) : 0,
    avgDaily: num(avg.billable_bytes),
    projected: num(proj.billable_bytes),
    resetDay: num(n.traffic_reset_day) || 1,
    cycle: { start: n.cycle.cycleStart || "", end: n.cycle.cycleEnd || "", total: num(n.cycle.daysTotal), elapsed: num(n.cycle.daysElapsed), remaining: num(n.cycle.daysRemaining) },
    exhaustDays: n.days_until_exhaustion != null ? num(n.days_until_exhaustion) : null,
    exhaustDate: n.exhaustion_date || "",
    days,
  };
}

// Daily totals of the days that actually happened, padded with nulls to the length of the cycle
// so a graph over it starts at the left edge.
export function dailySeries(f) {
  const len = Math.max(f.cycle.total, f.days.length);
  const real = f.days.filter((d) => !d.forecast).map((d) => d.total);
  return real.concat(Array(Math.max(0, len - real.length)).fill(null));
}
