import { createMixedField } from './mixed-field.js';

const status = document.querySelector('#preview-status');
const slider = document.querySelector('#blend');
const pauseButton = document.querySelector('#preview-pause');

try {
  await document.fonts.ready;
  const field = createMixedField(document.querySelector('#mixed-field'), Number(slider.value) / 100);
  slider.addEventListener('input', () => {
    const blend = Number(slider.value) / 100;
    field.setBlend(blend);
    document.querySelector('#blend-value').value = `${100 - Number(slider.value)} / ${slider.value}`;
  });
  slider.dispatchEvent(new Event('input'));
  let paused = false;
  pauseButton.addEventListener('click', () => {
    paused = !paused;
    paused ? field.pause() : field.play();
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
