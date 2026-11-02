import { signalField } from './signal-field.js';

export function arenaDensity(nx, ny, time) {
  const t = time * 0.34;
  const u = nx + Math.sin(ny * 6.2 + t * .8) * .17;
  const v = ny + Math.cos(nx * 5.6 - t * .7) * .14;
  const contour = Math.sin(u * 8.2 - v * 3.8 + t) +
    Math.sin(v * 8.5 + u * 3.1 - t * .65) * .48;
  const fold = Math.exp(-Math.pow(contour / .34, 2));
  const second = Math.exp(-Math.pow((contour - .68) / .21, 2));
  const lobeX = nx - (.5 + Math.sin(t * .75) * .3);
  const lobeY = ny - (.48 + Math.cos(t * .6) * .27);
  const lobe = Math.exp(-(lobeX * lobeX / .065 + lobeY * lobeY / .025));
  return Math.min(1, fold * .77 + second * .36 + lobe * .33);
}

export function foregroundFade(x, y, masks) {
  let fade = 1;
  for (const rect of masks) {
    const dx = Math.max(rect.left - x, 0, x - rect.right);
    const dy = Math.max(rect.top - y, 0, y - rect.bottom);
    const distance = Math.hypot(dx, dy);
    if (distance < 28) fade = Math.min(fade, .12 + .88 * distance / 28);
  }
  return fade;
}

export function renderArenaBackground(ctx, width, height, time, pointer) {
  const cell = width < 600 ? 7 : 8, line = width < 600 ? 10 : 11;
  const word = 'ARENACHALLENGE';
  ctx.font = '9px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#b8bfbd';
  for (let y = 4, row = 0; y < height; y += line, row++) {
    for (let x = 2, col = 0; x < width; x += cell, col++) {
      const nx = x / width, ny = y / height;
      const signal = signalField(x, y, pointer.time, pointer.ripples, pointer.trail);
      const density = arenaDensity(nx, ny, time);
      const hash = Math.sin(col * 127.1 + row * 311.7) * 43758.5453;
      const grain = hash - Math.floor(hash);
      const distance = Math.hypot(x - pointer.x, y - pointer.y);
      const wake = pointer.active ? Math.max(0, 1 - distance / 140) : 0;
      const value = Math.min(1, density * (1 + wake * 0.28) + signal.energy * 0.88);
      const dust = grain > 0.93 && value < 0.05;
      if (value < 0.04 && !dust && signal.energy < 0.08) continue;
      let glyph = '.';
      if (value > 0.62) glyph = word[(col + row * 3 + Math.floor(time * 1.6)) % word.length];
      else if (value > 0.4) glyph = '+';
      else if (value > 0.22) glyph = ':';
      const fade = foregroundFade(x, y, pointer.masks || []);
      ctx.fillStyle = signal.energy > 0.3 ? '#70c7bc' : '#bcc3c0';
      ctx.globalAlpha = (dust ? .1 : .045 + Math.pow(value, 1.25) * .48) * fade;
      ctx.fillText(glyph, x + signal.x, y + signal.y);
    }
  }
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = '#a8b0ac';
  ctx.globalAlpha = 0.12;
  const left = width * 0.06, right = width * 0.835;
  const top = width < 700 ? 70 : 84, lower = height * 0.64;
  ctx.beginPath();
  for (const x of [left, right]) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
  for (const y of [top, lower]) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
  ctx.stroke();
  ctx.globalAlpha = 0.42;
  for (const x of [left, right]) for (const y of [top, lower]) ctx.fillRect(x - 1, y - 1, 2, 2);
  ctx.globalAlpha = 1;
}
