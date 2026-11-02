import { createAsciiField } from './mixed-field.js';

const status = document.querySelector('#preview-status');
const pauseButton = document.querySelector('#preview-pause');

try {
  await document.fonts.ready;
  const field = createAsciiField(document.querySelector('#mixed-field'));
  let paused = false;
  pauseButton.addEventListener('click', () => {
    paused = !paused;
    paused ? field.pause() : field.play();
    pauseButton.setAttribute('aria-pressed', String(paused));
    pauseButton.textContent = paused ? 'Resume ▷' : 'Pause Ⅱ';
    status.textContent = paused ? 'ASCII / PAUSED' : 'ASCII / LIVE';
  });
  status.textContent = 'ASCII / LIVE';
  document.body.dataset.previewReady = 'true';
} catch (error) {
  status.textContent = 'Preview could not load. Please reload.';
  document.body.dataset.previewError = error.message;
  console.error(error);
}
