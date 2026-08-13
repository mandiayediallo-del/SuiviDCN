/*
 * Configuration de déploiement DCN.
 * Après déploiement Apps Script, coller l'URL /exec dans API_URL.
 * L'URL n'est pas un secret : les droits sont contrôlés côté Apps Script.
 */
window.DCN_RUNTIME_CONFIG={
  MODE:'google-sheets',
  API_URL:'https://script.google.com/macros/s/AKfycbx4UnWxoimay-ITgRMXM4bRP5QaXWKs9R30-R8V5cDuiRhJVAV2eqj6Ryc2371p9kRX/exec',
  SYNC_DEBOUNCE_MS:650,
  REQUEST_TIMEOUT_MS:20000
};
