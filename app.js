/* Matin Baderestani Gridlab core: OpenF1 client (throttled + cached), helpers, header, charts */
(function () {
'use strict';
const BASE = 'https://api.openf1.org/v1';
const G = window.G = {};
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- tiny helpers ---------- */
G.$ = (s, r) => (r || document).querySelector(s);
G.$$ = (s, r) => [...(r || document).querySelectorAll(s)];
G.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const esc = G.esc;
G.ts = s => { if (!s) return null; const t = Date.parse(String(s).replace(/(\.\d{3})\d+/, '$1')); return isNaN(t) ? null : t; };
G.lapTime = s => { if (s == null || isNaN(s)) return '–'; const m = Math.floor(s / 60); return m + ':' + (s - m * 60).toFixed(3).padStart(6, '0'); };
G.lapTick = s => { const m = Math.floor(s / 60); return m + ':' + (s - m * 60).toFixed(1).padStart(4, '0'); };
G.sec = (s, d) => (s == null || isNaN(s)) ? '–' : Number(s).toFixed(d == null ? 3 : d);
G.raceTime = s => {
  if (s == null) return '–';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s - h * 3600 - m * 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + r.toFixed(3).padStart(6, '0');
};
G.median = a => { const b = a.filter(x => x != null).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };
G.bsearch = (arr, v) => { let lo = 0, hi = arr.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (arr[m] <= v) { r = m; lo = m + 1; } else hi = m - 1; } return r; };
G.yt = q => 'https://www.youtube.com/@Formula1/search?query=' + encodeURIComponent(q);
G.f1tv = 'https://f1tv.formula1.com/';

G.COMPOUND = {
  SOFT: { c: '#ff4b4b', l: 'Soft', s: 'S' }, MEDIUM: { c: '#f5c518', l: 'Medium', s: 'M' },
  HARD: { c: '#e9edf1', l: 'Hard', s: 'H' }, INTERMEDIATE: { c: '#3bc46b', l: 'Intermediate', s: 'I' },
  WET: { c: '#3b8bff', l: 'Wet', s: 'W' }
};
G.cmp = n => G.COMPOUND[String(n || '').toUpperCase()] || { c: '#8d9ba9', l: n || 'Unknown', s: '?' };
G.cdot = n => { const c = G.cmp(n); return '<span class="cdot" style="--c:' + c.c + '" title="' + esc(c.l) + '">' + c.s + '</span>'; };
G.SEG = {
  2048: { c: 'var(--yellow)', l: 'Slower than personal best' },
  2049: { c: 'var(--green)', l: 'Personal best' },
  2051: { c: 'var(--purple)', l: 'Overall best' },
  2064: { c: '#5b7a99', l: 'Pit lane' }
};
G.seg = v => G.SEG[v] || { c: 'var(--line)', l: 'No data' };

/* ---------- IndexedDB cache ---------- */
const STORE = 'kv';
let dbp = null;
function getDb() {
  if (dbp) return dbp;
  dbp = new Promise(res => {
    try {
      const r = indexedDB.open('gridlab-cache', 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    } catch (e) { res(null); }
  });
  return dbp;
}
async function cget(k) {
  try {
    const db = await getDb(); if (!db) return null;
    return await new Promise(res => { const q = db.transaction(STORE).objectStore(STORE).get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); });
  } catch (e) { return null; }
}
async function cset(k, v) { try { const db = await getDb(); if (db) db.transaction(STORE, 'readwrite').objectStore(STORE).put(v, k); } catch (e) { /* ignore */ } }

/* ---------- throttled fetch ---------- */
let chain = Promise.resolve(), lastCall = 0;
function throttled(fn) {
  const run = chain.then(async () => {
    const wait = Math.max(0, lastCall + 380 - Date.now());
    if (wait) await sleep(wait);
    try { return await fn(); } finally { lastCall = Date.now(); }
  });
  chain = run.catch(() => {});
  return run;
}
async function fetchJson(url) {
  for (let a = 0; a < 6; a++) {
    const r = await throttled(() => fetch(url));
    if (r.status === 429) { await sleep(1500 * (a + 1)); continue; }
    if (r.status === 404) return [];
    if (!r.ok) {
      let m = ''; try { const j = await r.json(); m = j.detail || j.message || ''; } catch (e) { /* ignore */ }
      const err = new Error('OpenF1 answered ' + r.status + (m ? ': ' + (typeof m === 'string' ? m : JSON.stringify(m)) : ''));
      err.status = r.status; throw err;
    }
    return r.json();
  }
  throw new Error('OpenF1 rate limit reached. Wait a minute and reload the page.');
}
const mem = new Map();
G.ttl = 14 * 864e5;
G.api = async function (path, params, ttl) {
  params = params || {}; ttl = ttl || G.ttl;
  const qs = Object.entries(params).map(([k, v]) => /[<>]=?$/.test(k) ? k + encodeURIComponent(v) : k + '=' + encodeURIComponent(v)).join('&');
  const url = BASE + '/' + path + (qs ? '?' + qs : '');
  if (mem.has(url)) return mem.get(url);
  const hit = await cget(url);
  if (hit && Date.now() - hit.t < ttl) { mem.set(url, hit.v); return hit.v; }
  const p = fetchJson(url).then(v => { cset(url, { t: Date.now(), v }); return v; });
  mem.set(url, p);
  try { const v = await p; mem.set(url, v); return v; } catch (e) { mem.delete(url); throw e; }
};

/* ---------- race list ---------- */
G.loadRaces = async function () {
  const now = Date.now(), y = new Date().getFullYear();
  let sess = [];
  for (const yr of [y, y - 1, y - 2]) {
    const s = await G.api('sessions', { year: yr, session_name: 'Race' }, 36e5);
    sess = sess.concat(s);
    if (sess.filter(x => G.ts(x.date_end) < now).length >= 5) break;
  }
  const meetings = new Map();
  for (const yr of [...new Set(sess.map(s => s.year))]) {
    const ms = await G.api('meetings', { year: yr }, 36e5);
    ms.forEach(m => meetings.set(m.meeting_key, m));
  }
  const roundOf = new Map();
  [...new Set(sess.map(s => s.year))].forEach(yr => {
    sess.filter(s => s.year === yr).sort((a, b) => G.ts(a.date_start) - G.ts(b.date_start)).forEach((s, i) => roundOf.set(s.session_key, i + 1));
  });
  return sess.filter(s => G.ts(s.date_end) != null && G.ts(s.date_end) < now)
    .sort((a, b) => G.ts(b.date_start) - G.ts(a.date_start)).slice(0, 5)
    .map(s => {
      const m = meetings.get(s.meeting_key) || {};
      const d = new Date(G.ts(s.date_start));
      return {
        key: s.session_key, meeting: s.meeting_key, year: s.year, round: roundOf.get(s.session_key),
        name: m.meeting_name || ((s.country_name || 'Race') + ' Grand Prix'),
        country: s.country_name || m.country_name || '', location: s.location || m.location || '',
        circuit: s.circuit_short_name || m.circuit_short_name || '',
        date: d, dateLabel: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        dateLong: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
        recent: now - G.ts(s.date_end) < 864e5
      };
    });
};

/* ---------- header / boot ---------- */
const PAGES = [['index.html', 'Overview', 'overview'], ['timing.html', 'Timing', 'timing'], ['sectors.html', 'Mini-sectors', 'sectors'], ['strategy.html', 'Strategy', 'strategy'], ['onboard.html', 'Onboard', 'onboard']];
G.loading = m => '<div class="loading"><span class="pulse"></span><p>' + esc(m) + '</p></div>';
G.fail = function (e) {
  console.error(e);
  let m = (e && e.message) || String(e);
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) m = 'The browser could not reach api.openf1.org. Check your connection. OpenF1 can also be unavailable while a live session is running.';
  const a = document.getElementById('app');
  a.innerHTML = '<div class="note err"><b>Could not load data</b><p>' + esc(m) + '</p><button class="btn" id="retry" type="button">Try again</button></div>';
  document.getElementById('retry').onclick = () => location.reload();
};
G.boot = async function (page) {
  const hdr = document.getElementById('hdr');
  const file = PAGES.find(p => p[2] === page)[0];
  hdr.innerHTML = '<div class="bar"><a class="brand" href="index.html"><span class="lights"><i></i><i></i><i></i><i></i><i></i></span>Matin Baderestani Gridlab</a><nav class="nav" aria-label="Sections">' +
    PAGES.map(p => '<a data-p="' + p[0] + '" href="' + p[0] + '"' + (p[2] === page ? ' class="on" aria-current="page"' : '') + '>' + p[1] + '</a>').join('') +
    '</nav></div><div class="races" id="races" aria-label="Choose a race"></div>';
  document.getElementById('app').innerHTML = G.loading('Finding the latest races…');
  let races;
  try { races = await G.loadRaces(); } catch (e) { G.fail(e); return null; }
  if (!races.length) { G.fail(new Error('No finished races were found in the OpenF1 archive yet.')); return null; }
  const q = new URLSearchParams(location.search).get('s');
  let saved = null; try { saved = localStorage.getItem('gridlab-race'); } catch (e) { /* ignore */ }
  const sel = races.find(r => String(r.key) === q) || races.find(r => String(r.key) === saved) || races[0];
  try { localStorage.setItem('gridlab-race', sel.key); } catch (e) { /* ignore */ }
  G.race = sel; G.races = races; G.ttl = sel.recent ? 10 * 60e3 : 14 * 864e5;
  document.getElementById('races').innerHTML = races.map(r =>
    '<a class="race' + (r.key === sel.key ? ' on' : '') + '" href="' + file + '?s=' + r.key + '"><b>' + esc(r.country || r.name) + '</b><span>R' + (r.round || '') + ' · ' + r.dateLabel + '</span></a>').join('');
  G.$$('.nav a', hdr).forEach(a => { a.href = a.dataset.p + '?s=' + sel.key; });
  document.title = PAGES.find(p => p[2] === page)[1] + ' · ' + sel.name + ' ' + sel.year + ' · Matin Baderestani Gridlab';
  return sel;
};

/* ---------- data helpers ---------- */
const cap = s => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
G.getDrivers = async function (sk) {
  const raw = await G.api('drivers', { session_key: sk });
  const map = new Map();
  for (const d of raw) {
    if (map.has(d.driver_number)) continue;
    let last = d.last_name || '';
    if (last && last === last.toUpperCase()) last = cap(last);
    const name = ((d.first_name || '') + ' ' + last).trim() || (d.full_name ? cap(d.full_name) : '#' + d.driver_number);
    map.set(d.driver_number, Object.assign({}, d, { color: '#' + String(d.team_colour || '8d9ba9').replace('#', ''), acr: d.name_acronym || String(d.driver_number), name }));
  }
  return { list: [...map.values()], map };
};
G.getResult = async function (sk) {
  let rows = [];
  try { rows = await G.api('session_result', { session_key: sk }); } catch (e) { rows = []; }
  if (rows && rows.length) {
    return rows.map(r => ({
      num: r.driver_number, pos: r.position == null ? null : r.position, laps: r.number_of_laps == null ? null : r.number_of_laps,
      time: typeof r.duration === 'number' ? r.duration : null, gap: r.gap_to_leader == null ? null : r.gap_to_leader,
      status: r.dsq ? 'DSQ' : r.dns ? 'DNS' : r.dnf ? 'DNF' : ''
    })).sort((a, b) => (a.pos == null ? 99 : a.pos) - (b.pos == null ? 99 : b.pos));
  }
  const pos = await G.api('position', { session_key: sk });
  const last = new Map();
  for (const p of pos) { const c = last.get(p.driver_number); if (!c || p.date > c.date) last.set(p.driver_number, p); }
  return [...last.values()].map(p => ({ num: p.driver_number, pos: p.position, laps: null, time: null, gap: null, status: '' })).sort((a, b) => a.pos - b.pos);
};
G.groupLaps = function (laps) {
  const m = new Map();
  for (const l of laps) { if (!m.has(l.driver_number)) m.set(l.driver_number, []); m.get(l.driver_number).push(l); }
  for (const a of m.values()) a.sort((p, q) => p.lap_number - q.lap_number);
  return m;
};
G.tyreAt = function (stints, num, lap) {
  for (const s of stints) {
    if (s.driver_number !== num) continue;
    const a = s.lap_start, b = s.lap_end == null ? Infinity : s.lap_end;
    if (lap >= a && lap <= b) return { compound: s.compound, age: (s.tyre_age_at_start || 0) + (lap - a) };
  }
  return null;
};
G.pitField = function (pits) {
  for (const k of ['stop_duration', 'lane_duration', 'pit_duration']) if (pits.some(p => typeof p[k] === 'number' && p[k] > 0)) return k;
  return null;
};
G.lapWindow = function (L, n, med) {
  const cur = L.find(l => l.lap_number === n), next = L.find(l => l.lap_number === n + 1);
  let s = cur ? G.ts(cur.date_start) : null, e = next ? G.ts(next.date_start) : null;
  const dur = cur && cur.lap_duration > 0 ? cur.lap_duration * 1000 : null;
  if (s != null && e == null && dur != null) e = s + dur;
  if (s == null && e != null) s = e - (dur != null ? dur : (med || 95) * 1000 + 14000);
  if (s == null || e == null || e <= s) return null;
  return { start: s, end: e };
};
G.projector = function (pts, W, H, pad) {
  let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
  for (const p of pts) { if (p[0] < a) a = p[0]; if (p[0] > b) b = p[0]; if (p[1] < c) c = p[1]; if (p[1] > d) d = p[1]; }
  const rx = (b - a) || 1, ry = (d - c) || 1, s = Math.min((W - 2 * pad) / rx, (H - 2 * pad) / ry);
  const ox = (W - rx * s) / 2, oy = (H - ry * s) / 2;
  return (x, y) => [ox + (x - a) * s, H - (oy + (y - c) * s)];
};
G.chip = (d, on) => '<button type="button" class="chip" data-n="' + d.driver_number + '" aria-pressed="' + (on ? 'true' : 'false') + '" style="--c:' + d.color + '"><i class="dot"></i>' + esc(d.acr) + '</button>';
G.dcell = d => '<span class="tc" style="--tc:' + d.color + '"></span><b>' + esc(d.acr) + '</b> <span class="muted">' + esc(d.name) + '</span>';

/* ---------- line chart ---------- */
G.lineChart = function (host, cfg) {
  host.classList.add('chart');
  function draw() {
    const W = Math.max(280, host.clientWidth || 600), H = cfg.height || 300;
    const m = { l: cfg.yWide ? 58 : 48, r: 12, t: 12, b: 28 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
    const xs = [], ys = [];
    for (const s of cfg.series) for (const p of s.pts) if (p.y != null) { xs.push(p.x); ys.push(p.y); }
    if (!xs.length) { host.innerHTML = '<p class="note">Nothing to plot for this selection.</p>'; return; }
    const x0 = cfg.xMin != null ? cfg.xMin : Math.min(...xs), x1 = cfg.xMax != null ? cfg.xMax : Math.max(...xs);
    let y0 = cfg.yMin != null ? cfg.yMin : Math.min(...ys), y1 = cfg.yMax != null ? cfg.yMax : Math.max(...ys);
    if (y0 === y1) { y0 -= 1; y1 += 1; }
    if (cfg.yMin == null) y0 -= (y1 - y0) * 0.05;
    if (cfg.yMax == null) y1 += (y1 - y0) * 0.05;
    const sx = x => m.l + (x1 === x0 ? 0 : (x - x0) / (x1 - x0)) * iw;
    const sy = y => cfg.invertY ? m.t + (y - y0) / (y1 - y0) * ih : m.t + ih - (y - y0) / (y1 - y0) * ih;
    const yt = cfg.yTicks || [0, 1, 2, 3, 4].map(i => y0 + (y1 - y0) * i / 4);
    const raw = (x1 - x0) / 8, step = raw <= 1 ? 1 : raw <= 2 ? 2 : raw <= 5 ? 5 : Math.ceil(raw / 5) * 5;
    const xt = []; for (let v = Math.ceil(x0 / step) * step; v <= x1; v += step) xt.push(v);
    let g = '';
    yt.forEach(v => { const y = sy(v); g += '<line class="grid" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y + '" y2="' + y + '"/><text class="tick" x="' + (m.l - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + (cfg.yFmt ? cfg.yFmt(v) : Math.round(v * 100) / 100) + '</text>'; });
    xt.forEach(v => { g += '<text class="tick" x="' + sx(v) + '" y="' + (H - 8) + '" text-anchor="middle">' + v + '</text>'; });
    cfg.series.forEach(s => {
      let d = '', pen = false;
      for (const p of s.pts) { if (p.y == null) { pen = false; continue; } d += (pen ? 'L' : 'M') + sx(p.x).toFixed(1) + ',' + sy(p.y).toFixed(1); pen = true; }
      s._m = new Map(s.pts.map(p => [p.x, p.y]));
      g += '<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="' + (s.w || 2) + '"' + (s.dash ? ' stroke-dasharray="' + s.dash + '"' : '') + ' stroke-linejoin="round" stroke-linecap="round"/>';
    });
    g += '<line class="guide" y1="' + m.t + '" y2="' + (m.t + ih) + '" style="display:none"/>';
    host.innerHTML = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(cfg.label || 'Chart') + '">' + g + '</svg><div class="tip" hidden></div>';
    const svg = host.querySelector('svg'), tip = host.querySelector('.tip'), guide = host.querySelector('.guide');
    function move(e) {
      const r = svg.getBoundingClientRect(), px = e.clientX - r.left;
      const xv = Math.round(x0 + (px - m.l) / iw * (x1 - x0));
      if (xv < x0 || xv > x1) { out(); return; }
      const rows = cfg.series.map(s => ({ s, y: s._m.get(xv) })).filter(o => o.y != null).sort((a, b) => a.y - b.y);
      if (!rows.length) { out(); return; }
      guide.style.display = ''; guide.setAttribute('x1', sx(xv)); guide.setAttribute('x2', sx(xv));
      tip.innerHTML = '<b>' + (cfg.xName || 'Lap') + ' ' + xv + '</b>' + rows.map(o => '<div><span><i style="background:' + o.s.color + '"></i>' + esc(o.s.name) + '</span><span class="num">' + (cfg.tipFmt ? cfg.tipFmt(o.y) : (cfg.yFmt ? cfg.yFmt(o.y) : o.y)) + '</span></div>').join('');
      tip.hidden = false;
      const tw = tip.offsetWidth; let left = sx(xv) + 12; if (left + tw > W) left = sx(xv) - tw - 12; tip.style.left = Math.max(0, left) + 'px';
    }
    function out() { tip.hidden = true; guide.style.display = 'none'; }
    svg.addEventListener('pointermove', move); svg.addEventListener('pointerleave', out);
  }
  draw();
  if (!host._ro && window.ResizeObserver) {
    host._w = host.clientWidth;
    host._ro = new ResizeObserver(() => { if (host._w !== host.clientWidth) { host._w = host.clientWidth; draw(); } });
    host._ro.observe(host);
  }
  return { update(c) { cfg = c; draw(); } };
};
})();
