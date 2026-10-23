// Node detail page: machine config, resource history, and ping latency.
// Reached with Enter from the list (#/node/<uuid>). All drawing is text, like the cards.
import { esc, wcw, clip, stripEmoji, bytes, uptime, pct, ms, graph, bucketize, meter, box } from "./util.js";
import { pingRecords, loadRecords, invalidate } from "./api.js";

const RANGES = [[1, "1h"], [6, "6h"], [24, "24h"], [168, "7d"], [720, "30d"]];
const $ = (id) => document.getElementById(id);

export const HELP = ` detail
 ─────────────────────────────────────────
 h l  [ ]  ← →     previous / next time range
 o                 overview: config, resources
 p                 ping: latency per task
 Tab               switch overview / ping
 j k  ↓ ↑          ping: select task / scroll
 gg  G             top / bottom
 Enter             ping: zoom into a task
 u  Esc            back: unzoom, then node list
 R                 refresh now
 r                 replay banner effect
 t  T              next / prev palette
 s                 screensaver
 ?                 this help

 press ? u or Esc to close`;

export function createDetail(app) {
  const st = { uuid: null, tab: "overview", ri: 0, sel: 0, zoom: null };
  const slots = { ping: null, load: null }; // {key, at, value, err, loading, memo}
  let timer = 0, lastHTML = "", pendingG = 0, DW = 90;

  const node = () => app.nodes().find((n) => n.uuid === st.uuid);
  const ranges = () => {
    const max = Number(app.settings().ping_record_preserve_time) || 720;
    return RANGES.filter((r, i) => i < 2 || r[0] <= max);
  };
  const hours = () => (ranges()[Math.min(st.ri, ranges().length - 1)] || RANGES[0])[0];
  const rangeLabel = () => (ranges()[Math.min(st.ri, ranges().length - 1)] || RANGES[0])[1];
  const keyNow = () => `${st.uuid}|${hours()}`;

  // ---- data ----
  async function ensure(force) {
    if (!st.uuid) return;
    const u = st.uuid, h = hours(), key = keyNow(), jobs = [];
    if (force) invalidate(u);
    const run = (kind, fn) => {
      const s = slots[kind];
      if (s && s.key === key && !force && !s.err && !s.loading && Date.now() - s.at < 20000) return;
      slots[kind] = { key, at: s && s.key === key ? s.at : Date.now(), value: s && s.key === key ? s.value : null, loading: true };
      jobs.push(fn(u, h).then((value) => { if (keyNow() === key) slots[kind] = { key, at: Date.now(), value }; })
        .catch((e) => { if (keyNow() === key) slots[kind] = { key, at: Date.now(), value: null, err: e.message || "failed" }; }));
    };
    run("ping", pingRecords);
    if (st.tab === "overview") run("load", loadRecords);
    render();
    await Promise.all(jobs);
    render();
  }

  // ---- models (memoized per fetch and graph width) ----
  const memo = (slot, gw, build) => {
    if (!slot || !slot.value) return null;
    if (slot.memo && slot.memo.gw === gw) return slot.memo.m;
    const m = build(slot.value, slot.at);
    slot.memo = { gw, m };
    return m;
  };

  function pingModel(gw) {
    return memo(slots.ping, gw, (v, at) => {
      const end = at, start = end - hours() * 3600e3, n = gw * 2;
      const by = new Map();
      for (const r of v.records || []) {
        if (!by.has(r.task_id)) by.set(r.task_id, []);
        by.get(r.task_id).push({ t: Date.parse(r.time), v: r.value });
      }
      return (v.tasks || []).map((t) => {
        const p = (by.get(t.id) || []).sort((a, b) => a.t - b.t);
        const valid = p.filter((x) => x.v >= 0).map((x) => x.v);
        const b = bucketize(p, start, end, n);
        return { ...t, p, valid, last: p.length ? p[p.length - 1].v : null, vals: b.vals, lossB: b.loss, top: valid.length ? Math.max(...valid) : 0 };
      });
    });
  }

  function loadModel(gw) {
    return memo(slots.load, gw, (v, at) => {
      const recs = v.records || [], end = at, start = end - hours() * 3600e3, n = gw * 2;
      const mk = (f) => bucketize(recs.map((r) => ({ t: Date.parse(r.time), v: f(r) })), start, end, n).vals;
      const m = {
        count: recs.length,
        cpu: mk((r) => r.cpu), mem: mk((r) => (r.ram_total > 0 ? (r.ram / r.ram_total) * 100 : 0)),
        up: mk((r) => r.net_out), down: mk((r) => r.net_in), load: mk((r) => r.load),
      };
      return m;
    });
  }

  const stat = (vals) => {
    const xs = vals.filter((v) => v != null);
    if (!xs.length) return null;
    return { min: Math.min(...xs), max: Math.max(...xs), avg: xs.reduce((a, b) => a + b, 0) / xs.length };
  };
  const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

  // ---- rendering helpers ----
  const note = (b, text, cls = "d") => b.row([["", " "], [cls, text]]);
  const pairsRow = (b, pairs) => {
    const segs = [["", " "]];
    let w = 1;
    for (const [k, v, c] of pairs) {
      const sw = wcw(k) + 1 + wcw(String(v)) + 2;
      if (w + sw > b.I) break;
      segs.push(["d", k + " "], [c || "w", String(v) + "  "]);
      w += sw;
    }
    return b.row(segs);
  };
  const axis = (b, gw) => {
    const left = `-${rangeLabel()}`, right = "now";
    return b.row([["", " "], ["d", `${left} ${"─".repeat(Math.max(0, gw - left.length - right.length - 2))} ${right}`]]);
  };
  const padTo = (s, n) => s + " ".repeat(Math.max(0, n - wcw(s)));
  const dotClass = (t) => (t.last == null ? "d" : t.last < 0 ? "r" : t.last > 300 ? "y" : "g");

  // loss strip: a red × under every character cell that contains a lost sample
  const lossStrip = (b, t, gw) => {
    if (!t.lossB.some((x) => x > 0)) return null;
    const segs = [["", " "]];
    let run = "", cls = "";
    for (let c = 0; c < gw; c++) {
      const lost = (t.lossB[2 * c] || 0) + (t.lossB[2 * c + 1] || 0) > 0, k = lost ? "r" : "";
      if (k !== cls && run) { segs.push([cls, run]); run = ""; }
      cls = k; run += lost ? "×" : " ";
    }
    segs.push([cls, run]);
    return b.row(segs);
  };

  // ---- sections ----
  function configBox(I, n, r) {
    const b = box(I), L = [b.top(" config ")];
    const cycle = { 30: "month", 90: "quarter", 180: "half-year", 365: "year" };
    const exp = n.expired_at && new Date(n.expired_at).getFullYear() > 2000 ? new Date(n.expired_at) : null;
    const days = exp ? Math.ceil((exp - Date.now()) / 86400e3) : null;
    const cores = n.cpu_cores || (r && r.cpu.cores);
    const items = [
      ["os", n.os], ["arch", n.arch || (r && r.cpu.arch)], ["virt", n.virtualization], ["kernel", n.kernel_version],
      ["cpu", [n.cpu_name || (r && r.cpu.name), cores && `×${cores}`].filter(Boolean).join(" ") + (n.cpu_physical_cores ? ` (${n.cpu_physical_cores} physical)` : "")],
      ["gpu", n.gpu_name], ["memory", n.mem_total && bytes(n.mem_total)], ["swap", n.swap_total && bytes(n.swap_total)],
      ["disk", n.disk_total && bytes(n.disk_total)], ["region", stripEmoji(n.region)], ["group", n.group],
      ["tags", String(n.tags || "").split(";").filter(Boolean).join(" ")],
      ["price", n.price > 0 ? `${n.currency || "$"}${n.price}${n.billing_cycle ? " / " + (cycle[n.billing_cycle] || n.billing_cycle + "d") : ""}${n.auto_renewal ? " (auto)" : ""}` : ""],
      ["expires", exp ? `${exp.toISOString().slice(0, 10)} (${days >= 0 ? days + "d left" : "expired"})` : ""],
      ["traffic", n.traffic_limit > 0 ? `${bytes(n.traffic_limit)} ${n.traffic_limit_type || ""}` : ""],
      ["note", n.public_remark],
    ].filter(([, v]) => v);
    const two = I >= 72, colW = Math.floor((I - 1) / 2);
    for (let i = 0; i < items.length; i += two ? 2 : 1) {
      const cell = ([k, v], w) => [["d", padTo(k, 8)], ["", padTo(clip(String(v), w - 9), w - 8)]];
      L.push(b.row([["", " "], ...cell(items[i], two ? colW : I - 2), ...(two && items[i + 1] ? cell(items[i + 1], colW) : [])]));
    }
    L.push(b.bottom());
    return L.join("");
  }

  function resourcesBox(I, n, r) {
    const b = box(I), gw = I - 2, L = [b.top(" resources ", ` ${rangeLabel()} `)];
    const R = Math.min(26, Math.max(14, Math.floor(I * 0.3))), bl = Math.max(6, I - 6 - R - 1);
    const mrow = (label, p, right) => b.row([["d", ` ${label.padEnd(4)} `], ...meter(p / 100, bl), ["w", " " + clip(right, R)]]);
    const on = r && app.live().online.has(n.uuid);
    const ls = slots.load, lm = loadModel(gw);
    const hasHist = lm && lm.count > 0;
    const fmt = (s, f) => (s ? `avg ${f(s.avg)}  max ${f(s.max)}  min ${f(s.min)}` : "");
    const blockStats = (s, f) => { const t = fmt(s, f); if (t) L.push(note(b, t)); };

    const cpu = on ? r.cpu.usage : 0, mem = on ? pct(r.ram.used, n.mem_total || r.ram.total) : 0;
    L.push(mrow("cpu", cpu, on ? `${cpu.toFixed(1)}%${cores(n, r)}` : "-"));
    if (hasHist) { for (const g of graph(lm.cpu, gw, 3, 100)) L.push(b.row([["", " "], ["a", g]])); blockStats(stat(lm.cpu), (v) => v.toFixed(1) + "%"); }
    L.push(mrow("mem", mem, on ? `${mem.toFixed(1)}%  ${bytes(r.ram.used)}/${bytes(n.mem_total || r.ram.total)}` : "-"));
    if (hasHist) { for (const g of graph(lm.mem, gw, 2, 100)) L.push(b.row([["", " "], ["n", g]])); blockStats(stat(lm.mem), (v) => v.toFixed(1) + "%"); }
    const swapTotal = n.swap_total || (r && r.swap.total);
    if (on && swapTotal > 0) L.push(mrow("swap", pct(r.swap.used, swapTotal), `${pct(r.swap.used, swapTotal).toFixed(1)}%  ${bytes(r.swap.used)}/${bytes(swapTotal)}`));
    L.push(mrow("disk", on ? pct(r.disk.used, n.disk_total || r.disk.total) : 0, on ? `${pct(r.disk.used, n.disk_total || r.disk.total).toFixed(1)}%  ${bytes(r.disk.used)}/${bytes(n.disk_total || r.disk.total)}` : "-"));

    const net = (arrow, cls, bps, total, vals) => {
      L.push(b.row([["d", ` ${arrow} `], [cls, on ? `${bytes(bps)}/s` : "-"], ["d", on ? `   total ${bytes(total)}` : ""]]));
      if (hasHist) {
        const mx = Math.max(1024, ...vals.filter((v) => v != null));
        for (const g of graph(vals, gw, 2, mx)) L.push(b.row([["", " "], [cls, g]]));
        blockStats(stat(vals), (v) => bytes(v) + "/s");
      }
    };
    net("↑", "u", on ? r.network.up : 0, on ? r.network.totalUp : 0, lm ? lm.up : []);
    net("↓", "n", on ? r.network.down : 0, on ? r.network.totalDown : 0, lm ? lm.down : []);

    if (on) {
      L.push(b.row([["d", " load "], ["w", `${r.load.load1.toFixed(2)} ${r.load.load5.toFixed(2)} ${r.load.load15.toFixed(2)}`], ["d", `   conn tcp ${r.connections.tcp} udp ${r.connections.udp}`]]));
      if (hasHist) { const mx = Math.max(1, ...lm.load.filter((v) => v != null)); L.push(b.row([["", " "], ["y", graph(lm.load, gw, 1, mx)[0]]])); }
      for (const g of (r.gpu && r.gpu.detailed_info) || []) {
        L.push(b.row([["d", " gpu  "], ["", clip(g.name, I - 40)], ["w", `  ${g.utilization.toFixed(0)}%  ${bytes(g.memory_used)}/${bytes(g.memory_total)}  ${g.temperature}°C`]]));
      }
    }
    if (hasHist) {
      const left = `-${rangeLabel()}`, right = "now";
      L.push(b.row([["", " "], ["d", `${left} ${"─".repeat(Math.max(0, gw - left.length - right.length - 2))} ${right}`]]));
    } else if (!ls || ls.loading) L.push(note(b, "loading history…"));
    else if (ls.err) L.push(note(b, `history unavailable: ${ls.err}`, "r"));
    else L.push(note(b, "no history recorded for this range"));
    L.push(b.bottom());
    return L.join("");
  }
  const cores = (n, r) => (n.cpu_cores || (r && r.cpu.cores) ? `  ${n.cpu_cores || r.cpu.cores}c` : "");

  function pingSummaryBox(I) {
    const b = box(I), gw = I - 2 - 43 - 2, L = [b.top(" ping ", ` ${rangeLabel()} `)];
    const model = pingModel(Math.max(8, gw)), s = slots.ping;
    if (!model) {
      L.push(note(b, !s || s.loading ? "loading…" : s.err ? `unavailable: ${s.err}` : "no ping data", s && s.err ? "r" : "d"));
    } else if (!model.length) L.push(note(b, "no ping tasks for this node"));
    else {
      L.push(b.row([["d", `   ${"task".padEnd(16)} ${"last".padStart(7)} ${"avg".padStart(7)} ${"loss".padStart(6)}`]]));
      for (const t of model) {
        const lastTxt = t.last == null ? "-" : t.last < 0 ? "loss" : ms(t.last);
        const segs = [["", " "], [dotClass(t), "●"], ["", " "], ["w", padTo(clip(t.name, 16), 16)], ["", " "], ["w", lastTxt.padStart(7)], ["", " "],
          ["", (t.total ? ms(t.avg) : "-").padStart(7)], ["", " "], [t.loss > 0 ? "y" : "d", (t.total ? `${(+t.loss).toFixed(1)}%` : "-").padStart(6)]];
        if (gw >= 8) segs.push(["", "  "], ["n", graph(t.vals, gw, 1, Math.max(5, t.top * 1.1))[0]]);
        L.push(b.row(segs));
      }
      L.push(note(b, "p: full ping view"));
    }
    L.push(b.bottom());
    return L.join("");
  }

  function taskBlock(I, t, big) {
    const b = box(I), gw = I - 2, rows = big ? 8 : 4, L = [b.top(` ${t.name} `, ` ${t.type} · ${t.interval}s `)];
    const lastTxt = t.last == null ? "-" : t.last < 0 ? "loss" : ms(t.last);
    const total = t.total || t.p.length;
    L.push(pairsRow(b, [["last", lastTxt, t.last < 0 ? "r" : "w"], ["avg", total ? ms(t.avg) : "-"], ["min", total ? ms(t.min) : "-"], ["max", total ? ms(t.max) : "-"],
      ["loss", total ? `${(+t.loss).toFixed(1)}%` : "-", t.loss > 0 ? "y" : "w"], ["n", total]]));
    if (big && t.valid.length) {
      const s = [...t.valid].sort((a, c) => a - c);
      const mean = s.reduce((a, c) => a + c, 0) / s.length;
      const sd = Math.sqrt(s.reduce((a, c) => a + (c - mean) ** 2, 0) / s.length);
      const valids = t.p.filter((x) => x.v >= 0);
      let jit = 0;
      for (let i = 1; i < valids.length; i++) jit += Math.abs(valids[i].v - valids[i - 1].v);
      L.push(pairsRow(b, [["p50", ms(quantile(s, 0.5))], ["p95", ms(quantile(s, 0.95))], ["p99", ms(quantile(s, 0.99))], ["stddev", ms(sd)], ["jitter", ms(valids.length > 1 ? jit / (valids.length - 1) : 0)]]));
    }
    if (!t.valid.length) { L.push(note(b, t.p.length ? "all samples lost" : "no samples in this range", t.p.length ? "r" : "d")); L.push(b.bottom()); return L.join(""); }
    const top = Math.max(5, t.top * 1.1);
    for (const g of graph(t.vals, gw, rows, top)) L.push(b.row([["", " "], ["n", g]]));
    const ls = lossStrip(b, t, gw);
    if (ls) L.push(ls);
    L.push(axis(b, gw));
    L.push(note(b, `scale 0–${ms(top)}${slots.ping && slots.ping.value && slots.ping.value.records.length >= 600 ? "  (sampled)" : ""}`));
    L.push(b.bottom());
    return L.join("");
  }

  function pingTab(I) {
    const model = pingModel(I - 2), s = slots.ping, b = box(I);
    if (!model) return b.top(" ping ") + note(b, !s || s.loading ? "loading…" : s.err ? `unavailable: ${s.err}` : "no ping data", s && s.err ? "r" : "d") + b.bottom();
    if (!model.length) return b.top(" ping ") + note(b, "no ping tasks for this node") + b.bottom();
    st.sel = Math.min(st.sel, model.length - 1);
    if (st.zoom != null) {
      const t = model.find((x) => x.id === st.zoom);
      if (t) return `<div class="blk cur">${taskBlock(I, t, true)}</div>`;
      st.zoom = null;
    }
    return model.map((t, i) => `<div class="blk${i === st.sel ? " cur" : ""}">${taskBlock(I, t, false)}</div>`).join("");
  }

  function head(n, r) {
    const on = r && app.live().online.has(n.uuid);
    return `<div class="dhead"><span class="${on ? "g" : "r"}">●</span> ${on ? `up ${uptime(r.uptime)}` : "offline"}` +
      `<span class="d">  ${esc([stripEmoji(n.region), n.group].filter(Boolean).join(" · "))}</span></div>`;
  }

  function tabs() {
    const t = (id, key, label) => `<span class="tab${st.tab === id ? " on" : ""}" data-tab="${id}"> ${key} ${label} </span>`;
    const rs = ranges().map((r, i) => `<span class="tab${i === Math.min(st.ri, ranges().length - 1) ? " on" : ""}" data-range="${i}"> ${r[1]} </span>`).join("");
    return `<div class="ln tabs">${t("overview", "o", "overview")}${t("ping", "p", "ping")}<span class="sp"></span>${rs}</div>`;
  }

  function render() {
    if (!st.uuid) return;
    const n = node();
    if (!n) return;
    const I = DW - 2, r = app.live().data[n.uuid];
    let body;
    if (st.tab === "ping") body = pingTab(I);
    else body = configBox(I, n, r) + resourcesBox(I, n, r) + pingSummaryBox(I);
    const html = tabs() + head(n, r) + body;
    if (html === lastHTML) return;
    lastHTML = html;
    $("detail-body").innerHTML = html;
    app.status();
  }

  // ---- public ----
  function layout() {
    DW = Math.max(40, Math.min(110, Math.floor((innerWidth - 24) / app.cw())));
    $("detail").style.setProperty("--dw", DW);
    lastHTML = "";
    render();
  }

  function show(uuid) {
    if (st.uuid !== uuid) { st.tab = "overview"; st.sel = 0; st.zoom = null; slots.ping = slots.load = null; }
    st.uuid = uuid;
    $("detail").hidden = false;
    clearInterval(timer);
    timer = setInterval(() => { if (!document.hidden) ensure(); }, 30000);
    layout();
    ensure();
    window.scrollTo(0, 0);
  }
  function hide() {
    clearInterval(timer);
    st.uuid = null;
    $("detail").hidden = true;
    lastHTML = "";
  }

  function setTab(tab) {
    if (st.tab === tab) return;
    st.tab = tab; st.zoom = null;
    lastHTML = "";
    ensure();
    window.scrollTo(0, 0);
  }
  function stepRange(dir) {
    const next = Math.max(0, Math.min(ranges().length - 1, Math.min(st.ri, ranges().length - 1) + dir));
    if (next === st.ri) return;
    st.ri = next; st.zoom = null;
    lastHTML = "";
    ensure();
  }

  function key(e) {
    const k = e.key, g = pendingG && Date.now() - pendingG < 800;
    pendingG = 0;
    const inPing = st.tab === "ping" && st.zoom == null;
    const count = () => { const m = slots.ping && slots.ping.memo; return m ? m.m.length : 0; };
    const sel = (i) => { st.sel = Math.max(0, Math.min(count() - 1, i)); lastHTML = ""; render(); const el = document.querySelector(".blk.cur"); if (el) el.scrollIntoView({ block: "nearest" }); };
    switch (k) {
      case "h": case "ArrowLeft": case "[": stepRange(-1); return true;
      case "l": case "ArrowRight": case "]": stepRange(1); return true;
      case "o": setTab("overview"); return true;
      case "p": setTab("ping"); return true;
      case "Tab": setTab(st.tab === "ping" ? "overview" : "ping"); return true;
      case "j": case "ArrowDown": if (inPing) sel(st.sel + 1); else scrollBy({ top: 120 }); return true;
      case "k": case "ArrowUp": if (inPing) sel(st.sel - 1); else scrollBy({ top: -120 }); return true;
      case "g": if (g) { if (inPing) sel(0); scrollTo({ top: 0 }); } else pendingG = Date.now(); return true;
      case "G": if (inPing) sel(count() - 1); else scrollTo({ top: document.body.scrollHeight }); return true;
      case "Enter": if (inPing && count()) { st.zoom = slots.ping.memo.m[Math.min(st.sel, count() - 1)].id; lastHTML = ""; render(); scrollTo({ top: 0 }); } return true;
      case "u": case "Escape": case "Backspace":
        if (st.zoom != null) { st.zoom = null; lastHTML = ""; render(); } else app.back();
        return true;
      case "R": ensure(true); return true;
      case "r": app.replay(); return true;
      default: return false;
    }
  }

  $("detail-body").addEventListener("click", (e) => {
    const t = e.target.closest("[data-tab]"), r = e.target.closest("[data-range]"), blk = e.target.closest(".blk");
    if (t) setTab(t.dataset.tab);
    else if (r) { st.ri = +r.dataset.range; st.zoom = null; lastHTML = ""; ensure(); }
    else if (blk && st.tab === "ping" && st.zoom == null) {
      const i = [...blk.parentNode.querySelectorAll(".blk")].indexOf(blk), m = slots.ping && slots.ping.memo;
      if (m && m.m[i]) { st.sel = i; st.zoom = m.m[i].id; lastHTML = ""; render(); }
    }
  });

  return {
    show, hide, key, render, layout,
    active: () => !!st.uuid,
    info: () => {
      const n = node();
      return { mode: st.tab === "ping" ? (st.zoom != null ? "ZOOM" : "PING") : "DETAIL", name: n ? n.name : "", pos: rangeLabel() };
    },
  };
}
