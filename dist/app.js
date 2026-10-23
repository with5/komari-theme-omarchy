import { esc, txt, wcw, clip, stripEmoji, bytes, uptime, pct, graph, meter, box } from "./util.js";
import { getJSON } from "./api.js";
import { createDetail } from "./detail.js";
import { t as tr, getLang, setLang, onLang, detect } from "./i18n.js";

const $ = (id) => document.getElementById(id);
const PALETTES = window.OMARCHY_PALETTES || {};
const OFX = window.OFX;
const STORE = "omarchy-palette";
const HIST = 120; // live samples kept per node (2s each)
const FONT = '"JetBrainsMono Nerd Font","JetBrains Mono",ui-monospace,"Liberation Mono",monospace';

const store = {
  get: () => { try { return localStorage.getItem(STORE); } catch { return null; } },
  set: (v) => { try { v ? localStorage.setItem(STORE, v) : localStorage.removeItem(STORE); } catch {} },
};
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

let site = {};      // /api/public
let settings = {};  // site.theme_settings
let siteName = "komari";
let nodes = [];
let live = { online: new Set(), data: {} };
const hist = {}; // uuid -> {cpu, up, down}
let group = "", query = "", cursor = 0, kbd = false, curList = [];
let W = 44; // card width in characters
let banner, bannerText = "";

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
  sel.innerHTML = `<option value="">${tr("auto")}</option>` + paletteNames().map((n) => `<option value="${n}">${n}</option>`).join("");
  sel.value = chosenPalette() || "";
  sel.hidden = false;
  sel.onchange = () => { store.set(sel.value); applyPalette(currentPalette()); status(); };
}
dark.addEventListener("change", () => applyPalette(currentPalette()));

// ---- list card (a box drawn with text) ----
// Only metrics that are safe to show publicly: no processes, IPs or remarks.
function cardHTML(n, i) {
  const I = W - 2, b = box(I);
  const r = live.data[n.uuid];
  const on = live.online.has(n.uuid) && r;
  const h = hist[n.uuid] || { cpu: [], up: [], down: [] };
  const L = [];

  const right = n.group ? ` ${clip(n.group, 12)} ` : "";
  L.push(b.top(` ${String(i + 1).padStart(2, "0")} ${n.name} `, right));

  const state = on ? ` ${tr("up", { t: uptime(r.uptime) })}` : ` ${tr("offline")}`;
  const sub = [stripEmoji(n.region), n.os].filter(Boolean).join(" · ");
  const rem = I - 2 - wcw(state) - 3;
  L.push(b.row([["", " "], [on ? "g" : "r", "●"], ["", state], ...(rem > 6 && sub ? [["d", " · " + clip(sub, rem)]] : [])]));

  const bl = I - 5 - 7;
  const meterRow = (label, p, has) => b.row([["d", ` ${label} `], ...meter(p / 100, bl), ["w", (has ? p.toFixed(1) + "%" : "-").padStart(7) + " "]]);
  const cpu = on ? r.cpu.usage : 0, mem = on ? pct(r.ram.used, n.mem_total || r.ram.total) : 0, dsk = on ? pct(r.disk.used, n.disk_total || r.disk.total) : 0;
  L.push(meterRow("cpu", cpu, on));
  for (const g of graph(h.cpu, I - 2, 2, 100)) L.push(b.row([["", " "], ["a", g]]));
  L.push(meterRow("mem", mem, on));
  L.push(meterRow("dsk", dsk, on));

  const gw = I - 13;
  const net = (arrow, cls, bps, series) => {
    const mx = Math.max(1024, ...series.slice(-gw * 2));
    return b.row([[cls, ` ${arrow} `], ["w", (on ? bytes(bps) + "/s" : "-").padStart(8)], ["", " "], [cls, graph(series, gw, 1, mx)[0]]]);
  };
  L.push(net("↑", "u", on ? r.network.up : 0, h.up));
  L.push(net("↓", "n", on ? r.network.down : 0, h.down));
  L.push(b.bottom("[↵]"));
  return L.join("");
}

// ---- list view ----
const els = new Map();
let lastSig = "";
function cardEl(id) {
  let el = els.get(id);
  if (!el) {
    el = document.createElement("div");
    el.className = "card";
    el.dataset.id = id;
    els.set(id, el);
  }
  return el;
}

function summary() {
  let up = 0, down = 0, cpu = 0, k = 0;
  for (const n of nodes) {
    const r = live.data[n.uuid];
    if (r && live.online.has(n.uuid)) { up += r.network.up; down += r.network.down; cpu += r.cpu.usage; k++; }
  }
  $("summary").innerHTML = `<span class="${k ? "g" : "r"}">●</span> <b>${k}</b>/${nodes.length} ${txt(tr("online"))}` +
    `   <span class="u">↑ ${bytes(up)}/s</span>  <span class="n">↓ ${bytes(down)}/s</span>` + (k ? `   <span class="d">${txt(tr("cpuavg"))}</span> ${(cpu / k).toFixed(0)}%` : "");
}

function render() {
  const q = query.toLowerCase();
  const list = nodes.filter((n) => (!group || n.group === group) && (!q || `${n.name} ${n.group || ""}`.toLowerCase().includes(q)))
    .sort((a, b) => (b.weight || 0) - (a.weight || 0) || a.name.localeCompare(b.name));
  const sig = list.map((n) => n.uuid).join() + "|" + W;
  if (sig !== lastSig) { lastSig = sig; $("grid").replaceChildren(...list.map((n) => cardEl(n.uuid))); }
  curList = list;
  cursor = Math.max(0, Math.min(cursor, list.length - 1));
  list.forEach((n, i) => {
    const el = cardEl(n.uuid), html = cardHTML(n, i);
    if (el._h !== html) { el._h = html; el.innerHTML = html; }
    el.classList.toggle("off", !live.online.has(n.uuid));
    el.classList.toggle("cur", kbd && i === cursor);
  });
  $("empty").hidden = list.length > 0;

  summary();
  status();
}

function setupGroups() {
  const box = $("chips");
  const groups = [...new Set(nodes.map((n) => n.group).filter(Boolean))];
  if (settings.show_group === false || groups.length === 0) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = ["", ...groups].map((g) => `<button class="chip${g === group ? " on" : ""}" data-g="${esc(g)}">${txt(g || tr("all"))}</button>`).join("");
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
  const i = curList.findIndex((n) => n.uuid === c.dataset.id);
  if (i >= 0) cursor = i;
  openNode(c.dataset.id);
});

// ---- sizing ----
let cwCache = 0;
function charWidth() {
  if (!cwCache) {
    const x = document.createElement("canvas").getContext("2d");
    x.font = `15px ${FONT}`;
    cwCache = x.measureText("0").width || 9;
  }
  return cwCache;
}
function calcWidth() {
  W = Math.max(32, Math.min(46, Math.floor((innerWidth - 16) / charWidth())));
  $("grid").style.setProperty("--w", W);
}
function layout() {
  calcWidth();
  setBanner(bannerText, false);
  detail.layout();
  if (!detail.active()) render();
}

// ---- banner + screensaver ----
function linesFor(text) {
  text = (text || "komari").trim();
  return OFX.bigText(text) || ["", " " + text.toUpperCase(), ""];
}
function setBanner(text, play, effect) {
  bannerText = text;
  banner.set(linesFor(text), innerWidth - 24, 16);
  if (play) banner.play(effect);
}
const siteBanner = () => (settings.banner || siteName || "komari");
$("banner").addEventListener("click", () => banner.play());

let saver = null, saverBanner = null, saverTimer = 0, idleTimer = 0;
function startSaver() {
  if (saver || reduced.matches) return;
  saver = $("saver");
  saver.style.display = "flex";
  saverBanner = new OFX.Banner($("saver-cv"), color);
  saverBanner.set(linesFor(siteBanner()), innerWidth * 0.9, 44);
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

// ---- routing: #/node/<uuid> is the detail page; the URL path stays "/" so theme assets keep resolving ----
const detail = createDetail({
  nodes: () => nodes, live: () => live, settings: () => site, cw: charWidth,
  back: () => back(), replay: () => banner.play(), status: () => status(),
});
let fromList = false, listScroll = 0;

function openNode(id) { fromList = true; location.hash = "#/node/" + encodeURIComponent(id); }
function back() {
  if (fromList) { fromList = false; history.back(); } else location.replace("#/");
}
function route() {
  const m = /^#\/node\/(.+)$/.exec(location.hash);
  const id = m && decodeURIComponent(m[1]);
  const n = id && nodes.find((x) => x.uuid === id);
  if (n) {
    if (!detail.active()) listScroll = scrollY;
    $("list-view").hidden = true;
    detail.show(n.uuid);
    setBanner(n.name, settings.intro !== "off", settings.intro === "random" ? undefined : settings.intro);
  } else {
    const was = detail.active();
    if (was) detail.hide();
    $("list-view").hidden = false;
    if (was) { setBanner(siteBanner(), false); requestAnimationFrame(() => scrollTo(0, listScroll)); }
    render();
  }
  status();
}
addEventListener("hashchange", route);

// ---- vim-style keys ----
const help = $("help"), cmd = $("cmd"), cmdIn = $("cmd-in");
let count = "", pendingG = 0;

function openHelp() { help.textContent = tr(detail.active() ? "help.detail" : "help.list"); help.hidden = false; }

function status() {
  let mode = "NORMAL", name = "", pos = "", flt = "";
  if (detail.active()) {
    const i = detail.info();
    mode = i.mode; name = i.name; pos = i.pos;
  } else {
    const n = curList[cursor];
    name = n ? n.name : "";
    pos = curList.length ? `${cursor + 1}/${curList.length}` : "0/0";
    flt = [group && `@${group}`, query && `/${query}`, count].filter(Boolean).join(" ");
  }
  $("st-mode").textContent = mode;
  $("st-pos").textContent = pos;
  $("st-name").textContent = name;
  $("st-flt").textContent = flt;
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
  els.get(curList[cursor].uuid).scrollIntoView({ block: "nearest" });
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
const cycle = (list, cur, dir) => list[(list.indexOf(cur) + dir + list.length) % list.length];
function stepPalette(dir) {
  if (settings.allow_switch === false) return;
  const next = cycle(paletteNames(), currentPalette(), dir);
  store.set(next);
  $("palette").value = next;
  applyPalette(next);
}
function stepGroup(dir) {
  const gs = ["", ...new Set(nodes.map((n) => n.group).filter(Boolean))];
  if (gs.length < 2) return;
  group = cycle(gs, group, dir);
  setupGroups();
  render();
}
// u / Esc in the list: clear search, then clear group
function listBack() {
  if (query) { query = ""; render(); }
  else if (group) { group = ""; setupGroups(); render(); }
}
function openSearch() { cmd.hidden = false; cmdIn.value = query; cmdIn.focus(); }
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
  // keys that work on every page
  if (k === "?") { openHelp(); e.preventDefault(); return; }
  if (k === "i") { toggleLang(); e.preventDefault(); return; }
  if (k === "t") { stepPalette(1); status(); e.preventDefault(); return; }
  if (k === "T") { stepPalette(-1); status(); e.preventDefault(); return; }
  if (k === "s") { startSaver(); e.preventDefault(); return; }
  if (detail.active()) { if (detail.key(e)) e.preventDefault(); status(); return; }

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
    case "Enter": { const c = curList[cursor]; if (c) { kbd = true; openNode(c.uuid); } break; }
    case "u": case "Escape": case "Backspace": listBack(); break;
    case "/": openSearch(); break;
    case "H": stepGroup(-1); break;
    case "L": stepGroup(1); break;
    case "r": banner.play(); break;
    default: handled = false;
  }
  if (handled) e.preventDefault();
  status();
});
$("st-help").addEventListener("click", openHelp);
$("st-lang").addEventListener("click", toggleLang);

// ---- language ----
function applyStatic() {
  document.querySelectorAll("[data-i18n]").forEach((e) => { e.textContent = tr(e.dataset.i18n); });
  $("st-lang").textContent = tr("lang.label");
  $("cmd-in").placeholder = tr("search");
}
function toggleLang() { setLang(getLang() === "zh" ? "en" : "zh"); }
onLang(() => {
  applyStatic();
  setupPaletteSelect();
  setupGroups();
  lastSig = "";
  for (const el of els.values()) el._h = null;
  if (detail.active()) detail.layout();
  else render();
  status();
});
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
  if (detail.active()) { detail.render(); summary(); } else render();
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
setLang(detect(""), false);
applyStatic();
let rz;
addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(layout, 120); });
Promise.all([getJSON("/api/public").catch(() => ({})), getJSON("/api/nodes").catch(() => [])]).then(([pub, list]) => {
  site = pub || {};
  settings = site.theme_settings || {};
  if (site.sitename) { siteName = site.sitename; document.title = site.sitename; }
  nodes = Array.isArray(list) ? list : [];
  const lg = detect(settings.language);
  if (lg !== getLang()) setLang(lg, false);
  applyPalette(currentPalette());
  setupPaletteSelect();
  setupGroups();
  calcWidth();
  const opening = /^#\/node\//.test(location.hash);
  setBanner(siteBanner(), !opening && settings.intro !== "off", settings.intro === "random" ? undefined : settings.intro);
  render();
  connect();
  armIdle();
  if (opening) route();
});
