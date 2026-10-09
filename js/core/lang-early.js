// Runs in <head> before the first paint: sets the language direction and enables the Bootstrap RTL stylesheet
// for Urdu, so the page never flashes left-to-right. Keep in sync with js/i18n/i18n.js (same storage key).
(function () {
  var lang = 'en';
  try { lang = localStorage.getItem('disterp.lang') === 'ur' ? 'ur' : 'en'; } catch (e) { /* storage blocked */ }
  var root = document.documentElement;
  root.lang = lang;
  root.dir = lang === 'ur' ? 'rtl' : 'ltr';
  root.classList.toggle('lang-ur', lang === 'ur');
  var rtl = document.getElementById('bs-rtl');
  if (rtl) rtl.disabled = lang !== 'ur';
})();
