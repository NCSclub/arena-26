import { addRipple } from './ripples.js';
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
  square.style.animationDelay = `${-((row * 1.7 + column * .8) % 9)}s`;
  square.style.animationDuration = `${3.6 + (row + column) % 4}s`;
  pixelEdge.append(square);
}
$('.about').append(pixelEdge);
$('.footer').append(pixelEdge.cloneNode(true));

for (const side of ['top', 'bottom']) {
  const seam = document.createElement('div');
  seam.className = `section-seam ${side}`;
  seam.setAttribute('aria-hidden', 'true');
  for (let col = 0; col < 64; col++) {
    const height = 6 + Math.floor((Math.abs(Math.sin(col * 127.1) * 43758.5453) % 1) * 4) * 7;
    const block = document.createElement('i');
    Object.assign(block.style, { left: `${col / 64 * 100}%`, width: '1.6%', height: `${height}px` });
    seam.append(block);
  }
  $('.about').append(seam);
}

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
  let px = -1000, py = -1000;
  let ripples = [];
  area.addEventListener('pointermove', event => {
    const r = canvas.getBoundingClientRect(); px = event.clientX - r.left; py = event.clientY - r.top;
  }, { passive: true });
  area.addEventListener('pointerleave', () => { px = py = -1000; });
  area.addEventListener('pointerdown', event => {
    if (event.target.closest('a, button, input, select, textarea, summary, .ascii-sculpture')) return;
    const r = canvas.getBoundingClientRect();
    ripples = addRipple(ripples, event.clientX - r.left, event.clientY - r.top, performance.now() / 1000);
  }, { passive: true });
  engine(canvas, (ctx, w, h, now) => {
    ripples = ripples.filter(ripple => now - ripple.time < 2);
    const waves = motionOff ? [] : ripples.map(ripple => ({ ...ripple, radius: (now - ripple.time) * 220, strength: 1 - (now - ripple.time) / 2 }));
    canvas.dataset.ripples = String(waves.length);
    const t = motionOff ? 0 : now * .6;
    const step = w < 600 ? 8 : 9, line = 12;
    ctx.font = '9px "IBM Plex Mono", monospace';
    const ramp = ' .:+01<>[]=#';
    for (let y = 0; y < h; y += line) for (let x = 0; x < w; x += step) {
      const nx = x / w, ny = y / h;
      const warpX = nx + .16 * Math.sin(ny * 5 + t * .7);
      const warpY = ny + .12 * Math.cos(nx * 6 - t * .6);
      const flow = Math.sin(warpX * 14 + warpY * 6 + t) * Math.cos(warpY * 10 - warpX * 4 - t * .7);
      const ridge = Math.pow(Math.max(0, 1 - Math.abs(flow - .2) * 2.2), 2);
      const centerFade = Math.min(1, Math.pow(Math.abs(nx - .5) * 2.7, 1.3) + Math.pow(Math.abs(ny - .42) * 1.35, 3));
      const distance = Math.hypot(x - px, y - py);
      const wake = motionOff ? 0 : Math.max(0, 1 - distance / 180);
      let ring = 0;
      for (const wave of waves) {
        const radius = Math.hypot(x - wave.x, y - wave.y);
        ring += Math.exp(-Math.pow((radius - wave.radius) / 35, 2)) * wave.strength;
      }
      const scan = Math.pow(Math.max(0, Math.cos(ny * 13 - t * 1.7)), 16) * .22;
      const lane = (Math.floor(x / step) % 13 === 0 || Math.floor(y / line) % 11 === 0) ? .14 : 0;
      const value = Math.min(1, (ridge + scan + lane) * centerFade + wake * .8 + ring);
      if (value < .09) continue;
      const signal = Math.sin(x * .17 + y * .09 + Math.floor(t * 1.5)) > .9;
      ctx.fillStyle = wake > .25 || signal ? '#00d7be' : '#cad8d4';
      ctx.globalAlpha = Math.min(.8, value * .83);
      const i = Math.min(ramp.length - 1, Math.floor(value * (ramp.length - 1)));
      ctx.fillText(ramp[i], x + Math.sin(t + ny * 8) * wake * 9, y);
    }
    ctx.globalAlpha = 1;
    const unit = Math.min(64, w / 12);
    ctx.lineWidth = .7;
    for (let side = 0; side < 2; side++) for (let track = 0; track < 4; track++) {
      const origin = side ? w : 0;
      const direction = side ? -1 : 1;
      const x = origin + direction * unit * (track + .5);
      const y = h * (.17 + track * .2);
      ctx.strokeStyle = '#00d7be'; ctx.globalAlpha = .12;
      ctx.beginPath(); ctx.moveTo(x, y - unit); ctx.lineTo(x, y);
      ctx.lineTo(x + direction * unit * .5, y + unit * .5);
      ctx.lineTo(x + direction * unit * 1.2, y + unit * .5); ctx.stroke();
      const travel = ((t * .22 + track * .23) % 1);
      ctx.globalAlpha = .55;
      ctx.fillStyle = '#00d7be';
      ctx.fillRect(x - 1.5, y - unit + travel * unit, 3, 3);
      ctx.globalAlpha = .35;
      ctx.strokeRect(x + direction * unit * 1.2 - 2, y + unit * .5 - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
  });
});

const image = new Image(); image.src = 'assets/arena-logo.png';
const mask = document.createElement('canvas'); mask.width = mask.height = 90;
const mc = mask.getContext('2d', { willReadFrequently: true });
const shapes = [];
let elapsed = 0, previous = 0, offset = 0;
const sculpture = $('.ascii-sculpture');
const sculptureCanvas = $('#logo-ascii');
const orbit = { yaw: 0, pitch: 0, vx: 0, vy: 0, pointer: null, x: 0, y: 0, time: 0 };
sculptureCanvas.tabIndex = 0;
sculptureCanvas.setAttribute('aria-label', 'Sculpture ASCII ARENA. Glisser pour tourner ; flèches au clavier ; touche Début pour réinitialiser.');
sculptureCanvas.addEventListener('pointerdown', event => {
  if (event.button !== 0 || orbit.pointer !== null) return;
  event.stopPropagation();
  orbit.pointer = event.pointerId; orbit.x = event.clientX; orbit.y = event.clientY; orbit.time = performance.now();
  orbit.vx = orbit.vy = 0;
  sculptureCanvas.setPointerCapture(event.pointerId);
  sculptureCanvas.focus({ preventScroll: true });
  sculpture.classList.add('dragging');
});
sculptureCanvas.addEventListener('pointermove', event => {
  if (event.pointerId !== orbit.pointer) return;
  const dx = (event.clientX - orbit.x) * .008, dy = (event.clientY - orbit.y) * .008;
  const dt = Math.max(.016, (performance.now() - orbit.time) / 1000);
  orbit.yaw += dx; orbit.pitch = Math.max(-1.2, Math.min(1.2, orbit.pitch + dy));
  orbit.vx = Math.max(-4, Math.min(4, dx / dt)); orbit.vy = Math.max(-3, Math.min(3, dy / dt));
  orbit.x = event.clientX; orbit.y = event.clientY; orbit.time = performance.now();
  redrawLogo();
});
function releaseOrbit(event) {
  if (event.pointerId !== orbit.pointer) return;
  if (event.type === 'pointercancel' || performance.now() - orbit.time > 100) orbit.vx = orbit.vy = 0;
  orbit.pointer = null;
  sculpture.classList.remove('dragging');
  if (sculptureCanvas.hasPointerCapture(event.pointerId)) sculptureCanvas.releasePointerCapture(event.pointerId);
}
sculptureCanvas.addEventListener('pointerup', releaseOrbit);
sculptureCanvas.addEventListener('pointercancel', releaseOrbit);
sculptureCanvas.addEventListener('lostpointercapture', releaseOrbit);
function resetOrbit() { orbit.yaw = orbit.pitch = orbit.vx = orbit.vy = 0; redrawLogo(); }
sculptureCanvas.addEventListener('dblclick', resetOrbit);
sculptureCanvas.addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
  event.preventDefault();
  if (event.key === 'Home') { resetOrbit(); return; }
  orbit.vx = orbit.vy = 0;
  if (event.key === 'ArrowLeft') orbit.yaw -= .18;
  if (event.key === 'ArrowRight') orbit.yaw += .18;
  if (event.key === 'ArrowUp') orbit.pitch = Math.max(-1.2, orbit.pitch - .18);
  if (event.key === 'ArrowDown') orbit.pitch = Math.min(1.2, orbit.pitch + .18);
  redrawLogo();
});
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
  const dt = previous ? Math.min(.05, now - previous) : 0;
  if (previous && !motionOff && !logoPaused && orbit.pointer === null) elapsed += Math.min(1, now - previous);
  if (orbit.pointer === null && !motionOff && !logoPaused) {
    orbit.yaw += orbit.vx * dt;
    orbit.pitch = Math.max(-1.2, Math.min(1.2, orbit.pitch + orbit.vy * dt));
    orbit.vx *= Math.exp(-dt * 5); orbit.vy *= Math.exp(-dt * 5);
  }
  previous = now;
  const time = elapsed + offset;
  const state = Math.floor(time / 7) % 3;
  const progress = Math.max(0, Math.min(1, (time % 7 - 5) / 2));
  const blend = progress * progress * (3 - 2 * progress);
  const from = shapes[state], to = shapes[(state + 1) % 3];
  const ry = orbit.yaw + (state === 2 ? time * .35 : Math.sin(time * .65) * .75);
  const rx = orbit.pitch - .16 + Math.sin(time * .4) * .1;
  sculptureCanvas.dataset.rotation = `${orbit.yaw.toFixed(3)},${orbit.pitch.toFixed(3)}`;
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
