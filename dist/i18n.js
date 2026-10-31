import { translations } from './translations.js';

export function resolveLanguage(saved) {
  return saved === 'fr' ? 'fr' : 'en';
}

export let language = 'en';
if (typeof window !== 'undefined') {
  try { language = resolveLanguage(localStorage.getItem('arena-language')); } catch {}
}

export function t(key) {
  return translations[language][key] ?? translations.en[key] ?? key;
}

const textBindings = [];
const attributeBindings = [];

export function setLanguage(next, remember = true) {
  language = resolveLanguage(next);
  if (remember) {
    try { localStorage.setItem('arena-language', language); } catch {}
  }
  document.documentElement.lang = language;
  for (const { node, key, before, after } of textBindings) node.textContent = before + t(key) + after;
  for (const { element, attribute, key } of attributeBindings) element.setAttribute(attribute, t(key));
  document.querySelectorAll('[data-language]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.language === language));
  });
  document.dispatchEvent(new Event('languagechange'));
}

if (typeof document !== 'undefined') {
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const nodes = [...element.childNodes].filter(node => node.nodeType === 3 && node.textContent.trim());
    const keys = element.dataset.i18n.split(',');
    if (!nodes.length && keys.length === 1) nodes.push(element.appendChild(document.createTextNode('')));
    keys.forEach((key, index) => {
      const node = nodes[index];
      if (!key || !node) return;
      const text = node.textContent;
      textBindings.push({ node, key, before: text.match(/^\s*/)[0], after: text.trim() ? text.match(/\s*$/)[0] : '' });
    });
  });
  for (const attribute of ['aria-label', 'placeholder', 'content']) {
    document.querySelectorAll(`[data-i18n-${attribute}]`).forEach(element => {
      attributeBindings.push({ element, attribute, key: element.getAttribute(`data-i18n-${attribute}`) });
    });
  }
  document.querySelectorAll('[data-language]').forEach(button => {
    button.addEventListener('click', () => setLanguage(button.dataset.language));
  });
  setLanguage(language, false);
}
