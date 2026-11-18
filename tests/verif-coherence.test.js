/* Vérificateur de cohérence (18/11/2026) — « le calcul doit être fiable à 100 % ».
 * 1. Sur une base fictive, le VRAI handleGetAppData (index.ts) sort des chiffres identiques au recalcul indépendant.
 * 2. Le vérificateur ATTRAPE chaque type d'erreur trouvé lors des audits du 18/11 (sinon il ne prouverait rien) :
 *    record daté de la répétition, séries par muscle sur la mauvaise fenêtre, séances, tonnage, meilleure série,
 *    force estimée tuile ≠ tableau, point décimal, records affichés, compte de séances différent entre écrans. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const ROOT = path.join(__dirname, '..');
const T = fs.readFileSync(path.join(__dirname, 'e2e-parcours.test.js'), 'utf8');
eval(T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend')));
const { verifier } = require('../scripts/verif-coherence/verif.cjs');

let ok = 0, ko = 0;
const eq = (c, n, got) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (got !== undefined ? ' (got ' + JSON.stringify(got) + ')' : '')); } };
const ymd = (d) => d.toISOString().slice(0, 10);
const J = (n) => { const d = new Date(); d.setUTCHours(12, 0, 0, 0); d.setUTCDate(d.getUTCDate() - n); return ymd(d); };
const TODAY = J(0);

function charger(store) {
  let js = stripTypeScriptTypes(fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
  js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n');
  js += '\n;this.__api = { handleGetAppData };';
  const sandbox = { createClient: () => makeEngine(store), webpush: { setVapidDetails() {}, sendNotification: async () => {} },
    Deno: { env: { get: () => undefined }, serve: () => {} }, Response, Request, URLSearchParams, TextEncoder, TextDecoder, crypto, console, setTimeout, clearTimeout,
    fetch: async () => ({ ok: false, status: 0, text: async () => '', json: async () => ({}) }) };
  vm.createContext(sandbox); vm.runInContext(js, sandbox); return sandbox.__api;
}
// Base fictive : 3 séances sur 10 jours, un record égalé plus tard, un muscle secondaire, semaine glissante.
let id = 1;
const S = (d, exo, mus, c, r, rpe) => ({ id: id++, date: d, semaine: 46, seance_id: 'S', exercice: exo, muscle: mus, exercice_id: exo, serie: 1, charge: c, reps: r, rpe, repos: 90, athlete_id: '5', nom: 'A', volume: c * r });
const store = {
  athletes: [{ id: '5', login: '5555', nom: 'A', sport: 'muscu', annees: 2, prefs: { semaine_type: 'glissant' } }],
  exercices: [{ exercice_id: 'Presse', exercice: 'Presse', muscle: 'Quadriceps', muscle_secondaire: 'Fessier' }, { exercice_id: 'Curl', exercice: 'Curl', muscle: 'Biceps', muscle_secondaire: null }],
  performances: [S(J(9), 'Presse', 'Quadriceps', 100, 10, 8), S(J(9), 'Presse', 'Quadriceps', 100, 8, 9), S(J(5), 'Presse', 'Quadriceps', 100, 10, 9), S(J(5), 'Curl', 'Biceps', 12.5, 10, 9), S(J(1), 'Curl', 'Biceps', 12.5, 12, 10), S(J(1), 'Presse', 'Quadriceps', 90, 12, 8)],
  volume_obti: [{ id: 1, muscle: 'Quadriceps', series_min_semaine: 9, series_opt_semaine: 12 }, { id: 2, muscle: 'Fessier', series_min_semaine: 9, series_opt_semaine: 12 }, { id: 3, muscle: 'Biceps', series_min_semaine: 6, series_opt_semaine: 12 }],
  indicateurs: [], bien_etre: [], programme: [], planning: [], contexte_athlete: [], decisions: [], pauses: [], poids_historique: [], objectif: [], blessures: [],
};

(async () => {
  const ad = await (await charger(store).handleGetAppData(new URLSearchParams({ athlete_id: '5', _sess_role: 'a' }))).json();
  let r = verifier({ store, appdata: ad, now: TODAY });
  eq(r.length === 0, 'vrai backend : 0 écart avec le recalcul indépendant', r);
  eq(ad.global.records_par_exo.Presse.date.slice(0, 5) === J(9).slice(8, 10) + '/' + J(9).slice(5, 7), 'record Presse 100 × 10 daté de la 1re fois (J-9), pas de la répétition (J-5)', ad.global.records_par_exo.Presse);

  const mut = (f) => { const x = JSON.parse(JSON.stringify(ad)); f(x); return verifier({ store, appdata: x, now: TODAY }).map((e) => e.code); };
  eq(mut((x) => { x.global.records_par_exo.Presse.date = J(5).split('-').reverse().join('/'); }).includes('records.date'), 'attrape : record daté de la répétition');
  eq(mut((x) => { x.volume_obti.find((v) => v.muscle === 'Fessier').series_semaine = 0; }).includes('volume.muscle'), 'attrape : séries par muscle sur la mauvaise fenêtre (secondaire oublié)');
  eq(mut((x) => { x.dashboard.regularite.seances_j7 = 1; }).includes('seances.j7'), 'attrape : séances 7 jours fausses');
  eq(mut((x) => { x.dashboard.tonnage.j7 = (x.dashboard.tonnage.j7 || 0) + 1; }).includes('tonnage.j7'), 'attrape : tonnage 7 jours faux');
  eq(mut((x) => { const p = x.historique.progression_par_exo.Presse[0]; p.reps = p.reps + 1; }).includes('progression.meilleure'), 'attrape : meilleure série du jour fausse');
  eq(mut((x) => { x.global.total_series = 99; }).includes('global.series'), 'attrape : total de séries faux');

  const txt = (t) => verifier({ store, appdata: ad, ecrans: t, now: TODAY }).map((e) => e.code);
  eq(txt('######## ÉVOLUTION ▸ Curl\n12 kg\nFORCE ESTIMÉE\nx\nFORCE EST.\n18/11/2026\n12,5×12\n11 kg').includes('force.tuile_tableau'), 'attrape : force estimée 12 kg en haut, 11 kg dans le tableau');
  eq(txt('######## ÉVOLUTION ▸ Curl\nRECORD CHARGE\n12.5 kg').includes('format.decimal'), 'attrape : « 12.5 kg » (point décimal)');
  eq(txt('######## ANALYSES\nRECORDS PERSONNELS\nPresse\n100 kg\n' + J(5).split('-').reverse().join('/')).includes('records.ecran'), 'attrape : record affiché à la mauvaise date');
  eq(txt('######## AUJOURD\'HUI\nObjectif semaine 1/3\n2 / 3 séances cette semaine').includes('objectif.libelle'), 'attrape : « Objectif semaine » calendaire à côté d\'une semaine glissante');
  eq(txt('######## AUJOURD\'HUI\n1 / 3 séances cette semaine\n######## ENTRAINEMENT\n67% 2/3 cette semaine').includes('seances.ecrans'), 'attrape : deux comptes de séances « cette semaine »');
  eq(txt('######## AUJOURD\'HUI\n' + ad.dashboard.regularite.seances_j7 + ' / 3 séances cette semaine\n######## ENTRAINEMENT\n67% ' + ad.dashboard.regularite.seances_j7 + '/3 cette semaine').length === 0, 'témoin : écrans cohérents → aucun écart');

  console.log('-'.repeat(70));
  console.log('vérificateur de cohérence : ' + ok + ' OK / ' + ko + ' KO');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
