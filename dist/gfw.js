// GFW block status from the Komari "gfw-check" plugin (optional).
// The plugin pings every node from probers in China and abroad and serves a snapshot at
// /api/plugin/gfw-check/snapshot; the theme only reads it. Without the plugin, or for a node
// it has not checked yet, every function here degrades to "no data".

const STATUS = ["ok", "blocked", "suspect", "down", "unknown"];
const count = (c) => ({ ok: (c && c.ok) || 0, total: (c && c.total) || 0 });

function stack(rec) {
  if (!rec || typeof rec !== "object" || !STATUS.includes(rec.status)) return null;
  return { status: rec.status, cn: count(rec.cn), foreign: count(rec.foreign), since: rec.since || "", checkedAt: rec.checkedAt || "" };
}

// Pulls one node out of the snapshot body ({nodes:{uuid:{status, ipv4, ipv6, updatedAt}}}).
export function nodeGfw(snap, uuid) {
  const n = snap && snap.nodes && snap.nodes[uuid];
  if (!n || !STATUS.includes(n.status)) return null;
  const stacks = {};
  for (const k of ["ipv4", "ipv6"]) { const s = stack(n[k]); if (s) stacks[k] = s; }
  return { status: n.status, stacks, updatedAt: n.updatedAt || (snap && snap.updatedAt) || null };
}

// Status shown on the list card: only the bad news ("blocked" or "suspect"), else null.
export function cardFlag(snap, uuid) {
  const n = snap && snap.nodes && snap.nodes[uuid];
  return n && (n.status === "blocked" || n.status === "suspect") ? n.status : null;
}
