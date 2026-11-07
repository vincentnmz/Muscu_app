/* =============================================================================
 * Bien-être « le jour compte pour le jour » (06/11/2026, tableau validé :
 * docs/cas-bloque-bienetre-2026-11-06.md). VRAIES fonctions d'index.ts.
 *  - réponse d'aujourd'hui ou d'hier → elle décide ;
 *  - sans réponse récente → tendance seulement (≥ 2 réponses défavorables sur 7 j,
 *    ou moyenne défavorable), sinon rien ;
 *  - MÊME règle athlète et coach (fatigueVerdict / sommeilVerdict).
 * ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const { webcrypto } = require('crypto');

let js = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n');
js += '\n;this.__api = { _aggSignaux, evaluerEtatAthlete };';
const sandbox = { createClient: () => ({ from: () => ({}) }), webpush: { setVapidDetails() {}, sendNotification: async () => {} },
  Deno: { env: { get: () => undefined }, serve: () => {} }, Response, Request, URLSearchParams, TextEncoder, TextDecoder, console, atob, btoa,
  setTimeout, clearTimeout, crypto: webcrypto, fetch: async () => ({}) };
vm.createContext(sandbox); vm.runInContext(js, sandbox);
const { _aggSignaux, evaluerEtatAthlete } = sandbox.__api;

let ok = 0, ko = 0; const fails = [];
function eq(c, l, g) { if (c) ok++; else { ko++; fails.push(l); console.error('  ✗ ' + l + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } }

// Semaine type : lundi 02/11 … dimanche 08/11 (midi UTC).
const J = (d) => new Date('2026-11-' + d + 'T12:00:00Z');
const R = (d, o) => Object.assign({ date: '2026-11-' + d }, o);
const niveau = (rows, now) => {
  const g = _aggSignaux(rows, now, 7);
  return evaluerEtatAthlete({ acwr: 1.0, acwrFiable: true, seances7: 3, douleur: g.douleur, douleurZone: g.douleurZone, douleurDate: g.douleurDate,
    fatigue: g.fatigueVerdict, sommeil: g.sommeilVerdict, stress: null, courbatures: null, injStatut: null, ctxEtat: 'saison_normale',
    q: { jours: 90, wellnessN: rows.length, hasCharge: true } }).niveau;
};

// 1. Mauvaise nuit puis la pêche → mardi Prêt.
eq(niveau([R('02', { sommeil: '1', fatigue_musculaire: '1' }), R('03', { sommeil: '4', fatigue_musculaire: '1' })], J('03')) === 0, 'Cas 1 : mauvaise nuit lundi, bonne nuit mardi → mardi Prêt');
// 2. Journée fatiguée puis la pêche → mardi Prêt (avant : coach « Fatigue élevée » jusqu'au dimanche).
eq(niveau([R('02', { fatigue_musculaire: '5', sommeil: '4' }), R('03', { fatigue_musculaire: '1', sommeil: '4' })], J('03')) === 0, 'Cas 2 : fatigue 5 lundi, 1 mardi → mardi Prêt');
// 3. Journée fatiguée, pas de réponse ensuite → Vigilance lundi + mardi, Prêt dès mercredi.
{ const r = [R('02', { fatigue_musculaire: '5', sommeil: '4' })];
  eq(niveau(r, J('02')) === 1 && niveau(r, J('03')) === 1, 'Cas 3 : fatigue 5 lundi → Vigilance lundi et mardi');
  eq(niveau(r, J('04')) === 0 && niveau(r, J('06')) === 0, 'Cas 3 : sans nouvelle réponse → Prêt dès mercredi'); }
// 4. Deux mauvaises nuits → Vigilance jusqu'à une bonne réponse.
{ const r = [R('02', { sommeil: '1', fatigue_musculaire: '1' }), R('03', { sommeil: '2', fatigue_musculaire: '1' })];
  eq(niveau(r, J('04')) === 1 && niveau(r, J('05')) === 1, 'Cas 4 : 2 mauvaises nuits, pas de réponse → Vigilance');
  eq(niveau(r.concat([R('05', { sommeil: '4', fatigue_musculaire: '1' })]), J('05')) === 0, 'Cas 4 : bonne réponse jeudi → Prêt'); }
// 5. Fatigue 4 lundi et mercredi, 2 jeudi → jeudi Prêt.
eq(niveau([R('02', { fatigue_musculaire: '4', sommeil: '4' }), R('04', { fatigue_musculaire: '4', sommeil: '4' }), R('05', { fatigue_musculaire: '2', sommeil: '4' })], J('05')) === 0, 'Cas 5 : fatigue 4 lun + mer, 2 jeudi → jeudi Prêt');
// 6. Douleur passée → inchangé (dernière saisie).
eq(niveau([R('02', { douleur: '3', fatigue_musculaire: '1', sommeil: '4' }), R('03', { douleur: '1', fatigue_musculaire: '1', sommeil: '4' })], J('03')) === 0, 'Cas 6 : douleur 3 lundi, 1 mardi → Prêt');
// 7. Vieille réponse seule (6 j) → Prêt.
eq(niveau([R('02', { fatigue_musculaire: '4', sommeil: '4' })], J('08')) === 0, 'Cas 7 : une seule réponse fatigue 4 il y a 6 j → Prêt');
// 8. Cas réel (05 et 06/11) : sommeil 4, fatigue 1, douleur 1 → Prêt.
eq(niveau([R('05', { sommeil: '4', fatigue_musculaire: '1', douleur: '1' }), R('06', { sommeil: '4', fatigue_musculaire: '1', douleur: '1' })], J('06')) === 0, 'Cas 8 : cas réel → Prêt');

console.log('-'.repeat(66));
console.log('bien-être jour par jour : ' + ok + ' OK / ' + ko + ' KO');
if (ko) { console.log('Échecs : ' + fails.join(' | ')); process.exit(1); }
