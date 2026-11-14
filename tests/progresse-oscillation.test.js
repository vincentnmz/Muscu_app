/* L1 (audit 14/11) : « progresse » = la séance dépasse les précédentes (pas une oscillation) ; oscillation à la même charge =
 * plateau → « bloqué ». Même classement app (_lectureExos) et serveur (_rcLectureExos : mail récap, coach, IA). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const { webcrypto } = require('crypto');

let js = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
js = js.split('\n').filter((l) => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { _rcLectureExos, _bilanRecapV2, buildProgressionParExo, BLOQUE_N_NIVEAU };';
const S = { createClient: () => ({ from: () => ({}) }), webpush: { setVapidDetails() {}, sendNotification: async () => {} }, Deno: { env: { get: () => undefined }, serve: () => {} },
  Response, Request, URLSearchParams, TextEncoder, TextDecoder, console, atob, btoa, setTimeout, clearTimeout, crypto: webcrypto, fetch: async () => ({}) };
vm.createContext(S); vm.runInContext(js, S);
const A = S.__api;

const APP = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const LV3 = fs.readFileSync(path.join(__dirname, '..', 'js', 'lecture-v3.js'), 'utf8');
function extract(SRC, name) {
  const m = SRC.match(new RegExp('function\\s+' + name + '\\s*\\(')); if (!m) throw new Error('fn introuvable : ' + name);
  let i = SRC.indexOf('{', m.index), d = 0, j = i;
  for (; j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return SRC.slice(m.index, j);
}
const FF = ['parseChatDate', '_ctxAttendu', '_exoCat', '_exoFourchette', '_petitPas', '_cdAvgRpe', '_progSecondaire', '_lectureExos'];
const F = { exercicesData: [] }; vm.createContext(F);
vm.runInContext((APP.match(/var _EXO_CAT_R = \{[^}]*\};/) || [''])[0] + '\n' + LV3.match(/var LV3_BLOQUE_N = \{[^}]*\};/)[0] + '\n'
  + FF.map((n) => extract(APP, n)).join('\n') + '\nfunction _lv3Niveau(d) { return (d && d.niveau_experience) || "intermediaire"; }\nthis.lecture = _lectureExos; this.N = LV3_BLOQUE_N;', F);

let ok = 0, ko = 0;
const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };


const D = (n) => new Date(Date.UTC(2026, 10, 12) - n * 864e5).toISOString().slice(0, 10);
const nowT = Date.UTC(2026, 10, 13, 20);
const perfs = [];
const add = (exo, sessions) => sessions.forEach(([d, sets]) => sets.forEach(([c, r, rpe], i) => perfs.push({ date: D(d), exercice: exo, charge: c, reps: r, rpe, serie: i + 1 })));
// Oscillation à la même charge (cas John) : 9-10-9-9-10 reps → plateau, pas « progresse ».
add('Oscille', [[30, [[105, 9, 8]]], [23, [[105, 10, 8]]], [16, [[105, 9, 8]]], [9, [[105, 9, 8]]], [2, [[105, 10, 8]]]]);
// Baisse de charge puis +1 rep à la nouvelle charge → vrai progrès (comparé aux séances à 20 kg).
add('Baisse', [[19, [[25, 10, 8]]], [12, [[20, 10, 8]]], [5, [[20, 11, 8]]]]);
// Remontée de charge au niveau d'avant (60 → 55 → 60 × 8) → pas un progrès.
add('Remonte', [[23, [[60, 8, 8]]], [16, [[60, 8, 8]]], [9, [[55, 8, 8]]], [2, [[60, 8, 8]]]]);
// Vrai progrès : 8 → 8 → 9 reps à 100 kg.
add('Vrai', [[16, [[100, 8, 8]]], [9, [[100, 8, 8]]], [2, [[100, 9, 8]]]]);
const prog = A.buildProgressionParExo(perfs);
const lis = (L, k) => L[k].map((x) => x.exo).sort().join(',');
for (const niv of ['debutant', 'intermediaire', 'avance', 'expert']) {
  const B = A._rcLectureExos(prog, [], {}, nowT, null, niv);
  const Fr = F.lecture({ historique: { progression_par_exo: prog }, programme: [], exo_categories: {}, niveau_experience: niv }, nowT);
  for (const k of ['records', 'progresse', 'bloque', 'recule']) eq(lis(B, k) === lis(Fr, k), niv + ' : « ' + k + ' » serveur = app', { back: lis(B, k), front: lis(Fr, k) });
  eq(!/Oscille|Remonte/.test(lis(Fr, 'progresse')), niv + ' : oscillation / remontée ne sont pas « en progrès »', lis(Fr, 'progresse'));
  eq(/Baisse/.test(lis(Fr, 'progresse')) && /Vrai/.test(lis(Fr, 'progresse') + lis(Fr, 'records')), niv + ' : vrais progrès gardés (y compris après une baisse de charge ; « Vrai » est un record)', [lis(Fr, 'progresse'), lis(Fr, 'records')]);
}
const Fi = F.lecture({ historique: { progression_par_exo: prog }, programme: [], exo_categories: {}, niveau_experience: 'intermediaire' }, nowT);
const osc = Fi.bloque.filter((x) => x.exo === 'Oscille')[0];
eq(osc && osc.n === 4 && osc.c === 105 && osc.r === 10, 'oscillation intermédiaire : bloqué à 105 × 10 depuis 4 séances (depuis le 1er 10 reps)', osc);
eq(/var LV3_REGLE_VERSION = 'plan-2026-11-14'/.test(LV3), 'version de règle du plan changée (journal)');
console.log(`progresse-oscillation : ${ok} OK / ${ko} KO`);
process.exit(ko ? 1 : 0);
