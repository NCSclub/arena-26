import { registrationPayload } from './registration-data.js';
import { motionOff } from './visuals.js';
const $ = selector => document.querySelector(selector);
history.scrollRestoration = 'manual';

let currentStep = 0;
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
});
function validStep(index) {
  const controls = document.querySelectorAll(`[data-step="${index}"] input, [data-step="${index}"] select, [data-step="${index}"] textarea`);
  for (const input of controls) {
    if (input.disabled) continue;
    if (input.required && !input.value.trim()) input.setCustomValidity('Merci de renseigner ce champ.');
    else input.setCustomValidity('');
    if (!input.reportValidity()) return false;
  }
  return true;
}
const labels = { fullName: 'Nom complet', phoneNumber: 'Téléphone', email: 'E-mail', discordTag: 'Discord', university: 'Établissement', yearOfStudy: 'Année d’études', studentId: 'Matricule', teamName: 'Nom de l’équipe', expectations: 'Tes attentes' };
function payload() { return registrationPayload(Object.fromEntries(new FormData(form))); }
function renderReview() {
  const values = payload();
  const groups = [
    ['TON PROFIL', ['fullName', 'phoneNumber', 'email', 'discordTag', 'university', 'yearOfStudy', 'studentId'].map(key => [labels[key], values[key]])],
    ['TON ÉQUIPE', [['Participation', values.hasTeam ? 'En équipe' : 'En solo'], ...(values.hasTeam ? [['Équipe', values.teamName], ['Coéquipiers', values.teammates.join(', ') || 'Non renseignés']] : [])]],
    ['LE JOUR J', [['Transport', values.needsTransportation ? 'Demandé, selon disponibilité' : 'Autonome'], ...(values.needsTransportation ? [['Départ', values.transportationAddress]] : []), ['Tes attentes', values.expectations]]]
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
function showStep(index, focus = true) {
  currentStep = index;
  document.querySelectorAll('.form-step').forEach((step, i) => { step.hidden = i !== index; });
  document.querySelectorAll('.steps li').forEach((step, i) => {
    step.classList.toggle('active', i === index); step.classList.toggle('done', i < index);
    if (i === index) step.setAttribute('aria-current', 'step'); else step.removeAttribute('aria-current');
  });
  $('#previous-step').hidden = index === 0;
  $('#form-progress').textContent = `ÉTAPE 0${index + 1} / 03`;
  $('#step-counter').textContent = `PLAYER_SETUP / 0${index + 1}`;
  $('#next-step').innerHTML = index === 2 ? 'Exporter mes réponses <span aria-hidden="true">↓</span>' : 'Continuer <span aria-hidden="true">→</span>';
  $('#form-status').textContent = '';
  if (index === 2) renderReview();
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
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'arena-26-mes-reponses.json'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('#form-status').textContent = 'Réponses exportées. Aucune inscription n’a été envoyée à l’organisation.';
});
function route() {
  const registering = location.hash === '#inscription';
  $('#landing').hidden = registering; $('#registration').hidden = !registering;
  document.title = registering ? 'Inscription — ARENA 26' : 'ARENA 26 — Think fast. Gain more.';
  if (registering) {
    scrollTo({ top: 0, behavior: 'instant' });
    const heading = $('#registration-title'); heading.tabIndex = -1; heading.focus({ preventScroll: true });
  } else if (location.hash.length > 1) requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView());
  else scrollTo({ top: 0, behavior: 'instant' });
}
window.addEventListener('hashchange', route);
conditionalFields(); showStep(0, false); route();
