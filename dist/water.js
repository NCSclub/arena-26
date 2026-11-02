export function addWake(points, x, y, time) {
  return [...points.filter(point => time - point.time < 1.2), { x, y, time }].slice(-24);
}

export function waterOffset(x, y, time, ripples, trail) {
  let dx = 0, dy = 0, energy = 0;
  for (const wave of ripples) {
    const age = time - wave.time;
    if (age < 0 || age >= 2) continue;
    const distance = Math.hypot(x - wave.x, y - wave.y);
    const front = distance - age * 250;
    if (Math.abs(front) > 110) continue;
    const envelope = Math.exp(-Math.pow(front / 48, 2)) * Math.pow(1 - age / 2, 1.5);
    const displacement = Math.sin(front * 0.07) * envelope * 24;
    dx += (x - wave.x) / (distance || 1) * displacement;
    dy += (y - wave.y) / (distance || 1) * displacement;
    energy += envelope * 0.55;
  }
  for (const point of trail) {
    const age = time - point.time;
    if (age < 0 || age >= 1.2 || Math.abs(x - point.x) > 110 || Math.abs(y - point.y) > 110) continue;
    const distance = Math.hypot(x - point.x, y - point.y);
    const envelope = Math.exp(-distance * distance / 2800) * Math.pow(1 - age / 1.2, 2);
    const wobble = Math.sin(distance * 0.09 - age * 12) * envelope * 8;
    dx += (x - point.x) / (distance || 1) * wobble;
    dy += (y - point.y) / (distance || 1) * wobble;
    energy += envelope * 0.22;
  }
  return { x: Math.max(-32, Math.min(32, dx)), y: Math.max(-32, Math.min(32, dy)), energy: Math.min(1, energy) };
}
