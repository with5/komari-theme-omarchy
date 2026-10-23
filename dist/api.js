// Komari public API. The REST routes wrap results as {status, data}; JSON-RPC (/api/rpc2)
// is used where the REST binding lacks a parameter (ping `max_count`).

export const unwrap = (j) => (j && typeof j === "object" && !Array.isArray(j) && "status" in j && "data" in j ? j.data : j);
export const getJSON = (url) => fetch(url, { credentials: "same-origin" }).then((r) => r.json()).then(unwrap);

let rid = 0;
export async function rpc(method, params) {
  const r = await fetch("/api/rpc2", {
    method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rid, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "rpc error");
  return j.result;
}

// Small TTL cache keyed by request; failed requests are not cached.
const cache = new Map();
function cached(key, ttl, fn) {
  const c = cache.get(key);
  if (c && Date.now() - c.t < ttl) return c.p;
  const p = fn().catch((e) => { cache.delete(key); throw e; });
  cache.set(key, { t: Date.now(), p });
  return p;
}
export const invalidate = (uuid) => { for (const k of cache.keys()) if (k.includes("|" + uuid + "|")) cache.delete(k); };

// ping: {records:[{task_id,time,value,client}], tasks:[{id,name,type,interval,loss,min,max,avg,total}]}
export const pingRecords = (uuid, hours) =>
  cached(`p|${uuid}|${hours}`, 25000, () => rpc("public:getPingRecords", { uuid, hours: String(hours), max_count: 600 }));
// load history: {records:[{time,cpu,ram,ram_total,net_in,net_out,load,...}]}
export const loadRecords = (uuid, hours) =>
  cached(`l|${uuid}|${hours}`, 55000, () => rpc("public:getRecordsByUUID", { uuid, load_type: "all", hours: String(hours) }));
