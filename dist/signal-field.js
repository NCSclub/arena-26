export function addSignalPoint(points, x, y, time) {
  return [...points.filter(point => time - point.time < 0.9), { x, y, time }].slice(-32);
}

export function signalField(x, y, time, pulses, trail) {
  let energy = 0, offsetX = 0, offsetY = 0;
  for (const pulse of pulses) {
    const age = time - pulse.time;
    if (age < 0 || age >= 1.35) continue;
    const dx = x - pulse.x, dy = y - pulse.y;
    const distance = Math.hypot(dx, dy);
    const front = distance - age * 330;
    const ring = Math.exp(-Math.pow(front / 22, 2)) * Math.pow(1 - age / 1.35, 1.3);
    energy += ring;
    const tick = Math.sin(distance * 0.22 - age * 28) * ring * 3;
    offsetX += dx / (distance || 1) * tick;
    offsetY += dy / (distance || 1) * tick;
  }
  for (const point of trail) {
    const age = time - point.time;
    if (age < 0 || age >= 0.9) continue;
    const dx = x - point.x, dy = y - point.y;
    if (Math.abs(dx) > 65 || Math.abs(dy) > 65) continue;
    const distance = Math.hypot(dx, dy);
    const glow = Math.exp(-distance * distance / 720) * Math.pow(1 - age / 0.9, 1.8);
    energy += glow * 0.8;
    offsetX += Math.sin(point.x * 0.04 + age * 18) * glow * 1.4;
    offsetY += Math.cos(point.y * 0.05 - age * 15) * glow * 1.1;
  }
  return {
    x: Math.max(-3, Math.min(3, offsetX)),
    y: Math.max(-3, Math.min(3, offsetY)),
    energy: Math.min(1, energy)
  };
}
