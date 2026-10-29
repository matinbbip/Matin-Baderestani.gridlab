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
const stamps = [];
function throttled(fn, limited) {
  const run = chain.then(async () => {
    const wait = Math.max(0, lastCall + 380 - Date.now());
    if (wait) await sleep(wait);
    if (limited) {
      const now = Date.now(); while (stamps.length && now - stamps[0] > 60000) stamps.shift();
      if (stamps.length >= 28) await sleep(stamps[0] + 60000 - Date.now() + 50);
      stamps.push(Date.now());
    }
    try { return await fn(); } finally { lastCall = Date.now(); }
  });
  chain = run.catch(() => {});
  return run;
}
async function fetchJson(url) {
  const isF1 = url.indexOf(BASE) === 0;
  for (let a = 0; a < 6; a++) {
    const r = await throttled(() => fetch(url), isF1);
    if (r.status === 429) { await sleep(1500 * (a + 1)); continue; }
    if (r.status === 404) return [];
    if (!r.ok) {
      let m = ''; try { const j = await r.json(); m = j.detail || j.message || ''; } catch (e) { /* ignore */ }
      const err = new Error((isF1 ? 'OpenF1' : 'The data service') + ' answered ' + r.status + (m ? ': ' + (typeof m === 'string' ? m : JSON.stringify(m)) : ''));
      err.status = r.status; err.live = isF1 && (r.status === 401 || r.status === 403); throw err;
    }
    return r.json();
  }
  throw new Error('Rate limit reached. Wait a minute and reload the page.');
}
const mem = new Map();
G.ttl = 14 * 864e5;
G.cached = async function (url, ttl) {
  ttl = ttl || G.ttl;
  if (mem.has(url)) return mem.get(url);
  const hit = await cget(url);
  if (hit && Date.now() - hit.t < ttl) { mem.set(url, hit.v); return hit.v; }
  /* if the service is down or locked, an old saved copy is better than nothing */
  const p = fetchJson(url).then(v => { cset(url, { t: Date.now(), v }); return v; }, e => { if (hit) return hit.v; throw e; });
  mem.set(url, p);
  try { const v = await p; mem.set(url, v); return v; } catch (e) { mem.delete(url); throw e; }
};
G.api = function (path, params, ttl) {
  params = params || {};
  const qs = Object.entries(params).map(([k, v]) => /[<>]=?$/.test(k) ? k + encodeURIComponent(v) : k + '=' + encodeURIComponent(v)).join('&');
  return G.cached(BASE + '/' + path + (qs ? '?' + qs : ''), ttl);
};

/* ---------- race list ---------- */
const mkRace = (s, m, round) => {
  const d = new Date(G.ts(s.date_start)), cur = new Date().getFullYear();
  return {
    key: s.session_key, meeting: s.meeting_key, year: s.year, round,
    name: m.meeting_name || ((s.country_name || 'Race') + ' Grand Prix'),
    country: s.country_name || m.country_name || '', location: s.location || m.location || '',
    circuit: s.circuit_short_name || m.circuit_short_name || '',
    date: d, dateLabel: d.toLocaleDateString('en-GB', Object.assign({ day: 'numeric', month: 'short' }, s.year !== cur ? { year: 'numeric' } : {})),
    dateLong: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    recent: Date.now() - G.ts(s.date_end) < 864e5
  };
};
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
  /* a race weekend that has started but whose race has not finished yet (practice and qualifying are already available) */
  G.weekend = null;
  try {
    const up = sess.filter(s => G.ts(s.date_end) >= now).sort((a, b) => G.ts(a.date_start) - G.ts(b.date_start))[0];
    if (up && G.ts(up.date_start) - now < 4 * 864e5) {
      const ws = await G.api('sessions', { meeting_key: up.meeting_key }, 3e5);
      if (ws.some(x => G.ts(x.date_end) != null && G.ts(x.date_end) < now)) G.weekend = Object.assign(mkRace(up, meetings.get(up.meeting_key) || {}, roundOf.get(up.session_key)), { weekend: true });
    }
  } catch (e) { /* optional */ }
  return sess.filter(s => G.ts(s.date_end) != null && G.ts(s.date_end) < now)
    .sort((a, b) => G.ts(b.date_start) - G.ts(a.date_start)).slice(0, 5)
    .map(s => mkRace(s, meetings.get(s.meeting_key) || {}, roundOf.get(s.session_key)));
};
/* any race by session key (used by the season archive) */
G.raceFromKey = async function (key) {
  const ss = await G.api('sessions', { session_key: key }, 36e5), s = ss[0]; if (!s) return null;
  const ms = await G.api('meetings', { meeting_key: s.meeting_key }, 36e5);
  let round; try {
    const yr = await G.api('sessions', { year: s.year, session_name: 'Race' }, 36e5);
    const idx = yr.slice().sort((x, y) => G.ts(x.date_start) - G.ts(y.date_start)).findIndex(x => x.session_key === s.session_key);
    round = idx >= 0 ? idx + 1 : undefined;
  } catch (e) { /* round is optional */ }
  return mkRace(s, ms[0] || {}, round);
};

/* ---------- header / boot ---------- */
const PAGES = [['overview.html', 'Overview', 'overview'], ['calendar.html', 'Calendar', 'calendar'], ['sessions.html', 'Sessions', 'sessions'], ['timing.html', 'Timing', 'timing'], ['sectors.html', 'Mini-sectors', 'sectors'], ['strategy.html', 'Strategy', 'strategy'], ['onboard.html', 'Onboard', 'onboard'], ['championship.html', 'Championship', 'championship'], ['archive.html', 'Archive', 'archive']];
G.loading = m => '<div class="loading"><span class="pulse"></span><p>' + esc(m) + '</p></div>';
const JOL = 'https://api.jolpi.ca/ergast/f1/';
const histTtl = y => y >= new Date().getFullYear() ? 36e5 : 30 * 864e5;
G.jol = async function (path, ttl) { const j = await G.cached(JOL + path, ttl || 36e5); return (j && j.MRData) || null; };
/* OpenF1 switches its free access off from 30 min before a session until 30 min after it ends */
G.lockInfo = async function () {
  try {
    const m = await G.jol(new Date().getFullYear() + '.json?limit=100', 36e5), now = Date.now();
    const KEYS = [['FirstPractice', 60], ['SecondPractice', 60], ['ThirdPractice', 60], ['SprintQualifying', 50], ['SprintShootout', 50], ['Sprint', 40], ['Qualifying', 60]];
    let best = null;
    for (const r of (m && m.RaceTable && m.RaceTable.Races) || []) {
      for (const it of KEYS.map(k => [r[k[0]], k[1]]).concat([[r, 120]])) {
        const o = it[0]; if (!o || !o.date) continue;
        let t = o.time || '00:00:00Z'; if (!/Z|[+-]\d\d:?\d\d$/.test(t)) t += 'Z';
        const s = Date.parse(o.date + 'T' + t); if (isNaN(s)) continue;
        const a = s - 30 * 60e3, b = s + it[1] * 60e3 + 30 * 60e3;
        if (now >= a && now <= b && (!best || b > best.end)) best = { start: s, end: b };
      }
    }
    return best;
  } catch (e) { return null; }
};
G.fail = function (e) {
  console.error(e);
  const m = (e && e.message) || String(e), net = /Failed to fetch|NetworkError|Load failed/i.test(m), a = document.getElementById('app');
  const maybeLock = (e && e.live) || net;
  a.innerHTML = '<div class="note err"><b id="errh">' + (maybeLock ? 'No data from OpenF1 right now' : 'Could not load data') + '</b><p id="errp">' +
    esc(maybeLock ? 'The browser could not get data from api.openf1.org. The most common reason on a race weekend is that OpenF1 pauses its free service, past races included, from 30 minutes before a session starts until 30 minutes after it ends.' : m) +
    '</p><div class="links" id="errl"><button class="btn" id="retry" type="button">Try again</button><a class="lk" href="calendar.html">Calendar</a><a class="lk" href="archive.html">Season archive</a></div></div>';
  document.getElementById('retry').onclick = () => location.reload();
  if (maybeLock) {
    G.lockInfo().then(li => {
      const p = document.getElementById('errp'); if (!p) return;
      if (li) p.textContent = 'A live session is on right now, so OpenF1 has paused its free service. Past races come back around ' + new Date(li.end).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' your time. Until then, the links below still work, and races you opened before are saved in your browser.';
      else p.textContent = 'No live session is scheduled right now, so this may be a connection problem or OpenF1 being busy. Check your connection and try again in a minute.';
    });
  }
  G.jol('current/last/results.json?limit=100', 36e5).then(mm => {
    const r = mm && mm.RaceTable && mm.RaceTable.Races && mm.RaceTable.Races[0], l = document.getElementById('errl');
    if (r && l) l.insertAdjacentHTML('beforeend', '<a class="lk main" href="classic.html?y=' + r.season + '&r=' + r.round + '">Latest results: ' + esc(r.raceName) + '</a>');
  }).catch(() => {});
};

/* ---------- season + Grand Prix picker and full-season race bar in the header ---------- */
G.picker = async function (o) {
  const host = document.getElementById('races'); if (!host) return;
  host.style.display = '';
  const nowY = new Date().getFullYear(), years = []; for (let y = nowY; y >= 2020; y--) years.push(y);
  let items = [], tok = 0, year = o.year || nowY;
  host.innerHTML = '<div class="pickrow"><label class="pick"><span>Season</span><select id="pkY" aria-label="Season">' + years.map(y => '<option value="' + y + '"' + (y === year ? ' selected' : '') + '>' + y + '</option>').join('') + '</select></label>' +
    '<label class="pick"><span>Grand Prix</span><select id="pkG" aria-label="Grand Prix"><option>Loading…</option></select></label></div><div class="chiprow" id="chiprow" aria-label="All races of the season"></div>';
  const selY = host.querySelector('#pkY'), selG = host.querySelector('#pkG'), row = host.querySelector('#chiprow');
  const urlFor = (it, yy) => it.key && (o.mode === 'openf1' || it.weekend) ? (it.weekend ? 'sessions.html' : (o.file || 'overview.html')) + '?s=' + it.key : 'classic.html?y=' + yy + '&r=' + it.round;
  async function fill(y, pre) {
    const t = ++tok; selG.innerHTML = '<option>Loading…</option>'; selG.disabled = true; row.innerHTML = '<span class="muted" style="font-size:12.5px;align-self:center">Loading races…</span>';
    let list = [];
    try {
      const m = await G.jol(y + '.json?limit=100', histTtl(y));
      list = ((m && m.RaceTable && m.RaceTable.Races) || []).map(r => {
        const st = Date.parse(r.date + 'T' + (r.time || '12:00:00Z'));
        return { round: Number(r.round), name: r.raceName, short: String(r.raceName || '').replace(/ Grand Prix$/, ''), date: r.date, done: st + 2.5 * 36e5 < Date.now(), key: null };
      });
    } catch (e) { /* OpenF1 below */ }
    if (y >= 2023) {
      try {
        const ss = await G.api('sessions', { year: y, session_name: 'Race' }, 36e5);
        if (list.length) list.forEach(it => { const s = ss.find(x => Math.abs(Date.parse(String(x.date_start).slice(0, 10)) - Date.parse(it.date)) <= 864e5); if (s) it.key = s.session_key; });
        else {
          const ms = await G.api('meetings', { year: y }, 36e5), mm = new Map(ms.map(x => [x.meeting_key, x]));
          list = ss.sort((p, q) => G.ts(p.date_start) - G.ts(q.date_start)).map((s, i) => { const nm = (mm.get(s.meeting_key) || {}).meeting_name || s.country_name; return { round: i + 1, name: nm, short: String(nm).replace(/ Grand Prix$/, ''), date: String(s.date_start).slice(0, 10), done: G.ts(s.date_end) < Date.now(), key: s.session_key }; });
        }
      } catch (e) { /* classic links only */ }
    }
    if (G.weekend && y === nowY) {
      const w = list.find(it => it.key === G.weekend.key);
      if (w) w.weekend = true;
      else list.push({ round: G.weekend.round || list.length + 1, name: G.weekend.name, short: G.weekend.name.replace(/ Grand Prix$/, ''), date: String(G.weekend.date.toISOString()).slice(0, 10), done: false, key: G.weekend.key, weekend: true });
    }
    if (t !== tok) return;
    items = list;
    const cur = it => pre && (o.mode === 'openf1' ? it.key === o.key : it.round === o.round);
    const open = items.map((it, i) => ({ it, i })).filter(x => x.it.done || x.it.weekend);
    const at = open.findIndex(x => cur(x.it));
    selG.innerHTML = (at < 0 ? '<option value="" disabled selected>' + (open.length ? 'Choose a race' : 'No races yet') + '</option>' : '') +
      open.map((x, k) => '<option value="' + x.i + '"' + (k === at ? ' selected' : '') + '>R' + x.it.round + ' · ' + esc(x.it.name) + (x.it.weekend ? ' (this weekend)' : '') + '</option>').join('');
    selG.disabled = !open.length;
    row.innerHTML = items.length ? items.map(it => {
      const d = new Date(it.date + 'T12:00:00Z'), sub = it.weekend ? 'This weekend' : 'R' + it.round + ' · ' + d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const live = it.done || it.weekend;
      return live ? '<a class="race' + (cur(it) ? ' on' : '') + (it.weekend ? ' wk' : '') + '" href="' + urlFor(it, y) + '"><b>' + esc(it.short) + '</b><span>' + sub + '</span></a>'
        : '<span class="race off" title="Not raced yet"><b>' + esc(it.short) + '</b><span>' + sub + '</span></span>';
    }).join('') : '<span class="muted" style="font-size:12.5px;align-self:center">No races found for ' + y + '.</span>';
    const on = row.querySelector('.race.on'); row.scrollLeft = on ? Math.max(0, on.offsetLeft - row.clientWidth / 2 + on.offsetWidth / 2) : 0;
  }
  selY.onchange = () => { year = Number(selY.value); fill(year, false); };
  selG.onchange = () => { const it = items[Number(selG.value)]; if (it) location.href = urlFor(it, selY.value); };
  row.addEventListener('wheel', e => { if (row.scrollWidth > row.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { row.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
  fill(year, true);
};

G.boot = async function (page, opts) {
  const hdr = document.getElementById('hdr');
  const entry = PAGES.find(p => p[2] === page) || PAGES[0];
  hdr.innerHTML = '<div class="bar"><a class="brand" href="index.html"><span class="lights"><i></i><i></i><i></i><i></i><i></i></span>Matin Baderestani Gridlab</a><nav class="nav" aria-label="Sections">' +
    PAGES.map(p => '<a data-p="' + p[0] + '" href="' + p[0] + '"' + (p[2] === page ? ' class="on" aria-current="page"' : '') + '>' + p[1] + '</a>').join('') +
    '</nav></div><div class="races" id="races" aria-label="Choose a race"></div>';
  if (opts && opts.light) {
    const rb = document.getElementById('races');
    if (opts.classic) G.picker({ mode: 'classic', year: opts.classic.year, round: opts.classic.round }); else if (rb) rb.style.display = 'none';
    document.title = entry[1] + ' · Matin Baderestani Gridlab';
    return { light: true };
  }
  document.getElementById('app').innerHTML = G.loading('Finding the latest races…');
  let races;
  try { races = await G.loadRaces(); } catch (e) { G.picker({ mode: 'classic' }); G.fail(e); return null; }
  if (!races.length) { G.fail(new Error('No finished races were found in the OpenF1 archive yet.')); return null; }
  const q = new URLSearchParams(location.search).get('s');
  let saved = null; try { saved = localStorage.getItem('gridlab-race'); } catch (e) { /* ignore */ }
  let sel = races.find(r => String(r.key) === q), chips = races;
  if (!sel && G.weekend && String(G.weekend.key) === q) sel = G.weekend;
  if (!sel && q) {
    try { const ex = await G.raceFromKey(q); if (ex) { sel = ex; chips = [ex].concat(races); } } catch (e) { /* fall back to the latest race */ }
  }
  if (!sel) sel = races.find(r => String(r.key) === saved) || races[0];
  try { localStorage.setItem('gridlab-race', sel.key); } catch (e) { /* ignore */ }
  G.race = sel; G.races = races; G.ttl = sel.recent ? 10 * 60e3 : 14 * 864e5;
  G.picker({ mode: 'openf1', file: entry[0], year: sel.year, key: sel.key });
  G.$$('.nav a', hdr).forEach(a => { a.href = a.dataset.p + '?s=' + sel.key; });
  document.title = entry[1] + ' · ' + sel.name + ' ' + sel.year + ' · Matin Baderestani Gridlab';
  if (sel.weekend && page !== 'sessions') {
    document.getElementById('app').innerHTML = '<h1>' + esc(sel.name) + '</h1><p class="lede">The race has not been run yet, so there are no race laps, tyre stints or overtakes to analyse. Practice and qualifying results are ready.</p><p style="margin-top:20px"><a class="btn big" href="sessions.html?s=' + sel.key + '">Open practice and qualifying</a></p>';
    return null;
  }
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

/* ---------- visitor counter (free Abacus service, abacus.jasoncameron.dev). Every page load is one view. ---------- */
G.views = async function () {
  const f = document.querySelector('footer'); if (!f) return;
  const base = 'https://abacus.jasoncameron.dev/', ns = 'matin-baderestani-gridlab', d = new Date(), iso = d.toISOString(), day = iso.slice(0, 10), mon = iso.slice(0, 7);
  const call = async (key, act) => {
    try { const r = await fetch(base + (act === 'up' ? 'hit' : 'get') + '/' + ns + '/' + key); if (!r.ok) return null; const j = await r.json(); const v = j && (j.value != null ? j.value : j.count); return typeof v === 'number' ? v : null; }
    catch (e) { return null; }
  };
  const out = await Promise.all([call('site-views', 'up'), call('month-' + mon, 'up'), call('day-' + day, 'up')]);
  if (out[0] == null && out[1] == null && out[2] == null) return;
  const fmt = v => v == null ? '–' : v.toLocaleString('en-US'), monthName = (y, m) => new Date(Date.UTC(y, m, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  f.insertAdjacentHTML('beforeend', '<div class="views"><span>Views today <b class="num">' + fmt(out[2]) + '</b></span><span>' + monthName(d.getUTCFullYear(), d.getUTCMonth()) + ' <b class="num">' + fmt(out[1]) + '</b></span><span>All time <b class="num">' + fmt(out[0]) + '</b></span></div>' +
    '<details class="vm"><summary>Views by month</summary><div class="vml" id="vml">Loading…</div></details>');
  const det = f.querySelector('.vm'); let loaded = false;
  det.addEventListener('toggle', async () => {
    if (!det.open || loaded) return; loaded = true;
    const rows = [];
    for (let k = 0; k < 6; k++) { const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - k, 1)); const key = dt.toISOString().slice(0, 7); rows.push([monthName(dt.getUTCFullYear(), dt.getUTCMonth()), k === 0 ? out[1] : await call('month-' + key, 'get')]); }
    f.querySelector('#vml').innerHTML = rows.map(r => '<div><span>' + r[0] + '</span><b class="num">' + fmt(r[1] == null ? 0 : r[1]) + '</b></div>').join('');
  });
};
/* ---------- footer: link to the author's GitHub profile ---------- */
G.footerLinks = function () {
  const f = document.querySelector('footer'); if (!f) return;
  f.insertAdjacentHTML('beforeend', '<p class="fl" style="margin:14px 0 0"><a href="https://github.com/matinbbip" target="_blank" rel="noopener me" style="display:inline-flex;align-items:center;gap:8px;color:var(--ink);font-weight:600;text-decoration:none"><svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>GitHub</a></p>');
};
G.footerLinks();
G.views();
})();
