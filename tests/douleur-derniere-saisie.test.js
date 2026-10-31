/* =============================================================================
 * Douleur (oct. 2026, validé porteur) — VRAIES fonctions d'index.ts :
 *   - seuils : 2 Légère = point d'attention (pas de Vigilance) · 3 Modérée =
 *     Vigilance · 4 Forte+ = rouge ;
 *   - la douleur suit la DERNIÈRE saisie : rouge à 4, puis redescend si deux
 *     jours après l'athlète note 3 (Vigilance) ou 2/1 (Prêt) ;
 *   - le verdict expose sa CAUSE (zone + date) — règle 6bis.
 * ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const { webcrypto } = require('crypto');

let js = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n');
js += '\n;this.__api = { _aggSignaux, evaluerEtatAthlete };';
const sandbox = {
  createClient: () => ({ from: () => ({}) }),
  webpush: { setVapidDetails() {}, sendNotification: async () => {} },
  Deno: { env: { get: () => undefined }, serve: () => {} },
  Response, Request, URLSearchParams, TextEncoder, TextDecoder, console, atob, btoa, setTimeout, clearTimeout,
  crypto: webcrypto, fetch: async () => ({}),
};
vm.createContext(sandbox);
vm.runInContext(js, sandbox);
const { _aggSignaux, evaluerEtatAthlete } = sandbox.__api;

let ok = 0, ko = 0; const fails = [];
function eq(cond, label, got) { if (cond) ok++; else { ko++; fails.push(label); console.error('  ✗ ' + label + (got !== undefined ? ' (got ' + JSON.stringify(got) + ')' : '')); } }

const NOW = new Date('2026-10-28T12:00:00Z');
const etat = (rows) => {
  const g = _aggSignaux(rows, NOW, 7);
  return evaluerEtatAthlete({ acwr: 1.0, acwrFiable: true, seances7: 3, douleur: g.douleur, douleurZone: g.douleurZone, douleurDate: g.douleurDate,
    fatigue: 1, sommeil: 4, stress: null, courbatures: null, injStatut: null, ctxEtat: 'saison_normale', q: { jours: 90, wellnessN: 5, hasCharge: true } });
};

// Forte (4) aujourd'hui → rouge, cause affichée avec zone + date.
{ const e = etat([{ date: '2026-10-28', douleur: '4', zone_douloureuse: 'Epaule gauche' }]);
  eq(e.niveau === 2, 'douleur 4 → rouge', e.niveau);
  eq(e.causes.some(c => /Douleur forte — epaule gauche \(28\/10\)/.test(c)), 'cause « Douleur forte — epaule gauche (28/10) »', e.causes); }
// Forte le 26 puis Modérée le 28 → redescend en Vigilance.
{ const e = etat([{ date: '2026-10-26', douleur: '4', zone_douloureuse: 'Genou' }, { date: '2026-10-28', douleur: '3', zone_douloureuse: 'Genou' }]);
  eq(e.niveau === 1, '4 puis 3 deux jours après → Vigilance (plus rouge)', e.niveau); }
// Forte le 26 puis Légère le 28 → Prêt + simple point d'attention.
{ const e = etat([{ date: '2026-10-26', douleur: '4', zone_douloureuse: 'Genou' }, { date: '2026-10-28', douleur: '2', zone_douloureuse: 'Genou' }]);
  eq(e.niveau === 0, '4 puis 2 → Prêt', e.niveau);
  eq(e.alertes.some(a => a.type === 'douleur' && a.severite === 'basse'), '2 → point d\'attention (sévérité basse)', e.alertes); }
// Légère le 26 puis Aucune le 27 → rien.
{ const e = etat([{ date: '2026-10-26', douleur: '2', zone_douloureuse: 'Epaule gauche' }, { date: '2026-10-27', douleur: '1' }]);
  eq(e.niveau === 0 && !e.alertes.some(a => a.type === 'douleur'), '2 puis 1 (Aucune) → plus aucune alerte douleur', e.alertes); }
// Cas réel Vincent (26/10 : Légère épaule gauche, reste OK) → Prêt, pas Vigilance.
{ const e = etat([{ date: '2026-10-23', douleur: '1' }, { date: '2026-10-26', douleur: '2', zone_douloureuse: 'Epaule gauche' }]);
  eq(e.niveau === 0, 'cas réel : Légère seule → Prêt (plus « Reste vigilant »)', e.niveau); }
// Prêt → aucune cause.
{ const e = etat([{ date: '2026-10-28', douleur: '1' }]);
  eq(Array.isArray(e.causes) && e.causes.length === 0, 'Prêt → causes vides', e.causes); }

// Audit 31/10 (données réelles) : zone stockée « NaN » → aucune zone (plus de « (nan) » dans l'alerte).
{ const e = etat([{ date: '2026-10-28', douleur: '2', zone_douloureuse: 'NaN' }]);
  const a = e.alertes.find(x => x.type === 'douleur');
  eq(a && a.message === 'Gêne légère signalée', 'zone « NaN » → « Gêne légère signalée » sans (nan)', a && a.message); }

console.log('-'.repeat(70));
console.log('douleur dernière saisie : ' + ok + ' OK / ' + ko + ' KO');
if (ko) { console.log('Échecs : ' + fails.join(' | ')); process.exit(1); }
