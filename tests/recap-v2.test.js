/* =============================================================================
 * Mail récap v2 (01/11/2026, maquette mockups/novalyz-mail-recap-v2.html validée).
 * VRAIES fonctions d'index.ts : _recapBornes, _rcLectureExos (port de la lecture de
 * l'app), _bilanRecapV2, _emailRecapV2HTML.
 *  - vraie période écoulée (mois civil / semaine lun→dim / trimestre) ;
 *  - la lecture des exercices du serveur = celle de l'app (js/app.js) sur les mêmes données ;
 *  - vrais records, volume avec secondaires à 0,5, nuits < 3 h ignorées, normale ≥ 14 nuits ;
 *  - rien ne bloque sans montre / bien-être / cardio / séance (aucun NaN / undefined).
 * ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const { webcrypto } = require('crypto');

let js = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n');
js += '\n;this.__api = { _recapBornes, _rcLectureExos, _bilanRecapV2, _emailRecapV2HTML, buildProgressionParExo, fmtYMD };';
const S = { createClient: () => ({ from: () => ({}) }), webpush: { setVapidDetails() {}, sendNotification: async () => {} }, Deno: { env: { get: () => undefined }, serve: () => {} },
  Response, Request, URLSearchParams, TextEncoder, TextDecoder, console, atob, btoa, setTimeout, clearTimeout, crypto: webcrypto, fetch: async () => ({}) };
vm.createContext(S); vm.runInContext(js, S);
const A = S.__api;

// Lecture de l'app (front) pour la comparaison.
const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
function extractFrom(name) {
  const m = SRC.match(new RegExp('function\\s+' + name + '\\s*\\('));
  let i = SRC.indexOf('{', m.index), d = 0, j = i;
  for (; j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return SRC.slice(m.index, j);
}
const FF = ['parseChatDate', '_ctxAttendu', '_exoCat', '_exoFourchette', '_petitPas', '_cdAvgRpe', '_progSecondaire', '_lectureExos'];
const F = { exercicesData: [] }; vm.createContext(F);
vm.runInContext((SRC.match(/var _EXO_CAT_R = \{[^}]*\};/) || [''])[0] + '\n' + FF.map(extractFrom).join('\n') + '\n' + FF.map(n => `this.${n}=${n};`).join(''), F);

let ok = 0, ko = 0;
function eq(c, l, g) { if (c) ok++; else { ko++; console.error('  ✗ ' + l + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } }
const ymd = (d) => A.fmtYMD(d);

// 1) Bornes
{ let b = A._recapBornes('mois', new Date('2026-11-01T06:00:00Z'));
  eq(ymd(b.debut) === '2026-10-01' && ymd(b.fin) === '2026-11-01' && b.label === 'octobre' && /du 1er au 31 octobre/.test(b.sousTitre), 'mois envoyé le 01/11 = octobre complet', [ymd(b.debut), ymd(b.fin), b.sousTitre]);
  b = A._recapBornes('semaine', new Date('2026-11-02T06:00:00Z'));
  eq(ymd(b.debut) === '2026-10-26' && ymd(b.fin) === '2026-11-02', 'semaine envoyée le lundi 02/11 = 26/10 → 01/11', [ymd(b.debut), ymd(b.fin)]);
  b = A._recapBornes('3mois', new Date('2026-10-01T06:00:00Z'));
  eq(ymd(b.debut) === '2026-07-01' && ymd(b.fin) === '2026-10-01', 'trimestre envoyé le 01/10 = juillet → septembre', [ymd(b.debut), ymd(b.fin)]); }

// 2) Lecture serveur = lecture de l'app (mêmes points, mêmes règles).
{ const D = (n) => new Date(Date.UTC(2026, 9, 30) - n * 864e5).toISOString().slice(0, 10);
  const perfs = [];
  const add = (exo, d, sets) => sets.forEach(([c, r, rpe], i) => perfs.push({ date: D(d), exercice: exo, charge: c, reps: r, rpe, serie: i + 1 }));
  add('Dev', 20, [[80, 3, 10]]); add('Dev', 13, [[80, 2, 10]]); add('Dev', 6, [[80, 1, 10], [70, 5, 10]]);           // sous la fourchette
  add('Tir', 14, [[70, 8, 8]]); add('Tir', 2, [[75, 8, 8]]);                                                        // record
  add('Curl', 19, [[25, 10, 8]]); add('Curl', 12, [[20, 10, 8]]); add('Curl', 5, [[20, 11, 8]]);                    // progresse (reps, sous le record de 25 kg)
  add('Squat', 20, [[100, 8, 8]]); add('Squat', 13, [[100, 8, 8]]); add('Squat', 6, [[100, 8, 8]]);               // bloqué
  add('Rowing', 12, [[60, 10, 8]]); add('Rowing', 4, [[55, 8, 8]]);                                                  // recule
  const prog = A.buildProgressionParExo(perfs);
  const lignes = [{ exercice: 'Dev', reps_mini: 8, reps_max: 12 }];
  const cats = { Dev: 'moyen' };
  const nowT = Date.UTC(2026, 9, 31, 20);
  const back = A._rcLectureExos(prog, lignes, cats, nowT);
  const front = F._lectureExos({ historique: { progression_par_exo: prog }, programme: lignes, exo_categories: cats }, nowT);
  const sig = (L) => ['records', 'progresse', 'recule', 'bloque', 'sous'].map(k => k + ':' + L[k].map(x => x.exo).sort().join(',')).join(' | ');
  eq(sig(back) === sig(front), 'lecture serveur identique à celle de l\'app', [sig(back), sig(front)]);
  // Déload (audit Contexte X1) : « recule » / « bloqué » deviennent « attendus », côté serveur ET app.
  const backD = A._rcLectureExos(prog, lignes, cats, nowT, 'deload');
  const frontD = F._lectureExos({ historique: { progression_par_exo: prog }, programme: lignes, exo_categories: cats, contexte: { etat: 'deload' } }, nowT);
  eq(backD.recule.length === 0 && backD.bloque.length === 0 && backD.attendu.length === 2 && frontD.attendu.length === 2 && frontD.recule.length === 0, 'déload : recul et blocage = baisse attendue (serveur = app)', [backD.attendu, frontD.attendu]);
  eq(back.sous.length === 1 && back.records.length === 1 && back.progresse.length === 1 && back.bloque.length === 1 && back.recule.length === 1, '5 catégories couvertes', sig(back)); }

// 3) Bilan complet sur un mois synthétique.
const now = new Date('2026-11-01T06:00:00Z');
const perfs = [
  { date: '2026-09-10', exercice: 'Dev', muscle: 'Pectoraux', charge: 70, reps: 8, rpe: 8, serie: 1 },
  { date: '2026-10-05', exercice: 'Dev', muscle: 'Pectoraux', charge: 75, reps: 6, rpe: 9, serie: 1 },   // record (charge)
  { date: '2026-10-12', exercice: 'Dev', muscle: 'Pectoraux', charge: 75, reps: 6, rpe: 9, serie: 1 },   // pas un record (égal)
  { date: '2026-10-12', exercice: 'Squat', muscle: 'Quadriceps', charge: 100, reps: 8, rpe: 8, serie: 1 }, // 1re fois → pas un record
];
const appData = { dashboard: { regularite: { seances_prevues: 4 } }, programme: [{ exercice: 'Dev' }, { exercice: 'Squat' }],
  volume_obti: [{ muscle: 'Pectoraux', series_min: 8, series_opt: 14 }, { muscle: 'Quadriceps', series_min: 8, series_opt: 14 }, { muscle: 'Fessier', series_min: 8, series_opt: 14 }, { muscle: 'Mollets', series_min: 8, series_opt: 14 }],
  historique: { progression_par_exo: {} }, exo_categories: {},
  sante_historique: [{ date: '2026-10-10', sommeil_min: 120 }, { date: '2026-10-11', sommeil_min: 480 }, { date: '2026-09-01', sommeil_min: 400 }],
  bien_etre: [], cardio: { history: [] } };
const ctx = { perfs, appData, secByExo: { squat: 'Fessier' }, musByExo: { dev: 'Pectoraux', squat: 'Quadriceps' } };
const b = A._bilanRecapV2(ctx, 'mois', now);
eq(b.seances === 2 && b.prevues === 18, '2 jours de séance / 18 prévues (4 × 31/7)', [b.seances, b.prevues]);
eq(b.records.length === 1 && b.records[0].exo === 'Dev' && b.records[0].c === 75, 'seul vrai record : Dev 75 kg (le 1er Squat et l\'égalité ne comptent pas)', b.records);
const vF = b.volume.find(v => v.muscle === 'Fessier');
eq(vF && Math.abs(vF.parSem - Math.round(0.5 / (31 / 7) * 10) / 10) < 1e-9, 'fessier = muscle secondaire du squat compté 0,5', vF);
eq(b.horsProg.indexOf('Mollets') >= 0, 'mollets (0 série, hors programme) listés à part', b.horsProg);
eq(b.montre.sommeil && b.montre.sommeil.v === 480 && b.montre.sommeil.n === 1, 'nuit de 2 h ignorée (enregistrement incomplet)', b.montre.sommeil);
eq(b.montre.sommeil.normale === null, 'normale de sommeil absente sous 14 nuits complètes', b.montre.sommeil);
eq(b.forme.length === 0 && !b.cardio.n, 'sans bien-être ni cardio : blocs vides', [b.forme, b.cardio]);
const html = A._emailRecapV2HTML('Test', b);
eq(!/undefined|NaN/.test(html) && /Ton bilan d'octobre/.test(html), 'mail sans NaN / undefined, titre « octobre »');

// 4) Athlète sans montre, sans bien-être, sans cardio, sans AUCUNE séance → pas d'erreur.
{ const b0 = A._bilanRecapV2({ perfs: [], appData: {}, secByExo: {}, musByExo: {} }, 'mois', now);
  const h0 = A._emailRecapV2HTML('Test', b0);
  eq(b0.seances === 0 && Object.keys(b0.montre).length === 0 && b0.recos.length === 0, 'compte vide : aucun bloc, aucune reco inventée', b0);
  eq(!/undefined|NaN/.test(h0) && /Pas encore de séance/.test(h0), 'compte vide : mail lisible', h0.slice(0, 80)); }

console.log('-'.repeat(70));
console.log(`mail récap v2 : ${ok} OK / ${ko} KO`);
if (ko) process.exitCode = 1;
