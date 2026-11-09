
/* Gridlab Christmas mode */
(function () {
'use strict';
if (window.__gridlabSnow) return;
window.__gridlabSnow = true;

const ONLY_IN_SEASON = false;
if (ONLY_IN_SEASON) {
  const d = new Date(), m = d.getMonth();
  if (!(m === 11 || (m === 0 && d.getDate() <= 6))) return;
}

const BIN = 2.5;          /* width of one snow column in px */
const MAXH = 7;           /* tallest pile in px (most spots stay lower) */
const GROW = 1.0;         /* height one settled flake adds at its centre */
const STICK = 0.8;        /* how readily a flake stays where it lands */
const EDGE = 6;           /* snow stays this far in from the box corners */
const REST = 16;          /* frames a flake rests on the pile before it melts into it */
const SEL = '.panel,.stat,.gp,.ncard,.scroll,.champ,.gcard,.cmap,.slist li,a.btn.big';

const COLORS = ['#b85c5c', '#c6a96b', '#78977d', '#8298b5', '#c28b9c'];
const GLOW = ['174,72,78', '194,157,91', '91,133,105', '105,130,166', '177,119,139'];

const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
let stored = null;
try { stored = localStorage.getItem('gridlab-snow'); } catch (e) {}
let on = stored === 'on' ? true : stored === 'off' ? false : !reduce;

const css =
'.gl-back,.gl-front{position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none}' +
'.gl-back{z-index:-1}.gl-front{z-index:60}' +
'.gl-btn{position:fixed;right:14px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:61;width:38px;height:38px;border-radius:50%;border:1px solid var(--line);background:var(--panel);color:var(--ink);cursor:pointer;display:grid;place-items:center;padding:0;opacity:.85}' +
'.gl-btn[aria-pressed="false"]{opacity:.5}.gl-btn:focus-visible{outline:3px solid var(--blue);outline-offset:2px}';

const st = document.createElement('style');
st.textContent = css;
document.head.appendChild(st);

const mk = cls => {
  const c = document.createElement('canvas');
  c.className = cls;
  c.setAttribute('aria-hidden', 'true');
  document.body.appendChild(c);
  return c;
};

const back = mk('gl-back');
const front = mk('gl-front');
const bctx = back.getContext('2d');
const fctx = front.getContext('2d');

const btn = document.createElement('button');
btn.type = 'button';
btn.className = 'gl-btn';
btn.title = 'Snow and lights on or off';
btn.setAttribute('aria-label', 'Snow and lights on or off');
btn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 2v20M4.2 7l15.6 10M4.2 17L19.8 7M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5"/></svg>';
document.body.appendChild(btn);

let W = 0, H = 0, dpr = 1;
let flakes = [], surfaces = [], surfMap = new WeakMap();
let raf = 0, last = 0, dirty = true, lastCollect = 0;
let targetN = 60, frameNo = 0, slow = 0;
let bulbs = [], arcs = [], dark = true;

/* Random, subtle Christmas background glows */
const bokeh = Array.from({ length: 6 }, () => ({
  x: 0.08 + Math.random() * 0.84,
  y: 0.08 + Math.random() * 0.84,
  r: 115 + Math.random() * 115,
  c: GLOW[Math.floor(Math.random() * GLOW.length)],
  ph: Math.random() * 6.28,
  sp: 0.00008 + Math.random() * 0.00012,
  dx: 8 + Math.random() * 13,
  dy: 7 + Math.random() * 11
}));

const wind = t => Math.sin(t / 7000) * 0.3 + Math.sin(t / 2300) * 0.12;

function newFlake(anywhere) {
  const r = 0.55 + Math.random() * 0.85;
  return {
    x: Math.random() * W,
    y: anywhere ? Math.random() * H : -8 - Math.random() * 40,
    r,
    vy: 0.48 + r * 0.22,
    vyc: 0.48 + r * 0.22,
    b: 0,
    rest: null,
    vx: 0,
    ph: Math.random() * 6.28,
    t: Math.random() * 100,
    slide: null,
    dir: 0,
    sl: 0
  };
}

function resetFlake(f) {
  f.x = Math.random() * W;
  f.y = -8 - Math.random() * 30;
  f.slide = null;
  f.rest = null;
  f.b = 0;
  f.vyc = f.vy;
  f.vx = 0;
}

function buildLights() {
  bulbs = [];
  arcs = [];

  const span = Math.max(110, Math.min(170, W / 6));
  const n = Math.ceil(W / span);
  const sag = Math.min(9, span * 0.06);
  let k = 0;

  for (let a = 0; a < n; a++) {
    const x0 = a * span;
    const x1 = Math.min(W, (a + 1) * span);
    arcs.push([x0, x1, sag]);

    const m = Math.max(2, Math.round((x1 - x0) / 36));

    for (let j = 0; j < m; j++) {
      const t = (j + 0.5) / m;
      bulbs.push({
        x: x0 + t * (x1 - x0),
        y: 2 + 4 * sag * t * (1 - t) + 1,
        c: COLORS[k++ % COLORS.length],
        ph: Math.random() * 6.28,
        sp: 0.0012 + Math.random() * 0.001
      });
    }
  }
}

function resize() {
  dpr = Math.min(1.5, window.devicePixelRatio || 1);
  W = window.innerWidth;
  H = window.innerHeight;

  [back, front].forEach(c => {
    c.width = Math.max(1, Math.round(W * dpr));
    c.height = Math.max(1, Math.round(H * dpr));
  });

  targetN = W < 600 ? 18 : Math.min(38, Math.round(W / 34));

  while (flakes.length < targetN) flakes.push(newFlake(true));
  flakes.length = Math.min(flakes.length, targetN);

  buildLights();
  dirty = true;
}

/* Find page elements where snow can settle */
function collect() {
  const hdr = document.getElementById('hdr');
  let hb = 0;

  if (hdr && getComputedStyle(hdr).position === 'sticky') {
    hb = hdr.getBoundingClientRect().bottom;
  }

  const out = [];

  document.querySelectorAll(SEL).forEach(el => {
    const r = el.getBoundingClientRect();

    if (r.width < 70 || r.height < 26 || r.top > H || r.top < hb + 2 || r.top < 2) return;

    const n = Math.ceil(r.width / BIN) + 1;
    let s = surfMap.get(el);

    if (!s || s.h.length !== n) {
      s = { h: new Float32Array(n), nz: smoothNoise(n), lump: lumpiness(n), any: false };
      surfMap.set(el, s);
    }

    s.left = r.left;
    s.right = r.right;
    s.top = r.top;
    out.push(s);
  });

  surfaces = out;
}

function smoothNoise(n) {
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = Math.random() * 2 - 1;
  for (let p = 0; p < 2; p++) for (let i = 1; i < n - 1; i++) a[i] = (a[i - 1] + a[i] * 2 + a[i + 1]) / 4;
  return a;
}

/* how deep the snow can get at each spot: some places stay thin, others build real drifts */
function lumpiness(n) {
  const a = new Float32Array(n);
  const f1 = 0.09 + Math.random() * 0.07, f2 = 0.25 + Math.random() * 0.2;
  const p1 = Math.random() * 6.28, p2 = Math.random() * 6.28, p3 = Math.random() * 6.28;

  for (let i = 0; i < n; i++) {
    const v = 0.55 * Math.sin(i * f1 + p1) + 0.3 * Math.sin(i * f2 + p2) + 0.15 * Math.sin(i * 0.7 + p3);
    a[i] = Math.max(0.16, Math.min(1, 0.52 + 0.62 * v));
  }

  return a;
}

const limAt = (s, x) => MAXH * s.lump[Math.max(0, Math.min(s.lump.length - 1, Math.round((x - s.left) / BIN)))];

/* snow thins out towards the corners of a box */
const taper = (s, x) => {
  const d = Math.min(x - (s.left + EDGE), (s.right - EDGE) - x);
  if (d <= 0) return 0;
  const t = Math.min(1, d / 18);
  return t * t * (3 - 2 * t);
};

function hAt(s, x) {
  const p = (x - s.left) / BIN;
  const i = Math.max(0, Math.min(s.h.length - 2, Math.floor(p)));
  const f = p - i;
  return (s.h[i] * (1 - f) + s.h[i + 1] * f) * taper(s, x);
}

/* a settled flake adds a soft mound of random width, so piles grow lumpy instead of flat */
function addSnow(s, x, amt) {
  const h = s.h;
  const c = (x - s.left) / BIN;
  const sig = 2 + Math.random() * 2.6;
  const r = Math.ceil(sig * 2.6);
  const base = Math.floor(c);

  for (let k = -r; k <= r; k++) {
    const j = base + k;
    if (j < 1 || j >= h.length - 1) continue;
    const w = Math.exp(-((j - c) * (j - c)) / (2 * sig * sig));
    const lim = MAXH * s.lump[j];
    h[j] = Math.min(lim, h[j] + amt * w * Math.max(0, 1 - h[j] / lim) * 1.5);
  }

  s.any = true;
}

function relax(s) {
  const h = s.h;
  const n = h.length;

  for (let i = 0; i < n - 1; i++) {
    const d = h[i] - h[i + 1];

    if (d > 1.0) {
      const m = (d - 1.0) * 0.08;
      h[i] -= m;
      h[i + 1] += m;
    } else if (d < -1.0) {
      const m = (-d - 1.0) * 0.08;
      h[i] += m;
      h[i + 1] -= m;
    }
  }

  for (let i = 1; i < n - 1; i++) {
    h[i] += ((h[i - 1] + h[i + 1]) / 2 - h[i]) * 0.006;
  }

  h[0] *= 0.94;
  h[1] *= 0.98;
  h[n - 1] *= 0.94;
  h[n - 2] *= 0.98;
}

function land(f, s, ty) {
  const near = Math.max(hAt(s, f.x), hAt(s, f.x - 7), hAt(s, f.x + 7));
  const lim = limAt(s, f.x);
  /* fresh snow sticks best to snow that is already there, so mounds grow from small starts */
  const p = near >= lim - 0.4 ? 0 : STICK * (0.3 + 0.7 * Math.min(1, near / 1.5)) * (1 - 0.7 * near / lim);
  const force = f.b >= 2 && near < lim - 0.4;

  if (force || Math.random() < p) {
    f.rest = { s, x: f.x, age: 0, amt: GROW * (0.7 + Math.random() * 0.6) };
    f.y = ty - f.r * 0.5;
    f.vx = 0;
  } else {
    /* hop off, drifting a little towards the nearest side */
    f.b++;
    f.vyc = -(0.28 + Math.random() * 0.32);
    f.vx += (Math.random() - 0.5) * 0.6 + (f.x < (s.left + s.right) / 2 ? -1 : 1) * 0.18;
    f.y = ty - 0.8;
  }
}

function step(f, dt, now) {
  if (f.rest) {
    const r = f.rest;
    r.age += dt;
    f.x = r.x;
    f.y = r.s.top - hAt(r.s, r.x) - f.r * 0.5;

    if (r.age >= REST) {
      addSnow(r.s, r.x, r.amt);
      resetFlake(f);
    }

    return;
  }

  const py = f.y;
  f.t += dt;
  f.vx += (wind(now) - f.vx) * 0.02 * dt;
  f.vyc += (f.vy - f.vyc) * 0.07 * dt;
  f.x += (f.vx + Math.sin(f.t * 0.045 + f.ph) * 0.22) * dt;
  f.y += f.vyc * dt;

  if (f.vyc > 0) {
    for (let i = 0; i < surfaces.length; i++) {
      const s = surfaces[i];

      if (f.x < s.left + 6 || f.x > s.right - 6) continue;

      const ty = s.top - hAt(s, f.x);

      if (py <= ty && f.y >= ty) {
        land(f, s, ty);
        return;
      }
    }
  }

  if (f.y > H + 8 || f.x < -20 || f.x > W + 20) resetFlake(f);
}

function drawCap(ctx, s) {
  const h = s.h;
  const n = h.length;
  let mx = 0;

  for (let i = 0; i < n; i++) {
    if (h[i] > mx) mx = h[i];
  }

  if (mx < 0.3) return;

  const a = 2;
  const b = n - 3;
  const px = [], py = [];

  for (let i = a; i <= b; i++) {
    const x = s.left + i * BIN;
    const hh = h[i] * taper(s, x);
    px.push(x);
    py.push(s.top - hh - s.nz[i] * 0.55 * Math.min(1, hh / 1.6));
  }

  const m = px.length;

  const trace = () => {
    ctx.moveTo(px[0], py[0]);

    for (let i = 1; i < m - 1; i++) {
      ctx.quadraticCurveTo(px[i], py[i], (px[i] + px[i + 1]) / 2, (py[i] + py[i + 1]) / 2);
    }

    ctx.lineTo(px[m - 1], py[m - 1]);
  };

  /* body of the snow, lighter on top and a touch cooler at the base */
  const g = ctx.createLinearGradient(0, s.top - mx, 0, s.top + 2);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, dark ? 'rgba(206,220,240,.96)' : 'rgba(176,196,228,.99)');

  ctx.beginPath();
  ctx.moveTo(px[0], s.top + 1.5);
  ctx.lineTo(px[0], py[0]);
  trace();
  ctx.lineTo(px[m - 1], s.top + 1.5);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();

  /* thin soft edge along the top so white snow still reads on white boxes */
  ctx.beginPath();
  trace();
  ctx.strokeStyle = dark ? 'rgba(170,195,230,.35)' : 'rgba(90,120,172,.8)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  /* shade where the snow meets the box */
  ctx.beginPath();
  ctx.moveTo(px[0], s.top + 0.8);
  ctx.lineTo(px[m - 1], s.top + 0.8);
  ctx.strokeStyle = dark ? 'rgba(50,75,115,.16)' : 'rgba(50,75,115,.26)';
  ctx.lineWidth = 1.3;
  ctx.stroke();
}

function drawGarland(now) {
  fctx.lineWidth = 1.4;
  fctx.strokeStyle = 'rgba(25,70,45,.85)';

  arcs.forEach(a => {
    fctx.beginPath();
    fctx.moveTo(a[0], 2);
    fctx.quadraticCurveTo((a[0] + a[1]) / 2, 2 + 2 * a[2], a[1], 2);
    fctx.stroke();
  });

  bulbs.forEach(b => {
    const tw = 0.6 + 0.4 * Math.sin(now * b.sp + b.ph);

    fctx.globalAlpha = 0.16 * tw;
    fctx.fillStyle = b.c;
    fctx.beginPath();
    fctx.arc(b.x, b.y + 4, 9, 0, 6.2832);
    fctx.fill();

    fctx.globalAlpha = 0.55 + 0.45 * tw;
    fctx.beginPath();
    fctx.arc(b.x, b.y + 4, 3.2, 0, 6.2832);
    fctx.fill();

    fctx.globalAlpha = 0.5 * tw;
    fctx.fillStyle = '#fff';
    fctx.beginPath();
    fctx.arc(b.x - 0.9, b.y + 3, 0.9, 0, 6.2832);
    fctx.fill();
  });

  fctx.globalAlpha = 1;
}

function drawBack(now) {
  bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  bctx.clearRect(0, 0, W, H);

  bokeh.forEach(b => {
    const x = b.x * W + Math.sin(now * b.sp + b.ph) * b.dx;
    const y = b.y * H + Math.cos(now * b.sp * 0.82 + b.ph) * b.dy;
    const a = 0.018 + 0.022 * (0.5 + 0.5 * Math.sin(now * b.sp + b.ph));

    const g = bctx.createRadialGradient(x, y, 0, x, y, b.r);
    g.addColorStop(0, 'rgba(' + b.c + ',' + a + ')');
    g.addColorStop(1, 'rgba(' + b.c + ',0)');

    bctx.fillStyle = g;
    bctx.beginPath();
    bctx.arc(x, y, b.r, 0, 6.2832);
    bctx.fill();
  });
}

function frame(now) {
  raf = requestAnimationFrame(frame);

  const dt = Math.min(3, (now - last) / 16.667 || 1);
  last = now;

  if (dt > 2.2) {
    if (++slow > 90 && targetN > 18) {
      targetN = Math.max(18, Math.floor(targetN * 0.7));
      flakes.length = Math.min(flakes.length, targetN);
      slow = 0;
    }
  } else if (slow > 0) slow--;

  if (dirty || now - lastCollect > 350) {
    collect();
    dirty = false;
    lastCollect = now;
    dark = !(window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches);
  }

  fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  fctx.clearRect(0, 0, W, H);
  drawGarland(now);

  fctx.shadowColor = 'rgba(70,95,135,.22)';
  fctx.shadowBlur = 2;
  fctx.shadowOffsetY = 0.6;

  for (let i = 0; i < surfaces.length; i++) {
    if (surfaces[i].any) {
      relax(surfaces[i]);
      drawCap(fctx, surfaces[i]);
    }
  }

  fctx.shadowColor = 'rgba(0,0,0,0)';
  fctx.shadowBlur = 0;
  fctx.shadowOffsetY = 0;

  fctx.fillStyle = 'rgba(250,252,255,.78)';
  fctx.strokeStyle = dark ? 'rgba(190,210,235,.32)' : 'rgba(130,155,190,.38)';
  fctx.lineWidth = 0.55;

  for (let i = 0; i < flakes.length; i++) {
    const f = flakes[i];
    step(f, dt, now);

    const fade = f.rest ? Math.max(0, 1 - f.rest.age / REST) : 1;
    fctx.globalAlpha = fade;
    fctx.beginPath();
    fctx.arc(f.x, f.y, f.r * (f.rest ? 0.5 + 0.5 * fade : 1), 0, 6.2832);
    fctx.fill();
    fctx.stroke();
  }

  fctx.globalAlpha = 1;

  if ((frameNo++ & 3) === 0) drawBack(now);
}

function start() {
  if (raf) return;
  back.style.display = '';
  front.style.display = '';
  last = performance.now();
  raf = requestAnimationFrame(frame);
}

function stop() {
  cancelAnimationFrame(raf);
  raf = 0;

  fctx.setTransform(1, 0, 0, 1, 0, 0);
  fctx.clearRect(0, 0, front.width, front.height);
  bctx.setTransform(1, 0, 0, 1, 0, 0);
  bctx.clearRect(0, 0, back.width, back.height);
}

btn.setAttribute('aria-pressed', on ? 'true' : 'false');

btn.addEventListener('click', () => {
  on = !on;
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');

  try {
    localStorage.setItem('gridlab-snow', on ? 'on' : 'off');
  } catch (e) {}

  if (on) {
    surfMap = new WeakMap();
    dirty = true;
    start();
  } else {
    stop();
  }
});

window.addEventListener('resize', resize);
window.addEventListener('scroll', () => {
  dirty = true;
}, { passive: true });

resize();
if (on) start();

if (window.__GL_DEBUG) {
  window.__glDebug = {
    surfaces: () => surfaces,
    flakes: () => flakes,
    frame,
    setNow: v => { last = v; }
  };
}

})();
