export function beginOrbitReturn(orbit) {
  orbit.yaw = Math.atan2(Math.sin(orbit.yaw), Math.cos(orbit.yaw));
  orbit.returning = true;
}

export function advanceOrbit(orbit, dt) {
  if (orbit.returning) {
    const frequency = 5;
    const decay = Math.exp(-frequency * dt);
    for (const [angle, velocity] of [["yaw", "vx"], ["pitch", "vy"]]) {
      const momentum = orbit[velocity] + frequency * orbit[angle];
      orbit[angle] = (orbit[angle] + momentum * dt) * decay;
      orbit[velocity] = (orbit[velocity] - frequency * momentum * dt) * decay;
    }
    if (Math.abs(orbit.yaw) + Math.abs(orbit.pitch) + Math.abs(orbit.vx) + Math.abs(orbit.vy) < 0.0001) {
      orbit.yaw = orbit.pitch = orbit.vx = orbit.vy = 0;
      orbit.returning = false;
    }
  } else {
    orbit.yaw += orbit.vx * dt;
    orbit.pitch += orbit.vy * dt;
    orbit.vx *= Math.exp(-dt * 5);
    orbit.vy *= Math.exp(-dt * 5);
  }
  orbit.pitch = Math.max(-1.2, Math.min(1.2, orbit.pitch));
}

export function morphFrame(time) {
  const from = Math.floor(time / 6) % 2;
  const progress = Math.max(0, Math.min(1, (time % 6 - 4) / 2));
  const blend = progress ** 3 * (progress * (progress * 6 - 15) + 10);
  return { from, to: 1 - from, blend };
}
