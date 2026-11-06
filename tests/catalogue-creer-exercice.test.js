/* Catalogue 06/11 : un coach crée un exercice (liste fermée de muscles, doublon refusé, athlète refusé). */
const fs = require('fs'), path = require('path'), vm = require('vm'); const { stripTypeScriptTypes } = require('node:module');
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g).slice(0, 300) + ')' : '')); } };
const T = fs.readFileSync(path.join(__dirname, 'e2e-parcours.test.js'), 'utf8');
eval(T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend')));
const store = { exercices: [{ exercice_id: '91', exercice: 'Curl barre', muscle: 'Biceps' }, { exercice_id: '92', exercice: 'Élévation latérale haltère', muscle: 'Epaule' }] };
let js = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8')).split('\n').filter((l) => !/^import\s/.test(l)).join('\n');
js += '\n;this.__api={handleCreerExercice,handleGetExercices,normMuscle};';
const client = makeEngine(store);
const sb = { createClient: () => client, webpush: { setVapidDetails() {}, sendNotification: async () => {} }, Deno: { env: { get: () => 'x' }, serve: () => {} }, Response, Request, URLSearchParams, TextEncoder, TextDecoder, crypto, console, setTimeout, clearTimeout, fetch: async () => ({ ok: false }) };
vm.createContext(sb); vm.runInContext(js, sb);
(async () => {
  const A = sb.__api, j = async (r) => (await r).json();
  let r = await j(A.handleCreerExercice({ _sessRole: 'a', exercice: 'X', muscle: 'Biceps' }));
  eq(r.erreur && !r.ok, 'athlète refusé', r);
  r = await j(A.handleCreerExercice({ _sessRole: 'c', _sessId: '7', exercice: '  Curl   araignée ', muscle: 'Biceps', muscle_secondaire: 'Avant-bras', materiel: 'Haltères' }));
  eq(r.ok && r.exercice.exercice === 'Curl araignée' && r.exercice.exercice_id === '93' && r.exercice.muscle_secondaire === 'Avant-bras' && r.exercice.cree_par === 'coach:7' && r.exercice.increment_kg === '2', 'coach : créé (nom nettoyé, id suivant, secondaire, auteur)', r);
  r = await j(A.handleCreerExercice({ _sessRole: 'c', exercice: 'elevation laterale haltere', muscle: 'Epaule' }));
  eq(r.erreur === 'Cet exercice existe déjà', 'doublon (accents / casse) refusé', r);
  r = await j(A.handleCreerExercice({ _sessRole: 'c', exercice: 'Truc', muscle: 'Cou' }));
  eq(r.erreur === 'Muscle inconnu', 'muscle hors liste refusé', r);
  r = await j(A.handleCreerExercice({ _sessRole: 'c', exercice: 'Truc', muscle: 'Biceps', muscle_secondaire: 'Biceps' }));
  eq(!!r.erreur, 'secondaire = principal refusé', r);
  eq(A.normMuscle('avant bras') === 'Avant-bras' && A.normMuscle('Lombaires') === 'Lombaires' && A.normMuscle('Épaules') === 'Epaule' && A.normMuscle('Trapèzes') === 'Trapèze', 'alias des nouveaux muscles');
  const g = await j(A.handleGetExercices());
  eq(g.exercices.some((e) => e.exercice === 'Curl araignée' && e.materiel === 'Haltères' && e.disciplines === 'muscu' && e.mesure === 'charge_reps'), 'catalogue renvoie matériel / disciplines / mesure', g.exercices.slice(-1));
  console.log('-'.repeat(70)); console.log('catalogue créer exercice : ' + ok + ' OK / ' + ko + ' KO'); if (ko) process.exitCode = 1;
})();
