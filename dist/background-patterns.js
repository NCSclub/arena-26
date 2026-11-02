export const backgroundModes = ['circuit', 'rain', 'wireframe', 'flow'];

export function resolveBackground(value) {
  return backgroundModes.includes(value) ? value : 'circuit';
}

export function backgroundSignal(mode, x, y, width, height, time) {
  const nx = x / width, ny = y / height;
  if (mode === 'rain') {
    const column = Math.floor(x / 9);
    const speed = 0.035 + (Math.sin(column * 12.9898) + 1) * 0.035;
    const head = (time * speed + Math.sin(column * 7.13) * 0.5 + 1) % 1;
    const trail = (head - ny + 1) % 1;
    return trail < 0.28 ? Math.pow(1 - trail / 0.28, 2) : 0.025;
  }
  if (mode === 'wireframe') {
    const depth = 0.25 + ny * 0.9;
    const perspective = (nx - 0.5) / depth;
    const wave = Math.sin(perspective * 5 + time * 0.18) * 0.055;
    const horizon = Math.abs(Math.sin((1 / depth + wave) * 28 - time * 0.28));
    const longitude = Math.abs(Math.sin(perspective * 24));
    return Math.max(Math.pow(1 - horizon, 9), Math.pow(1 - longitude, 15)) * 0.85;
  }
  if (mode === 'circuit') {
    const cellX = Math.floor(x / 81), cellY = Math.floor(y / 96);
    const row = Math.floor(y / 12), column = Math.floor(x / 9);
    const trace = (column % 9 === 0 && (cellY + cellX) % 3 !== 0) ||
      (row % 8 === 0 && (cellX + cellY) % 3 !== 1);
    if (!trace) return 0.025;
    const pulse = Math.pow(Math.max(0, Math.cos(x * 0.012 + y * 0.009 - time * 0.65)), 14);
    return 0.18 + pulse * 0.82;
  }
  const wx = nx + 0.06 * Math.sin(ny * 5 + time * 0.7);
  const wy = ny + 0.04 * Math.cos(nx * 6 - time * 0.6);
  const flow = Math.sin(wx * 14 + wy * 6 + time) * Math.cos(wy * 10 - wx * 4 - time * 0.7);
  return Math.pow(Math.max(0, 1 - Math.abs(flow - 0.2) * 2.2), 2);
}
