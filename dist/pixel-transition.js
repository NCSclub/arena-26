export function isWhitePixel(column, row, columns, time) {
  const x = column / Math.max(1, columns - 1);
  if (x <= 0.16) return true;
  if (x >= 0.97) return false;
  const front =
    0.48 + 0.12 * Math.sin(row * 0.21 + time * 0.85) + 0.07 * Math.cos(row * 0.49 - time * 0.6);
  const noise =
    (Math.abs(Math.sin(column * 127.1 + row * 311.7) * 43758.5453) % 1) - 0.5;
  return (front - x) * 2.4 + noise * 1.5 > 0;
}
