export function arenaDensity(nx, ny, time) {
  const drift = time * 0.13;
  const patches = [
    [0.29 + Math.sin(drift) * 0.025, 0.085, 0.18, 0.065, -0.12],
    [-0.045, 0.77 + Math.sin(drift * 0.8) * 0.035, 0.255, 0.18, 0.55],
    [1.035, 0.22 + Math.cos(drift * 0.7) * 0.04, 0.15, 0.27, -0.4],
    [0.96, 1.035, 0.24, 0.16, -0.5]
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
  const quiet = Math.exp(-Math.pow((nx - 0.5) / 0.26, 6)) * Math.exp(-Math.pow((ny - 0.45) / 0.27, 6));
  return density * (1 - quiet * 0.97);
}

export function renderArenaBackground(ctx, width, height, time, pointer) {
  const cell = width < 600 ? 7 : 8, line = width < 600 ? 10 : 11;
  const word = 'ARENACHALLENGE';
  ctx.font = '9px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#b8bfbd';
  for (let y = 4, row = 0; y < height; y += line, row++) {
    for (let x = 2, col = 0; x < width; x += cell, col++) {
      const nx = x / width, ny = y / height;
      const density = arenaDensity(nx, ny, time);
      const hash = Math.sin(col * 127.1 + row * 311.7) * 43758.5453;
      const grain = hash - Math.floor(hash);
      const distance = Math.hypot(x - pointer.x, y - pointer.y);
      const wake = pointer.active ? Math.max(0, 1 - distance / 140) : 0;
      let pulse = 0;
      for (const wave of pointer.waves) pulse += Math.exp(-Math.pow((Math.hypot(x - wave.x, y - wave.y) - wave.radius) / 40, 2)) * wave.strength * 0.24;
      const value = Math.min(1, density * (1 + wake * 0.45 + pulse));
      const dust = grain > 0.92 && value < 0.05;
      if (value < 0.028 && !dust) continue;
      let glyph = '.';
      if (value > 0.48) glyph = word[(col + row * 3 + Math.floor(time * 0.45)) % word.length];
      else if (value > 0.28) glyph = '+';
      else if (value > 0.12) glyph = ':';
      ctx.globalAlpha = dust ? 0.1 : 0.1 + value * 0.62;
      ctx.fillText(glyph, x + Math.sin(time * 0.6 + ny * 8) * wake * density * 5, y);
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
