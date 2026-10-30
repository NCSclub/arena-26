import { registrationPayload } from './registration-data.js';

const $ = selector => document.querySelector(selector);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let motionOff = reducedMotion.matches;
let logoPaused = false;
const engines = [];

function canvasEngine(canvas, paint, fps = 24) {
  const context = canvas.getContext('2d');
  let width = 0, height = 0, visible = false, frame = 0, last = 0;
  const resize = new ResizeObserver(() => {
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width; height = bounds.height;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (width && height) draw(performance.now(), true);
  });
  const draw = (now, force = false) => {
    if (force || now - last >= 1000 / fps) {
      last = now;
      context.clearRect(0, 0, width, height);
      if (width && height) paint(context, width, height, now / 1000);
    }
    if (!force) schedule();
  };
  function schedule() {
    cancelAnimationFrame(frame);
    if (visible && !document.hidden && !motionOff && !(canvas.id === 'logo-ascii' && logoPaused)) frame = requestAnimationFrame(draw);
  }
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) draw(performance.now(), true);
    schedule();
  }, { threshold: 0 }).observe(canvas);
  resize.observe(canvas);
  const refresh = () => { draw(performance.now(), true); schedule(); };
  document.addEventListener('visibilitychange', schedule);
  engines.push(refresh);
  return refresh;
}

document.querySelectorAll('[data-ascii="background"]').forEach(canvas => {
  const area = canvas.parentElement;
  const pointer = { x: -1000, y: -1000, pulse: -1000 };
  area.addEventListener('pointermove', event => {
    const rect = area.getBoundingClientRect();
    pointer.x = event.clientX - rect.left; pointer.y = event.clientY - rect.top;
  }, { passive: true });
  area.addEventListener('pointerleave', () => { pointer.x = -1000; pointer.y = -1000; });
  area.addEventListener('pointerdown', () => { pointer.pulse = performance.now() / 1000; }, { passive: true });
  canvasEngine(canvas, (context, width, height, now) => {
    const t = motionOff ? 0 : now * .16;
    const spacing = width < 600 ? 9 : 8;
    const line = 11;
    const chars = ' .·:+x#ARENA01';
    context.font = '8px "IBM Plex Mono", monospace';
    const colors = ['#28362f', '#3c5045', '#57675b', '#738476', '#00a28e'];
    for (let y = 10; y < height; y += line) {
      for (let x = 4; x < width; x += spacing) {
        const nx = (x / width - .5) * 2, ny = (y / height - .5) * 2;
        const radius = Math.sqrt(nx * nx * .7 + ny * ny * 1.1);
        const bend = Math.sin(nx * 3.8 + t) * .19 + Math.cos(ny * 4.8 - t * 1.2) * .12;
        const wave = Math.sin((radius + bend) * 17 - t * 3);
        const ripple = Math.hypot(x - pointer.x, y - pointer.y);
        const influence = motionOff ? 0 : Math.max(0, 1 - ripple / 140);
        const pulse = motionOff ? 0 : Math.max(0, 1 - (now - pointer.pulse) / 1.4) * Math.exp(-Math.pow((ripple - (now - pointer.pulse) * 230) / 35, 2));
        const edge = Math.max(0, Math.min(1, (radius - .36) * 2.5));
        const noise = Math.sin(x * 17.13 + y * 3.91) * .13;
        const value = Math.max(0, (wave * .4 + .38 + noise) * edge + influence * .8 + pulse);
        if (value < .2) continue;
        context.fillStyle = influence > .3 || pulse > .2 ? '#00a995' : colors[Math.min(3, Math.floor(value * 3.9))];
        context.globalAlpha = Math.min(.8, value * .68);
        const character = chars[Math.min(chars.length - 1, Math.floor(value * 9))];
        const offset = influence * 8;
        context.fillText(character, x + (x - pointer.x) / Math.max(ripple, 1) * offset, y + (y - pointer.y) / Math.max(ripple, 1) * offset);
      }
    }
    context.globalAlpha = 1;
  });
});

const logoImage = new Image();
logoImage.src = 'assets/arena-logo.png';
const cols = 92, rows = 42;
const mask = document.createElement('canvas'); mask.width = cols; mask.height = rows;
const maskContext = mask.getContext('2d', { willReadFrequently: true });
let targets = [];
let morphOffset = 0;
let activeSeconds = 0;
let previousPaint = 0;
const morphNames = ['01 / ARENA', '02 / CODE', '03 / VICTOIRE'];
function buildTargets() {
  targets = [0, 1, 2].map(index => {
    maskContext.clearRect(0, 0, cols, rows);
    maskContext.fillStyle = '#fff';
    if (index === 0) maskContext.drawImage(logoImage, 26, 1, 40, 39);
    if (index === 1) {
      maskContext.font = 'bold 41px monospace'; maskContext.textAlign = 'center';
      maskContext.fillText('</>', 46, 34);
    }
    if (index === 2) {
      maskContext.beginPath(); maskContext.moveTo(32, 5); maskContext.lineTo(60, 5); maskContext.lineTo(57, 23); maskContext.quadraticCurveTo(46, 34, 35, 23); maskContext.closePath(); maskContext.fill();
      maskContext.fillRect(44, 26, 4, 8); maskContext.fillRect(36, 34, 20, 4);
      maskContext.lineWidth = 3; maskContext.strokeStyle = '#fff';
      maskContext.beginPath(); maskContext.moveTo(32, 8); maskContext.lineTo(25, 8); maskContext.quadraticCurveTo(24, 22, 37, 23); maskContext.moveTo(60, 8); maskContext.lineTo(67, 8); maskContext.quadraticCurveTo(68, 22, 55, 23); maskContext.stroke();
    }
    const pixels = maskContext.getImageData(0, 0, cols, rows).data;
    const points = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      if (pixels[i + 3] > 100 && Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) > 75) points.push({ x, y, alpha: 1 });
    }
    return points;
  });
}
const refreshLogo = canvasEngine($('#logo-ascii'), (context, width, height, now) => {
  if (!targets.length) return;
  if (previousPaint && !motionOff && !logoPaused) activeSeconds += Math.min(.1, now - previousPaint);
  previousPaint = now;
  const clock = motionOff ? morphOffset * 6 : activeSeconds + morphOffset * 6;
  const state = Math.floor(clock / 6) % 3;
  const next = (state + 1) % 3;
  const progress = Math.max(0, Math.min(1, (clock % 6 - 4) / 1.6));
  const ease = progress * progress * (3 - 2 * progress);
  const from = targets[state], to = targets[next];
  const count = Math.max(from.length, to.length);
  const sx = width / cols, sy = (height - 25) / rows;
  context.font = `${Math.max(5, sx * 1.05)}px "IBM Plex Mono", monospace`;
  context.textAlign = 'center';
  context.fillStyle = '#1e2e23';
  for (let x = 10; x < width; x += 18) for (let y = 13; y < height; y += 18) context.fillText('·', x, y);
  const alphabet = '+*#01ARENA';
  for (let i = 0; i < count; i++) {
    const a = from[i] || { x: 46, y: 21, alpha: 0 }, b = to[i] || { x: 46, y: 21, alpha: 0 };
    const scatter = Math.sin(progress * Math.PI) * 5;
    const x = a.x + (b.x - a.x) * ease + Math.sin(i * 4.7) * scatter;
    const y = a.y + (b.y - a.y) * ease + Math.cos(i * 7.3) * scatter;
    context.globalAlpha = a.alpha + (b.alpha - a.alpha) * ease;
    context.fillStyle = x < 46 ? '#00d7be' : '#e5e843';
    context.fillText(alphabet[(i + Math.floor(clock * 2)) % alphabet.length], x * sx, y * sy + 16);
  }
  context.globalAlpha = 1;
  context.strokeStyle = '#314039'; context.lineWidth = .5;
  context.strokeRect(15, 13, width - 30, height - 26);
  $('#morph-label').textContent = morphNames[progress > .5 ? next : state];
}, 24);
logoImage.addEventListener('load', () => { buildTargets(); refreshLogo(); });
if (logoImage.complete && logoImage.naturalWidth) { buildTargets(); refreshLogo(); }
$('#morph-next').addEventListener('click', () => {
  const current = Math.floor((motionOff ? morphOffset * 6 : activeSeconds + morphOffset * 6) / 6);
  activeSeconds = 0; morphOffset = (current + 1) % 3;
  refreshLogo();
});
$('#morph-pause').addEventListener('click', event => {
  logoPaused = !logoPaused;
  event.currentTarget.textContent = logoPaused ? '▷' : 'Ⅱ';
  event.currentTarget.setAttribute('aria-pressed', String(logoPaused));
  event.currentTarget.setAttribute('aria-label', logoPaused ? 'Reprendre l’animation du logo' : 'Mettre l’animation du logo en pause');
  previousPaint = 0; refreshLogo();
});
function updateMotion() {
  document.body.classList.toggle('no-motion', motionOff);
  $('#motion-toggle').setAttribute('aria-pressed', String(motionOff));
  $('#motion-toggle').setAttribute('aria-label', motionOff ? 'Activer les animations' : 'Désactiver les animations');
  $('#motion-toggle').innerHTML = `${motionOff ? '▷' : 'Ⅱ'} <span>ANIMATIONS ${motionOff ? 'OFF' : 'ON'}</span>`;
  previousPaint = 0; engines.forEach(refresh => refresh());
}
$('#motion-toggle').addEventListener('click', () => { motionOff = !motionOff; updateMotion(); });
reducedMotion.addEventListener('change', event => { motionOff = event.matches; updateMotion(); });
updateMotion();

let currentStep = 0;
const form = $('#registration-form');
form.noValidate = true;
function conditionalFields() {
  for (const [selector, name, enabled, required] of [
    ['#team-fields', 'hasTeam', form.elements.hasTeam.value === 'yes', 'teamName'],
    ['#transport-fields', 'needsTransportation', form.elements.needsTransportation.value === 'yes', 'transportationAddress']
  ]) {
    const group = $(selector); group.hidden = !enabled;
    group.querySelectorAll('input').forEach(input => { input.disabled = !enabled; input.required = enabled && input.name === required; });
  }
}
form.addEventListener('change', conditionalFields);
form.addEventListener('input', event => {
  if (event.target.setCustomValidity) event.target.setCustomValidity('');
  $('#form-status').textContent = '';
});
function validStep(index) {
  const controls = document.querySelectorAll(`[data-step="${index}"] input, [data-step="${index}"] select, [data-step="${index}"] textarea`);
  for (const input of controls) {
    if (input.disabled) continue;
    if (input.required && !input.value.trim()) input.setCustomValidity('Merci de renseigner ce champ.');
    else input.setCustomValidity('');
    if (!input.reportValidity()) return false;
  }
  return true;
}
const labels = { fullName: 'Nom complet', phoneNumber: 'Téléphone', email: 'E-mail', discordTag: 'Discord', university: 'Établissement', yearOfStudy: 'Année d’études', studentId: 'Matricule', teamName: 'Nom de l’équipe', expectations: 'Tes attentes' };
function payload() { return registrationPayload(Object.fromEntries(new FormData(form))); }
function renderReview() {
  const values = payload();
  const groups = [
    ['TON PROFIL', ['fullName', 'phoneNumber', 'email', 'discordTag', 'university', 'yearOfStudy', 'studentId'].map(key => [labels[key], values[key]])],
    ['TON ÉQUIPE', [['Participation', values.hasTeam ? 'En équipe' : 'En solo'], ...(values.hasTeam ? [['Équipe', values.teamName], ['Coéquipiers', values.teammates.join(', ') || 'Non renseignés']] : [])]],
    ['LE JOUR J', [['Transport', values.needsTransportation ? 'Demandé, selon disponibilité' : 'Autonome'], ...(values.needsTransportation ? [['Départ', values.transportationAddress]] : []), ['Tes attentes', values.expectations]]]
  ];
  $('#review').replaceChildren(...groups.map(([title, entries]) => {
    const section = document.createElement('section'); section.className = 'review-group';
    const heading = document.createElement('h3'); heading.textContent = title; section.append(heading);
    const list = document.createElement('dl');
    entries.forEach(([label, value]) => {
      const row = document.createElement('div'); row.className = 'review-row';
      const term = document.createElement('dt'); term.textContent = label;
      const description = document.createElement('dd'); description.textContent = value;
      row.append(term, description); list.append(row);
    });
    section.append(list); return section;
  }));
}
function showStep(index, focus = true) {
  currentStep = index;
  document.querySelectorAll('.form-step').forEach((step, i) => { step.hidden = i !== index; });
  document.querySelectorAll('.steps li').forEach((step, i) => {
    step.classList.toggle('active', i === index); step.classList.toggle('done', i < index);
    if (i === index) step.setAttribute('aria-current', 'step'); else step.removeAttribute('aria-current');
  });
  $('#previous-step').hidden = index === 0;
  $('#form-progress').textContent = `ÉTAPE 0${index + 1} / 03`;
  $('#step-counter').textContent = `PLAYER_SETUP / 0${index + 1}`;
  $('#next-step').innerHTML = index === 2 ? 'Exporter mes réponses <span aria-hidden="true">↓</span>' : 'Continuer <span aria-hidden="true">→</span>';
  $('#form-status').textContent = '';
  if (index === 2) renderReview();
  if (focus) {
    const heading = $(`[data-step="${index}"] h2`); heading.tabIndex = -1; heading.focus({ preventScroll: true });
    $('.form-panel').scrollIntoView({ behavior: motionOff ? 'instant' : 'smooth', block: 'start' });
  }
}
$('#previous-step').addEventListener('click', () => showStep(Math.max(0, currentStep - 1)));
form.addEventListener('submit', event => {
  event.preventDefault();
  if (currentStep < 2) { if (validStep(currentStep)) showStep(currentStep + 1); return; }
  for (let index = 0; index < 2; index++) {
    showStep(index, false);
    if (!validStep(index)) return;
  }
  showStep(2, false);
  const blob = new Blob([JSON.stringify(payload(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'arena-26-mes-reponses.json'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('#form-status').textContent = 'Réponses exportées. Aucune inscription n’a été envoyée à l’organisation.';
});
function route() {
  const registering = location.hash === '#inscription';
  $('#landing').hidden = registering; $('#registration').hidden = !registering;
  document.title = registering ? 'Inscription — ARENA 26' : 'ARENA 26 — Think fast. Gain more.';
  if (registering) {
    scrollTo({ top: 0, behavior: 'instant' });
    const heading = $('#registration-title'); heading.tabIndex = -1; heading.focus({ preventScroll: true });
  } else if (location.hash) requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView());
  else scrollTo({ top: 0, behavior: 'instant' });
}
window.addEventListener('hashchange', route);
conditionalFields(); showStep(0, false); route();
