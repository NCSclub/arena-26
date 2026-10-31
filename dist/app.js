import { registrationPayload } from './registration-data.js';
import { motionOff } from './visuals.js';
import { language, t } from './i18n.js';
const $ = selector => document.querySelector(selector);
history.scrollRestoration = 'manual';

let currentStep = 0;
let statusKey = '';
const form = $('#registration-form');
form.noValidate = true;
function conditionalFields() {
  for (const [selector, name, enabled, required] of [
    ['#team-fields', 'hasTeam', form.elements.hasTeam.value === 'yes', 'teamName'],
    ['#transport-fields', 'needsTransportation', form.elements.needsTransportation.value === 'yes', 'transportationAddress']
  ]) {
    const group = $(selector); group.hidden = !enabled;
    group.querySelectorAll('input').forEach(input => { input.disabled = !enabled; input.required = enabled && input.name === required; });
  }
}
form.addEventListener('change', conditionalFields);
form.addEventListener('input', event => {
  if (event.target.setCustomValidity) event.target.setCustomValidity('');
  $('#form-status').textContent = '';
  statusKey = '';
});
function validateInput(input) {
  input.setCustomValidity('');
  if (input.required && !input.value.trim()) input.setCustomValidity(t('required'));
  else if (input.validity.typeMismatch) input.setCustomValidity(t('emailInvalid'));
  else if (input.validity.patternMismatch) input.setCustomValidity(t('phoneInvalid'));
  else if (input.validity.tooShort) input.setCustomValidity(t('tooShort'));
}
function validStep(index) {
  const controls = document.querySelectorAll(`[data-step="${index}"] input, [data-step="${index}"] select, [data-step="${index}"] textarea`);
  for (const input of controls) {
    if (input.disabled) continue;
    validateInput(input);
    if (!input.reportValidity()) return false;
  }
  return true;
}
function payload() { return registrationPayload(Object.fromEntries(new FormData(form))); }
function renderReview() {
  const values = payload();
  const groups = [
    [t('profileHeading'), ['fullName', 'phoneNumber', 'email', 'discordTag', 'university', 'yearOfStudy', 'studentId'].map(key => [t(key), values[key]])],
    [t('teamHeading'), [[t('participation'), t(values.hasTeam ? 'teamParticipation' : 'soloParticipation')], ...(values.hasTeam ? [[t('teamName'), values.teamName], [t('teammates'), values.teammates.join(', ') || t('notProvided')]] : [])]],
    [t('eventDay'), [[t('transport'), t(values.needsTransportation ? 'transportRequested' : 'transportIndependent')], ...(values.needsTransportation ? [[t('departure'), values.transportationAddress]] : []), [t('expectations'), values.expectations]]]
  ];
  $('#review').replaceChildren(...groups.map(([title, entries]) => {
    const section = document.createElement('section'); section.className = 'review-group';
    const heading = document.createElement('h3'); heading.textContent = title; section.append(heading);
    const list = document.createElement('dl');
    entries.forEach(([label, value]) => {
      const row = document.createElement('div'); row.className = 'review-row';
      const term = document.createElement('dt'); term.textContent = label;
      const description = document.createElement('dd'); description.textContent = value;
      row.append(term, description); list.append(row);
    });
    section.append(list); return section;
  }));
}
function updateFormCopy() {
  $('#form-progress').textContent = `${t('step')} 0${currentStep + 1} / 03`;
  $('#next-step').replaceChildren(document.createTextNode(t(currentStep === 2 ? 'export' : 'continue') + ' '));
  const arrow = document.createElement('span'); arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = currentStep === 2 ? '↓' : '→'; $('#next-step').append(arrow);
  $('#form-status').textContent = statusKey ? t(statusKey) : '';
  if (currentStep === 2) renderReview();
}
function showStep(index, focus = true) {
  currentStep = index;
  document.querySelectorAll('.form-step').forEach((step, i) => { step.hidden = i !== index; });
  document.querySelectorAll('.steps li').forEach((step, i) => {
    step.classList.toggle('active', i === index); step.classList.toggle('done', i < index);
    if (i === index) step.setAttribute('aria-current', 'step'); else step.removeAttribute('aria-current');
  });
  $('#previous-step').hidden = index === 0;
  $('#step-counter').textContent = `PLAYER_SETUP / 0${index + 1}`;
  statusKey = ''; updateFormCopy();
  if (focus) {
    const heading = $(`[data-step="${index}"] h2`); heading.tabIndex = -1; heading.focus({ preventScroll: true });
    $('.form-panel').scrollIntoView({ behavior: motionOff ? 'instant' : 'smooth', block: 'start' });
  }
}
$('#previous-step').addEventListener('click', () => showStep(Math.max(0, currentStep - 1)));
form.addEventListener('submit', event => {
  event.preventDefault();
  if (currentStep < 2) { if (validStep(currentStep)) showStep(currentStep + 1); return; }
  for (let index = 0; index < 2; index++) {
    showStep(index, false);
    if (!validStep(index)) return;
  }
  showStep(2, false);
  const blob = new Blob([JSON.stringify(payload(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = language === 'fr' ? 'arena-26-mes-reponses.json' : 'arena-26-my-answers.json'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  statusKey = 'exported'; $('#form-status').textContent = t(statusKey);
});
function updateTitle() {
  document.title = location.hash === '#inscription' ? t('registrationPageTitle') : 'ARENA 26 — Think fast. Gain more.';
}
function route() {
  const registering = location.hash === '#inscription';
  $('#landing').hidden = registering; $('#registration').hidden = !registering;
  updateTitle();
  if (registering) {
    scrollTo({ top: 0, behavior: 'instant' });
    const heading = $('#registration-title'); heading.tabIndex = -1; heading.focus({ preventScroll: true });
  } else if (location.hash.length > 1) requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView());
  else scrollTo({ top: 0, behavior: 'instant' });
}
window.addEventListener('hashchange', route);
document.addEventListener('languagechange', () => {
  updateTitle(); updateFormCopy();
  [...form.elements].filter(input => input.validity?.customError).forEach(validateInput);
});
conditionalFields(); showStep(0, false); route();
