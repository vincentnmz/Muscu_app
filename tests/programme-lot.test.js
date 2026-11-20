/* Création de séance (20/11) — saveProgrammeLignes : tous les exercices choisis en UN envoi, UNE insertion.
 * VRAI index.ts sur la base en mémoire de l'e2e. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const ROOT = path.join(__dirname, '..');
const T = fs.readFileSync(path.join(__dirname, 'e2e-parcours.test.js'), 'utf8');
eval(T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend')));
let ok = 0, ko = 0;
const eq = (c, n, got) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (got !== undefined ? ' (got ' + JSON.stringify(got) + ')' : '')); } };
function charger(store, client) {
  let js = stripTypeScriptTypes(fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
  js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { handleSaveProgrammeLignes };';
  const sb = { createClient: () => client || makeEngine(store), webpush: { setVapidDetails() {}, sendNotification: async () => {} },
    Deno: { env: { get: () => undefined }, serve: () => {} }, Response, Request, URLSearchParams, TextEncoder, TextDecoder, crypto, console, setTimeout, clearTimeout,
    fetch: async () => ({ ok: false, status: 0, json: async () => ({}) }) };
  vm.createContext(sb); vm.runInContext(js, sb); return sb.__api;
}
const J = async (p) => (await (await p).json());
(async () => {
  const S = { programme: [{ athlete_id: 'A1', seance_id: 'Push', exercice: 'Pompe', jour: 2 }] };
  const A = charger(S);
  let r = await J(A.handleSaveProgrammeLignes({ athlete_id: 'A1', athlete_nom: 'Test', seance_id: 'Pull', lignes: [
    { exercice: 'Traction', series_prevues: 3, reps_mini: 8, reps_max: 12, repos_sec: 120, type: 'muscu' },
    { exercice: 'Rowing barre', series_prevues: 3, reps_mini: 8, reps_max: 12, repos_sec: 120, type: 'muscu' },
    { exercice: 'Course', type: 'cardio', cardio_cible: 20, cardio_unite: 'min', series_prevues: 3 }] }));
  const P = S.programme.filter((l) => l.seance_id === 'Pull');
  eq(r.ok && r.n === 3 && P.length === 3, 'lot : 3 lignes enregistrées en une fois', r);
  eq(P[0].exercice === 'Traction' && P[0].series_prevues === 3 && P[0].reps_max === 12 && P[0].type === 'muscu' && P[0].athlete_nom === 'Test', 'lot : ligne muscu complète', P[0]);
  eq(P[2].type === 'cardio' && P[2].cardio_cible === 20 && P[2].series_prevues === null, 'lot : ligne cardio (champs muscu vides)', P[2]);
  r = await J(A.handleSaveProgrammeLignes({ athlete_id: 'A1', seance_id: 'Push', lignes: [{ exercice: 'Dips pectoraux', series_prevues: 3 }] }));
  eq(S.programme.find((l) => l.exercice === 'Dips pectoraux').jour === 2, 'lot : hérite du jour déjà posé sur la séance');
  const avant = S.programme.length;
  r = await J(A.handleSaveProgrammeLignes({ athlete_id: 'A1', seance_id: 'Legs', lignes: [{ exercice: 'Squat' }, { exercice: '' }] }));
  eq(!r.ok && S.programme.length === avant, 'lot : un exercice vide → rien enregistré (tout ou rien)', r);
  r = await J(A.handleSaveProgrammeLignes({ athlete_id: 'A1', seance_id: 'Legs', lignes: [] }));
  eq(!r.ok && S.programme.length === avant, 'lot : liste vide refusée');
  r = await J(A.handleSaveProgrammeLignes({ athlete_id: 'A1', seance_id: 'Legs', lignes: Array.from({ length: 41 }, (_, i) => ({ exercice: 'E' + i })) }));
  eq(!r.ok && /40/.test(r.erreur) && S.programme.length === avant, 'lot : plus de 40 exercices refusé', r);
  r = await J(A.handleSaveProgrammeLignes({ athlete_id: 'A1', lignes: [{ exercice: 'Squat' }] }));
  eq(!r.ok, 'lot : séance manquante refusée');
  // Erreur base → message, rien de partiel (une seule insertion).
  const E = makeEngine({ programme: [] }), from0 = E.from.bind(E);
  const err = { from: (t) => { const q = from0(t); if (t === 'programme') q.insert = () => ({ then: (res) => res({ data: null, error: { message: 'base indisponible' } }) }); return q; } };
  r = await J(charger(null, err).handleSaveProgrammeLignes({ athlete_id: 'A1', seance_id: 'Legs', lignes: [{ exercice: 'Squat' }] }));
  eq(!r.ok && /indisponible/.test(r.erreur), 'lot : erreur de la base renvoyée (l\'app garde la sélection)', r);
  console.log('-'.repeat(70));
  console.log('programme lot : ' + ok + ' OK / ' + ko + ' KO');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
