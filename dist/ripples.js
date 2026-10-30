export function addRipple(ripples, x, y, time) {
  return [...ripples.filter(ripple => time - ripple.time < 2), { x, y, time }].slice(-8);
}
