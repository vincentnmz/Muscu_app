/* Audit photos & mensurations (02/11/2026) — P2 fusion des mesures du jour, P4 bornes, P7 date photo. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const T = fs.readFileSync(path.join(__dirname, 'e2e-parcours.test.js'), 'utf8');
eval(T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend')));
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g).slice(0, 300) + ')' : '')); } };
const store = { indicateurs: [] }, client = makeEngine(store);
let js = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { handleSaveMensuration, handleSaveSuiviPhoto };';
const sb = { createClient: () => client, webpush: { setVapidDetails() {}, sendNotification: async () => {} }, Deno: { env: { get: () => undefined }, serve: () => {} },
  Response, Request, URLSearchParams, TextEncoder, TextDecoder, crypto, console: { log() {}, error() {}, warn() {} }, atob, btoa, setTimeout, clearTimeout, Intl, fetch: async () => ({ ok: false }) };
client.storage = { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: 'u' } }) }) };
vm.createContext(sb); vm.runInContext(js, sb);
const A = sb.__api, J = async (r) => (await r).json();
const du = (k) => store.indicateurs.filter(r => r.seance_id === 'mensuration' && r.cle === k);
(async () => {
  await J(A.handleSaveMensuration({ athlete_id: 'A1', date: '2026-11-02', mesures: { taille: 82, bras_g: 38 } }));
  await J(A.handleSaveMensuration({ athlete_id: 'A1', date: '2026-11-02', mesures: { mollet: 37 } }));
  eq(du('taille').length === 1 && du('bras_g').length === 1 && du('mollet').length === 1, 'P2 : ajouter le mollet n\'efface pas la taille ni le bras du jour');
  await J(A.handleSaveMensuration({ athlete_id: 'A1', date: '2026-11-02', mesures: { taille: 81.5 } }));
  eq(du('taille').length === 1 && du('taille')[0].valeur === '81.5', 'P2 : corriger la taille du jour la remplace');
  eq((await J(A.handleSaveMensuration({ athlete_id: 'A1', date: '2026-11-02', mesures: { bras_g: 500 } }))).success === false, 'P4 : 500 cm refusé');
  eq((await J(A.handleSaveMensuration({ athlete_id: 'A1', date: '2026-11-02', mesures: { masse_grasse: 90 } }))).success === false, 'P4 : 90 % de masse grasse refusé');
  eq(du('bras_g')[0].valeur === '38', 'P4 : une valeur refusée ne touche pas aux mesures existantes');
  const ph = await J(A.handleSaveSuiviPhoto({ athlete_id: 'A1', path: 'A1/x.jpg', angle: 'face', date: '2026-05-10' }));
  eq(ph.success && ph.date === '10/05/2026', 'P7 : ancienne photo datée du 10/05', ph);
  eq((await J(A.handleSaveSuiviPhoto({ athlete_id: 'A1', path: 'A1/y.jpg', angle: 'face', date: '2099-01-01' }))).success === false, 'P7 : date future refusée');
  console.log('-'.repeat(70)); console.log('mensurations : ' + ok + ' OK / ' + ko + ' KO'); if (ko) process.exitCode = 1;
})();
