const status = document.querySelector('#preview-status');
const slider = document.querySelector('#blend');
const pauseButton = document.querySelector('#preview-pause');

try {
  const { background, drift, contour } = await import('https://esm.sh/asciify-engine@4.32.8/kit');
  let clearRects = [], dirty = true;
  const markDirty = () => { dirty = true; };
  const clear = () => {
    if (!dirty) return clearRects;
    dirty = false;
    clearRects = [...document.querySelectorAll('.hero-lockup, #hero-title, .hero-description, .event-date, .hero-actions')]
      .map(element => element.getBoundingClientRect());
    return clearRects;
  };
  addEventListener('resize', markDirty, { passive: true });
  addEventListener('scroll', markDirty, { passive: true });
  document.fonts.addEventListener('loadingdone', markDirty);
  const shared = {
    palette: '#b6c1bb', cellSize: 9, charset: ' .:+*#@', mark: 'glyph',
    clear, clearPadding: 6, clearSoftness: 34, clearStrength: .95,
    speed: 2.2, reducedMotion: false, opacity: .35, lazy: false, globalLook: false
  };
  const layers = [
    background(document.querySelector('#drift-layer'), { ...shared, preset: drift, cursor: 'trail' }),
    background(document.querySelector('#contour-layer'), { ...shared, preset: contour, cursor: 'lantern' })
  ];
  if (layers.some(layer => !layer.supported)) throw new Error('WebGL2 is unavailable in this browser.');
  layers.forEach(layer => layer.play());
  window.previewBackgrounds = layers;
  slider.addEventListener('input', () => {
    const blend = Number(slider.value) / 100;
    layers[0].update({ opacity: .8 * (1 - blend) });
    layers[1].update({ opacity: .8 * blend });
    document.querySelector('#blend-value').value = `${100 - Number(slider.value)} / ${slider.value}`;
  });
  slider.dispatchEvent(new Event('input'));
  let paused = false;
  pauseButton.addEventListener('click', () => {
    paused = !paused;
    layers.forEach(layer => paused ? layer.pause() : layer.play());
    pauseButton.setAttribute('aria-pressed', String(paused));
    pauseButton.textContent = paused ? 'Resume ▷' : 'Pause Ⅱ';
    status.textContent = paused ? 'Animation paused' : 'Animating · 2.2× speed';
  });
  status.textContent = 'Animating · 2.2× speed';
  document.body.dataset.previewReady = 'true';
} catch (error) {
  status.textContent = 'Preview could not load. Please reload.';
  document.body.dataset.previewError = error.message;
  console.error(error);
}
