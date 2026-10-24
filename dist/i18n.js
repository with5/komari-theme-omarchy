// English / Chinese strings. Short metric labels (cpu, mem, disk, p50 ...) stay in English on purpose,
// like in a terminal; everything else is translated. Layout code counts display cells, so wide
// Chinese characters line up in the text-drawn boxes.

const STORE = "omarchy-lang";

const D = {
  en: {
    online: "online", offline: "offline", up: "up {t}", cpuavg: "cpu avg", nodes: "nodes", nonodes: "no nodes",
    all: "all", auto: "auto", help: "? help", admin: "admin", search: "search",
    "dur.d": "d", "dur.h": "h", "dur.m": "m", now: "now",
    "tab.overview": "overview", "tab.ping": "ping", "tab.unlock": "unlock",
    "ul.at": "probed {t}", "ul.legend": "● unlocked  ○ locked  v6 ipv6 only",
    "ul.r.0": "global", "ul.r.11": "ai", "ul.r.1": "taiwan", "ul.r.2": "hong kong", "ul.r.3": "japan", "ul.r.4": "korea",
    "ul.r.5": "north america", "ul.r.6": "south america", "ul.r.7": "europe", "ul.r.8": "africa", "ul.r.9": "southeast asia", "ul.r.10": "oceania",
    "sec.config": " config ", "sec.res": " resources ", "sec.ping": " ping ",
    "k.os": "os", "k.arch": "arch", "k.virt": "virt", "k.kernel": "kernel", "k.cpu": "cpu", "k.gpu": "gpu", "k.memory": "memory",
    "k.swap": "swap", "k.disk": "disk", "k.region": "region", "k.group": "group", "k.tags": "tags", "k.price": "price",
    "k.expires": "expires", "k.traffic": "traffic", "k.note": "note",
    "cycle.30": "month", "cycle.90": "quarter", "cycle.180": "half-year", "cycle.365": "year", "cycle.n": "{n}d",
    left: "{n}d left", expired: "expired", autorenew: " (auto)", physical: "{n} physical",
    load: " load ", conn: " conn ", total: "total", stats: "avg {a}  max {x}  min {n}",
    loading: "loading…", histErr: "history unavailable: {e}", noHist: "no history recorded for this range",
    "h.task": "task", "h.last": "last", "h.avg": "avg", "h.loss": "loss", lossWord: "loss",
    pingHint: "p: full ping view", noTasks: "no ping tasks for this node", noPing: "no ping data", unavailable: "unavailable: {e}",
    "s.last": "last", "s.avg": "avg", "s.min": "min", "s.max": "max", "s.loss": "loss", "s.n": "n",
    stddev: "stddev", jitter: "jitter", allLost: "all samples lost", noSamples: "no samples in this range",
    scale: "scale 0–{x}", sampled: "(sampled)",
    "lang.label": "EN",
    "help.list": ` keys
 ─────────────────────────────────────────
 h j k l  ←↓↑→     move between nodes
 gg  G             first / last node
 0  $              start / end of row
 3j  5G            number prefix repeats
 Enter             open node detail
 u  Esc            back: clear search,
                   clear group
 /                 search by name
 H  L              previous / next group
 t  T              next / prev palette
 r                 replay banner effect
 s                 screensaver
 i                 language: English / 中文
 a                 open admin panel
 ?                 this help

 press ? u or Esc to close`,
    "help.detail": ` detail
 ─────────────────────────────────────────
 h l  [ ]  ← →     previous / next time range
 o                 overview: config, resources
 p                 ping: latency per task
 c                 unlock: streaming / AI (needs the
                   unlock-test plugin)
 Tab               switch tabs
 j k  ↓ ↑          ping: select task / scroll
 gg  G             top / bottom
 Enter             ping: zoom into a task
 u  Esc            back: unzoom, then node list
 R                 refresh now
 r                 replay banner effect
 t  T              next / prev palette
 s                 screensaver
 i                 language: English / 中文
 a                 open admin panel
 ?                 this help

 press ? u or Esc to close`,
  },
  zh: {
    online: "在线", offline: "离线", up: "已运行 {t}", cpuavg: "CPU 均值", nodes: "节点", nonodes: "暂无节点",
    all: "全部", auto: "自动", help: "? 帮助", admin: "后台", search: "搜索",
    "dur.d": "天", "dur.h": "时", "dur.m": "分", now: "现在",
    "tab.overview": "概览", "tab.ping": "延迟", "tab.unlock": "解锁",
    "ul.at": "检测于 {t}", "ul.legend": "● 已解锁  ○ 未解锁  v6 仅 IPv6",
    "ul.r.0": "跨国平台", "ul.r.11": "AI 平台", "ul.r.1": "台湾", "ul.r.2": "香港", "ul.r.3": "日本", "ul.r.4": "韩国",
    "ul.r.5": "北美", "ul.r.6": "南美", "ul.r.7": "欧洲", "ul.r.8": "非洲", "ul.r.9": "东南亚", "ul.r.10": "大洋洲",
    "sec.config": " 配置 ", "sec.res": " 资源 ", "sec.ping": " Ping ",
    "k.os": "系统", "k.arch": "架构", "k.virt": "虚拟化", "k.kernel": "内核", "k.cpu": "处理器", "k.gpu": "显卡", "k.memory": "内存",
    "k.swap": "交换", "k.disk": "磁盘", "k.region": "地区", "k.group": "分组", "k.tags": "标签", "k.price": "价格",
    "k.expires": "到期", "k.traffic": "流量", "k.note": "备注",
    "cycle.30": "月", "cycle.90": "季", "cycle.180": "半年", "cycle.365": "年", "cycle.n": "{n}天",
    left: "剩余 {n} 天", expired: "已过期", autorenew: "（自动续费）", physical: "{n} 物理核",
    load: " 负载 ", conn: " 连接 ", total: "累计", stats: "平均 {a}  最高 {x}  最低 {n}",
    loading: "加载中…", histErr: "历史数据不可用：{e}", noHist: "此时间范围内没有历史记录",
    "h.task": "任务", "h.last": "最新", "h.avg": "平均", "h.loss": "丢包", lossWord: "丢包",
    pingHint: "p：查看完整延迟", noTasks: "该节点没有延迟任务", noPing: "没有延迟数据", unavailable: "不可用：{e}",
    "s.last": "最新", "s.avg": "平均", "s.min": "最低", "s.max": "最高", "s.loss": "丢包", "s.n": "样本",
    stddev: "标准差", jitter: "抖动", allLost: "全部丢包", noSamples: "此范围内没有样本",
    scale: "量程 0–{x}", sampled: "（已采样）",
    "lang.label": "中文",
    "help.list": ` 按键
 ─────────────────────────────────────────
 h j k l  ←↓↑→     在节点间移动
 gg  G             第一个 / 最后一个
 0  $              行首 / 行尾
 3j  5G            数字前缀重复动作
 Enter             打开节点详情
 u  Esc            返回：清除搜索、分组
 /                 按名称搜索
 H  L              上一个 / 下一个分组
 t  T              下一个 / 上一个调色板
 r                 重播横幅动画
 s                 屏保
 i                 语言：English / 中文
 a                 打开后台
 ?                 本帮助

 按 ? u 或 Esc 关闭`,
    "help.detail": ` 详情页
 ─────────────────────────────────────────
 h l  [ ]  ← →     上一个 / 下一个时间范围
 o                 概览：配置、资源
 p                 延迟：每个任务的 Ping
 c                 解锁：流媒体 / AI（需 unlock-test
                   插件）
 Tab               切换标签页
 j k  ↓ ↑          延迟页选任务 / 概览滚动
 gg  G             顶部 / 底部
 Enter             延迟页：放大当前任务
 u  Esc            返回：先退出放大，再回列表
 R                 立即刷新
 r                 重播横幅动画
 t  T              下一个 / 上一个调色板
 s                 屏保
 i                 语言：English / 中文
 a                 打开后台
 ?                 本帮助

 按 ? u 或 Esc 关闭`,
  },
};

let lang = "en";
const listeners = [];
export const getLang = () => lang;
export const onLang = (f) => listeners.push(f);

export function t(key, vars) {
  let s = D[lang][key] ?? D.en[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ""));
  return s;
}

// visitor's saved choice > admin default (en|zh) > Komari's "language" cookie > browser language
export function detect(adminDefault) {
  try { const s = localStorage.getItem(STORE); if (s === "en" || s === "zh") return s; } catch {}
  if (adminDefault === "en" || adminDefault === "zh") return adminDefault;
  const cookie = (document.cookie.match(/(?:^|;\s*)language=([^;]+)/) || [])[1];
  const raw = decodeURIComponent(cookie || navigator.language || "en").toLowerCase();
  return raw.startsWith("zh") ? "zh" : "en";
}

export function setLang(l, save = true) {
  lang = l === "zh" ? "zh" : "en";
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  if (save) { try { localStorage.setItem(STORE, lang); } catch {} }
  for (const f of listeners) f();
}
