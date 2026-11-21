/* =============================================================================
 * Boutique des points (21/11) — VRAI handleClaimRecompense sur une base en mémoire.
 *  1. Solde insuffisant → refusé, rien d'écrit.
 *  2. Deux achats SIMULTANÉS avec le solde d'un seul → un seul passe, le solde ne devient jamais négatif
 *     (avant : les deux lisaient le même solde et passaient).
 *  3. Achat normal → solde diminué du coût exact.
 * ========================================================================== */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const ROOT = path.join(__dirname, '..');
const T = fs.readFileSync(path.join(ROOT, 'tests', 'e2e-parcours.test.js'), 'utf8');
eval(T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend')));
let id = 1;
const jour = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
// 12 séances sur 12 jours, RPE partout → 12 × (10 + 5) = 180 points (pas de programme, pas de questionnaire, pas d'objectif).
const perfs = []; for (let k = 1; k <= 12; k++) perfs.push({ id: id++, athlete_id: 'B1', date: jour(k * 3), seance_id: 'S', exercice: 'Curl', muscle: 'Biceps', serie: 1, charge: 10, reps: 10, rpe: 8, repos: 60 });
const store = { athletes: [{ id: 'B1', login: '5151', nom: 'B', sport: 'muscu', annees: 1 }], performances: perfs, indicateurs: [], bien_etre: [], programme: [], exercices: [], planning: [], objectif: [], volume_obti: [], decisions: [], pauses: [], poids_historique: [], blessures: [], contexte_athlete: [], activites: [] };
const client = makeEngine(store);
let js = stripTypeScriptTypes(fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { handleClaimRecompense, handleGetAppData };';
const sb = { createClient: () => client, webpush: { setVapidDetails() {}, sendNotification: async () => {} }, Deno: { env: { get: () => 'x' }, serve: () => {} },
  Response, Request, URL, URLSearchParams, TextEncoder, TextDecoder, crypto, console: { log() {}, warn() {}, error() {}, info() {} }, setTimeout, clearTimeout, fetch: async () => ({ ok: false, json: async () => ({}) }) };
vm.createContext(sb); vm.runInContext(js, sb);
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };
const solde = async () => Number((await (await sb.__api.handleGetAppData(new URLSearchParams({ athlete_id: 'B1' }))).json()).recompenses.solde);
const claims = () => store.indicateurs.filter((r) => r.seance_id === 'recompense').length;
(async () => {
  const s0 = await solde();
  eq(s0 === 180, 'solde de départ = 180 points (12 séances × 15)', s0);
  // 2. Deux achats simultanés à 150 pts avec 180 de solde.
  const [a, b] = await Promise.all([sb.__api.handleClaimRecompense({ athlete_id: 'B1', reward_id: 'ia_plus5' }), sb.__api.handleClaimRecompense({ athlete_id: 'B1', reward_id: 'ia_plus5' })]);
  const ra = await a.json(), rb = await b.json(), s1 = await solde();
  eq([ra.success, rb.success].filter(Boolean).length <= 1, 'deux achats simultanés : au plus un passe', [ra, rb]);
  eq(s1 >= 0, 'deux achats simultanés : le solde ne devient jamais négatif', s1);
  eq(s1 === 180 - 150 * claims(), 'solde = gagnés − coût des achats réellement enregistrés', { s1, claims: claims() });
  // 1. Solde insuffisant ensuite (30 pts ou 180 si aucun n'est passé).
  if (s1 < 150) { const r = await (await sb.__api.handleClaimRecompense({ athlete_id: 'B1', reward_id: 'ia_plus5' })).json(); eq(r.success === false && /insuffisant/i.test(r.error), 'solde insuffisant → refusé', r); }
  // 3. Achat normal (repart d'une base propre si les deux simultanés ont été annulés).
  if (claims() === 0) { const r = await (await sb.__api.handleClaimRecompense({ athlete_id: 'B1', reward_id: 'ia_plus5' })).json(); eq(r.success && r.solde === 30 && (await solde()) === 30, 'achat normal : solde 180 → 30', r); }
  else eq((await solde()) === 30, 'achat passé : solde 180 → 30');
  console.log('-'.repeat(70));
  console.log('boutique (solde) : ' + ok + ' OK / ' + ko + ' KO');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
