/* Gridlab pages: each page is its own HTML file, this file holds their logic */
(function () {
'use strict';
const { $, $$, esc } = G;
const pages = {};
const head = race => '<h1>' + esc(race.name) + '</h1><p class="lede">' + esc(race.circuit) + (race.location ? ', ' + esc(race.location) : '') + ' · ' + race.dateLong + '</p>';
const rngDefault = (arr, n) => arr.slice(0, n);

/* =========================================================
   OVERVIEW
   ========================================================= */
pages.overview = async function () {
  const race = await G.boot('overview'); if (!race) return;
  const app = $('#app'); app.innerHTML = G.loading('Loading the race…');
  let dr, laps, stints, pits, res, ots;
  try {
    [dr, laps, stints, pits, res, ots] = await Promise.all([
      G.getDrivers(race.key), G.api('laps', { session_key: race.key }), G.api('stints', { session_key: race.key }),
      G.api('pit', { session_key: race.key }), G.getResult(race.key), G.api('overtakes', { session_key: race.key }).catch(() => [])]);
  } catch (e) { return G.fail(e); }
  const D = n => dr.map.get(n);
  let fl = null, ts = null;
  for (const l of laps) {
    if (l.lap_duration > 0 && (!fl || l.lap_duration < fl.lap_duration)) fl = l;
    if (l.st_speed > 0 && (!ts || l.st_speed > ts.st_speed)) ts = l;
  }
  const pf = G.pitField(pits); let fp = null;
  if (pf) for (const p of pits) { const v = p[pf]; if (v > 0 && v < 90 && (!fp || v < fp[pf])) fp = p; }
  const oc = new Map(); (ots || []).forEach(o => { const n = o.overtaking_driver_number; if (n != null) oc.set(n, (oc.get(n) || 0) + 1); });
  const topOt = [...oc.entries()].sort((a, b) => b[1] - a[1])[0];
  const flD = fl && D(fl.driver_number), flTy = fl && G.tyreAt(stints, fl.driver_number, fl.lap_number);
  const ob = (n, lap) => 'onboard.html?s=' + race.key + '&d=' + n + '&lap=' + lap;

  const cards = [];
  cards.push('<div class="stat"><small>Fastest lap of the race</small><div class="v p">' + (fl ? G.lapTime(fl.lap_duration) : '–') + '</div><div class="s">' +
    (flD ? '<b>' + esc(flD.name) + '</b>, lap ' + fl.lap_number + (flTy ? ' on ' + esc(G.cmp(flTy.compound).l.toLowerCase()) + ' tyres' : '') : 'No lap data') + '</div>' +
    (flD ? '<div class="links"><a class="lk" href="' + ob(fl.driver_number, fl.lap_number) + '">Replay this lap</a><a class="lk" target="_blank" rel="noopener" href="' + G.yt(race.name + ' ' + race.year + ' ' + flD.name + ' fastest lap onboard') + '">Official video</a></div>' : '') + '</div>');
  cards.push('<div class="stat"><small>Highest speed trap</small><div class="v">' + (ts ? ts.st_speed + ' km/h' : '–') + '</div><div class="s">' +
    (ts && D(ts.driver_number) ? '<b>' + esc(D(ts.driver_number).name) + '</b>, lap ' + ts.lap_number : 'No data') + '</div></div>');
  cards.push('<div class="stat"><small>' + (pf === 'stop_duration' ? 'Fastest pit stop' : 'Fastest pit lane time') + '</small><div class="v">' + (fp ? G.sec(fp[pf], 2) + ' s' : '–') + '</div><div class="s">' +
    (fp && D(fp.driver_number) ? '<b>' + esc(D(fp.driver_number).name) + '</b>, lap ' + fp.lap_number : 'No pit data') + '</div></div>');
  cards.push('<div class="stat"><small>Most overtakes</small><div class="v">' + (topOt ? topOt[1] : '–') + '</div><div class="s">' +
    (topOt && D(topOt[0]) ? '<b>' + esc(D(topOt[0]).name) + '</b>' + '<div class="links"><a class="lk" href="onboard.html?s=' + race.key + '&d=' + topOt[0] + '&lap=1">See the passes</a></div>' : 'No overtake data published') + '</div></div>');

  let prevGap = null;
  const rows = res.map(r => {
    const d = D(r.num); if (!d) return '';
    let t = '–';
    if (r.pos === 1) { t = r.time != null ? G.raceTime(r.time) : '–'; prevGap = 0; }
    else if (typeof r.gap === 'number') { t = '+' + (prevGap != null ? r.gap - prevGap : r.gap).toFixed(3); prevGap = r.gap; }
    else if (r.gap) { t = esc(r.gap); prevGap = null; }
    if (r.status) t = r.status;
    return '<tr><td class="n"><span class="pos">' + (r.pos == null ? '–' : r.pos) + '</span></td><td>' + G.dcell(d) + (fl && fl.driver_number === r.num ? '<span class="pill" title="Fastest lap">FL</span>' : '') + '</td><td class="muted">' + esc(d.team_name || '') + '</td><td class="n r">' + (r.laps == null ? '–' : r.laps) + '</td><td class="n r">' + t + '</td><td class="r"><a class="lk" href="' + ob(r.num, 1) + '">Onboard</a></td></tr>';
  }).join('');

  app.innerHTML = head(race) + '<div class="stats">' + cards.join('') + '</div>' +
    '<section class="block"><h2>Final classification</h2><p>Official order from the OpenF1 session result, with the gap to the car ahead.</p><div class="scroll"><table class="tbl"><thead><tr><th>Pos</th><th>Driver</th><th>Team</th><th class="r">Laps</th><th class="r">Gap to car ahead</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div><p class="note">The winner shows race time. Everyone else shows the gap to the car directly ahead. Lapped cars show laps down on the leader.</p></section>' +
    '<section class="block"><h2>Dig into the race</h2><p>Each analysis has its own page.</p><div class="stats">' +
    [['timing.html', 'Timing', 'Best laps, sector bests, ideal lap, speed trap, lap time and position charts.'],
     ['sectors.html', 'Mini-sectors', 'Purple, green and yellow mini-sectors for any lap, compared driver against driver.'],
     ['strategy.html', 'Strategy', 'Tyre stints, pit stops and pace per compound.'],
     ['onboard.html', 'Onboard', 'Replay any lap from the start to the best overtakes, with live telemetry.']].map(c =>
      '<a class="stat" style="text-decoration:none" href="' + c[0] + '?s=' + race.key + '"><b>' + c[1] + '</b><div class="s">' + c[2] + '</div></a>').join('') + '</div></section>';
};

/* =========================================================
   TIMING
   ========================================================= */
pages.timing = async function () {
  const race = await G.boot('timing'); if (!race) return;
  const app = $('#app'); app.innerHTML = G.loading('Loading laps and positions…');
  let dr, laps, stints, res, pos;
  try {
    [dr, laps, stints, res, pos] = await Promise.all([G.getDrivers(race.key), G.api('laps', { session_key: race.key }), G.api('stints', { session_key: race.key }), G.getResult(race.key), G.api('position', { session_key: race.key })]);
  } catch (e) { return G.fail(e); }
  const by = G.groupLaps(laps), resMap = new Map(res.map(r => [r.num, r]));
  const mn = (L, k) => { const v = L.map(l => l[k]).filter(x => x > 0); return v.length ? Math.min(...v) : null; };
  const rows = dr.list.filter(d => by.has(d.driver_number)).map(d => {
    const L = by.get(d.driver_number);
    let best = null; L.forEach(l => { if (l.lap_duration > 0 && (!best || l.lap_duration < best.lap_duration)) best = l; });
    const s1 = mn(L, 'duration_sector_1'), s2 = mn(L, 'duration_sector_2'), s3 = mn(L, 'duration_sector_3');
    const sp = Math.max(0, ...L.map(l => l.st_speed || 0));
    const r = resMap.get(d.driver_number);
    return { d, best, bt: best ? best.lap_duration : null, s1, s2, s3, ideal: (s1 && s2 && s3) ? s1 + s2 + s3 : null, speed: sp || null, fin: r && r.pos != null ? r.pos : 99 };
  });
  const O = {
    bt: Math.min(...rows.map(r => r.bt).filter(Boolean)), s1: Math.min(...rows.map(r => r.s1).filter(Boolean)),
    s2: Math.min(...rows.map(r => r.s2).filter(Boolean)), s3: Math.min(...rows.map(r => r.s3).filter(Boolean)),
    ideal: Math.min(...rows.map(r => r.ideal).filter(Boolean)), speed: Math.max(...rows.map(r => r.speed || 0))
  };
  const order = rows.slice().sort((a, b) => a.fin - b.fin).map(r => r.d.driver_number);
  const sel = new Set(rngDefault(order, 3));

  app.innerHTML = head(race) +
    '<section class="block"><h2>Best laps and sectors</h2><p>Purple marks the best of the whole field. Click a column to sort.</p><div class="scroll"><table class="tbl" id="bt"></table></div></section>' +
    '<section class="block"><h2>Lap times</h2><p>Hover the chart to compare drivers on the same lap.</p><div class="chips" id="chips"></div><div class="btns" style="margin:6px 0 10px"><button class="btn ghost" data-sel="3" type="button">Top 3</button><button class="btn ghost" data-sel="10" type="button">Top 10</button><button class="btn ghost" data-sel="99" type="button">Everyone</button><label class="check"><input type="checkbox" id="slow"> Include slow laps (pit, safety car)</label></div><div class="panel"><div id="lapChart"></div></div></section>' +
    '<section class="block"><h2>Race positions</h2><p>Running order at the end of every lap for the selected drivers.</p><div class="panel"><div id="posChart"></div></div></section>' +
    '<section class="block"><h2>Lap by lap</h2><div class="controls" style="margin-bottom:12px"><label>Driver<select id="lapDrv"></select></label></div><div class="scroll"><table class="tbl" id="lt"></table></div></section>';

  /* best-lap table */
  let sk = 'fin', dir = 1;
  const val = { fin: r => r.fin, d: r => r.d.acr, bt: r => r.bt, s1: r => r.s1, s2: r => r.s2, s3: r => r.s3, ideal: r => r.ideal, speed: r => r.speed == null ? null : -r.speed };
  const cls = (v, o, rev) => v == null ? '' : (rev ? v === o : Math.abs(v - o) < 1e-9) ? 'pp' : '';
  function renderTable() {
    const sorted = rows.slice().sort((a, b) => { const x = val[sk](a), y = val[sk](b); if (x == null) return 1; if (y == null) return -1; return (x < y ? -1 : x > y ? 1 : 0) * dir; });
    const th = (k, t, r) => '<th class="' + (r ? 'r' : '') + '" data-k="' + k + '">' + t + (sk === k ? (dir === 1 ? ' ↑' : ' ↓') : '') + '</th>';
    $('#bt').innerHTML = '<thead><tr>' + th('fin', 'Finish') + th('d', 'Driver') + th('bt', 'Best lap', 1) + '<th class="r">Gap</th>' + th('s1', 'S1', 1) + th('s2', 'S2', 1) + th('s3', 'S3', 1) + th('ideal', 'Ideal lap', 1) + th('speed', 'Speed trap', 1) + '</tr></thead><tbody>' +
      sorted.map(r => '<tr><td class="n">' + (r.fin === 99 ? '–' : r.fin) + '</td><td>' + G.dcell(r.d) + '</td>' +
        '<td class="n r ' + cls(r.bt, O.bt) + '">' + G.lapTime(r.bt) + (r.best ? ' <span class="muted">L' + r.best.lap_number + '</span>' : '') + '</td>' +
        '<td class="n r">' + (r.bt ? (r.bt === O.bt ? '–' : '+' + (r.bt - O.bt).toFixed(3)) : '–') + '</td>' +
        '<td class="n r ' + cls(r.s1, O.s1) + '">' + G.sec(r.s1) + '</td><td class="n r ' + cls(r.s2, O.s2) + '">' + G.sec(r.s2) + '</td><td class="n r ' + cls(r.s3, O.s3) + '">' + G.sec(r.s3) + '</td>' +
        '<td class="n r ' + cls(r.ideal, O.ideal) + '">' + G.lapTime(r.ideal) + '</td><td class="n r ' + cls(r.speed, O.speed) + '">' + (r.speed ? r.speed + ' km/h' : '–') + '</td></tr>').join('') + '</tbody>';
    $$('#bt th[data-k]').forEach(h => h.onclick = () => { const k = h.dataset.k; if (sk === k) dir = -dir; else { sk = k; dir = 1; } renderTable(); });
  }
  renderTable();

  /* charts */
  const posBy = new Map();
  for (const p of pos) { const t = G.ts(p.date); if (t == null) continue; if (!posBy.has(p.driver_number)) posBy.set(p.driver_number, []); posBy.get(p.driver_number).push([t, p.position]); }
  for (const a of posBy.values()) a.sort((x, y) => x[0] - y[0]);
  const posAt = (num, t) => { const a = posBy.get(num); if (!a) return null; let lo = 0, hi = a.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (a[m][0] <= t) { r = m; lo = m + 1; } else hi = m - 1; } return r < 0 ? null : a[r][1]; };
  function posSeries(num) {
    const L = by.get(num) || [];
    return L.map((l, i) => {
      const nx = L[i + 1]; let end = nx ? G.ts(nx.date_start) : null;
      if (end == null) { const s = G.ts(l.date_start); end = (s != null && l.lap_duration > 0) ? s + l.lap_duration * 1000 : null; }
      return { x: l.lap_number, y: end == null ? null : posAt(num, end) };
    });
  }
  function styled() {
    const used = new Map();
    return order.filter(n => sel.has(n)).map(n => { const d = dr.map.get(n); const k = used.get(d.color) || 0; used.set(d.color, k + 1); return { d, dash: k ? '6 4' : null }; });
  }
  const maxLap = Math.max(...laps.map(l => l.lap_number || 0));
  function lapCfg() {
    const cut = $('#slow').checked ? Infinity : O.bt * 1.1;
    return {
      label: 'Lap times', height: 320, yFmt: G.lapTick, tipFmt: G.lapTime, yWide: true, xMin: 1, xMax: maxLap,
      series: styled().map(o => ({ name: o.d.acr, color: o.d.color, dash: o.dash, pts: (by.get(o.d.driver_number) || []).map(l => ({ x: l.lap_number, y: l.lap_duration > 0 && l.lap_duration <= cut ? l.lap_duration : null })) }))
    };
  }
  function posCfg() {
    return {
      label: 'Race positions', height: 320, invertY: true, yMin: 1, yMax: dr.list.length, xMin: 1, xMax: maxLap, tipFmt: v => 'P' + v, yFmt: v => 'P' + Math.round(v),
      yTicks: Array.from({ length: dr.list.length }, (_, i) => i + 1).filter(v => v === 1 || v % 2 === 0),
      series: styled().map(o => ({ name: o.d.acr, color: o.d.color, dash: o.dash, pts: posSeries(o.d.driver_number) }))
    };
  }
  const lc = G.lineChart($('#lapChart'), lapCfg()), pc = G.lineChart($('#posChart'), posCfg());
  function drawChips() {
    $('#chips').innerHTML = order.map(n => G.chip(dr.map.get(n), sel.has(n))).join('');
    $$('#chips .chip').forEach(c => c.onclick = () => { const n = Number(c.dataset.n); if (sel.has(n)) sel.delete(n); else sel.add(n); drawChips(); lc.update(lapCfg()); pc.update(posCfg()); });
  }
  drawChips();
  $$('[data-sel]').forEach(b => b.onclick = () => { sel.clear(); rngDefault(order, Number(b.dataset.sel)).forEach(n => sel.add(n)); drawChips(); lc.update(lapCfg()); pc.update(posCfg()); });
  $('#slow').onchange = () => lc.update(lapCfg());

  /* lap by lap */
  $('#lapDrv').innerHTML = order.map(n => '<option value="' + n + '">' + esc(dr.map.get(n).name) + '</option>').join('');
  function renderLaps() {
    const n = Number($('#lapDrv').value), L = by.get(n) || [];
    const dm = k => { const v = L.map(l => l[k]).filter(x => x > 0); return v.length ? Math.min(...v) : null; };
    const b = { t: dm('lap_duration'), s1: dm('duration_sector_1'), s2: dm('duration_sector_2'), s3: dm('duration_sector_3') };
    const c = (v, k) => { if (!(v > 0)) return ''; if (Math.abs(v - O[k]) < 1e-9) return 'pp'; if (Math.abs(v - b[k]) < 1e-9) return 'gg'; return ''; };
    $('#lt').innerHTML = '<thead><tr><th>Lap</th><th class="r">Time</th><th class="r">S1</th><th class="r">S2</th><th class="r">S3</th><th>Tyre</th><th class="r">Trap</th><th></th></tr></thead><tbody>' +
      L.map(l => { const ty = G.tyreAt(stints, n, l.lap_number); return '<tr><td class="n">' + l.lap_number + '</td><td class="n r ' + c(l.lap_duration, 'bt') + '">' + G.lapTime(l.lap_duration) + '</td><td class="n r ' + c(l.duration_sector_1, 's1') + '">' + G.sec(l.duration_sector_1) + '</td><td class="n r ' + c(l.duration_sector_2, 's2') + '">' + G.sec(l.duration_sector_2) + '</td><td class="n r ' + c(l.duration_sector_3, 's3') + '">' + G.sec(l.duration_sector_3) + '</td><td>' + (ty ? G.cdot(ty.compound) + ' <span class="muted">' + ty.age + ' laps old</span>' : '') + '</td><td class="n r">' + (l.st_speed || '–') + '</td><td>' + (l.is_pit_out_lap ? '<span class="pill mute">Out lap</span>' : '') + '</td></tr>'; }).join('') + '</tbody>';
  }
  $('#lapDrv').onchange = renderLaps; renderLaps();
};

/* =========================================================
   MINI-SECTORS
   ========================================================= */
pages.sectors = async function () {
  const race = await G.boot('sectors'); if (!race) return;
  const app = $('#app'); app.innerHTML = G.loading('Loading laps…');
  let dr, laps, res;
  try { [dr, laps, res] = await Promise.all([G.getDrivers(race.key), G.api('laps', { session_key: race.key }), G.getResult(race.key)]); } catch (e) { return G.fail(e); }
  const by = G.groupLaps(laps), med = G.median(laps.map(l => l.lap_duration > 0 ? l.lap_duration : null));
  const bestOf = n => { let b = null; (by.get(n) || []).forEach(l => { if (l.lap_duration > 0 && (!b || l.lap_duration < b.lap_duration)) b = l; }); return b; };
  const bests = dr.list.filter(d => bestOf(d.driver_number)).sort((a, b) => bestOf(a.driver_number).lap_duration - bestOf(b.driver_number).lap_duration);
  if (!bests.length) { app.innerHTML = head(race) + '<p class="note">No lap data for this race.</p>'; return; }
  const st = { a: bests[0].driver_number, la: bestOf(bests[0].driver_number).lap_number, b: (bests[1] || bests[0]).driver_number, lb: bestOf((bests[1] || bests[0]).driver_number).lap_number, cmp: true };
  const drvOpts = bests.map(d => '<option value="' + d.driver_number + '">' + esc(d.name) + '</option>').join('');
  const lapOpts = n => (by.get(n) || []).filter(l => l.lap_duration > 0).map(l => '<option value="' + l.lap_number + '">Lap ' + l.lap_number + ' · ' + G.lapTime(l.lap_duration) + '</option>').join('');

  app.innerHTML = head(race) +
    '<section class="block"><h2>Pick a lap</h2><p>Every box is one mini-sector. Fastest laps are preselected.</p><div class="panel"><div class="controls">' +
    '<label>Driver<select id="a">' + drvOpts + '</select></label><label>Lap<select id="la"></select></label>' +
    '<label>Compare with<select id="b">' + drvOpts + '</select></label><label>Lap<select id="lb"></select></label>' +
    '<label class="check" style="margin-bottom:8px"><input type="checkbox" id="cmp" checked> Compare</label></div>' +
    '<div id="cards"></div><div class="legend"><span><i style="--c:var(--purple)"></i>Overall best</span><span><i style="--c:var(--green)"></i>Personal best</span><span><i style="--c:var(--yellow)"></i>Slower</span><span><i style="--c:#5b7a99"></i>Pit lane</span><span><i style="--c:var(--line)"></i>No data</span></div></div></section>' +
    '<section class="block"><h2>On the track</h2><p>The selected lap of the first driver, coloured by mini-sector. Mini-sectors are spread over each sector by time, so the boundaries are approximate.</p><div class="panel"><div id="map"></div></div></section>' +
    '<section class="block"><h2>Who owned the mini-sectors?</h2><p>Count of purple and green mini-sectors across every lap of the race.</p><div class="panel" id="own"></div></section>';

  const strip = l => '<div class="strip">' + [1, 2, 3].map(i => {
    const a = l['segments_sector_' + i] || [];
    return '<div class="sec"><div class="segs">' + (a.map(v => '<i style="--c:' + G.seg(v).c + '" title="' + esc(G.seg(v).l) + '"></i>').join('') || '<em class="muted">No mini-sector data</em>') + '</div><span class="num">S' + i + ' ' + G.sec(l['duration_sector_' + i]) + '</span></div>';
  }).join('') + '</div>';
  const card = (n, ln) => {
    const d = dr.map.get(n), l = (by.get(n) || []).find(x => x.lap_number === ln);
    if (!l) return '<p class="note">No lap data.</p>';
    return '<div class="lapcard"><div class="who"><span class="tc" style="--tc:' + d.color + '"></span><b>' + esc(d.acr) + '</b><span class="muted">Lap ' + ln + '</span><span class="num big">' + G.lapTime(l.lap_duration) + '</span></div>' + strip(l) + '</div>';
  };
  function renderCards() {
    let h = card(st.a, st.la);
    if (st.cmp) {
      h += card(st.b, st.lb);
      const A = (by.get(st.a) || []).find(x => x.lap_number === st.la), B = (by.get(st.b) || []).find(x => x.lap_number === st.lb);
      if (A && B) {
        const dl = (x, y, t) => { if (!(x > 0 && y > 0)) return ''; const v = x - y; return '<span><span class="muted">' + t + '</span> <span class="' + (v <= 0 ? 'gg' : 'bad') + '" style="color:var(' + (v <= 0 ? '--green' : '--yellow') + ')">' + (v > 0 ? '+' : '') + v.toFixed(3) + '</span></span>'; };
        h += '<div class="delta">' + dl(A.duration_sector_1, B.duration_sector_1, 'S1') + dl(A.duration_sector_2, B.duration_sector_2, 'S2') + dl(A.duration_sector_3, B.duration_sector_3, 'S3') + dl(A.lap_duration, B.lap_duration, 'Lap') + '<span class="muted">Negative means ' + esc(dr.map.get(st.a).acr) + ' is faster</span></div>';
      }
    }
    $('#cards').innerHTML = h;
  }
  /* track map */
  let mapToken = 0;
  async function renderMap() {
    const tok = ++mapToken, host = $('#map');
    const l = (by.get(st.a) || []).find(x => x.lap_number === st.la), win = G.lapWindow(by.get(st.a) || [], st.la, med);
    if (!l || !win) { host.innerHTML = '<p class="note">No timing window for this lap.</p>'; return; }
    host.innerHTML = G.loading('Loading the car path…');
    let loc;
    try { loc = await G.api('location', { session_key: race.key, driver_number: st.a, 'date>=': new Date(win.start).toISOString(), 'date<': new Date(win.end).toISOString() }); } catch (e) { if (tok === mapToken) host.innerHTML = '<p class="note">' + esc(e.message) + '</p>'; return; }
    if (tok !== mapToken) return;
    const pts = loc.map(r => ({ t: (G.ts(r.date) - win.start) / 1000, x: r.x, y: r.y })).filter(p => !isNaN(p.t) && !(p.x === 0 && p.y === 0)).sort((p, q) => p.t - q.t);
    if (pts.length < 10) { host.innerHTML = '<p class="note">No location data for this lap.</p>'; return; }
    const W = 640, H = 440, P = G.projector(pts.map(p => [p.x, p.y]), W, H, 26), total = (win.end - win.start) / 1000;
    const a = l.duration_sector_1 > 0 ? l.duration_sector_1 : total / 3, b = l.duration_sector_2 > 0 ? l.duration_sector_2 : total / 3;
    const vals = [l.segments_sector_1 || [], l.segments_sector_2 || [], l.segments_sector_3 || []];
    const key = t => {
      let s = 0, off = t, dur = a;
      if (t >= a + b) { s = 2; off = t - a - b; dur = total - a - b; } else if (t >= a) { s = 1; off = t - a; dur = b; }
      const n = vals[s].length; if (!n) return [s, -1];
      return [s, Math.min(n - 1, Math.max(0, Math.floor(off / (dur || 1) * n)))];
    };
    const proj = pts.map(p => P(p.x, p.y));
    let base = 'M' + proj.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L');
    let runs = '', cur = null, d = '';
    const flush = () => { if (cur && d) runs += '<path class="seg" d="' + d + '" style="stroke:' + G.seg(cur.v).c + '"/>'; };
    pts.forEach((p, i) => {
      const k = key(p.t), v = k[1] < 0 ? 0 : vals[k[0]][k[1]], id = k[0] + '-' + k[1];
      if (!cur || cur.id !== id) { flush(); cur = { id, v }; d = i ? 'M' + proj[i - 1][0].toFixed(1) + ',' + proj[i - 1][1].toFixed(1) + 'L' : 'M'; d += proj[i][0].toFixed(1) + ',' + proj[i][1].toFixed(1); }
      else d += 'L' + proj[i][0].toFixed(1) + ',' + proj[i][1].toFixed(1);
    });
    flush();
    const s0 = proj[0];
    host.innerHTML = '<svg class="map" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Track map coloured by mini-sector"><path class="base" d="' + base + '"/>' + runs + '<circle cx="' + s0[0] + '" cy="' + s0[1] + '" r="6" style="fill:var(--ink)"/><text x="' + (s0[0] + 10) + '" y="' + (s0[1] - 8) + '">Lap start</text></svg>';
  }
  /* ownership */
  function renderOwn() {
    const rows = dr.list.map(d => {
      let pu = 0, gr = 0;
      (by.get(d.driver_number) || []).forEach(l => [1, 2, 3].forEach(i => (l['segments_sector_' + i] || []).forEach(v => { if (v === 2051) pu++; else if (v === 2049) gr++; })));
      return { d, pu, gr };
    }).filter(r => r.pu + r.gr > 0).sort((x, y) => y.pu - x.pu);
    const mx = Math.max(1, ...rows.map(r => r.pu));
    $('#own').innerHTML = rows.length ? '<div class="bars">' + rows.map(r => '<div class="brow"><span><span class="tc" style="--tc:' + r.d.color + '"></span><b>' + esc(r.d.acr) + '</b></span><div class="tr" title="' + r.pu + ' purple, ' + r.gr + ' green"><i style="width:' + (r.pu / mx * 100) + '%"></i></div><span class="num">' + r.pu + '</span></div>').join('') + '</div><p class="note">Bars show purple mini-sectors (best of everyone at that moment). Hover a bar for the green count.</p>' : '<p class="note">No mini-sector data for this race.</p>';
  }
  const setLaps = () => { $('#la').innerHTML = lapOpts(st.a); $('#la').value = st.la; $('#lb').innerHTML = lapOpts(st.b); $('#lb').value = st.lb; };
  $('#a').value = st.a; $('#b').value = st.b; setLaps(); renderCards(); renderMap(); renderOwn();
  $('#a').onchange = e => { st.a = Number(e.target.value); st.la = (bestOf(st.a) || {}).lap_number; setLaps(); renderCards(); renderMap(); };
  $('#b').onchange = e => { st.b = Number(e.target.value); st.lb = (bestOf(st.b) || {}).lap_number; setLaps(); renderCards(); };
  $('#la').onchange = e => { st.la = Number(e.target.value); renderCards(); renderMap(); };
  $('#lb').onchange = e => { st.lb = Number(e.target.value); renderCards(); };
  $('#cmp').onchange = e => { st.cmp = e.target.checked; renderCards(); };
};

/* =========================================================
   STRATEGY
   ========================================================= */
pages.strategy = async function () {
  const race = await G.boot('strategy'); if (!race) return;
  const app = $('#app'); app.innerHTML = G.loading('Loading tyre data…');
  let dr, laps, stints, pits, res;
  try { [dr, laps, stints, pits, res] = await Promise.all([G.getDrivers(race.key), G.api('laps', { session_key: race.key }), G.api('stints', { session_key: race.key }), G.api('pit', { session_key: race.key }), G.getResult(race.key)]); } catch (e) { return G.fail(e); }
  const by = G.groupLaps(laps), N = Math.max(1, ...laps.map(l => l.lap_number || 0));
  const order = res.map(r => r.num).filter(n => dr.map.has(n));
  dr.list.forEach(d => { if (!order.includes(d.driver_number)) order.push(d.driver_number); });
  const sBy = new Map(); stints.forEach(s => { if (!sBy.has(s.driver_number)) sBy.set(s.driver_number, []); sBy.get(s.driver_number).push(s); });
  for (const a of sBy.values()) a.sort((x, y) => x.lap_start - y.lap_start);

  const bars = order.filter(n => sBy.has(n)).map(n => {
    const d = dr.map.get(n), L = by.get(n) || [], last = L.length ? L[L.length - 1].lap_number : N;
    const seg = sBy.get(n).map(s => {
      const a = s.lap_start, b = s.lap_end == null ? last : s.lap_end, c = G.cmp(s.compound), w = (b - a + 1) / N * 100;
      return '<div class="stint" style="--c:' + c.c + ';left:' + ((a - 1) / N * 100) + '%;width:' + w + '%" title="' + esc(c.l) + ', laps ' + a + ' to ' + b + '">' + (w > 7 ? c.s + ' ' + (b - a + 1) : '') + '</div>';
    }).join('');
    return '<div class="srow"><b>' + esc(d.acr) + '</b><div class="track">' + seg + '</div></div>';
  }).join('');

  const pf = G.pitField(pits);
  const pitRows = pits.slice().sort((a, b) => a.lap_number - b.lap_number || a.driver_number - b.driver_number).map(p => {
    const d = dr.map.get(p.driver_number); if (!d) return '';
    const S = sBy.get(p.driver_number) || [], before = S.find(s => s.lap_end != null && Math.abs(s.lap_end - p.lap_number) <= 1), after = before ? S[S.indexOf(before) + 1] : null;
    return { d, p, html: '<tr><td class="n">' + p.lap_number + '</td><td>' + G.dcell(d) + '</td><td>' + (before ? G.cdot(before.compound) : '') + (after ? ' → ' + G.cdot(after.compound) : '') + '</td><td class="n r" data-v="' + (pf ? p[pf] : '') + '">' + (pf && p[pf] != null ? G.sec(p[pf], 2) + ' s' : '–') + '</td></tr>' };
  }).filter(Boolean);
  let fastest = Infinity; if (pf) pitRows.forEach(r => { if (r.p[pf] > 0 && r.p[pf] < fastest) fastest = r.p[pf]; });

  app.innerHTML = head(race) +
    '<section class="block"><h2>Tyre stints</h2><p>One row per driver in finishing order. Width is laps run.</p><div class="panel"><div id="stints">' + (bars || '<p class="note">No stint data for this race.</p>') + '</div>' +
    '<div class="legend">' + Object.keys(G.COMPOUND).map(k => '<span>' + G.cdot(k) + ' ' + G.COMPOUND[k].l + '</span>').join('') + '</div></div></section>' +
    '<section class="block"><h2>Pace by tyre age</h2><p>Average lap time for each compound as the tyre wears. Pit laps, lap 1 and slow laps are left out.</p><div class="panel"><div id="deg"></div></div><div class="scroll" style="margin-top:12px"><table class="tbl" id="degt"></table></div></section>' +
    '<section class="block"><h2>Pit stops</h2><p>' + (pf === 'stop_duration' ? 'Time stationary in the box.' : pf === 'lane_duration' ? 'Time spent in the pit lane.' : 'Pit duration as published by OpenF1.') + '</p><div class="scroll"><table class="tbl"><thead><tr><th>Lap</th><th>Driver</th><th>Tyres</th><th class="r">Time</th></tr></thead><tbody>' +
    (pitRows.map(r => r.p[pf] === fastest ? r.html.replace('class="n r"', 'class="n r pp"') : r.html).join('') || '<tr><td colspan="4" class="muted">No pit stop data.</td></tr>') + '</tbody></table></div></section>';

  /* degradation */
  const best = Math.min(...laps.filter(l => l.lap_duration > 0).map(l => l.lap_duration)), cut = best * 1.07;
  const groups = {};
  laps.forEach(l => {
    if (!(l.lap_duration > 0) || l.lap_duration > cut || l.lap_number <= 1 || l.is_pit_out_lap) return;
    const nx = (by.get(l.driver_number) || []).find(x => x.lap_number === l.lap_number + 1); if (nx && nx.is_pit_out_lap) return;
    const t = G.tyreAt(stints, l.driver_number, l.lap_number); if (!t || !t.compound) return;
    const k = String(t.compound).toUpperCase(); (groups[k] = groups[k] || []).push({ age: t.age, t: l.lap_duration });
  });
  const series = [], trs = [];
  Object.keys(groups).forEach(k => {
    const g = groups[k], byAge = new Map();
    g.forEach(p => { if (!byAge.has(p.age)) byAge.set(p.age, []); byAge.get(p.age).push(p.t); });
    const pts = [...byAge.entries()].filter(e => e[1].length >= 3).sort((a, b) => a[0] - b[0]).map(e => ({ x: e[0], y: e[1].reduce((a, b) => a + b, 0) / e[1].length }));
    if (pts.length >= 2) series.push({ name: G.cmp(k).l, color: G.cmp(k).c, pts, w: 2.5 });
    const n = g.length, mx = g.reduce((a, p) => a + p.age, 0) / n, my = g.reduce((a, p) => a + p.t, 0) / n;
    let sxy = 0, sxx = 0; g.forEach(p => { sxy += (p.age - mx) * (p.t - my); sxx += (p.age - mx) * (p.age - mx); });
    trs.push('<tr><td>' + G.cdot(k) + ' ' + G.cmp(k).l + '</td><td class="n r">' + n + '</td><td class="n r">' + G.lapTime(my) + '</td><td class="n r">' + (sxx ? (sxy / sxx >= 0 ? '+' : '') + (sxy / sxx).toFixed(3) + ' s/lap' : '–') + '</td></tr>');
  });
  if (series.length) G.lineChart($('#deg'), { label: 'Lap time by tyre age', height: 300, xName: 'Tyre age', yFmt: G.lapTick, tipFmt: G.lapTime, yWide: true, series });
  else $('#deg').innerHTML = '<p class="note">Not enough clean laps to plot tyre wear.</p>';
  $('#degt').innerHTML = '<thead><tr><th>Compound</th><th class="r">Laps used</th><th class="r">Average</th><th class="r">Trend</th></tr></thead><tbody>' + (trs.join('') || '<tr><td colspan="4" class="muted">No data</td></tr>') + '</tbody>';
};

/* =========================================================
   SESSIONS (practice, qualifying, sprint, race)
   ========================================================= */
pages.sessions = async function () {
  const race = await G.boot('sessions'); if (!race) return;
  const app = $('#app'); app.innerHTML = G.loading('Loading the race weekend…');
  let all;
  try { all = await G.api('sessions', { meeting_key: race.meeting }); } catch (e) { return G.fail(e); }
  const list = all.filter(s => G.ts(s.date_end) != null && G.ts(s.date_end) < Date.now()).sort((a, b) => G.ts(a.date_start) - G.ts(b.date_start));
  if (!list.length) { app.innerHTML = head(race) + '<p class="note">OpenF1 has no finished sessions for this weekend.</p>'; return; }
  const qp = new URLSearchParams(location.search);
  let cur = list.find(s => String(s.session_key) === qp.get('x')) || list[list.length - 1];
  const day = s => new Date(G.ts(s.date_start)).toLocaleDateString('en-GB', { weekday: 'short' });
  app.innerHTML = head(race) + '<div class="stabs" id="stabs" role="tablist"></div><div id="sbody"></div>';
  let token = 0;
  function drawTabs() {
    $('#stabs').innerHTML = list.map(s => '<button type="button" class="stab" role="tab" aria-selected="' + (s.session_key === cur.session_key) + '" data-k="' + s.session_key + '"><b>' + esc(s.session_name) + '</b><span>' + day(s) + '</span></button>').join('');
    $$('#stabs .stab').forEach(b => b.onclick = () => { cur = list.find(s => String(s.session_key) === b.dataset.k); drawTabs(); load(); });
  }
  async function load() {
    const tok = ++token, body = $('#sbody'), isRace = /^race$/i.test(cur.session_name);
    history.replaceState(null, '', '?s=' + race.key + '&x=' + cur.session_key);
    body.innerHTML = G.loading('Loading ' + cur.session_name + '…');
    let dr, laps, stints, res = [];
    try { [dr, laps, stints] = await Promise.all([G.getDrivers(cur.session_key), G.api('laps', { session_key: cur.session_key }), G.api('stints', { session_key: cur.session_key })]); if (isRace) res = await G.getResult(cur.session_key); }
    catch (e) { if (tok === token) body.innerHTML = '<div class="note err"><b>Could not load this session</b><p>' + esc(e.message) + '</p></div>'; return; }
    if (tok !== token) return;
    const by = G.groupLaps(laps);
    let rows = dr.list.filter(d => by.has(d.driver_number)).map(d => {
      const L = by.get(d.driver_number), last = L.length ? L[L.length - 1].lap_number : 0;
      let best = null, top = 0;
      L.forEach(l => { if (l.lap_duration > 0 && (best == null || l.lap_duration < best)) best = l.lap_duration; top = Math.max(top, l.st_speed || 0, l.i1_speed || 0, l.i2_speed || 0); });
      const st = stints.filter(x => x.driver_number === d.driver_number).sort((a, b) => a.lap_start - b.lap_start).map(x => ({ c: x.compound, n: (x.lap_end == null ? last : x.lap_end) - x.lap_start + 1 }));
      return { d, best, top: top || null, st };
    });
    if (!rows.length) { body.innerHTML = '<p class="note">No lap data for this session.</p>'; return; }
    if (isRace && res.length) { const o = new Map(res.map((r, i) => [r.num, i])); rows.sort((a, b) => (o.has(a.d.driver_number) ? o.get(a.d.driver_number) : 99) - (o.has(b.d.driver_number) ? o.get(b.d.driver_number) : 99)); }
    else rows.sort((a, b) => (a.best == null ? 1e9 : a.best) - (b.best == null ? 1e9 : b.best));
    const fastest = Math.min(...rows.map(r => r.best).filter(Boolean)), topMax = Math.max(0, ...rows.map(r => r.top || 0));
    body.innerHTML = '<div class="scroll"><table class="tbl sess"><thead><tr><th>Pos</th><th>Driver</th><th>Team</th><th>Tyres</th><th class="r">Best lap</th><th class="r">Gap</th><th class="r">Top speed</th></tr></thead><tbody>' +
      rows.map((r, i) => '<tr><td class="n"><span class="pos">' + (i + 1) + '</span></td><td><span class="tc" style="--tc:' + r.d.color + '"></span>' +
        (r.d.headshot_url ? '<img class="hs" loading="lazy" alt="" src="' + esc(r.d.headshot_url) + '" onerror="this.style.display=\'none\'">' : '') +
        '<b class="acr" style="color:' + r.d.color + '">' + esc(r.d.acr) + '</b></td><td class="muted">' + esc(r.d.team_name || '') + '</td>' +
        '<td><div class="tyres">' + (r.st.map(s => '<span class="tyre">' + G.cdot(s.c) + '<b>' + s.n + '</b></span>').join('') || '<span class="muted">–</span>') + '</div></td>' +
        '<td class="n r ' + (r.best === fastest ? 'pp' : '') + '"><b>' + G.lapTime(r.best) + '</b></td>' +
        '<td class="n r muted">' + (r.best && r.best !== fastest ? '+' + (r.best - fastest).toFixed(3) : '') + '</td>' +
        '<td class="n r ' + (r.top && r.top === topMax ? 'pp' : '') + '">' + (r.top ? r.top + ' km/h' : '–') + '</td></tr>').join('') + '</tbody></table></div>' +
      '<p class="note">' + (isRace ? 'Ordered by finishing position. Best lap, gap and top speed are the driver’s own race laps.' : 'Ordered by best lap. Qualifying knockout segments (Q1, Q2, Q3) are not split out. Tyre chips show the compound and laps run on each set.') + ' Top speed is the highest speed trap or intermediate speed recorded.</p>';
  }
  drawTabs(); load();
};

/* =========================================================
   CALENDAR (schedule from the Jolpica Ergast API, countdowns live)
   ========================================================= */
pages.calendar = async function () {
  await G.boot('calendar', { light: true });
  const app = $('#app'); app.innerHTML = G.loading('Loading the calendar…');
  const JOL = 'https://api.jolpi.ca/ergast/f1/';
  const toTs = o => { if (!o || !o.date) return null; let t = o.time || '00:00:00Z'; if (!/Z|[+-]\d\d:?\d\d$/.test(t)) t += 'Z'; const v = Date.parse(o.date + 'T' + t); return isNaN(v) ? null : v; };
  const KEYS = [['FirstPractice', 'Practice 1', 60], ['SecondPractice', 'Practice 2', 60], ['ThirdPractice', 'Practice 3', 60], ['SprintQualifying', 'Sprint Qualifying', 50], ['SprintShootout', 'Sprint Qualifying', 50], ['Sprint', 'Sprint', 40], ['Qualifying', 'Qualifying', 60]];
  async function season(y) { const j = await G.cached(JOL + y + '.json?limit=100', 36e5); return (j && j.MRData && j.MRData.RaceTable && j.MRData.RaceTable.Races) || []; }
  function weekends(races) {
    return races.map(r => {
      const ss = []; KEYS.forEach(k => { const t = toTs(r[k[0]]); if (t != null) ss.push({ name: k[1], start: t, mins: k[2] }); });
      const rt = toTs(r); if (rt != null) ss.push({ name: 'Race', start: rt, mins: 120 });
      ss.sort((a, b) => a.start - b.start);
      if (!ss.length) return null;
      const last = ss[ss.length - 1];
      return { r, round: Number(r.round), name: r.raceName, ss, start: ss[0].start, race: last, end: last.start + last.mins * 60e3 };
    }).filter(Boolean);
  }
  let y = new Date().getFullYear(), W;
  try {
    W = weekends(await season(y));
    if (!W.length || W.every(w => w.end < Date.now())) { const nx = weekends(await season(y + 1)); if (nx.length) { y += 1; W = nx; } }
  } catch (e) { return G.fail(e); }
  if (!W.length) { app.innerHTML = '<h1>Formula 1 Calendar</h1><p class="note">No schedule is published for this season yet.</p>'; return; }
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local time';
  const fmtDay = (t, o) => new Date(t).toLocaleDateString('en-GB', o);
  const dayTime = t => fmtDay(t, { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const range = w => { const a = new Date(w.start), b = new Date(w.race.start); const m = d => d.toLocaleDateString('en-GB', { month: 'short' }); return a.getMonth() === b.getMonth() ? a.getDate() + '–' + b.getDate() + ' ' + m(b) : a.getDate() + ' ' + m(a) + ' – ' + b.getDate() + ' ' + m(b); };
  const cd = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return { d: Math.floor(s / 86400), h: Math.floor(s % 86400 / 3600), m: Math.floor(s % 3600 / 60), s: s % 60 }; };
  const cdHtml = ms => { const c = cd(ms); return '<div class="cd">' + [[c.d, 'days'], [c.h, 'hours'], [c.m, 'minutes'], [c.s, 'seconds']].map(x => '<div><b class="num">' + x[0] + '</b><span>' + x[1] + '</span></div>').join('') + '</div>'; };
  const now0 = Date.now(), done0 = W.filter(w => w.end < now0).length, pct = Math.round(done0 / W.length * 100);
  const nextW = W.find(w => w.end >= now0) || null;

  let h = '<h1>Formula 1 Calendar ' + y + '</h1><p class="lede">Complete ' + y + ' race calendar with all event dates and circuit locations. Times are in your local time (' + esc(tz) + ').</p><div class="prog"><div class="pl"><span>' + done0 + ' of ' + W.length + ' races completed</span><span>' + pct + '%</span></div><div class="pt"><i style="width:' + pct + '%"></i></div></div>';
  if (nextW) {
    const loc = nextW.r.Circuit && nextW.r.Circuit.Location || {};
    h += '<section class="ncard"><div class="ntop"><span class="badge">Next race</span><span class="muted">Round ' + nextW.round + ' of ' + W.length + '</span></div><h2 class="nname">' + esc(nextW.name) + '</h2><p class="muted">' + esc(loc.country || '') + (loc.locality ? ' · ' + esc(loc.locality) : '') + ' · ' + range(nextW) + '</p>' +
      '<div class="ngrid"><ul class="slist" id="slist"></ul><div id="cds"></div><div class="cmap" id="cmap"></div></div></section>';
  } else h += '<p class="note">The ' + y + ' season is complete.</p>';
  h += '<section class="block"><h2>All rounds</h2><div class="scroll"><table class="tbl"><thead><tr><th>Round</th><th>Grand Prix</th><th>Circuit</th><th>Dates</th><th>Status</th></tr></thead><tbody>' +
    W.map(w => { const st = w.end < now0 ? 'Completed' : (nextW && w.round === nextW.round ? 'Next' : 'Upcoming'); const c = w.r.Circuit || {}; return '<tr><td class="n">' + w.round + '</td><td><b>' + esc(w.name) + '</b></td><td class="muted">' + esc(c.circuitName || '') + '</td><td class="n">' + range(w) + '</td><td>' + (st === 'Next' ? '<span class="pill">Next</span>' : '<span class="' + (st === 'Completed' ? 'muted' : '') + '">' + st + '</span>') + '</td></tr>'; }).join('') + '</tbody></table></div></section>';
  app.innerHTML = h;
  if (!nextW) return;

  function tick() {
    const now = Date.now();
    const next = nextW.ss.find(s => s.start > now);
    const live = nextW.ss.find(s => s.start <= now && now < s.start + s.mins * 60e3);
    $('#slist').innerHTML = nextW.ss.map(s => {
      const over = now >= s.start + s.mins * 60e3, isLive = live === s;
      return '<li class="' + (s.name === 'Race' ? 'race ' : '') + (over ? 'over' : '') + '"><b>' + esc(s.name) + '</b><span>' + (isLive ? '<em class="livepill">Live now</em>' : dayTime(s.start)) + '</span></li>';
    }).join('');
    let c = '';
    if (live && live.name !== 'Race') c += '<h3 class="cdt">' + esc(live.name) + ' is live</h3>';
    if (next && next.name !== 'Race') c += '<h3 class="cdt">' + esc(next.name) + ' in:</h3>' + cdHtml(next.start - now);
    const rc = nextW.race;
    if (rc.start > now) c += '<h3 class="cdt">Race' + (next && next.name === 'Race' ? ' in:' : '') + '</h3>' + cdHtml(rc.start - now);
    else if (live && live.name === 'Race') c += '<h3 class="cdt">The race is live</h3>';
    $('#cds').innerHTML = c;
  }
  tick(); setInterval(tick, 1000);

  /* circuit outline, best effort from a past race at the same place */
  (async function () {
    const box = $('#cmap');
    try {
      const loc = nextW.r.Circuit.Location.locality;
      const ss = await G.api('sessions', { session_name: 'Race', location: loc }, 36e5);
      const past = ss.filter(s => G.ts(s.date_end) < Date.now()).sort((a, b) => G.ts(b.date_start) - G.ts(a.date_start))[0];
      if (!past) { box.remove(); return; }
      const laps = await G.api('laps', { session_key: past.session_key, lap_number: 8 });
      const l = laps.find(x => x.date_start && x.lap_duration > 0);
      if (!l) { box.remove(); return; }
      const s = G.ts(l.date_start), iso = t => new Date(t).toISOString();
      const pts = (await G.api('location', { session_key: past.session_key, driver_number: l.driver_number, 'date>=': iso(s), 'date<': iso(s + l.lap_duration * 1000) })).filter(p => !(p.x === 0 && p.y === 0));
      if (pts.length < 20) { box.remove(); return; }
      const P = G.projector(pts.map(p => [p.x, p.y]), 420, 300, 22), d = 'M' + pts.map(p => { const q = P(p.x, p.y); return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join('L');
      box.innerHTML = '<svg class="map" viewBox="0 0 420 300" role="img" aria-label="Circuit outline"><path class="base" d="' + d + '"/><path d="' + d + '" fill="none" style="stroke:var(--ink)" stroke-width="2.5" stroke-linejoin="round"/></svg>';
    } catch (e) { box.remove(); }
  })();
};

/* =========================================================
   ONBOARD
   ========================================================= */
pages.onboard = async function () {
  const race = await G.boot('onboard'); if (!race) return;
  const app = $('#app'); app.innerHTML = G.loading('Loading drivers and laps…');
  let dr, laps, res, ots, posRaw;
  try {
    [dr, laps, res, ots, posRaw] = await Promise.all([G.getDrivers(race.key), G.api('laps', { session_key: race.key }), G.getResult(race.key),
      G.api('overtakes', { session_key: race.key }).catch(() => []), G.api('position', { session_key: race.key }).catch(() => [])]);
  } catch (e) { return G.fail(e); }
  const by = G.groupLaps(laps), med = G.median(laps.map(l => l.lap_duration > 0 ? l.lap_duration : null));
  const order = res.map(r => r.num).filter(n => dr.map.has(n)); dr.list.forEach(d => { if (!order.includes(d.driver_number)) order.push(d.driver_number); });
  const qp = new URLSearchParams(location.search);
  let sel = Number(qp.get('d')); if (!dr.map.has(sel)) sel = order[0];
  let lapNo = Number(qp.get('lap')) || 1;
  let fl = null; laps.forEach(l => { if (l.lap_duration > 0 && (!fl || l.lap_duration < fl.lap_duration)) fl = l; });
  const flD = fl && dr.map.get(fl.driver_number);
  const bestLapOf = n => { let b = null; (by.get(n) || []).forEach(l => { if (l.lap_duration > 0 && (!b || l.lap_duration < b.lap_duration)) b = l; }); return b; };
  const lapOf = (num, t) => { let n = null; for (const l of by.get(num) || []) { const s = G.ts(l.date_start); if (s != null && s <= t) n = l.lap_number; } return n == null ? 1 : n; };

  /* running order index from the position feed */
  const posBy = new Map();
  for (const r of posRaw) { const tt = G.ts(r.date); if (tt == null || !dr.map.has(r.driver_number)) continue; let a = posBy.get(r.driver_number); if (!a) { a = { t: [], p: [] }; posBy.set(r.driver_number, a); } a.t.push(tt); a.p.push(r.position); }
  for (const a of posBy.values()) { const ix = a.t.map((_, i) => i).sort((x, y) => a.t[x] - a.t[y]); a.t = ix.map(i => a.t[i]); a.p = ix.map(i => a.p[i]); }
  const orderAt = ts => { const out = []; posBy.forEach((a, n) => { const i = G.bsearch(a.t, ts); out.push({ n, p: a.p[i < 0 ? 0 : i] }); }); out.sort((x, y) => x.p - y.p); return out; };
  const ROW = 30;

  app.innerHTML = head(race).replace('<h1>', '<h1>Onboard · ') +
    '<div class="panel" style="margin-top:20px"><div class="controls"><label>Driver<select id="drv">' + order.map(n => '<option value="' + n + '">' + esc(dr.map.get(n).name) + '</option>').join('') + '</select></label>' +
    '<label>Lap<select id="lap"></select></label><div class="btns"><button class="btn" id="bStart" type="button">Race start</button><button class="btn ghost" id="bFast" type="button">Driver’s fastest lap</button><button class="btn ghost" id="bPrev" type="button">Previous lap</button><button class="btn ghost" id="bNext" type="button">Next lap</button></div></div></div>' +
    '<div class="ob"><div class="panel"><div id="status" class="note" style="padding:0 0 8px"></div><div id="mapHost"></div><div class="transport"><button class="btn" id="play" type="button">Play</button><select id="rate" aria-label="Speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select><input type="range" id="scrub" min="0" max="1000" value="0" aria-label="Position in lap"><span class="num" id="clock">0:00.0</span></div>' +
    '<h3 style="margin-top:16px">Overtake feed</h3><div id="feed" class="feed"><span class="muted">Press play. Passes appear here as they happen.</span></div></div>' +
    '<div class="col2"><div class="panel"><div class="read"><div><small>Speed</small><span class="v" id="vSpeed">–</span> <small style="display:inline">km/h</small></div><div><small>Gear</small><span class="v" id="vGear">–</span></div>' +
    '<div><small>Active aero</small><svg class="aero" viewBox="0 0 96 40" aria-hidden="true"><rect x="10" y="27" width="76" height="5" rx="2" class="pl"/><rect x="6" y="16" width="4" height="18" rx="1.5" class="ep"/><rect x="86" y="16" width="4" height="18" rx="1.5" class="ep"/><rect id="flap" x="10" y="19" width="76" height="4" rx="2" class="fl"/></svg><span class="v" id="vAero" style="font-size:18px">–</span></div></div>' +
    '<small class="muted">Throttle</small><div class="meter"><i id="mThr"></i></div><small class="muted" style="display:block;margin-top:8px">Brake</small><div class="meter b"><i id="mBrk"></i></div>' +
    '<div class="trace" id="trace" style="margin-top:14px"></div><p class="note" style="padding-bottom:0">Click or drag the chart to jump. Orange ticks mark passes by this driver. <span id="aeroNote"></span></p></div>' +
    '<div class="panel"><h3>Live order</h3><p class="note" style="padding:0 0 8px">Positions follow the replay. Click a driver to follow them. Arrows show places gained or lost since the start of this lap.</p><div class="lo-wrap" id="lo"></div></div></div></div>' +
    '<section class="block"><h2>Overtakes</h2><p>Every pass this driver made, plus the places lost. Click one to jump straight to it.</p><div id="ots"></div></section>' +
    '<section class="block"><h2>Watch the real onboard</h2><p>The replay above is rebuilt from official timing telemetry, not video. For actual camera footage use the official sources.</p><div class="links" id="vids"></div></section>';

  /* state */
  let D = null, t = 0, playing = false, raf = 0, last = 0, rate = 1, token = 0;
  const disp = { thr: 0, brk: 0, aero: 0 };
  const status = m => { $('#status').textContent = m || ''; };
  const fmtClock = ms => { const s = ms / 1000, m = Math.floor(s / 60); return m + ':' + (s - m * 60).toFixed(1).padStart(4, '0'); };
  const lerp = (arr, T, tt) => { const n = T.length, i = G.bsearch(T, tt); if (i < 0) return arr[0]; if (i >= n - 1) return arr[n - 1]; const f = (tt - T[i]) / ((T[i + 1] - T[i]) || 1); return arr[i] + (arr[i + 1] - arr[i]) * f; };
  const ease = (cur, target, dt, tau) => (dt == null ? target : cur + (target - cur) * (1 - Math.exp(-dt / tau)));

  function fillLaps() {
    const L = by.get(sel) || [];
    $('#lap').innerHTML = L.map(l => '<option value="' + l.lap_number + '">Lap ' + l.lap_number + (l.lap_duration > 0 ? ' · ' + G.lapTime(l.lap_duration) : '') + (l.is_pit_out_lap ? ' · out lap' : '') + '</option>').join('');
    if (!L.some(l => l.lap_number === lapNo)) lapNo = L.length ? L[0].lap_number : 1;
    $('#lap').value = lapNo;
  }
  function drawVideos() {
    const d = dr.map.get(sel), q = race.name + ' ' + race.year;
    $('#vids').innerHTML = '<a class="lk" target="_blank" rel="noopener" href="' + G.yt(q + ' ' + d.name + ' onboard') + '">Official F1 channel: ' + esc(d.name) + ' onboard</a>' +
      (flD ? '<a class="lk" target="_blank" rel="noopener" href="' + G.yt(q + ' ' + flD.name + ' fastest lap onboard') + '">Fastest lap of the race: ' + esc(flD.name) + ' (' + G.lapTime(fl.lap_duration) + ')</a>' : '') +
      '<a class="lk" target="_blank" rel="noopener" href="' + G.yt(q + ' highlights') + '">Race highlights</a><a class="lk" target="_blank" rel="noopener" href="' + G.f1tv + '">F1 TV: full onboard feeds</a>';
  }
  function drawOvertakes() {
    const made = [], lost = [];
    (ots || []).forEach(o => {
      const ts = G.ts(o.date); if (ts == null) return;
      if (o.overtaking_driver_number === sel) made.push({ ts, other: o.overtaken_driver_number, pos: o.position });
      else if (o.overtaken_driver_number === sel) lost.push({ ts, other: o.overtaking_driver_number, pos: o.position });
    });
    const item = (e, isLost) => {
      const od = dr.map.get(e.other), ln = lapOf(sel, e.ts);
      return '<button type="button" class="ot' + (isLost ? ' lost' : '') + '" data-ts="' + e.ts + '" data-lap="' + ln + '"><b>Lap ' + ln + '</b> ' + (isLost ? 'passed by ' : 'passed ') + esc(od ? od.acr : '#' + e.other) + (e.pos && !isLost ? ' for P' + e.pos : '') + '</button>';
    };
    $('#ots').innerHTML = (made.length || lost.length)
      ? '<h3>Passes made (' + made.length + ')</h3><div class="otlist">' + (made.map(e => item(e, false)).join('') || '<span class="muted">None recorded</span>') + '</div><h3 style="margin-top:16px">Places lost (' + lost.length + ')</h3><div class="otlist">' + (lost.map(e => item(e, true)).join('') || '<span class="muted">None recorded</span>') + '</div>'
      : '<p class="note">OpenF1 has no overtake data for this driver in this race.</p>';
    $$('#ots .ot').forEach(b => b.onclick = () => { lapNo = Number(b.dataset.lap); $('#lap').value = lapNo; load(Number(b.dataset.ts) - 6000); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    drawOvertakes.list = made;
  }

  async function load(seekTs) {
    stop(); const tok = ++token; D = null;
    status('Loading lap ' + lapNo + '…');
    history.replaceState(null, '', '?s=' + race.key + '&d=' + sel + '&lap=' + lapNo);
    const win = G.lapWindow(by.get(sel) || [], lapNo, med);
    if (!win) { status('This lap has no timing window, try another lap.'); return; }
    const iso = x => new Date(x).toISOString(), base = { session_key: race.key, 'date>=': iso(win.start), 'date<': iso(win.end) };
    let loc, car;
    try { [loc, car] = await Promise.all([G.api('location', base), G.api('car_data', Object.assign({ driver_number: sel }, base))]); }
    catch (e) { if (tok === token) status(e.message); return; }
    if (tok !== token) return;
    loc = loc.slice().sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    const cars = new Map();
    for (const r of loc) {
      const tt = G.ts(r.date); if (tt == null || (r.x === 0 && r.y === 0)) continue;
      let c = cars.get(r.driver_number); if (!c) { c = { t: [], x: [], y: [] }; cars.set(r.driver_number, c); }
      c.t.push(tt - win.start); c.x.push(r.x); c.y.push(r.y);
    }
    const me = cars.get(sel);
    if (!me || me.t.length < 5) { status('OpenF1 has no location data for this lap.'); $('#mapHost').innerHTML = ''; return; }
    car = car.slice().sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    const tel = { t: [], speed: [], thr: [], brk: [], gear: [], drs: [], aero: [] };
    for (const r of car) { const tt = G.ts(r.date); if (tt == null) continue; tel.t.push(tt - win.start); tel.speed.push(r.speed || 0); tel.thr.push(r.throttle || 0); tel.brk.push(r.brake || 0); tel.gear.push(r.n_gear || 0); tel.drs.push(r.drs || 0); }
    /* active aero: use the telemetry channel when it carries a real signal, otherwise estimate */
    const nT = tel.t.length, open = tel.drs.map(v => v >= 8 ? 1 : 0), share = open.reduce((a, b) => a + b, 0) / Math.max(1, nT), chan = share > 0.02 && share < 0.7;
    const raw = tel.t.map((_, i) => chan ? open[i] : (tel.thr[i] >= 98 && tel.brk[i] === 0 && tel.speed[i] >= 170 ? 1 : 0));
    tel.aero = raw.map((_, i) => { let s = 0, c = 0; for (let k = i - 2; k <= i + 2; k++) if (k >= 0 && k < nT) { s += raw[k]; c++; } return s / c >= 0.5 ? 1 : 0; });
    const dur = win.end - win.start, P = G.projector(me.x.map((x, i) => [x, me.y[i]]), 600, 420, 24);
    D = { win, dur, cars, tel, P, chan };
    D.marks = (drawOvertakes.list || []).filter(e => e.ts >= win.start && e.ts <= win.end).map(e => e.ts - win.start);
    D.events = (ots || []).map(o => ({ rel: G.ts(o.date) - win.start, a: o.overtaking_driver_number, b: o.overtaken_driver_number, pos: o.position })).filter(e => e.rel >= 0 && e.rel <= dur).sort((x, y) => x.rel - y.rel);
    D.feedN = -1; D.key = '';
    $('#aeroNote').textContent = posBy.size ? (chan ? 'Active aero mode comes from the car’s telemetry channel.' : 'Active aero mode is estimated from throttle, brake and speed because OpenF1 has no usable channel for this lap.') : '';
    status(''); buildMap(); buildOrder(); drawTrace();
    const sc = $('#scrub'); sc.max = dur; sc.value = 0;
    t = seekTs != null ? Math.max(0, Math.min(dur, seekTs - win.start)) : 0;
    render(null);
  }
  function buildMap() {
    const me = D.cars.get(sel);
    const path = 'M' + me.x.map((x, i) => { const p = D.P(x, me.y[i]); return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join('L');
    let g = '';
    D.cars.forEach((c, n) => { const d = dr.map.get(n); if (!d) return; const me2 = n === sel; g += '<g class="car" data-n="' + n + '"><circle r="' + (me2 ? 8 : 5) + '" style="fill:' + d.color + ';stroke:' + (me2 ? 'var(--ink)' : 'var(--panel)') + ';stroke-width:' + (me2 ? 2.5 : 1.5) + '"/><text x="10" y="-6" style="' + (me2 ? 'font-size:11px' : '') + '">' + esc(d.acr) + '</text></g>'; });
    $('#mapHost').innerHTML = '<svg class="map" viewBox="0 0 600 420" role="img" aria-label="Track map with live car positions"><path class="base" d="' + path + '"/>' + g + '</svg>';
    D.nodes = $$('#mapHost .car').map(el => ({ el, c: D.cars.get(Number(el.dataset.n)) }));
  }
  function buildOrder() {
    const host = $('#lo'); if (!posBy.size) { host.innerHTML = '<p class="note">OpenF1 has no position feed for this race.</p>'; D.rows = []; return; }
    const start = orderAt(D.win.start); D.base = new Map(start.map((o, i) => [o.n, i + 1]));
    host.style.height = (start.length * ROW) + 'px';
    host.innerHTML = start.map((o, i) => { const d = dr.map.get(o.n); return '<div class="lo" data-n="' + o.n + '" style="transform:translateY(' + (i * ROW) + 'px)"><span class="p">' + (i + 1) + '</span><span class="tc" style="--tc:' + d.color + '"></span><b>' + esc(d.acr) + '</b><span class="nm muted">' + esc(d.name) + '</span><span class="dl"></span></div>'; }).join('');
    D.rows = new Map($$('#lo .lo').map(el => [Number(el.dataset.n), el]));
    D.rank = new Map(start.map((o, i) => [o.n, i + 1]));
    $$('#lo .lo').forEach(el => { el.onclick = () => { const n = Number(el.dataset.n); if (n === sel) return; sel = n; $('#drv').value = n; fillLaps(); drawVideos(); drawOvertakes(); load(); }; });
  }
  function updateOrder() {
    if (!D.rows || !D.rows.size) return;
    const ord = orderAt(D.win.start + t), key = ord.map(o => o.n).join(',');
    if (key === D.key) return; D.key = key;
    ord.forEach((o, i) => {
      const el = D.rows.get(o.n); if (!el) return;
      const prev = D.rank.get(o.n), now = i + 1;
      el.style.transform = 'translateY(' + (i * ROW) + 'px)'; el.firstChild.textContent = now;
      el.classList.toggle('me', o.n === sel);
      const dlt = D.base.get(o.n) - now, dl = el.querySelector('.dl');
      dl.textContent = dlt > 0 ? '▲' + dlt : dlt < 0 ? '▼' + (-dlt) : ''; dl.style.color = dlt > 0 ? 'var(--green)' : 'var(--red)';
      if (prev !== now) { el.classList.remove('up', 'dn'); void el.offsetWidth; el.classList.add(now < prev ? 'up' : 'dn'); }
      D.rank.set(o.n, now);
    });
  }
  function updateFeed() {
    let n = 0; while (n < D.events.length && D.events[n].rel <= t) n++;
    if (n === D.feedN) return; D.feedN = n;
    const nm = x => { const d = dr.map.get(x); return d ? '<b style="color:' + d.color + '">' + esc(d.acr) + '</b>' : '#' + x; };
    const rows = D.events.slice(Math.max(0, n - 5), n).reverse();
    $('#feed').innerHTML = rows.length ? rows.map(e => '<div class="fi' + (e.a === sel || e.b === sel ? ' mine' : '') + '"><span class="num muted">' + fmtClock(e.rel) + '</span> ' + nm(e.a) + ' passed ' + nm(e.b) + (e.pos ? ' for P' + e.pos : '') + '</div>').join('') : '<span class="muted">No passes yet in this lap.</span>';
  }
  function interp(c, tt) {
    const n = c.t.length, i = G.bsearch(c.t, tt);
    if (i < 0) return [c.x[0], c.y[0]];
    if (i >= n - 1) return [c.x[n - 1], c.y[n - 1]];
    const f = (tt - c.t[i]) / ((c.t[i + 1] - c.t[i]) || 1);
    return [c.x[i] + (c.x[i + 1] - c.x[i]) * f, c.y[i] + (c.y[i + 1] - c.y[i]) * f];
  }
  function drawTrace() {
    const host = $('#trace'), W = Math.max(260, host.clientWidth || 400), H = 150, T = D.tel;
    if (!T.t.length) { host.innerHTML = '<p class="note">No car telemetry for this lap.</p>'; return; }
    const sx = v => v / D.dur * W, ys = v => 70 - v / 360 * 66, yt = v => 146 - v / 100 * 66;
    let sp = 'M', th = 'M', br = '';
    T.t.forEach((v, i) => { sp += sx(v).toFixed(1) + ',' + ys(T.speed[i]).toFixed(1) + (i < T.t.length - 1 ? 'L' : ''); th += sx(v).toFixed(1) + ',' + yt(T.thr[i]).toFixed(1) + (i < T.t.length - 1 ? 'L' : ''); if (T.brk[i] > 0) br += '<rect x="' + sx(v).toFixed(1) + '" y="76" width="3" height="70" style="fill:var(--red);opacity:.28"/>'; });
    const marks = D.marks.map(m => '<line x1="' + sx(m) + '" x2="' + sx(m) + '" y1="0" y2="' + H + '" style="stroke:#ff9d00;stroke-width:2"/>').join('');
    host.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '"><text x="2" y="12" style="fill:var(--muted);font:11px var(--mono)">Speed</text><text x="2" y="90" style="fill:var(--muted);font:11px var(--mono)">Throttle and brake</text>' + br + marks + '<path d="' + sp + '" fill="none" style="stroke:var(--blue)" stroke-width="2"/><path d="' + th + '" fill="none" style="stroke:var(--green)" stroke-width="2"/><line id="cur" y1="0" y2="' + H + '" style="stroke:var(--ink);stroke-width:1.5"/></svg>';
    const seek = e => { const r = host.getBoundingClientRect(); t = Math.max(0, Math.min(D.dur, (e.clientX - r.left) / r.width * D.dur)); render(null); };
    let drag = false;
    host.onpointerdown = e => { drag = true; host.setPointerCapture(e.pointerId); seek(e); };
    host.onpointermove = e => { if (drag) seek(e); };
    host.onpointerup = () => { drag = false; };
    D.traceW = W;
  }
  /* dt = real milliseconds since the last frame, or null to snap (seeking) */
  function render(dt) {
    if (!D) return;
    for (const n of D.nodes) { const p = interp(n.c, t), q = D.P(p[0], p[1]); n.el.setAttribute('transform', 'translate(' + q[0].toFixed(1) + ',' + q[1].toFixed(1) + ')'); }
    const T = D.tel;
    if (T.t.length) {
      const i = Math.max(0, G.bsearch(T.t, t));
      $('#vSpeed').textContent = Math.round(lerp(T.speed, T.t, t)); $('#vGear').textContent = T.gear[i] || 'N';
      disp.thr = ease(disp.thr, Math.min(100, lerp(T.thr, T.t, t)), dt, 80);
      disp.brk = ease(disp.brk, Math.min(100, lerp(T.brk, T.t, t)), dt, 70);
      $('#mThr').style.width = disp.thr.toFixed(1) + '%'; $('#mBrk').style.width = disp.brk.toFixed(1) + '%';
      const tgt = T.aero[i]; disp.aero = ease(disp.aero, tgt, dt, 160);
      $('#flap').setAttribute('transform', 'rotate(' + (-26 * (1 - disp.aero)).toFixed(1) + ' 48 21)');
      const x = tgt === 1; $('#vAero').textContent = x ? 'X-mode' : 'Z-mode'; $('#vAero').style.color = x ? 'var(--green)' : '';
    }
    const cur = $('#cur'); if (cur) { const x = t / D.dur * (D.traceW || 1); cur.setAttribute('x1', x); cur.setAttribute('x2', x); }
    $('#scrub').value = t; $('#clock').textContent = fmtClock(t) + ' / ' + fmtClock(D.dur);
    updateOrder(); updateFeed();
  }
  function tick(now) { const dt = Math.min(100, now - last); last = now; t = Math.min(D.dur, t + dt * rate); render(dt); if (t >= D.dur) { stop(); return; } raf = requestAnimationFrame(tick); }
  function play() { if (!D) return; if (t >= D.dur) t = 0; playing = true; last = performance.now(); raf = requestAnimationFrame(tick); $('#play').textContent = 'Pause'; }
  function stop() { playing = false; cancelAnimationFrame(raf); const b = $('#play'); if (b) b.textContent = 'Play'; }

  /* wiring */
  $('#drv').value = sel;
  $('#drv').onchange = e => { sel = Number(e.target.value); fillLaps(); drawVideos(); drawOvertakes(); load(); };
  $('#lap').onchange = e => { lapNo = Number(e.target.value); load(); };
  const goLap = n => { const L = by.get(sel) || []; if (!L.some(l => l.lap_number === n)) return; lapNo = n; $('#lap').value = n; load(); };
  $('#bStart').onclick = () => goLap(1);
  $('#bFast').onclick = () => { const b = bestLapOf(sel); if (b) goLap(b.lap_number); };
  $('#bPrev').onclick = () => goLap(lapNo - 1);
  $('#bNext').onclick = () => goLap(lapNo + 1);
  $('#play').onclick = () => playing ? stop() : play();
  $('#rate').onchange = e => { rate = Number(e.target.value); };
  $('#scrub').oninput = e => { t = Number(e.target.value); render(null); };
  if (window.ResizeObserver) { let w = 0; new ResizeObserver(() => { const x = $('#trace').clientWidth; if (D && x && x !== w) { w = x; drawTrace(); render(null); } }).observe($('#trace')); }

  fillLaps(); drawVideos(); drawOvertakes(); load();
};

/* =========================================================
   HOME (landing page, static content in index.html)
   ========================================================= */
pages.home = async function () {
  await G.boot('home', { light: true });
  document.title = 'Matin Baderestani Gridlab · Formula 1 race analysis';
  const cols = $$('.gcard .col'), yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();
  const set = n => cols.forEach((c, i) => c.classList.toggle('on', i < n));
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { set(5); return; }
  (function cycle() {
    set(0); let n = 0;
    const step = () => { n++; set(n); if (n < 5) setTimeout(step, 650); else setTimeout(() => { set(0); setTimeout(cycle, 3400); }, 1500); };
    setTimeout(step, 900);
  })();
};

/* =========================================================
   ARCHIVE (every Grand Prix since 2020)
   ========================================================= */
const JOL = 'https://api.jolpi.ca/ergast/f1/';
const TEAM_COL = { mercedes: '#27F4D2', ferrari: '#E8002D', red_bull: '#3671C6', mclaren: '#FF8000', alpine: '#2293D1', renault: '#FFD800', aston_martin: '#229971', racing_point: '#F596C8', alphatauri: '#5E8FAA', rb: '#6692FF', haas: '#B6BABD', williams: '#64C4FF', alfa: '#C92D4B', sauber: '#52E252', audi: '#F50537', cadillac: '#C0C0C8', toro_rosso: '#469BFF' };
const teamCol = id => TEAM_COL[id] || '#8d9ba9';
const jol = async (path, ttl) => { const j = await G.cached(JOL + path, ttl || 36e5); return (j && j.MRData) || null; };
const fixedTtl = y => y >= new Date().getFullYear() ? 36e5 : 30 * 864e5;

pages.archive = async function () {
  await G.boot('archive', { light: true });
  const app = $('#app'), nowY = new Date().getFullYear(), qp = new URLSearchParams(location.search);
  let year = Number(qp.get('y')) || nowY; if (year < 2020 || year > nowY) year = nowY;
  const years = []; for (let y = nowY; y >= 2020; y--) years.push(y);
  app.innerHTML = '<h1>Season archive</h1><p class="lede">Every Grand Prix since 2020. Pick a season, then a race. From 2023 the full analysis pages open, with telemetry and mini-sectors. For 2020 to 2022 you get results, qualifying, lap charts and pit stops.</p>' +
    '<div class="stabs" id="years" role="tablist"></div><div class="controls" style="margin-bottom:14px"><label>Find a Grand Prix<input id="q" class="sel" type="search" placeholder="Singapore, Monza, Spa…" autocomplete="off"></label></div><div class="gplist" id="glist"></div>';
  let tok = 0, cards = [];
  function drawYears() {
    $('#years').innerHTML = years.map(y => '<button type="button" class="stab" role="tab" aria-selected="' + (y === year) + '" data-y="' + y + '"><b>' + y + '</b><span>' + (y >= 2023 ? 'Full data' : 'Results') + '</span></button>').join('');
    $$('#years .stab').forEach(b => b.onclick = () => { year = Number(b.dataset.y); history.replaceState(null, '', '?y=' + year); drawYears(); load(); });
  }
  async function load() {
    const t = ++tok, box = $('#glist'); box.innerHTML = G.loading('Loading ' + year + '…');
    let races = [], link = new Map();
    try { const m = await jol(year + '/results/1.json?limit=100', fixedTtl(year)); races = (m && m.RaceTable && m.RaceTable.Races) || []; } catch (e) { if (t === tok) box.innerHTML = '<div class="note err"><b>Could not load ' + year + '</b><p>' + esc(e.message) + '</p></div>'; return; }
    if (year >= 2023) { try { (await G.api('sessions', { year, session_name: 'Race' }, 36e5)).forEach(s => link.set(String(s.date_start).slice(0, 10), s.session_key)); } catch (e) { /* classic links only */ } }
    if (t !== tok) return;
    if (!races.length) { box.innerHTML = '<p class="note">No finished races for ' + year + ' yet.</p>'; return; }
    cards = races.map(r => {
      const w = (r.Results && r.Results[0]) || null, loc = (r.Circuit && r.Circuit.Location) || {};
      const near = [...link.keys()].find(k => Math.abs(Date.parse(k) - Date.parse(r.date)) <= 864e5), key = near ? link.get(near) : null;
      const d = new Date(r.date + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      return { text: (r.raceName + ' ' + (loc.locality || '') + ' ' + (loc.country || '')).toLowerCase(), html:
        '<article class="gp"><div class="gph"><span class="rd num">R' + r.round + '</span><span class="muted">' + d + '</span></div><h3>' + esc(r.raceName) + '</h3><p class="muted">' + esc(loc.locality || '') + (loc.country ? ', ' + esc(loc.country) : '') + '</p>' +
        (w ? '<p class="win"><span class="tc" style="--tc:' + teamCol(w.Constructor.constructorId) + '"></span>' + esc(w.Driver.givenName + ' ' + w.Driver.familyName) + '<span class="muted"> · ' + esc(w.Constructor.name) + '</span></p>' : '') +
        '<div class="links">' + (key ? '<a class="lk main" href="overview.html?s=' + key + '">Open full analysis</a>' : '') + '<a class="lk" href="classic.html?y=' + year + '&r=' + r.round + '">Results and laps</a></div></article>' };
    });
    paint();
  }
  function paint() {
    const q = $('#q').value.trim().toLowerCase(), f = cards.filter(c => !q || c.text.includes(q));
    $('#glist').innerHTML = f.length ? f.map(c => c.html).join('') : '<p class="note">No Grand Prix matches that search.</p>';
  }
  $('#q').oninput = paint;
  drawYears(); load();
};

/* =========================================================
   CLASSIC RACE PAGE (any season, Jolpica data)
   ========================================================= */
pages.classic = async function () {
  const qp = new URLSearchParams(location.search), y = Number(qp.get('y')), rd = Number(qp.get('r'));
  await G.boot('archive', { light: true, classic: { year: y || undefined, round: rd } });
  const app = $('#app');
  if (!y || !rd) { app.innerHTML = '<p class="note">Pick a race in the <a href="archive.html"><u>season archive</u></a>.</p>'; return; }
  const base = y + '/' + rd, ttl = fixedTtl(y);
  let race;
  try { const m = await jol(base + '/results.json?limit=100', ttl); race = m && m.RaceTable && m.RaceTable.Races[0]; } catch (e) { return G.fail(e); }
  if (!race) { app.innerHTML = '<p class="note">That race was not found. <a href="archive.html"><u>Back to the archive</u></a></p>'; return; }
  document.title = race.raceName + ' ' + y + ' · Matin Baderestani Gridlab';
  const loc = (race.Circuit && race.Circuit.Location) || {}, results = race.Results || [];
  const drv = new Map(results.map(r => [r.Driver.driverId, { id: r.Driver.driverId, acr: r.Driver.code || r.Driver.familyName.slice(0, 3).toUpperCase(), name: r.Driver.givenName + ' ' + r.Driver.familyName, team: r.Constructor.name, color: teamCol(r.Constructor.constructorId), driver_number: r.Driver.driverId }]));
  const dc = d => '<span class="tc" style="--tc:' + d.color + '"></span><b class="acr" style="color:' + d.color + '">' + esc(d.acr) + '</b> <span class="muted">' + esc(d.name) + '</span>';
  const secs = t => { if (!t) return null; const m = /^(?:(\d+):)?(\d+(?:\.\d+)?)$/.exec(String(t).trim()); return m ? (m[1] ? Number(m[1]) * 60 : 0) + Number(m[2]) : null; };
  app.innerHTML = '<h1>' + esc(race.raceName) + ' ' + y + '</h1><p class="lede">' + esc((race.Circuit && race.Circuit.circuitName) || '') + ', ' + esc(loc.locality || '') + ' · ' + new Date(race.date + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + '</p>' +
    '<div class="links" id="fullLink"></div>' + (y < 2023 ? '<p class="note" style="padding-bottom:0">Timing, mini-sector and onboard pages need OpenF1 telemetry, which only exists from 2023. This season has results, qualifying, lap charts and pit stops.</p>' : '') + '<div class="stabs" id="ctabs" role="tablist"></div><div id="cbody"></div>';
  if (y >= 2023) { (async () => { try { const ss = await G.api('sessions', { year: y, session_name: 'Race' }, 36e5), s = ss.find(x => Math.abs(Date.parse(String(x.date_start).slice(0, 10)) - Date.parse(race.date)) <= 864e5); if (s) $('#fullLink').innerHTML = '<a class="lk main" href="overview.html?s=' + s.session_key + '">Open the full analysis for this race</a>'; } catch (e) { /* optional */ } })(); }

  const TABS = [['results', 'Results'], ['quali', 'Qualifying'], ['laps', 'Lap charts'], ['pits', 'Pit stops']];
  let tab = TABS.some(t => t[0] === qp.get('t')) ? qp.get('t') : 'results', tok = 0; const cache = {};
  function drawTabs() { $('#ctabs').innerHTML = TABS.map(t => '<button type="button" class="stab" role="tab" aria-selected="' + (t[0] === tab) + '" data-t="' + t[0] + '"><b>' + t[1] + '</b></button>').join(''); $$('#ctabs .stab').forEach(b => b.onclick = () => { tab = b.dataset.t; drawTabs(); show(); }); }
  async function show() {
    const t = ++tok, box = $('#cbody'); box.innerHTML = G.loading('Loading…');
    try { const html = await VIEW[tab](); if (t !== tok) return; if (html != null) box.innerHTML = html; if (t === tok && AFTER[tab]) AFTER[tab](); }
    catch (e) { if (t === tok) box.innerHTML = '<div class="note err"><b>Could not load this section</b><p>' + esc(e.message) + '</p></div>'; }
  }
  const VIEW = {
    async results() {
      const fl = results.find(r => r.FastestLap && r.FastestLap.rank === '1');
      let prev = null;
      const gapTxt = r => {
        if (r.position === '1') { prev = 0; return r.Time ? r.Time.time : r.status; }
        if (r.Time && /^\+/.test(r.Time.time)) { const g = secs(r.Time.time.slice(1)); if (g != null && prev != null) { const v = '+' + (g - prev).toFixed(3); prev = g; return v; } prev = g; return r.Time.time; }
        prev = null; return r.status;
      };
      return '<div class="scroll"><table class="tbl"><thead><tr><th>Pos</th><th>Driver</th><th>Team</th><th class="r">Grid</th><th class="r">Laps</th><th class="r">Gap to car ahead</th><th class="r">Fastest lap</th><th class="r">Pts</th></tr></thead><tbody>' +
        results.map(r => { const d = drv.get(r.Driver.driverId), f = r.FastestLap; return '<tr><td class="n"><span class="pos">' + esc(r.positionText || r.position) + '</span></td><td>' + dc(d) + '</td><td class="muted">' + esc(r.Constructor.name) + '</td><td class="n r">' + (r.grid === '0' ? 'Pit' : esc(r.grid)) + '</td><td class="n r">' + esc(r.laps) + '</td><td class="n r">' + esc(gapTxt(r)) + '</td><td class="n r ' + (f && f.rank === '1' ? 'pp' : '') + '">' + (f ? esc(f.Time.time) + ' <span class="muted">L' + esc(f.lap) + '</span>' : '–') + '</td><td class="n r">' + esc(r.points) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        '<p class="note">The winner shows race time, everyone else the gap to the car directly ahead. ' + (fl ? 'Fastest lap: ' + esc(fl.Driver.givenName + ' ' + fl.Driver.familyName) + ', ' + esc(fl.FastestLap.Time.time) + (fl.FastestLap.AverageSpeed ? ' at ' + esc(fl.FastestLap.AverageSpeed.speed) + ' km/h average.' : '.') : 'Fastest lap data is not available for this race.') + '</p>';
    },
    async quali() {
      const m = await jol(base + '/qualifying.json?limit=100', ttl), Q = (m && m.RaceTable && m.RaceTable.Races[0] && m.RaceTable.Races[0].QualifyingResults) || [];
      if (!Q.length) return '<p class="note">No qualifying data for this race.</p>';
      const best = k => Math.min(...Q.map(q => secs(q[k])).filter(Boolean));
      const b = { Q1: best('Q1'), Q2: best('Q2'), Q3: best('Q3') };
      const cell = (q, k) => '<td class="n r ' + (q[k] && secs(q[k]) === b[k] ? 'pp' : '') + '">' + esc(q[k] || '–') + '</td>';
      return '<div class="scroll"><table class="tbl"><thead><tr><th>Pos</th><th>Driver</th><th>Team</th><th class="r">Q1</th><th class="r">Q2</th><th class="r">Q3</th></tr></thead><tbody>' +
        Q.map(q => { const d = drv.get(q.Driver.driverId) || { acr: q.Driver.code || q.Driver.familyName.slice(0, 3).toUpperCase(), name: q.Driver.givenName + ' ' + q.Driver.familyName, color: teamCol(q.Constructor.constructorId) }; return '<tr><td class="n"><span class="pos">' + esc(q.position) + '</span></td><td>' + dc(d) + '</td><td class="muted">' + esc(q.Constructor.name) + '</td>' + cell(q, 'Q1') + cell(q, 'Q2') + cell(q, 'Q3') + '</tr>'; }).join('') + '</tbody></table></div><p class="note">Purple is the fastest time of each knockout segment.</p>';
    },
    async laps() {
      if (!cache.laps) {
        const by = new Map(); let off = 0, total = Infinity, lim = 1000, guard = 0;
        while (off < total && guard++ < 40) {
          const m = await jol(base + '/laps.json?limit=' + lim + '&offset=' + off, ttl); if (!m) break;
          total = Number(m.total) || 0; const L = (m.RaceTable.Races[0] || {}).Laps || [];
          L.forEach(l => (l.Timings || []).forEach(t => { if (!by.has(t.driverId)) by.set(t.driverId, []); by.get(t.driverId).push({ lap: Number(l.number), pos: Number(t.position), t: secs(t.time) }); }));
          const got = Number(m.limit) || lim; off += got; lim = got; if (!L.length) break;
        }
        for (const a of by.values()) a.sort((p, q) => p.lap - q.lap);
        cache.laps = by;
      }
      if (!cache.laps.size) return '<p class="note">OpenF1 does not cover this season and the archive has no lap times for this race.</p>';
      return '<h2>Lap times</h2><p class="muted" style="margin:2px 0 8px">Hover to compare drivers lap by lap.</p><div class="chips" id="cchips"></div><div class="btns" style="margin:6px 0 10px"><button class="btn ghost" data-sel="3" type="button">Top 3</button><button class="btn ghost" data-sel="10" type="button">Top 10</button><button class="btn ghost" data-sel="99" type="button">Everyone</button><label class="check"><input type="checkbox" id="cslow"> Include slow laps</label></div><div class="panel"><div id="clap"></div></div>' +
        '<h2 style="margin-top:30px">Race positions</h2><div class="panel" style="margin-top:8px"><div id="cpos"></div></div>';
    },
    async pits() {
      const m = await jol(base + '/pitstops.json?limit=100', ttl), P = (m && m.RaceTable && m.RaceTable.Races[0] && m.RaceTable.Races[0].PitStops) || [];
      if (!P.length) return '<p class="note">No pit stop data for this race.</p>';
      const dur = p => secs(p.duration), fast = Math.min(...P.map(dur).filter(Boolean));
      return '<div class="scroll"><table class="tbl"><thead><tr><th>Lap</th><th>Driver</th><th class="r">Stop</th><th class="r">Time of day</th><th class="r">Pit lane time</th></tr></thead><tbody>' +
        P.slice().sort((a, b) => Number(a.lap) - Number(b.lap) || Number(a.stop) - Number(b.stop)).map(p => { const d = drv.get(p.driverId) || { acr: p.driverId, name: p.driverId, color: '#8d9ba9' }; return '<tr><td class="n">' + esc(p.lap) + '</td><td>' + dc(d) + '</td><td class="n r">' + esc(p.stop) + '</td><td class="n r muted">' + esc(p.time) + '</td><td class="n r ' + (dur(p) === fast ? 'pp' : '') + '">' + esc(p.duration) + ' s</td></tr>'; }).join('') + '</tbody></table></div><p class="note">The time is the whole trip through the pit lane, not just the stop.</p>';
    }
  };
  const AFTER = {
    laps() {
      const by = cache.laps, order = results.map(r => r.Driver.driverId).filter(id => by.has(id)); by.forEach((_, id) => { if (!order.includes(id) && drv.has(id)) order.push(id); });
      const sel = new Set(order.slice(0, 3)), maxLap = Math.max(...[...by.values()].map(a => a.length ? a[a.length - 1].lap : 0));
      const best = Math.min(...[...by.values()].flat().map(p => p.t).filter(Boolean));
      const styled = () => { const used = new Map(); return order.filter(id => sel.has(id)).map(id => { const d = drv.get(id), k = used.get(d.color) || 0; used.set(d.color, k + 1); return { d, id, dash: k ? '6 4' : null }; }); };
      const lapCfg = () => { const cut = $('#cslow').checked ? Infinity : best * 1.1; return { label: 'Lap times', height: 320, yFmt: G.lapTick, tipFmt: G.lapTime, yWide: true, xMin: 1, xMax: maxLap, series: styled().map(o => ({ name: o.d.acr, color: o.d.color, dash: o.dash, pts: by.get(o.id).map(p => ({ x: p.lap, y: p.t && p.t <= cut ? p.t : null })) })) }; };
      const posCfg = () => ({ label: 'Race positions', height: 320, invertY: true, yMin: 1, yMax: Math.max(results.length, 2), xMin: 1, xMax: maxLap, tipFmt: v => 'P' + v, yFmt: v => 'P' + Math.round(v), yTicks: Array.from({ length: results.length }, (_, i) => i + 1).filter(v => v === 1 || v % 2 === 0), series: styled().map(o => ({ name: o.d.acr, color: o.d.color, dash: o.dash, pts: by.get(o.id).map(p => ({ x: p.lap, y: p.pos || null })) })) });
      const lc = G.lineChart($('#clap'), lapCfg()), pc = G.lineChart($('#cpos'), posCfg());
      const refresh = () => { lc.update(lapCfg()); pc.update(posCfg()); };
      function chips() { $('#cchips').innerHTML = order.map(id => G.chip(drv.get(id), sel.has(id))).join(''); $$('#cchips .chip').forEach(c => c.onclick = () => { const id = c.dataset.n; if (sel.has(id)) sel.delete(id); else sel.add(id); chips(); refresh(); }); }
      chips();
      $$('[data-sel]').forEach(b => b.onclick = () => { sel.clear(); order.slice(0, Number(b.dataset.sel)).forEach(id => sel.add(id)); chips(); refresh(); });
      $('#cslow').onchange = () => lc.update(lapCfg());
    }
  };
  drawTabs(); show();
};

/* =========================================================
   CHAMPIONSHIP (standings from Jolpica, fireworks when the title is decided)
   ========================================================= */
function fireworks(canvas, ms) {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return { stop() {} };
  const ctx = canvas.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1);
  const r0 = canvas.getBoundingClientRect(); canvas.width = Math.max(1, r0.width * dpr); canvas.height = Math.max(1, r0.height * dpr);
  const colors = ['#ff4b4b', '#f5c518', '#34d17f', '#6e9cff', '#b07dff', '#ffffff', '#ff9d00'];
  let parts = [], raf = 0, stopped = false; const t0 = performance.now(); let last = t0, nextBurst = t0;
  function burst(x, y) {
    const c = colors[Math.floor(Math.random() * colors.length)], n = 55 + Math.floor(Math.random() * 35);
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = 1.4 + Math.random() * 4.3; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, decay: 0.008 + Math.random() * 0.01, color: Math.random() < 0.2 ? '#fff' : c }); }
  }
  function frame(now) {
    const dt = Math.min(40, now - last) / 16.7; last = now;
    const W = canvas.width / dpr, H = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    if (now < t0 + ms && now >= nextBurst) { burst(W * (0.1 + Math.random() * 0.8), H * (0.1 + Math.random() * 0.5)); nextBurst = now + 260 + Math.random() * 420; }
    parts = parts.filter(q => q.life > 0);
    for (const q of parts) { q.vy += 0.045 * dt; q.vx *= 0.992; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= q.decay * dt; ctx.globalAlpha = Math.max(0, q.life); ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, 2, 0, 6.2832); ctx.fill(); }
    ctx.globalAlpha = 1;
    if (!stopped && (now < t0 + ms || parts.length)) raf = requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
  }
  raf = requestAnimationFrame(frame);
  return { stop() { stopped = true; cancelAnimationFrame(raf); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); } };
}

pages.championship = async function () {
  await G.boot('championship', { light: true });
  const app = $('#app'), nowY = new Date().getFullYear(), qp = new URLSearchParams(location.search);
  let year = Number(qp.get('y')) || nowY; if (year < 2020 || year > nowY) year = nowY;
  let kind = qp.get('k') === 'teams' ? 'teams' : 'drivers', fx = null, tok = 0;
  const years = []; for (let y = nowY; y >= 2020; y--) years.push(y);
  app.innerHTML = '<h1>Championship</h1><p class="lede" id="clede"></p><div class="controls" style="margin-top:18px"><label>Season<select id="cy">' + years.map(y => '<option value="' + y + '"' + (y === year ? ' selected' : '') + '>' + y + '</option>').join('') + '</select></label><div class="stabs" id="ck" role="tablist" style="margin:0"></div></div><div id="cbox"></div>';
  const drawTabs = () => { $('#ck').innerHTML = [['drivers', 'Drivers'], ['teams', 'Constructors']].map(k => '<button type="button" class="stab" role="tab" aria-selected="' + (k[0] === kind) + '" data-k="' + k[0] + '"><b>' + k[1] + '</b></button>').join(''); $$('#ck .stab').forEach(b => b.onclick = () => { kind = b.dataset.k; drawTabs(); load(); }); };
  $('#cy').onchange = e => { year = Number(e.target.value); load(); };
  const wiki = async url => {
    try { const t = decodeURIComponent(String(url).split('/wiki/')[1] || ''); if (!t) return null; const j = await G.cached('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(t), 30 * 864e5); return (j && j.thumbnail && j.thumbnail.source) || null; } catch (e) { return null; }
  };
  async function load() {
    const t = ++tok; if (fx) { fx.stop(); fx = null; }
    history.replaceState(null, '', '?y=' + year + '&k=' + kind);
    const box = $('#cbox'); box.innerHTML = G.loading('Loading standings…');
    let m, sched;
    try { [m, sched] = await Promise.all([G.jol(year + '/' + (kind === 'teams' ? 'constructorstandings' : 'driverstandings') + '.json?limit=100', fixedTtl(year)), G.jol(year + '.json?limit=100', fixedTtl(year))]); }
    catch (e) { if (t === tok) box.innerHTML = '<div class="note err"><b>Could not load the standings</b><p>' + esc(e.message) + '</p></div>'; return; }
    if (t !== tok) return;
    const sl = m && m.StandingsTable && m.StandingsTable.StandingsLists && m.StandingsTable.StandingsLists[0];
    const list = sl ? ((kind === 'teams' ? sl.ConstructorStandings : sl.DriverStandings) || []) : [];
    if (!list.length) { box.innerHTML = '<p class="note">No standings are published for ' + year + ' yet.</p>'; $('#clede').textContent = ''; return; }
    const races = (sched && sched.RaceTable && sched.RaceTable.Races) || [], now = Date.now();
    const left = races.filter(r => Date.parse(r.date + 'T' + (r.time || '12:00:00Z')) + 2.5 * 36e5 > now);
    const sprints = left.filter(r => r.Sprint).length, maxLeft = kind === 'teams' ? left.length * 43 + sprints * 15 : left.length * 25 + sprints * 8;
    const pts = x => Number(x.points), lead = list.length > 1 ? pts(list[0]) - pts(list[1]) : 1;
    const decided = year < nowY ? true : (left.length === 0 || lead > maxLeft);
    const name = x => kind === 'teams' ? x.Constructor.name : x.Driver.givenName + ' ' + x.Driver.familyName;
    const team = x => kind === 'teams' ? '' : (x.Constructors && x.Constructors[0] ? x.Constructors[0].name : '');
    const col = x => teamCol(kind === 'teams' ? x.Constructor.constructorId : (x.Constructors && x.Constructors[0] ? x.Constructors[0].constructorId : ''));
    const ini = x => kind === 'teams' ? x.Constructor.name.slice(0, 3).toUpperCase() : (x.Driver.code || x.Driver.familyName.slice(0, 3).toUpperCase());
    $('#clede').textContent = year + ' ' + (kind === 'teams' ? 'Constructors' : 'Drivers') + ' championship, after round ' + sl.round + ' of ' + (races.length || '?') + '. ' +
      (decided ? (year < nowY ? 'Final standings.' : 'The title is decided.') : 'Still ' + maxLeft + ' points up for grabs, the leader is ' + lead + ' ahead.');
    const card = (x, k) => '<article class="pc p' + k + '" style="--tc:' + col(x) + '">' + (k === 1 ? '<span class="crown">' + (decided ? (year < nowY ? 'Champion ' + year : 'Champion') : 'Leader') + '</span>' : '<span class="pos2 num">P' + k + '</span>') +
      '<div class="ph ' + (kind === 'teams' ? 'tb' : '') + '" data-i="' + (k - 1) + '"><span class="ini">' + esc(ini(x)) + '</span></div><div class="nm">' + esc(name(x)) + '</div><div class="tm">' + esc(team(x) || (x.wins + (x.wins === '1' ? ' win' : ' wins'))) + '</div><div class="pts num">' + esc(x.points) + '<small> pts</small></div></article>';
    const top = list.slice(0, 3);
    box.innerHTML = '<section class="champ" id="champ"><canvas class="fw" id="fw" aria-hidden="true"></canvas><div class="podium">' + (top[1] ? card(top[1], 2) : '<div></div>') + card(top[0], 1) + (top[2] ? card(top[2], 3) : '<div></div>') + '</div>' +
      (decided ? '<button type="button" class="btn ghost celebrate" id="again">Replay fireworks</button>' : '') + '</section>' +
      '<div class="scroll" style="margin-top:18px"><table class="tbl"><thead><tr><th>Pos</th><th>' + (kind === 'teams' ? 'Team' : 'Driver') + '</th>' + (kind === 'teams' ? '' : '<th>Team</th>') + '<th class="r">Wins</th><th class="r">Behind</th><th class="r">Points</th></tr></thead><tbody>' +
      list.map((x, i) => '<tr><td class="n"><span class="pos">' + esc(x.positionText || x.position) + '</span></td><td><span class="tc" style="--tc:' + col(x) + '"></span><b>' + esc(name(x)) + '</b></td>' + (kind === 'teams' ? '' : '<td class="muted">' + esc(team(x)) + '</td>') + '<td class="n r">' + esc(x.wins) + '</td><td class="n r muted">' + (i === 0 ? '–' : '-' + (pts(list[0]) - pts(x))) + '</td><td class="n r"><b>' + esc(x.points) + '</b></td></tr>').join('') + '</tbody></table></div>' +
      '<p class="note">Standings come from the Jolpica archive. ' + (kind === 'drivers' ? 'Driver photos are from Wikipedia and Wikimedia Commons under their open licences.' : '') + ' The title counts as decided when the lead is bigger than the points still available (25 per race and 8 per sprint for drivers, 43 and 15 for teams).</p>';
    const play = () => { if (fx) fx.stop(); fx = fireworks($('#fw'), 7000); };
    if (decided) { play(); $('#again').onclick = play; }
    if (kind === 'drivers') top.forEach(async (x, i) => { const src = await wiki(x.Driver.url); const el = $('#champ .ph[data-i="' + i + '"]'); if (src && el && t === tok) el.style.backgroundImage = 'url("' + src.replace(/"/g, '%22') + '")'; });
  }
  drawTabs(); load();
};

const p = document.body.dataset.page;
if (pages[p]) pages[p]().catch(G.fail);
})();
