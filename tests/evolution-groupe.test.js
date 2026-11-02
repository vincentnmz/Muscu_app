/* Audit Évolution (02/11/2026) — Par groupe : semaines réellement couvertes (E1), statuts du Résumé (E4/E5). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const pick = (name) => { const i = src.indexOf('function ' + name + '('); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } };
const sb = { Date, Math, Object, String, Number }; vm.createContext(sb);
vm.runInContext(['_ymdLocal', '_maSemCouvertes', '_maVolStatut', '_maNum1'].map(pick).join('\n'), sb);
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };
const iso = (d) => sb._ymdLocal(d), t = new Date(), y = t.getFullYear(), m = t.getMonth();
const data = { historique: { daily_muscu: { '2026-06-15': { series: 10 } } } };
// Période passée complète : octobre 2026 = 31 jours.
const oct = { startISO: '2026-10-01', endISO: '2026-11-01', days: 31 };
eq(Math.abs(sb._maSemCouvertes(data, oct) - 31 / 7) < 1e-9, 'E1 : mois passé = 31/7 semaines (avant : 4)');
// Mois en cours : pas la durée totale (avant : ÷ 4 semaines dès le 1er du mois).
const debut = new Date(y, m, 1), fin = new Date(y, m + 1, 1);
const w = sb._maSemCouvertes(data, { startISO: iso(debut), endISO: iso(fin), days: Math.round((fin - debut) / 864e5) });
eq(w <= (t.getDate() + 1) / 7 + 1e-9 || w === 1, 'E1 : mois en cours = jours écoulés seulement (min. 1 semaine)', w);
// Année : à partir de la 1re séance, pas 52 semaines.
const an = sb._maSemCouvertes(data, { startISO: '2026-01-01', endISO: '2027-01-01', days: 365 });
eq(an < 52 && an > 19, 'E1 : année = depuis la 1re séance (15/06), pas 52 semaines', an);
// Statuts identiques au Résumé.
eq(sb._maVolStatut(5, 8, 14, null).t === 'Sous-MEV' && sb._maVolStatut(9, 8, 14, null).t === 'Suffisant' && sb._maVolStatut(14, 8, 14, null).t === 'Optimal' && sb._maVolStatut(22, 8, 14, null).t === 'Au-delà', 'E5 : 4 statuts (Sous-MEV / Suffisant / Optimal / Au-delà)');
eq(sb._maVolStatut(3, 8, 14, 'déload').t === 'Réduit (déload)', 'E4 : déload → « Réduit (déload) » au lieu de Sous-MEV');
eq(sb._maNum1(3.94) === '3,9', 'E9 : virgule décimale');
console.log('-'.repeat(70)); console.log('evolution-groupe : ' + ok + ' OK / ' + ko + ' KO'); if (ko) process.exitCode = 1;
