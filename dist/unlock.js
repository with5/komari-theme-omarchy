// Streaming / AI unlock results from the Komari "unlock-test" plugin (optional).
// The plugin probes the nodes and serves its snapshot at /api/plugin/unlock-test/snapshot;
// the theme only reads it. Without the plugin every function here degrades to "no data".

// Services are grouped like the plugin's own regions; unknown ids sort last.
const ORDER = ["0", "11", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

// What a service shows: IPv4 (or the dual-stack "auto" probe) first; IPv6 only when it unlocks
// what IPv4 does not, marked v6.
export function pick(svc) {
  const primary = svc.ipv4 || svc.auto;
  const v6 = !(primary && primary.unlocked) && !!(svc.ipv6 && svc.ipv6.unlocked);
  const r = v6 ? svc.ipv6 : primary || svc.ipv6;
  if (!r) return { unlocked: false, v6: false, code: "--", status: "UNKNOWN" };
  return { unlocked: !!r.unlocked, v6, code: r.region || (r.unlocked ? "OK" : r.status || "NO"), status: r.status || "" };
}

// [{id, key, items:[{name, unlocked, v6, code}]}] in display order, or [] when there is nothing to show.
export function group(services) {
  const by = new Map();
  for (const s of Array.isArray(services) ? services : []) {
    if (!s || !s.name) continue;
    const id = String(s.regionId ?? "0");
    if (!by.has(id)) by.set(id, { id, key: s.regionKey || id, items: [] });
    by.get(id).items.push({ name: s.displayName || s.name, ...pick(s) });
  }
  const rank = (id) => { const i = ORDER.indexOf(id); return i < 0 ? ORDER.length : i; };
  return [...by.values()].sort((a, b) => rank(a.id) - rank(b.id) || Number(a.id) - Number(b.id));
}

// Pulls one node out of the snapshot body ({nodes:{uuid:{services,updatedAt}}}).
export function nodeEntry(snap, uuid) {
  const n = snap && snap.nodes && snap.nodes[uuid];
  if (!n || !Array.isArray(n.services) || !n.services.length) return null;
  return { groups: group(n.services), updatedAt: n.updatedAt || (snap && snap.updatedAt) || null };
}
