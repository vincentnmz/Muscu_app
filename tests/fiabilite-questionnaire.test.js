/* FIABILITÉ DES DONNÉES (Analyses ▸ Résumé) — critère « Questionnaire du jour » (audit 13/11, option a).
 * Avant : le critère comptait la NOTE DE SÉANCE (bilan de fin de séance) sous le libellé « Questionnaire bien-être »
 * → 0/15 + « fais ton questionnaire du jour » chez un athlète qui le remplissait tous les jours (John : 10 en 28 j). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
function ex(n) { const m = APP.match(new RegExp('function\\s+' + n + '\\s*\\(')); if (!m) throw new Error('fn introuvable : ' + n); let i = APP.indexOf('{', m.index), d = 0, j = i; for (; j < APP.length; j++) { const c = APP[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } } return APP.slice(m.index, j); }
const S = {}; vm.createContext(S);
vm.runInContext((APP.match(/var _EXO_CAT_R = \{[^}]*\};/) || [''])[0] + '\n' + ['_ymdLocal', '_dYmd', '_normTxt', '_musKey', '_maMuscuAgg', '_maRecent4wISO', '_exoCat', '_exoFourchette', '_maFiabilite'].map(ex).join('\n') + '\nthis.F = _maFiabilite;', S);
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };
const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const fr = (n) => iso(n).split('-').reverse().join('/');
const daily = {}; for (const n of [1, 4, 7, 10, 13, 16, 19, 22]) daily[iso(n)] = { series: 10, rpe_n: 10, spm: { Dos: 10 } };
const base = { historique: { daily_muscu: daily }, programme: [], analyses: {} };
const crit = (r) => r.rows.find((x) => /Questionnaire/.test(x.l));

// Cas John : questionnaire tous les jours d'entraînement, aucune note de séance.
let r = S.F(Object.assign({}, base, { bien_etre: [1, 4, 7, 10, 13, 16, 19, 22].map((n) => ({ date: fr(n), sommeil: 4 })) }));
eq(crit(r).g === 15 && /Questionnaire du jour \(8\/28 j\)/.test(crit(r).l), 'questionnaire rempli 8 jours / 8 séances → 15/15', crit(r));
eq(!r.tips.some((t) => /questionnaire/.test(t)), 'plus de conseil « fais ton questionnaire » quand il est rempli', r.tips);
// Notes de séance seules (bilan de fin de séance) : ne comptent plus comme questionnaire.
r = S.F(Object.assign({}, base, { bien_etre: [], analyses: { rpe_muscu: [{ date: iso(1), seance_id: 'S', valeur: 7 }] } }));
eq(crit(r).g === 0 && r.tips.some((t) => /fais ton questionnaire du jour \(\+15\)/.test(t)), 'note de séance seule → 0/15 et conseil questionnaire (désormais juste)', { c: crit(r), t: r.tips });
// Moitié des jours, date au format ISO, doublon le même jour, questionnaire trop ancien ignoré.
r = S.F(Object.assign({}, base, { bien_etre: [{ date: iso(1) }, { date: iso(1) }, { date: fr(4) }, { date: iso(7) }, { date: iso(10) }, { date: iso(40) }] }));
eq(crit(r).g === 8 && /\(4\/28 j\)/.test(crit(r).l), '4 jours distincts / 8 séances → 8/15 (doublon et > 28 j ignorés)', crit(r));
eq(r.pct === 25 * 0 + 25 + 20 + 8 + 0 || r.pct === r.rows.reduce((a, x) => a + x.g, 0), 'score = somme des critères', r.pct);
eq(!/_maEffortSeries/.test(ex('_maFiabilite')), 'le calcul ne lit plus les notes de séance');

console.log(`fiabilite-questionnaire : ${ok} OK / ${ko} KO`);
process.exit(ko ? 1 : 0);
