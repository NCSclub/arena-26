const $ = selector => document.querySelector(selector);
export let motionOff = sessionStorage.getItem('arena-motion') === 'off';
let logoPaused = false;
const engines = [];

const pixelEdge = document.createElement('div');
pixelEdge.className = 'pixel-edge'; pixelEdge.setAttribute('aria-hidden', 'true');
for (let row = 0; row < 52; row++) for (let column = 0; column < 18; column++) {
  const noise = (Math.sin(row * 47.1 + column * 13.7) * 43758.54) % 1;
  const white = Math.abs(noise) > column / 17;
  if ((column < 8 && white) || (column >= 8 && !white)) continue;
  const square = document.createElement('i');
  square.className = white ? '' : 'dark';
  Object.assign(square.style, { left: `${column / 18 * 100}%`, top: `${row / 52 * 100}%`, width: '5.7%', height: '1.95%' });
  pixelEdge.append(square);
}
$('.about').append(pixelEdge);
$('.footer').append(pixelEdge.cloneNode(true));

function engine(canvas, render) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, frame = 0, visible = false, last = 0;
  function paint(now) {
    if (now - last > 32) { last = now; draw(now); }
    schedule();
  }
  function draw(now) {
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h); render(ctx, w, h, now / 1000);
    canvas.dataset.frames = String(Number(canvas.dataset.frames || 0) + 1);
  }
  function schedule() {
    cancelAnimationFrame(frame);
    if (visible && !motionOff && !document.hidden && !(canvas.id === 'logo-ascii' && logoPaused)) frame = requestAnimationFrame(paint);
  }
  const refresh = () => { draw(performance.now()); schedule(); };
  new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect(); w = rect.width; h = rect.height;
    const dpr = Math.min(devicePixelRatio, 1.5);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); refresh();
  }).observe(canvas);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; refresh(); }).observe(canvas);
  document.addEventListener('visibilitychange', schedule);
  engines.push(refresh);
  return refresh;
}

document.querySelectorAll('[data-ascii="background"]').forEach(canvas => {
  const area = canvas.parentElement;
  let px = -1000, py = -1000, clicked = -1000;
  area.addEventListener('pointermove', event => {
    const r = area.getBoundingClientRect(); px = event.clientX - r.left; py = event.clientY - r.top;
  }, { passive: true });
  area.addEventListener('pointerleave', () => { px = py = -1000; });
  area.addEventListener('pointerdown', () => { clicked = performance.now() / 1000; }, { passive: true });
  engine(canvas, (ctx, w, h, now) => {
    const t = motionOff ? 0 : now * .65;
    const step = w < 600 ? 7 : 8, line = 10;
    ctx.font = '8px "IBM Plex Mono", monospace';
    const ramp = ' .·:+*=x%#@';
    for (let y = 0; y < h; y += line) for (let x = 0; x < w; x += step) {
      const nx = x / w, ny = y / h;
      const warpX = nx + .16 * Math.sin(ny * 5 + t * .7);
      const warpY = ny + .12 * Math.cos(nx * 6 - t * .6);
      const flow = Math.sin(warpX * 11 + warpY * 5 + t) * Math.cos(warpY * 8 - warpX * 3 - t * .7);
      const ridge = Math.pow(Math.max(0, 1 - Math.abs(flow - .2) * 2.2), 2);
      const centerFade = Math.min(1, Math.pow(Math.abs(nx - .5) * 2.7, 1.3) + Math.pow(Math.abs(ny - .42) * 1.35, 3));
      const distance = Math.hypot(x - px, y - py);
      const wake = motionOff ? 0 : Math.max(0, 1 - distance / 180);
      const age = now - clicked;
      const ring = motionOff ? 0 : Math.exp(-Math.pow((distance - age * 220) / 35, 2)) * Math.max(0, 1 - age / 2);
      const value = Math.min(1, ridge * centerFade + wake * .8 + ring);
      if (value < .09) continue;
      ctx.fillStyle = wake > .25 ? '#00d7be' : '#b6bebd';
      ctx.globalAlpha = Math.min(.68, value * .58);
      const i = Math.min(ramp.length - 1, Math.floor(value * (ramp.length - 1)));
      ctx.fillText(ramp[i], x + Math.sin(t + ny * 8) * wake * 9, y);
    }
    ctx.globalAlpha = 1;
  });
});

const image = new Image(); image.src = 'assets/arena-logo.png';
const mask = document.createElement('canvas'); mask.width = mask.height = 90;
const mc = mask.getContext('2d', { willReadFrequently: true });
const shapes = [];
let elapsed = 0, previous = 0, offset = 0;
let pointerX = 0, pointerY = 0;
const sculpture = $('.ascii-sculpture');
sculpture.addEventListener('pointermove', event => {
  const r = sculpture.getBoundingClientRect(); pointerX = (event.clientX - r.left) / r.width - .5; pointerY = (event.clientY - r.top) / r.height - .5;
});
sculpture.addEventListener('pointerleave', () => { pointerX = pointerY = 0; });
function buildShapes() {
  for (let kind = 0; kind < 2; kind++) {
    mc.clearRect(0, 0, 90, 90);
    if (kind === 0) mc.drawImage(image, 5, 5, 80, 80);
    else { mc.fillStyle = '#fff'; mc.font = 'bold 48px monospace'; mc.textAlign = 'center'; mc.fillText('</>', 45, 61); }
    const data = mc.getImageData(0, 0, 90, 90).data;
    const points = [];
    for (let y = 0; y < 90; y++) for (let x = 0; x < 90; x++) {
      const i = (y * 90 + x) * 4;
      if (data[i + 3] > 128 && Math.max(data[i], data[i + 1], data[i + 2]) > 70) {
        points.push({ x: (x - 45) / 38, y: (y - 45) / 38, z: .11 });
        if ((x + y) % 3 === 0) points.push({ x: (x - 45) / 38, y: (y - 45) / 38, z: -.11 });
      }
    }
    shapes.push(points);
  }
  const cube = [];
  for (let face = 0; face < 6; face++) for (let a = -1; a <= 1; a += .055) for (let b = -1; b <= 1; b += .055) {
    const grid = Math.abs(Math.sin((a + 1) * Math.PI * 1.5)) < .12 || Math.abs(Math.sin((b + 1) * Math.PI * 1.5)) < .12;
    if (grid) continue;
    const coords = [a * .8, b * .8, face % 2 ? .8 : -.8];
    if (face < 2) cube.push({ x: coords[0], y: coords[1], z: coords[2] });
    else if (face < 4) cube.push({ x: coords[2], y: coords[0], z: coords[1] });
    else cube.push({ x: coords[1], y: coords[2], z: coords[0] });
  }
  shapes.push(cube);
}
const names = ['01 — ARENA', '02 — CODE', '03 — LOGIQUE'];
const redrawLogo = engine($('#logo-ascii'), (ctx, w, h, now) => {
  if (shapes.length < 3) return;
  if (previous && !motionOff && !logoPaused) elapsed += Math.min(1, now - previous);
  previous = now;
  const time = elapsed + offset;
  const state = Math.floor(time / 7) % 3;
  const progress = Math.max(0, Math.min(1, (time % 7 - 5) / 2));
  const blend = progress * progress * (3 - 2 * progress);
  const from = shapes[state], to = shapes[(state + 1) % 3];
  const ry = state === 2 ? time * .35 : Math.sin(time * .65) * .75 + pointerX * .5;
  const rx = -.16 + Math.sin(time * .4) * .1 + pointerY * .25;
  const scale = Math.min(w * .36, h * .4);
  const cellX = 4.2, cellY = 6;
  const cells = new Map();
  const count = Math.max(from.length, to.length);
  for (let i = 0; i < count; i++) {
    const a = from[Math.floor(i * from.length / count)], b = to[Math.floor(i * to.length / count)];
    const x = a.x + (b.x - a.x) * blend, y = a.y + (b.y - a.y) * blend, z = a.z + (b.z - a.z) * blend;
    const xx = x * Math.cos(ry) + z * Math.sin(ry), zz = z * Math.cos(ry) - x * Math.sin(ry);
    const yy = y * Math.cos(rx) - zz * Math.sin(rx), depth = zz * Math.cos(rx) + y * Math.sin(rx);
    const perspective = 3.8 / (3.8 - depth);
    const gx = Math.round((w / 2 + xx * scale * perspective) / cellX), gy = Math.round((h / 2 + yy * scale * perspective) / cellY);
    const key = gx + ':' + gy;
    if (!cells.has(key) || cells.get(key).depth < depth) cells.set(key, { gx, gy, depth, x: xx, y: yy });
  }
  ctx.font = 'bold 7px "IBM Plex Mono", monospace';
  const ramp = '.:+*x%#@';
  for (const p of cells.values()) {
    const light = Math.max(0, Math.min(1, .58 + p.depth * .4 + p.x * .2 - p.y * .14));
    ctx.fillStyle = p.x > .35 ? '#007d74' : '#003dad';
    ctx.globalAlpha = .75 + light * .25;
    ctx.fillText(ramp[Math.floor(light * (ramp.length - 1))], p.gx * cellX, p.gy * cellY);
  }
  ctx.globalAlpha = 1;
  $('#morph-label').textContent = names[progress > .5 ? (state + 1) % 3 : state];
});
image.addEventListener('load', () => { buildShapes(); redrawLogo(); });
if (image.complete && image.naturalWidth) { buildShapes(); redrawLogo(); }
$('#morph-next').addEventListener('click', () => { offset = ((Math.floor((elapsed + offset) / 7) + 1) % 3) * 7; elapsed = 0; redrawLogo(); });
$('#morph-pause').addEventListener('click', event => {
  logoPaused = !logoPaused; previous = 0;
  event.currentTarget.textContent = logoPaused ? '▷' : 'Ⅱ';
  event.currentTarget.setAttribute('aria-pressed', String(logoPaused));
  event.currentTarget.setAttribute('aria-label', logoPaused ? 'Reprendre l’animation du logo' : 'Mettre l’animation du logo en pause');
  redrawLogo();
});
function updateMotion() {
  document.body.classList.toggle('no-motion', motionOff);
  const toggle = $('#motion-toggle');
  toggle.setAttribute('aria-pressed', String(motionOff));
  toggle.setAttribute('aria-label', motionOff ? 'Activer les animations' : 'Désactiver les animations');
  toggle.innerHTML = `${motionOff ? '▷' : 'Ⅱ'} <span>${motionOff ? 'REPRENDRE' : 'PAUSE'}</span>`;
  previous = 0; engines.forEach(refresh => refresh());
}
$('#motion-toggle').addEventListener('click', () => {
  motionOff = !motionOff; sessionStorage.setItem('arena-motion', motionOff ? 'off' : 'on'); updateMotion();
});
updateMotion();
