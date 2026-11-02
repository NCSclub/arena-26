import { language, t } from "./i18n.js";

export function remainingTime(start, now = Date.now()) {
  const target = Date.parse(start);
  if (!Number.isFinite(target) || !Number.isFinite(now)) return null;
  const total = Math.max(0, Math.ceil((target - now) / 1000));
  return { total, days: Math.floor(total / 86400), hours: Math.floor(total / 3600) % 24, minutes: Math.floor(total / 60) % 60, seconds: total % 60 };
}

const DIGITS = {
  '0': '01110/10001/10011/10101/11001/10001/01110',
  '1': '00100/01100/00100/00100/00100/00100/01110',
  '2': '01110/10001/00001/00010/00100/01000/11111',
  '3': '11110/00001/00001/01110/00001/00001/11110',
  '4': '00010/00110/01010/10010/11111/00010/00010',
  '5': '11111/10000/10000/11110/00001/00001/11110',
  '6': '01110/10000/10000/11110/10001/10001/01110',
  '7': '11111/00001/00010/00100/01000/01000/01000',
  '8': '01110/10001/10001/01110/10001/10001/01110',
  '9': '01110/10001/10001/01111/00001/00001/01110',
  '-': '00000/00000/00000/11111/00000/00000/00000'
};
const keys = ['days', 'hours', 'minutes', 'seconds'];
const labels = ['countdownDays', 'countdownHours', 'countdownMinutes', 'countdownSeconds'];
const clamp = value => Math.max(0, Math.min(1, value));

export function initCountdown(element) {
  if (!element) return;
  const models = keys.map(key => {
    const canvas = element.querySelector(`[data-countdown-unit="${key}"]`);
    return { key, canvas, ctx: canvas.getContext('2d'), from: '--', value: '--', changed: -1000, width: 0, height: 0 };
  });
  const face = element.querySelector('.countdown-face');
  let frame = 0, timer = 0, visible = true;
  const paused = () => document.body.classList.contains('no-motion');
  function draw(now) {
    frame = 0;
    let active = false;
    for (const model of models) {
      const { ctx, width, height } = model;
      if (!width || !height) continue;
      ctx.clearRect(0, 0, width, height);
      const age = paused() ? 1000 : now - model.changed;
      const columns = model.value.length * 6 - 1;
      const cell = Math.min(width / (columns + 1.5), height / 7.5);
      const left = (width - columns * cell) / 2;
      const top = (height - cell * 7) / 2;
      ctx.font = `600 ${cell * 1.15}px "IBM Plex Mono", monospace`;
      ctx.textAlign = 'center';ctx.textBaseline = 'middle';
      [...model.value].forEach((digit, position) => {
        const next = DIGITS[digit].split('/');
        const old = DIGITS[model.from[position] || digit].split('/');
        for (let row = 0; row < 7; row++) for (let column = 0; column < 5; column++) {
          const mix = clamp((age - row * 26) / 240);
          const changing = old[row][column] !== next[row][column] && mix > 0 && mix < 1;
          const seed = (row * 17 + column * 13 + position * 7) % 23 / 23;
          const lit = (mix > seed ? next : old)[row][column] === '1';
          if (!lit) continue;
          const marks = changing ? '+*#@' : '+#*';
          const index = changing ? Math.floor(age / 45) + row + column : row + column;
          const x = left + (position * 6 + column) * cell, y = top + row * cell;
          ctx.fillStyle = changing ? '#008d7b' : '#101715';
          ctx.fillRect(x + cell * .025, y + cell * .025, cell * .95, cell * .95);
          ctx.globalAlpha = changing ? .8 : .18;
          ctx.fillStyle = '#f7f7f2';
          ctx.fillText(marks[Math.abs(index) % marks.length], x + cell * .5, y + cell * .5);
          ctx.globalAlpha = 1;
        }
      });
      if (age < 420) active = true;
    }
    if (active && visible && !document.hidden && !paused()) frame = requestAnimationFrame(draw);
  }
  function paint() {
    cancelAnimationFrame(frame);
    if (visible && !document.hidden) frame = requestAnimationFrame(draw);
  }
  function tick() {
    clearTimeout(timer);
    const start = element.dataset.eventStart;
    const remaining = remainingTime(start);
    const now = performance.now();
    element.dataset.countdownState = remaining ? remaining.total ? 'running' : 'live' : 'waiting';
    for (const model of models) {
      const value = remaining ? String(remaining[model.key]).padStart(2, '0') : '--';
      if (value !== model.value) { model.from = model.value; model.value = value; model.changed = now; }
    }
    const status = !remaining ? 'countdownPending' : remaining.total ? 'countdownRunning' : 'countdownLive';
    element.querySelector('[data-countdown-status]').textContent = t(status);
    const readable = !remaining ? t('countdownDateSoon') : keys.map((key, index) => `${remaining[key]} ${t(labels[index]).toLowerCase()}`).join(', ');
    face.setAttribute('aria-label', readable);
    element.querySelector('[data-countdown-readable]').textContent = readable;
    element.querySelector('[data-countdown-caption]').textContent = !remaining ? t('countdownDateSoon') : new Intl.DateTimeFormat(language === 'fr' ? 'fr-DZ' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short', timeZone: element.dataset.eventZone || 'Africa/Algiers' }).format(new Date(start));
    paint();
    timer = setTimeout(tick, 1000 - Date.now() % 1000 + 10);
  }
  const resize = new ResizeObserver(() => {
    for (const model of models) {
      const rect = model.canvas.getBoundingClientRect(), ratio = Math.min(devicePixelRatio, 2);
      model.width = rect.width; model.height = rect.height;
      model.canvas.width = Math.round(rect.width * ratio);model.canvas.height = Math.round(rect.height * ratio);
      model.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
    paint();
  });
  models.forEach(model => resize.observe(model.canvas));
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; paint(); });
  intersection.observe(element);
  const motion = new MutationObserver(paint);motion.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', tick);
  document.addEventListener('languagechange', tick);
  tick();
  return () => { clearTimeout(timer);cancelAnimationFrame(frame);resize.disconnect();intersection.disconnect();motion.disconnect();document.removeEventListener('visibilitychange', tick);document.removeEventListener('languagechange', tick); };
}
