export function isWhitePixel(column, row, columns, time) {
  const x = column / Math.max(1, columns - 1);
  if (x <= .16) return true;
  if (x >= .97) return false;
  const front = .48 + .12 * Math.sin(row * .21 + time * .85) + .07 * Math.cos(row * .49 - time * .6);
  const noise = Math.abs(Math.sin(column * 127.1 + row * 311.7) * 43758.5453) % 1 - .5;
  return (front - x) * 2.4 + noise * 1.5 > 0;
}
