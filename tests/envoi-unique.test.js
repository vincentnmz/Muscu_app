/* =============================================================================
 * Audit saisie 01/11 — une séance renvoyée (file hors-ligne après coupure réseau)
 * avec le MÊME envoi_id n'est enregistrée qu'une fois. VRAI handleSaveSeance.
 * ========================================================================== */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const ROOT = path.join(__dirname, '..');
const T = fs.readFileSync(path.join(ROOT, 'tests', 'e2e-parcours.test.js'), 'utf8');
eval(T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend')));
const store = { performances: [], indicateurs: [] };
let js = stripTypeScriptTypes(fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'handler', 'index.ts'), 'utf8')).split('\n').filter(l => !/^import\s/.test(l)).join('\n');
js += '\n;this.__api = { handleSaveSeance };';
const S = { createClient: () => makeEngine(store), webpush: { setVapidDetails() {}, sendNotification: async () => {} }, Deno: { env: { get: () => undefined }, serve: () => {} },
  Response, Request, URLSearchParams, TextEncoder, TextDecoder, crypto, console, setTimeout, clearTimeout, fetch: async () => ({}) };
vm.createContext(S); vm.runInContext(js, S);
let ok = 0, ko = 0; const eq = (c, l, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + l + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };
const lignes = [['2026-11-01', 44, 'dos', 'Test', '7', 'Traction', 'Dos', '1', 1, 0, 8, 8, 120, 8], ['2026-11-01', 44, 'dos', 'Test', '7', 'Traction', 'Dos', '1', 2, 0, 8, 9, 120, 8]];
(async () => {
  let r = await (await S.__api.handleSaveSeance(lignes, null, 'env_abc')).json();
  eq(!r.erreur && store.performances.length === 2, '1er envoi : 2 séries enregistrées', store.performances.length);
  r = await (await S.__api.handleSaveSeance(lignes, null, 'env_abc')).json();
  eq(r.success && r.deja_recu === true && store.performances.length === 2, 'renvoi avec le même envoi_id : rien de plus en base', [r, store.performances.length]);
  r = await (await S.__api.handleSaveSeance(lignes, null, 'env_xyz')).json();
  eq(store.performances.length === 4, 'autre séance (autre envoi_id) : bien enregistrée', store.performances.length);
  r = await (await S.__api.handleSaveSeance(lignes)).json();
  eq(store.performances.length === 6, 'sans envoi_id (ancienne app) : comportement inchangé', store.performances.length);
  console.log('-'.repeat(70)); console.log(`envoi unique : ${ok} OK / ${ko} KO`); if (ko) process.exitCode = 1;
})();
