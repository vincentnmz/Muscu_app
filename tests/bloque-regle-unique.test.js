/* « BLOQUÉ » — UNE SEULE RÈGLE (audit moteur 13/11, P0-1).
 * Avant : l'app (js/app.js _lectureExos + js/lecture-v3.js LV3_BLOQUE_N) disait « bloqué » après 2 / 3 / 4 séances
 * identiques selon le niveau ; la copie serveur (index.ts _rcLectureExos, utilisée par le MAIL RÉCAP et le CONTEXTE IA)
 * après 3, quel que soit le niveau. Ici : même table des deux côtés, et même classement sur les mêmes historiques. */
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

eq(JSON.stringify(F.N) === JSON.stringify(A.BLOQUE_N_NIVEAU), 'même table « séances identiques avant bloqué » app = serveur', [F.N, A.BLOQUE_N_NIVEAU]);

const D = (n) => new Date(Date.UTC(2026, 10, 12) - n * 864e5).toISOString().slice(0, 10);
const nowT = Date.UTC(2026, 10, 13, 20);
const perfs = [];
const add = (exo, sessions) => sessions.forEach(([d, sets]) => sets.forEach(([c, r, rpe], i) => perfs.push({ date: D(d), exercice: exo, charge: c, reps: r, rpe, serie: i + 1 })));
add('Deux', [[30, [[50, 10, 8]]], [9, [[60, 8, 8]]], [2, [[60, 8, 8]]]]);                                     // 2 identiques (après une montée)
add('Trois', [[23, [[50, 10, 8]]], [16, [[70, 8, 8]]], [9, [[70, 8, 8]]], [2, [[70, 8, 8]]]]);                  // 3 identiques
add('Quatre', [[30, [[40, 12, 8]]], [23, [[80, 6, 8]]], [16, [[80, 6, 8]]], [9, [[80, 6, 8]]], [2, [[80, 6, 8]]]]); // 4 identiques
add('Second', [[23, [[30, 10, 9]]], [16, [[30, 10, 9]]], [9, [[30, 10, 9], [30, 10, 9]]], [2, [[30, 10, 9], [30, 10, 9]]]]); // plus de séries au top (S-3→S-2) : progrès secondaire → pas bloqué en intermédiaire+ ; débutant : 2 dernières identiques → bloqué
const prog = A.buildProgressionParExo(perfs);
const ATT = { debutant: 'Deux,Quatre,Second,Trois', intermediaire: 'Quatre,Trois', avance: 'Quatre', expert: 'Quatre' };
for (const niv of ['debutant', 'intermediaire', 'avance', 'expert']) {
  const back = A._rcLectureExos(prog, [], {}, nowT, null, niv).bloque.map((x) => x.exo).sort().join(',');
  const front = F.lecture({ historique: { progression_par_exo: prog }, programme: [], exo_categories: {}, niveau_experience: niv }, nowT).bloque.map((x) => x.exo).sort().join(',');
  eq(back === front, niv + ' : « bloqué » serveur (mail, IA) = app', { back, front });
  eq(front === ATT[niv], niv + ' : liste attendue « ' + ATT[niv] + ' »', front);
}
eq(A._rcLectureExos(prog, [], {}, nowT).bloque.map((x) => x.exo).sort().join(',') === 'Quatre,Trois', 'niveau inconnu → 3 séances (comme l\'app)');
// Mail récap : le niveau de l'athlète (getAppData.niveau_experience) est bien transmis.
const appData = { historique: { progression_par_exo: prog }, programme: [], exo_categories: {}, niveau_experience: 'debutant', bien_etre: [], cardio: { history: [] } };
const b = A._bilanRecapV2({ perfs, appData, secByExo: {}, musByExo: {} }, 'semaine', new Date('2026-11-16T06:00:00Z'));
eq(b.lecture && b.lecture.bloque.map((x) => x.exo).sort().join(',') === 'Deux,Quatre,Second,Trois', 'mail récap d\'un débutant : même « bloqué » que son app', b.lecture && b.lecture.bloque);
eq(/_rcLectureExos\([^\n]*d\.niveau_experience\)/.test(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8')), 'contexte IA : niveau transmis');

console.log(`bloque-regle-unique : ${ok} OK / ${ko} KO`);
process.exit(ko ? 1 : 0);
