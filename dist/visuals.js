import { createAsciiField } from "./ascii-background.js";
import { isWhitePixel } from "./pixel-transition.js";
import { t } from "./i18n.js";
const $ = (selector) => document.querySelector(selector);
export let motionOff = sessionStorage.getItem("arena-motion") === "off";
let logoPaused = false;
const engines = [];

for (const selector of [".about", ".footer"]) {
  const canvas = document.createElement("canvas");
  canvas.className = "pixel-transition";
  canvas.setAttribute("aria-hidden", "true");
  $(selector).append(canvas);
  engine(canvas, (ctx, width, height, now) => {
    const time = motionOff ? 0 : now;
    const size = width < 220 ? 14 : 20;
    const columns = Math.ceil(width / size);
    const rows = Math.ceil(height / size);
    ctx.fillStyle = "#fff";
    for (let row = 0; row < rows; row++)
      for (let column = 0; column < columns; column++) {
        if (isWhitePixel(column, row, columns, time))
          ctx.fillRect(column * size, row * size, size + 0.5, size + 0.5);
      }
  });
}

function engine(canvas, render) {
  const ctx = canvas.getContext("2d");
  let w = 0,
    h = 0,
    frame = 0,
    visible = false,
    last = 0;
  function paint(now) {
    if (now - last > 32) {
      last = now;
      draw(now);
    }
    schedule();
  }
  function draw(now) {
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);
    render(ctx, w, h, now / 1000);
    canvas.dataset.frames = String(Number(canvas.dataset.frames || 0) + 1);
  }
  function schedule() {
    cancelAnimationFrame(frame);
    if (
      visible &&
      !motionOff &&
      !document.hidden &&
      !(canvas.id === "logo-ascii" && logoPaused)
    )
      frame = requestAnimationFrame(paint);
  }
  const refresh = () => {
    draw(performance.now());
    schedule();
  };
  new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect();
    w = rect.width;
    h = rect.height;
    const dpr = Math.min(devicePixelRatio, 1.5);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    refresh();
  }).observe(canvas);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    refresh();
  }).observe(canvas);
  document.addEventListener("visibilitychange", schedule);
  engines.push(refresh);
  return refresh;
}

const backgroundCanvas = $('[data-ascii="background"]');
try {
  const background = createAsciiField(backgroundCanvas);
  engines.push(() => motionOff ? background.pause() : background.play());
} catch (error) {
  backgroundCanvas.hidden = true;
  console.warn("ASCII background unavailable:", error);
}

const image = new Image();
image.src = "assets/arena-logo.png";
const mask = document.createElement("canvas");
mask.width = mask.height = 90;
const mc = mask.getContext("2d", { willReadFrequently: true });
const shapes = [];
let elapsed = 0,
  previous = 0,
  offset = 0;
const sculpture = $(".ascii-sculpture");
const sculptureCanvas = $("#logo-ascii");
const orbit = {
  yaw: 0,
  pitch: 0,
  vx: 0,
  vy: 0,
  pointer: null,
  x: 0,
  y: 0,
  time: 0,
};
let orbitResetTimer = null;
sculptureCanvas.tabIndex = 0;
sculptureCanvas.setAttribute("aria-label", t("sculptureHelp"));
sculptureCanvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || orbit.pointer !== null) return;
  clearTimeout(orbitResetTimer);
  event.stopPropagation();
  orbit.pointer = event.pointerId;
  orbit.x = event.clientX;
  orbit.y = event.clientY;
  orbit.time = performance.now();
  orbit.vx = orbit.vy = 0;
  sculptureCanvas.setPointerCapture(event.pointerId);
  sculptureCanvas.focus({ preventScroll: true });
  sculpture.classList.add("dragging");
});
sculptureCanvas.addEventListener("pointermove", (event) => {
  if (event.pointerId !== orbit.pointer) return;
  const dx = (event.clientX - orbit.x) * 0.008,
    dy = (event.clientY - orbit.y) * 0.008;
  const dt = Math.max(0.016, (performance.now() - orbit.time) / 1000);
  orbit.yaw += dx;
  orbit.pitch = Math.max(-1.2, Math.min(1.2, orbit.pitch + dy));
  orbit.vx = Math.max(-4, Math.min(4, dx / dt));
  orbit.vy = Math.max(-3, Math.min(3, dy / dt));
  orbit.x = event.clientX;
  orbit.y = event.clientY;
  orbit.time = performance.now();
  redrawLogo();
});
function releaseOrbit(event) {
  if (event.pointerId !== orbit.pointer) return;
  if (event.type === "pointercancel" || performance.now() - orbit.time > 100)
    orbit.vx = orbit.vy = 0;
  orbit.pointer = null;
  sculpture.classList.remove("dragging");
  if (sculptureCanvas.hasPointerCapture(event.pointerId))
    sculptureCanvas.releasePointerCapture(event.pointerId);
  scheduleOrbitReset();
}
sculptureCanvas.addEventListener("pointerup", releaseOrbit);
sculptureCanvas.addEventListener("pointercancel", releaseOrbit);
sculptureCanvas.addEventListener("lostpointercapture", releaseOrbit);
function resetOrbit() {
  clearTimeout(orbitResetTimer);
  orbitResetTimer = null;
  orbit.yaw = orbit.pitch = orbit.vx = orbit.vy = 0;
  redrawLogo();
}
function scheduleOrbitReset() {
  clearTimeout(orbitResetTimer);
  orbitResetTimer = setTimeout(() => {
    orbitResetTimer = null;
    if (orbit.pointer === null) resetOrbit();
  }, 5000);
}
sculptureCanvas.addEventListener("dblclick", resetOrbit);
sculptureCanvas.addEventListener("keydown", (event) => {
  if (
    !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(
      event.key,
    )
  )
    return;
  event.preventDefault();
  if (event.key === "Home") {
    resetOrbit();
    return;
  }
  orbit.vx = orbit.vy = 0;
  if (event.key === "ArrowLeft") orbit.yaw -= 0.18;
  if (event.key === "ArrowRight") orbit.yaw += 0.18;
  if (event.key === "ArrowUp") orbit.pitch = Math.max(-1.2, orbit.pitch - 0.18);
  if (event.key === "ArrowDown")
    orbit.pitch = Math.min(1.2, orbit.pitch + 0.18);
  redrawLogo();
  scheduleOrbitReset();
});
function buildShapes() {
  for (let kind = 0; kind < 1; kind++) {
    mc.clearRect(0, 0, 90, 90);
    if (kind === 0) mc.drawImage(image, 5, 5, 80, 80);
    else {
      mc.fillStyle = "#fff";
      mc.font = "bold 48px monospace";
      mc.textAlign = "center";
      mc.fillText("</>", 45, 61);
    }
    const data = mc.getImageData(0, 0, 90, 90).data;
    const points = [];
    for (let y = 0; y < 90; y++)
      for (let x = 0; x < 90; x++) {
        const i = (y * 90 + x) * 4;
        if (
          data[i + 3] > 128 &&
          Math.max(data[i], data[i + 1], data[i + 2]) -
            Math.min(data[i], data[i + 1], data[i + 2]) >
            20
        ) {
          points.push({ x: (x - 45) / 38, y: (y - 45) / 38, z: 0.11 });
          if ((x + y) % 3 === 0)
            points.push({ x: (x - 45) / 38, y: (y - 45) / 38, z: -0.11 });
        }
      }
    shapes.push(points);
  }
}
let morphState = 0;
function updateSculptureCopy() {
  $("#morph-label").textContent = ["01 — ARENA", "02 — CODE"][
    morphState
  ];
  sculptureCanvas.setAttribute("aria-label", t("sculptureHelp"));
  $("#morph-pause")?.setAttribute(
    "aria-label",
    t(logoPaused ? "resumeLogo" : "pauseLogo"),
  );
}
const redrawLogo = engine($("#logo-ascii"), (ctx, w, h, now) => {
  if (!shapes.length) return;
  const dt = previous ? Math.min(0.05, now - previous) : 0;
  if (previous && !motionOff && !logoPaused && orbit.pointer === null)
    elapsed += Math.min(1, now - previous);
  if (orbit.pointer === null && !motionOff && !logoPaused) {
    orbit.yaw += orbit.vx * dt;
    orbit.pitch = Math.max(-1.2, Math.min(1.2, orbit.pitch + orbit.vy * dt));
    orbit.vx *= Math.exp(-dt * 5);
    orbit.vy *= Math.exp(-dt * 5);
  }
  previous = now;
  const time = elapsed + offset;
  const state = 0;
  const progress = 0;
  const blend = 0;
  const from = shapes[0],
    to = shapes[0];
  const ry =
    orbit.yaw + (state === 2 ? time * 0.35 : Math.sin(time * 0.65) * 0.75);
  const rx = orbit.pitch - 0.16 + Math.sin(time * 0.4) * 0.1;
  sculptureCanvas.dataset.rotation = `${orbit.yaw.toFixed(3)},${orbit.pitch.toFixed(3)}`;
  const scale = Math.min(w * 0.36, h * 0.4);
  const cellX = 4.2,
    cellY = 6;
  const cells = new Map();
  const count = Math.max(from.length, to.length);
  for (let i = 0; i < count; i++) {
    const a = from[Math.floor((i * from.length) / count)],
      b = to[Math.floor((i * to.length) / count)];
    const x = a.x + (b.x - a.x) * blend,
      y = a.y + (b.y - a.y) * blend,
      z = a.z + (b.z - a.z) * blend;
    const xx = x * Math.cos(ry) + z * Math.sin(ry),
      zz = z * Math.cos(ry) - x * Math.sin(ry);
    const yy = y * Math.cos(rx) - zz * Math.sin(rx),
      depth = zz * Math.cos(rx) + y * Math.sin(rx);
    const perspective = 3.8 / (3.8 - depth);
    const gx = Math.round((w / 2 + xx * scale * perspective) / cellX),
      gy = Math.round((h / 2 + yy * scale * perspective) / cellY);
    const key = gx + ":" + gy;
    if (!cells.has(key) || cells.get(key).depth < depth)
      cells.set(key, { gx, gy, depth, x: xx, y: yy });
  }
  ctx.font = 'bold 7px "IBM Plex Mono", monospace';
  const ramp = ".:+*x%#@";
  for (const p of cells.values()) {
    const light = Math.max(
      0,
      Math.min(1, 0.58 + p.depth * 0.4 + p.x * 0.2 - p.y * 0.14),
    );
    ctx.fillStyle = p.x > 0.35 ? "#007d74" : "#003dad";
    ctx.globalAlpha = 0.75 + light * 0.25;
    ctx.fillText(
      ramp[Math.floor(light * (ramp.length - 1))],
      p.gx * cellX,
      p.gy * cellY,
    );
  }
  ctx.globalAlpha = 1;
  morphState = progress > 0.5 ? (state + 1) % 2 : state;
  $("#morph-label").textContent = ["01 — ARENA", "02 — CODE"][
    morphState
  ];
});
image.addEventListener("load", () => {
  buildShapes();
  redrawLogo();
});
if (image.complete && image.naturalWidth) {
  buildShapes();
  redrawLogo();
}
$("#morph-pause")?.addEventListener("click", (event) => {
  logoPaused = !logoPaused;
  previous = 0;
  event.currentTarget.textContent = logoPaused ? "▷" : "Ⅱ";
  event.currentTarget.setAttribute("aria-pressed", String(logoPaused));
  event.currentTarget.setAttribute(
    "aria-label",
    t(logoPaused ? "resumeLogo" : "pauseLogo"),
  );
  redrawLogo();
});
function updateMotionCopy() {
  const toggle = $("#motion-toggle");
  toggle.setAttribute("aria-pressed", String(motionOff));
  toggle.setAttribute(
    "aria-label",
    t(motionOff ? "enableMotion" : "disableMotion"),
  );
  toggle.innerHTML = `${motionOff ? "▷" : "Ⅱ"} <span>${t(motionOff ? "resume" : "pause")}</span>`;
}
function updateMotion() {
  document.body.classList.toggle("no-motion", motionOff);
  updateMotionCopy();
  previous = 0;
  engines.forEach((refresh) => refresh());
}
$("#motion-toggle").addEventListener("click", () => {
  motionOff = !motionOff;
  sessionStorage.setItem("arena-motion", motionOff ? "off" : "on");
  updateMotion();
});
updateMotion();
document.addEventListener("languagechange", () => {
  updateSculptureCopy();
  updateMotionCopy();
});
