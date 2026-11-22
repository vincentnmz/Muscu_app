/* N2 (22/11, docs/audit-cardio-nutrition-science-2026-11-22.md) : effort estimé d'une sortie importée sans RPE = % de la FC max
 * estimée selon l'âge (208 − 0,7 × âge, Tanaka 2001) ; âge inconnu → anciens seuils en bpm ; l'app reprend rpe_estime. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
let js = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
js = js.split('\n').filter((l) => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { _fcMaxEstimee, _rpeDepuisFc, chargeInterneCardio };';
const S = { createClient: () => ({ from: () => ({}) }), webpush: { setVapidDetails() {}, sendNotification: async () => {} }, Deno: { env: { get: () => undefined }, serve: () => {} },
  Response, Request, URLSearchParams, TextEncoder, TextDecoder, console, atob, btoa, setTimeout, clearTimeout, crypto: require('crypto').webcrypto, fetch: async () => ({}) };
vm.createContext(S); vm.runInContext(js, S); const A = S.__api;
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };
const an = (y) => { const d = new Date(); d.setFullYear(d.getFullYear() - y); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10); };
const m25 = A._fcMaxEstimee(an(25)), m55 = A._fcMaxEstimee(an(55));
eq(Math.abs(m25 - (208 - 0.7 * 25.08)) < 0.5 && Math.abs(m55 - (208 - 0.7 * 55.08)) < 0.5, 'FC max estimée = 208 − 0,7 × âge', [m25, m55]);
eq(A._fcMaxEstimee('') === null && A._fcMaxEstimee('n/a') === null, 'date de naissance inconnue → pas d\'estimation');
eq(A._fcMaxEstimee('15/03/' + (new Date().getFullYear() - 40)) > 0, 'date au format jj/mm/aaaa acceptée');
eq(A._rpeDepuisFc(165, m25) === 8 && A._rpeDepuisFc(165, m55) === 9, '165 bpm : RPE 8 à 25 ans (≈ 87 % de la FC max), RPE 9 à 55 ans (≈ 98 %)', [A._rpeDepuisFc(165, m25), A._rpeDepuisFc(165, m55)]);
eq(A._rpeDepuisFc(165, null) === 9 && A._rpeDepuisFc(120, null) === 5 && A._rpeDepuisFc(0, null) === 5, 'âge inconnu → anciens seuils en bpm');
eq(A.chargeInterneCardio({ type_cardio: 'course', duree: 30, fc_moy: 165, rpe_estime: 7 }) === 210, 'charge = rpe_estime × durée quand il est posé');
eq(A.chargeInterneCardio({ type_cardio: 'course', duree: 30, fc_moy: 165, rpe: 5, rpe_estime: 7 }) === 150, 'un RPE saisi passe toujours avant l\'estimation');
const APP = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
eq(/rpe_estime/.test(APP.slice(APP.indexOf('function _chargeInterneCardio'), APP.indexOf('function _chargeInterneCardio') + 900)), 'l\'app reprend rpe_estime (même charge que le serveur)');
console.log(`rpe-fc-age : ${ok} OK / ${ko} KO`); process.exit(ko ? 1 : 0);
