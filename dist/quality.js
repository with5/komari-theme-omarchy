// IP quality from the Komari "ip-quality" plugin (optional).
// The plugin runs the IPQuality script on the nodes and serves a snapshot at
// /api/plugin/ip-quality/snapshot; the theme only reads it. Without the plugin, or for a node
// it has not checked yet, every function here degrades to "no data".

const FACTORS = ["proxy", "vpn", "tor", "server", "abuser", "robot"];
const MAIL_PORT = "Port25";

// Most common value and how many databases said something else: {top, n, others:[[value,count]]}
export function tally(map) {
  const c = new Map();
  for (const v of Object.values(map || {})) if (v) c.set(v, (c.get(v) || 0) + 1);
  const all = [...c].sort((a, b) => b[1] - a[1]);
  return all.length ? { top: all[0][0], n: all[0][1], all, mixed: all.length > 1 } : null;
}

// One stack's record -> what the tab draws.
export function view(rec) {
  if (!rec || typeof rec !== "object") return null;
  const scores = Object.entries(rec.scores || {}).filter(([, v]) => typeof v === "number").map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const factors = FACTORS.map((key) => {
    const f = (rec.factors || {})[key] || {};
    return { key, hit: f.hit || 0, total: f.total || 0, sources: Array.isArray(f.sources) ? f.sources : [] };
  }).filter((f) => f.total > 0);
  const mail = rec.mail || {}, provs = Object.keys(mail).filter((k) => k !== MAIL_PORT);
  const bl = rec.blacklist || {};
  return {
    ip: rec.ip || "", asn: rec.asn || "", org: rec.org || "",
    country: rec.country || "", countryName: rec.countryName || "", registered: rec.registered || "", city: rec.city || "", timezone: rec.timezone || "",
    geoOk: !rec.geo || /consistent/i.test(rec.geo) && !/discrepant|inconsistent/i.test(rec.geo),
    usage: tally(rec.usage), scores, factors,
    port25: typeof mail[MAIL_PORT] === "boolean" ? mail[MAIL_PORT] : null,
    mailOk: provs.filter((k) => mail[k]).length, mailTotal: provs.length,
    blacklist: bl.total > 0 ? { total: bl.total, clean: bl.clean || 0, marked: bl.marked || 0, listed: bl.blacklisted || 0 } : null,
    checkedAt: rec.checkedAt || "",
  };
}

// Pulls one node out of the snapshot body ({nodes:{uuid:{ipv4, ipv6, updatedAt}}}).
export function nodeQuality(snap, uuid) {
  const n = snap && snap.nodes && snap.nodes[uuid];
  if (!n) return null;
  const stacks = {};
  for (const k of ["ipv4", "ipv6"]) { const v = view(n[k]); if (v) stacks[k] = v; }
  if (!Object.keys(stacks).length) return null;
  return { stacks, updatedAt: n.updatedAt || (snap && snap.updatedAt) || null };
}
