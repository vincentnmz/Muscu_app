/* Audit hors-ligne (02/11/2026) — H2 : séance saisie sans catalogue → muscle complété par le serveur ;
 * renvoi de la file (même identifiant d'envoi) → pas de doublon. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const T = fs.readFileSync(path.join(__dirname, 'e2e-parcours.test.js'), 'utf8');
eval(T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend')));
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g).slice(0, 300) + ')' : '')); } };
const store = { performances: [], indicateurs: [], exercices: [{ exercice_id: 7, exercice: 'Ecarté machine', muscle: 'Pectoraux' }], athletes: [{ id: '1', nom: 'V' }] };
const client = makeEngine(store);
let js = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { handleSaveSeance };';
const sb = { createClient: () => client, webpush: { setVapidDetails() {}, sendNotification: async () => {} }, Deno: { env: { get: () => undefined }, serve: () => {} },
  Response, Request, URLSearchParams, TextEncoder, TextDecoder, crypto, console: { log() {}, error() {}, warn() {} }, atob, btoa, setTimeout, clearTimeout, Intl, fetch: async () => ({ ok: false }) };
vm.createContext(sb); vm.runInContext(js, sb);
const A = sb.__api, J = async (r) => (await r).json();
(async () => {
  // Ligne telle que l'app la construit sans catalogue : muscle vide, exercice_id = nom.
  const lignes = [['02/11/2026', 45, 'pec epaule', 'V', '1', 'Ecarté machine', '', 'Ecarté machine', 1, 30, 9, 9, 120, 270]];
  await J(A.handleSaveSeance(lignes, null, 'envoi-1'));
  const p = store.performances[0] || {};
  eq(p.muscle === 'Pectoraux' && p.exercice_id === '7', 'H2 : muscle et identifiant complétés depuis le catalogue', p);
  const r2 = await J(A.handleSaveSeance(lignes, null, 'envoi-1'));
  eq(r2.deja_recu === true && store.performances.length === 1, 'File renvoyée avec le même identifiant → pas de doublon');
  console.log('-'.repeat(70)); console.log('hors-ligne : ' + ok + ' OK / ' + ko + ' KO'); if (ko) process.exitCode = 1;
})();
