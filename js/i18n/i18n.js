// Language support (English / Urdu).
// English text is the key. Each screen is rendered in English by its module; when Urdu is on, every text node and
// placeholder / title / aria-label is looked up in ur.js and replaced as it appears (initial pass + MutationObserver).
// Changing the language reloads the page, so every screen is rendered again from scratch.
import { storageKey } from '../config.js';
import { UR, UR_PATTERNS } from './ur.js';

const KEY = storageKey('lang');
const LANGS = ['en', 'ur'];
const TRANSLATED_ATTRS = ['placeholder', 'title', 'aria-label'];
// Text inside these is never translated (code, styles, and the print area used for receipts).
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA', 'NOSCRIPT', 'SVG']);

let lang = 'en';
try { lang = localStorage.getItem(KEY) === 'ur' ? 'ur' : 'en'; } catch { lang = 'en'; }
let observer = null;
let toggleBound = false;

// Locale for Intl formatting (dates, month names). Digits stay Western so amounts read the same in both languages.
export const locale = () => (lang === 'ur' ? 'ur-PK' : undefined);

// Applies the language to the document: direction, Bootstrap RTL stylesheet, language buttons, translation.
// Call once at boot, before modules render.
export function applyLanguage() {
  const root = document.documentElement;
  root.lang = lang;
  root.dir = lang === 'ur' ? 'rtl' : 'ltr';
  root.classList.toggle('lang-ur', lang === 'ur');
  const rtl = document.getElementById('bs-rtl');
  if (rtl) rtl.disabled = lang !== 'ur';
  // Language buttons show the language they switch to.
  document.querySelectorAll('[data-lang-toggle]').forEach((b) => { b.textContent = lang === 'ur' ? 'English' : 'اردو'; });
  if (!toggleBound) {
    toggleBound = true;
    document.addEventListener('click', (e) => {
      if (e.target.closest?.('[data-lang-toggle]')) setLanguage(lang === 'ur' ? 'en' : 'ur');
    });
  }
  if (lang === 'ur') {
    translateTree(document.body);
    if (!observer) startObserver();
  }
}

// Stores the new language and reloads so every screen is rendered in it.
export function setLanguage(next) {
  if (!LANGS.includes(next) || next === lang) return;
  try { localStorage.setItem(KEY, next); } catch { /* storage unavailable: the choice lasts for this visit */ }
  location.reload();
}

// Looks up one trimmed English string. Returns the translation, or null when there is none.
function lookup(s) {
  if (Object.prototype.hasOwnProperty.call(UR, s)) return UR[s];
  for (const [re, tpl] of UR_PATTERNS) if (re.test(s)) return s.replace(re, tpl);
  return null;
}

function translateText(node) {
  const parent = node.parentNode;
  if (!parent || parent.nodeType !== 1 || SKIP_TAGS.has(parent.tagName) || parent.closest('#print-area, [data-no-i18n]')) return;
  const raw = node.nodeValue;
  const s = raw.trim();
  if (!s) return;
  const out = lookup(s);
  if (out === null || out === s) return;
  const lead = raw.match(/^\s*/)[0];
  const trail = raw.match(/\s*$/)[0];
  node.nodeValue = lead + out + trail;
}

function translateAttrs(el) {
  if (el.closest('#print-area, [data-no-i18n]')) return;
  for (const name of TRANSLATED_ATTRS) {
    const v = el.getAttribute(name);
    if (!v) continue;
    const out = lookup(v.trim());
    if (out !== null && out !== v.trim()) el.setAttribute(name, out);
  }
}

// Translates a subtree (or a single text node / element).
function translateTree(root) {
  if (root.nodeType === 3) return translateText(root);
  if (root.nodeType !== 1 && root.nodeType !== 11) return;
  if (root.nodeType === 1) translateAttrs(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (n.nodeType === 3) return NodeFilter.FILTER_ACCEPT;
      if (SKIP_TAGS.has(n.tagName)) return NodeFilter.FILTER_REJECT;
      translateAttrs(n);
      return NodeFilter.FILTER_SKIP; // skip the element itself, keep visiting its children
    },
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) translateText(n);
}

function startObserver() {
  observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') translateText(r.target);
      else if (r.type === 'attributes') translateAttrs(r.target);
      else r.addedNodes.forEach((n) => translateTree(n));
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: TRANSLATED_ATTRS });
}
