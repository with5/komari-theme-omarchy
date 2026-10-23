(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const PALETTES = window.OMARCHY_PALETTES || {};
  const STORE = "omarchy-palette";
  const HIST = 120; // samples kept per node (2s each)
  const FONT = '"JetBrainsMono Nerd Font","JetBrains Mono",ui-monospace,"Liberation Mono",monospace';

  const unwrap = (j) => (j && typeof j === "object" && !Array.isArray(j) && "status" in j && "data" in j ? j.data : j);
  const getJSON = (url) => fetch(url, { credentials: "same-origin" }).then((r) => r.json()).then(unwrap);
  const store = {
    get: () => { try { return localStorage.getItem(STORE); } catch { return null; } },
    set: (v) => { try { v ? localStorage.setItem(STORE, v) : localStorage.removeItem(STORE); } catch {} },
  };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");

  let settings = {};
  let siteName = "komari";
  let nodes = [];
  let live = { online: new Set(), data: {} };
  const hist = {}; // uuid -> {cpu, up, down}
  let group = "";
  let W = 44; // card width in characters
  const open = new Set();
  let banner;
  let cursor = 0, kbd = false, query = "", curList = [];

  // ---- palette ----
  const dark = matchMedia("(prefers-color-scheme: dark)");
  const adminDefault = () => (dark.matches ? settings.palette_dark || "tokyo-night" : settings.palette_light || "catppuccin-latte");
  const colorCache = {};
  const TOKENS = { main: "accent", bright: "bright-foreground", dim: "muted", green: "green", cyan: "cyan", blue: "blue", orange: "orange", red: "red", yellow: "yellow" };
  const color = (tok) => colorCache[tok] || (colorCache[tok] = getComputedStyle(document.documentElement).getPropertyValue("--" + (TOKENS[tok] || tok)).trim() || "#888");

  function applyPalette(name) {
    const p = PALETTES[name] || PALETTES["tokyo-night"] || Object.values(PALETTES)[0];
    if (!p) return;
    const root = document.documentElement.style;
    const c = (k, fb) => p[k] || p[fb] || p.foreground;
    const vars = {
      background: c("background"), "dark-background": c("dark_background", "background"),
      "darker-background": c("darker_background", "background"), "lighter-background": c("lighter_background", "background"),
      foreground: c("foreground"), "dark-foreground": c("dark_foreground", "muted"),
      "light-foreground": c("light_foreground", "foreground"), "bright-foreground": c("bright_foreground", "foreground"),
      accent: c("accent", "blue"), selection: c("selection", "muted"), muted: c("muted", "selection"),
      red: c("red"), yellow: c("yellow"), orange: c("orange", "yellow"), green: c("green"),
      cyan: c("cyan", "blue"), blue: c("blue"), magenta: c("magenta", "accent"),
    };
    for (const [k, v] of Object.entries(vars)) root.setProperty("--" + k, v);
    root.colorScheme = p.mode === "light" ? "light" : "dark";
    for (const k in colorCache) delete colorCache[k];
    if (banner && !banner.raf) banner.drawStatic();
  }

  const paletteNames = () => Object.keys(PALETTES);
  const chosenPalette = () => { const c = settings.allow_switch === false ? null : store.get(); return PALETTES[c] ? c : null; };
  const currentPalette = () => chosenPalette() || adminDefault();

  function setupPaletteSelect() {
    const sel = $("palette");
    if (settings.allow_switch === false) { sel.hidden = true; return; }
    sel.innerHTML = '<option value="">auto</option>' + paletteNames().map((n) => `<option value="${n}">${n}</option>`).join("");
    sel.value = chosenPalette() || "";
    sel.hidden = false;
    sel.onchange = () => { store.set(sel.value); applyPalette(currentPalette()); };
  }
  dark.addEventListener("change", () => applyPalette(currentPalette()));

  // ---- text helpers (cells are monospace; CJK counts as 2) ----
  const wide = (c) => (c >= 0x1100 && c <= 0x115f) || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3) ||
    (c >= 0xf900 && c <= 0xfaff) || (c >= 0xfe30 && c <= 0xfe6f) || (c >= 0xff00 && c <= 0xff60) || (c >= 0xffe0 && c <= 0xffe6);
  const wcw = (s) => { let w = 0; for (const ch of s) w += wide(ch.codePointAt(0)) ? 2 : 1; return w; };
  const clip = (s, n) => {
    if (n <= 0) return "";
    if (wcw(s) <= n) return s;
    let out = "", w = 0;
    for (const ch of s) { const k = wide(ch.codePointAt(0)) ? 2 : 1; if (w + k > n - 1) break; out += ch; w += k; }
    return out + "…";
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const bytes = (n) => {
    n = Number(n) || 0;
    const u = ["B", "K", "M", "G", "T", "P"];
    let i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return (n >= 100 || i === 0 ? n.toFixed(0) : n.toFixed(1)) + u[i];
  };
  const uptime = (s) => {
    s = Number(s) || 0;
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
  };
  const pct = (used, total) => (total > 0 ? Math.min(100, (used / total) * 100) : 0);
  const stripEmoji = (s) => String(s || "").replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}️‍]/gu, "").trim();

  // btop-style braille area graph: 2 samples per character, 4 dots per row.
  const BL = [0x40, 0x04, 0x02, 0x01], BR = [0x80, 0x20, 0x10, 0x08];
  function graph(series, w, rows, max) {
    const n = w * 2, s = series.slice(-n), off = n - s.length;
    const cells = Array.from({ length: rows }, () => new Uint16Array(w));
    for (let i = off; i < n; i++) {
      const v = Math.min(1, Math.max(0, s[i - off] / max));
      const h = Math.max(1, Math.round(v * rows * 4)), dots = i & 1 ? BR : BL, cx = i >> 1;
      for (let r = 0; r < rows; r++) {
        const k = Math.min(4, Math.max(0, h - (rows - 1 - r) * 4));
        for (let d = 0; d < k; d++) cells[r][cx] |= dots[d];
      }
    }
    return cells.map((row) => Array.from(row, (b) => (b ? String.fromCharCode(0x2800 + b) : " ")).join(""));
  }

  // meter as colored zones, like btop's gradient: green -> yellow -> red by position
  function meter(frac, n) {
    const f = Math.round(Math.min(1, Math.max(0, frac)) * n), z1 = Math.floor(n * 0.6), z2 = Math.floor(n * 0.85);
    const segs = [["g", Math.min(f, z1)], ["y", Math.max(0, Math.min(f, z2) - z1)], ["r", Math.max(0, f - z2)], ["d", n - f]];
    return segs.filter((s) => s[1] > 0).map(([c, k]) => [c, (c === "d" ? "░" : "█").repeat(k)]);
  }

  // ---- card (a box drawn with text) ----
  // Only metrics that are safe to show publicly: no processes, IPs, kernel or remarks.
  function cardHTML(n, i, isOpen) {
    const I = W - 2;
    const r = live.data[n.uuid];
    const on = live.online.has(n.uuid) && r;
    const h = hist[n.uuid] || { cpu: [], up: [], down: [] };
    const B = (t) => `<span class="b">${t}</span>`;
    const row = (segs) => {
      let w = 0, out = "";
      for (const [c, t] of segs) { w += wcw(t); out += c ? `<span class="${c}">${esc(t)}</span>` : esc(t); }
      return `<div class="ln s"> ${out}${" ".repeat(Math.max(0, I - w))} </div>`;
    };
    const E = (html, k = "") => `<div class="ln ${k}">${html}</div>`; // text-drawn border line
    const L = [];

    const right = n.group ? ` ${clip(n.group, 12)} ` : "";
    const title = clip(` ${String(i + 1).padStart(2, "0")} ${n.name} `, I - 2 - wcw(right));
    L.push(E(B("┌─") + `<span class="w">${esc(title)}</span>` + B("─".repeat(Math.max(0, I - 2 - wcw(title) - wcw(right)))) + `<span class="d">${esc(right)}</span>` + B("─┐"), "t"));

    const state = on ? ` up ${uptime(r.uptime)}` : " offline";
    const sub = [stripEmoji(n.region), n.os].filter(Boolean).join(" · ");
    const rem = I - 2 - wcw(state) - 3;
    L.push(row([["", " "], [on ? "g" : "r", "●"], ["", state], ...(rem > 6 && sub ? [["d", " · " + clip(sub, rem)]] : [])]));

    const bl = I - 5 - 7;
    const meterRow = (label, p, hasVal) => row([["d", ` ${label} `], ...meter(p / 100, bl), ["w", (hasVal ? p.toFixed(1) + "%" : "-").padStart(7) + " "]]);
    const cpu = on ? r.cpu.usage : 0, mem = on ? pct(r.ram.used, n.mem_total || r.ram.total) : 0, dsk = on ? pct(r.disk.used, n.disk_total || r.disk.total) : 0;
    L.push(meterRow("cpu", cpu, on));
    for (const g of graph(h.cpu, I - 2, 2, 100)) L.push(row([["", " "], ["a", g]]));
    L.push(meterRow("mem", mem, on));
    L.push(meterRow("dsk", dsk, on));

    const gw = I - 13;
    const net = (arrow, cls, bps, series) => {
      const mx = Math.max(1024, ...series.slice(-gw * 2));
      return row([[cls, ` ${arrow} `], ["w", (on ? bytes(bps) + "/s" : "-").padStart(8)], ["", " "], [cls, graph(series, gw, 1, mx)[0]]]);
    };
    L.push(net("↑", "u", on ? r.network.up : 0, h.up));
    L.push(net("↓", "n", on ? r.network.down : 0, h.down));

    if (isOpen && on) {
      L.push(E(B("├" + "─".repeat(I) + "┤"), "s"));
      const kv = (k, v) => row([["d", ` ${k.padEnd(6)}`], ["", clip(String(v), I - 8)]]);
      L.push(kv("cpu", `${n.cpu_name || r.cpu.name || "-"} ×${n.cpu_cores || r.cpu.cores || "?"}`));
      L.push(kv("load", `${r.load.load1.toFixed(2)} ${r.load.load5.toFixed(2)} ${r.load.load15.toFixed(2)}`));
      L.push(kv("ram", `${bytes(r.ram.used)} / ${bytes(n.mem_total || r.ram.total)}`));
      if (r.swap && r.swap.total > 0) L.push(kv("swap", `${bytes(r.swap.used)} / ${bytes(r.swap.total)}`));
      L.push(kv("disk", `${bytes(r.disk.used)} / ${bytes(n.disk_total || r.disk.total)}`));
      L.push(kv("total", `↑${bytes(r.network.totalUp)} ↓${bytes(r.network.totalDown)}`));
      L.push(kv("conn", `tcp ${r.connections.tcp} udp ${r.connections.udp}`));
      if (n.arch) L.push(kv("arch", n.arch));
    }
    const tag = isOpen ? "[-]" : "[+]";
    L.push(E(B("└" + "─".repeat(I - tag.length - 1)) + `<span class="d">${tag}</span>` + B("─┘"), "u"));
    return L.join("");
  }

  // ---- render ----
  const els = new Map();
  let lastSig = "";
  function cardEl(id) {
    let el = els.get(id);
    if (!el) {
      el = document.createElement("div");
      el.className = "card";
      el.dataset.id = id;
      el.tabIndex = 0;
      els.set(id, el);
    }
    return el;
  }

  function render() {
    const list = nodes.filter((n) => (!group || n.group === group) && (!query || `${n.name} ${n.group || ""}`.toLowerCase().includes(query.toLowerCase())))
      .sort((a, b) => (b.weight || 0) - (a.weight || 0) || a.name.localeCompare(b.name));
    const sig = list.map((n) => n.uuid).join() + "|" + W;
    if (sig !== lastSig) { lastSig = sig; $("grid").replaceChildren(...list.map((n) => cardEl(n.uuid))); }
    curList = list;
    cursor = Math.max(0, Math.min(cursor, list.length - 1));
    list.forEach((n, i) => {
      const el = cardEl(n.uuid), html = cardHTML(n, i, open.has(n.uuid));
      if (el._h !== html) { el._h = html; el.innerHTML = html; }
      el.classList.toggle("off", !live.online.has(n.uuid));
      el.classList.toggle("open", open.has(n.uuid));
      el.classList.toggle("cur", kbd && i === cursor);
    });
    status();
    $("empty").hidden = list.length > 0;

    let up = 0, down = 0, cpu = 0, k = 0;
    for (const n of nodes) {
      const r = live.data[n.uuid];
      if (r && live.online.has(n.uuid)) { up += r.network.up; down += r.network.down; cpu += r.cpu.usage; k++; }
    }
    $("summary").innerHTML = `<span class="${k ? "g" : "r"}">●</span> <b>${k}</b>/${nodes.length} online` +
      `   <span class="u">↑ ${bytes(up)}/s</span>  <span class="n">↓ ${bytes(down)}/s</span>` + (k ? `   <span class="d">cpu avg</span> ${(cpu / k).toFixed(0)}%` : "");
  }

  function setupGroups() {
    const box = $("chips");
    const groups = [...new Set(nodes.map((n) => n.group).filter(Boolean))];
    if (settings.show_group === false || groups.length === 0) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = ["", ...groups].map((g) => `<button class="chip${g === group ? " on" : ""}" data-g="${esc(g)}">${g ? esc(g) : "all"}</button>`).join("");
  }
  $("chips").addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    group = b.dataset.g;
    setupGroups();
    render();
  });

  $("grid").addEventListener("click", (e) => {
    const c = e.target.closest(".card");
    if (!c) return;
    const id = c.dataset.id;
    const i = curList.findIndex((n) => n.uuid === id);
    if (i >= 0) cursor = i;
    open.has(id) ? open.delete(id) : open.add(id);
    render();
  });

  // ---- sizing ----
  function charWidth() {
    const x = document.createElement("canvas").getContext("2d");
    x.font = `15px ${FONT}`;
    return x.measureText("0").width || 7.8;
  }
  function calcWidth() {
    W = Math.max(32, Math.min(46, Math.floor((innerWidth - 16) / charWidth())));
    $("grid").style.setProperty("--w", W);
  }
  function layout() {
    calcWidth();
    drawBanner(false);
    render();
  }

  // ---- banner + screensaver ----
  function bannerLines() {
    const text = (settings.banner || siteName || "komari").trim();
    return OFX.bigText(text) || ["", " " + text.toUpperCase(), ""];
  }
  function drawBanner(play) {
    banner.set(bannerLines(), innerWidth - 24, 16);
    if (play) banner.play(settings.intro === "random" || !settings.intro ? undefined : settings.intro);
  }
  $("banner").addEventListener("click", () => banner.play());

  let saver = null, saverBanner = null, saverTimer = 0, idleTimer = 0;
  function startSaver() {
    if (saver || reduced.matches) return;
    saver = $("saver");
    saver.style.display = "flex";
    saverBanner = new OFX.Banner($("saver-cv"), color);
    saverBanner.set(bannerLines(), innerWidth * 0.9, 44);
    saverBanner.onDone = () => { saverTimer = setTimeout(() => saverBanner && saverBanner.play(), 2500); };
    saverBanner.play();
  }
  function stopSaver() {
    if (!saver) return;
    clearTimeout(saverTimer);
    saverBanner.stop();
    saverBanner.onDone = null;
    saver.style.display = "none";
    saver = saverBanner = null;
  }
  function armIdle() {
    clearTimeout(idleTimer);
    if (settings.screensaver !== false) idleTimer = setTimeout(startSaver, 90000);
  }
  for (const ev of ["pointermove", "pointerdown", "wheel", "touchstart", "keydown"]) {
    addEventListener(ev, () => { if (saver) stopSaver(); armIdle(); }, { passive: true });
  }

  // ---- vim-style keys ----
  // h j k l move, gg/G first/last, 0/$ row ends, <count> prefixes, Enter in, u out, / search, ? help
  const help = $("help"), cmd = $("cmd"), cmdIn = $("cmd-in");
  let count = "", pendingG = 0;

  function status() {
    const n = curList[cursor];
    $("st-pos").textContent = curList.length ? `${cursor + 1}/${curList.length}` : "0/0";
    $("st-name").textContent = n ? n.name : "";
    $("st-flt").textContent = [group && `@${group}`, query && `/${query}`, count].filter(Boolean).join(" ");
    $("st-pal").textContent = currentPalette();
  }
  function cols() {
    const cs = $("grid").children;
    if (!cs.length) return 1;
    const top = cs[0].offsetTop;
    let k = 0;
    while (k < cs.length && cs[k].offsetTop === top) k++;
    return k || 1;
  }
  function moveTo(i) {
    if (!curList.length) return;
    kbd = true;
    cursor = Math.max(0, Math.min(curList.length - 1, i));
    render();
    const el = els.get(curList[cursor].uuid);
    el.scrollIntoView({ block: "nearest" });
  }
  function moveRows(dir, n) {
    const c = cols(), len = curList.length;
    let i = cursor;
    for (let k = 0; k < n; k++) {
      let t = i + dir * c;
      if (t >= len && Math.floor(i / c) < Math.floor((len - 1) / c)) t = len - 1; // partial last row
      if (t < 0 || t >= len) break;
      i = t;
    }
    moveTo(i);
  }
  function cycle(list, cur, dir) { return list[(list.indexOf(cur) + dir + list.length) % list.length]; }
  function stepPalette(dir) {
    if (settings.allow_switch === false) return;
    const next = cycle(paletteNames(), currentPalette(), dir);
    store.set(next);
    $("palette").value = next;
    applyPalette(next);
    status();
  }
  function stepGroup(dir) {
    const gs = ["", ...new Set(nodes.map((n) => n.group).filter(Boolean))];
    if (gs.length < 2) return;
    group = cycle(gs, group, dir);
    setupGroups();
    render();
  }
  // u / Esc: close help -> collapse card -> clear search -> clear group
  function back() {
    if (!help.hidden) { help.hidden = true; return; }
    const n = curList[cursor];
    if (n && open.has(n.uuid)) { open.delete(n.uuid); render(); }
    else if (query) { query = ""; render(); }
    else if (group) { group = ""; setupGroups(); render(); }
  }
  function openSearch() {
    cmd.hidden = false;
    cmdIn.value = query;
    cmdIn.focus();
  }
  function closeSearch(keep) {
    if (!keep) query = "";
    cmd.hidden = true;
    cmdIn.blur();
    moveTo(0);
    if (!curList.length) render();
  }
  cmdIn.addEventListener("input", () => { query = cmdIn.value.trim(); cursor = 0; render(); });
  cmdIn.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); closeSearch(true); }
    else if (e.key === "Escape") { e.preventDefault(); closeSearch(false); }
  });

  addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    const k = e.key;
    if (!help.hidden) { if (k === "?" || k === "u" || k === "Escape" || k === "q") { help.hidden = true; e.preventDefault(); } return; }
    if (/^[0-9]$/.test(k) && (k !== "0" || count)) { count += k; status(); return; }
    const n = parseInt(count, 10) || 1, hadCount = !!count;
    count = "";
    const g = pendingG && Date.now() - pendingG < 800;
    pendingG = 0;
    let handled = true;
    switch (k) {
      case "h": case "ArrowLeft": moveTo(cursor - n); break;
      case "l": case "ArrowRight": moveTo(cursor + n); break;
      case "j": case "ArrowDown": moveRows(1, n); break;
      case "k": case "ArrowUp": moveRows(-1, n); break;
      case "g": if (g) moveTo(hadCount ? n - 1 : 0); else pendingG = Date.now(); break;
      case "G": moveTo(hadCount ? n - 1 : curList.length - 1); break;
      case "0": { const c = cols(); moveTo(cursor - (cursor % c)); break; }
      case "$": { const c = cols(); moveTo(Math.min(curList.length - 1, cursor - (cursor % c) + c - 1)); break; }
      case "Enter": { const c = curList[cursor]; if (c) { kbd = true; open.add(c.uuid); render(); } break; }
      case "u": case "Escape": case "Backspace": back(); break;
      case "/": openSearch(); break;
      case "H": stepGroup(-1); break;
      case "L": stepGroup(1); break;
      case "t": stepPalette(1); break;
      case "T": stepPalette(-1); break;
      case "r": banner.play(); break;
      case "s": startSaver(); break;
      case "?": help.hidden = false; break;
      default: handled = false;
    }
    if (handled) e.preventDefault();
    status();
  });
  $("st-help").addEventListener("click", () => { help.hidden = false; });
  help.addEventListener("click", () => { help.hidden = true; });

  // ---- live data ----
  let ws, timer, wantLive = true;
  const push = (arr, v) => { arr.push(v); if (arr.length > HIST) arr.shift(); };
  function onData(d) {
    live = { online: new Set(d.online || []), data: d.data || {} };
    for (const id of live.online) {
      const r = live.data[id];
      if (!r) continue;
      const h = hist[id] || (hist[id] = { cpu: [], up: [], down: [] });
      push(h.cpu, r.cpu.usage); push(h.up, r.network.up); push(h.down, r.network.down);
    }
    render();
  }
  function connect() {
    if (!wantLive) return;
    ws = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/api/clients");
    ws.onopen = () => { ws.send("get"); timer = setInterval(() => ws.readyState === 1 && ws.send("get"), 2000); };
    ws.onmessage = (e) => { const m = JSON.parse(e.data); onData(m.data || m); };
    ws.onclose = () => { clearInterval(timer); if (wantLive) setTimeout(connect, 3000); };
  }
  // no polling while the tab is in the background
  document.addEventListener("visibilitychange", () => {
    wantLive = !document.hidden;
    if (wantLive) connect(); else { clearInterval(timer); ws && ws.close(); }
  });

  // ---- boot ----
  banner = new OFX.Banner($("banner"), color);
  applyPalette("tokyo-night");
  let rz;
  addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(layout, 120); });
  Promise.all([getJSON("/api/public").catch(() => ({})), getJSON("/api/nodes").catch(() => [])]).then(([pub, list]) => {
    settings = (pub && pub.theme_settings) || {};
    if (pub && pub.sitename) { siteName = pub.sitename; document.title = pub.sitename; }
    nodes = Array.isArray(list) ? list : [];
    applyPalette(currentPalette());
    setupPaletteSelect();
    setupGroups();
    calcWidth();
    drawBanner(settings.intro !== "off");
    render();
    connect();
    armIdle();
  });
})();
