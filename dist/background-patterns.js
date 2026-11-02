import { signalField } from './signal-field.js';

export function arenaDensity(nx, ny, time) {
  const drift = time * 0.28;
  const patches = [
    [0.29 + Math.sin(drift) * 0.045, 0.085 + Math.cos(drift * .7) * .012, 0.18, 0.065, -0.12],
    [-0.045, 0.77 + Math.sin(drift * 0.8) * 0.035, 0.255, 0.18, 0.55],
    [1.035, 0.22 + Math.cos(drift * 0.7) * 0.04, 0.15, 0.27, -0.4],
    [0.96, 1.035, 0.24, 0.16, -0.5],
    [0.08 + Math.sin(drift * .6) * .03, .29, .065, .045, .4],
    [.9, .64 + Math.cos(drift) * .06, .08, .055, -.3]
  ];
  let density = 0;
  for (const [cx, cy, sx, sy, rotation] of patches) {
    const x = nx - cx, y = ny - cy;
    const u = (x * Math.cos(rotation) - y * Math.sin(rotation)) / sx;
    const v = (x * Math.sin(rotation) + y * Math.cos(rotation)) / sy;
    const contour = v + Math.sin(u * 2.7 + drift) * 0.16;
    const envelope = Math.exp(-(u * u * 1.3 + contour * contour * 2.5));
    const fold = 0.76 + Math.sin(u * 4 + contour * 3 - drift * 1.5) * 0.24;
    density = Math.max(density, envelope * fold);
  }
  const quiet = Math.exp(-Math.pow((nx - 0.5) / 0.3, 6)) * Math.exp(-Math.pow((ny - 0.45) / 0.32, 6));
  return density * (1 - quiet * 0.72);
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
      const dust = grain > 0.92 && value < 0.05;
      if (value < 0.028 && !dust && signal.energy < 0.08) continue;
      let glyph = '.';
      if (value > 0.48) glyph = word[(col + row * 3 + Math.floor(time * 1.2)) % word.length];
      else if (value > 0.28) glyph = '+';
      else if (value > 0.12) glyph = ':';
      ctx.fillStyle = signal.energy > 0.24 ? '#00d7be' : '#b8bfbd';
      ctx.globalAlpha = dust ? 0.1 : 0.1 + value * 0.62;
      ctx.fillText(glyph, x + signal.x + Math.sin(time * .7 + ny * 8) * density * 2, y + signal.y + Math.cos(time * .6 + nx * 5) * density);
    }
  }
  ctx.lineWidth = 0.6;
  const lanes = [0.14, 0.23, 0.32, 0.43, 0.55, 0.66, 0.77, 0.88];
  for (let lane = 0; lane < lanes.length; lane++) {
    const y = height * lanes[lane] + Math.sin(time * .32 + lane) * 10;
    const direction = lane % 2 ? -1 : 1;
    const travel = ((time * (.035 + lane * .002) * direction + lane * .173) % 1 + 1) % 1;
    const x = travel * width;
    ctx.globalAlpha = lane % 3 === 0 ? 0.15 : 0.11;
    ctx.fillStyle = lane % 3 === 0 ? '#00d7be' : '#b8bfbd';
    for (const wrap of [-width, 0, width]) {
      ctx.fillText(lane % 2 ? '[01] <ARENA_PACKET> >>>' : '...+01> ARENA_SIGNAL ...', x - 90 + wrap, y);
    }
    ctx.globalAlpha = 0.055;
    ctx.fillRect(0, y + 3, width, 0.5);
  }
  for (let i = 0; i < 12; i++) {
    const side = i % 2;
    const x = width * (side ? .89 : .075) + Math.sin(time * .3 + i * 2.4) * width * .045;
    const y = ((i * .137 + time * (.008 + (i % 3) * .003)) % 1) * height;
    ctx.globalAlpha = .12 + Math.pow(Math.sin(time * .4 + i), 2) * .16;
    ctx.fillText(i % 3 === 0 ? '01' : '+', x, y);
  }
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
