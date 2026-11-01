/* =============================================================================
 * Lecture COMPLÈTE (audit 01/11/2026) : Supabase plafonne une requête à 1 000 lignes
 * par défaut, sans erreur. Base en mémoire avec plafond simulé (store.__maxRows) et un
 * athlète à 2 500 séries (cas réel : 2 808) → le VRAI handleGetAppData doit tout lire.
 * ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const T = fs.readFileSync(path.join(__dirname, 'e2e-parcours.test.js'), 'utf8');
eval(T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend')));

let ok = 0, ko = 0;
const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };

const perfs = [];
const d0 = Date.UTC(2025, 0, 6);
for (let i = 0; i < 2500; i++) {
  const day = Math.floor(i / 10) * 2;   // 250 jours de séance, 10 séries chacun
  perfs.push({ id: i + 1, athlete_id: '1', date: new Date(d0 + day * 864e5).toISOString().slice(0, 10), seance_id: 'S', nom: 'T', exercice: 'Squat', muscle: 'Quadriceps', serie: (i % 10) + 1, charge: 100 + day / 10, reps: 8, rpe: 8 });
}
const store = { __maxRows: 1000, athletes: [{ id: '1', login: '1234', nom: 'Test', annees: 4, created_at: '2025-01-01' }], performances: perfs, indicateurs: [], bien_etre: [], programme: [], exercices: [] };
const client = makeEngine(store);
client.storage = { from: () => ({ createSignedUrls: async () => ({ data: [] }) }) };
let js = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { handleGetAppData, _toutLire };';
const sb = { createClient: () => client, webpush: { setVapidDetails() {}, sendNotification: async () => {} }, Deno: { env: { get: () => 'x' }, serve: () => {} },
  Response, Request, URLSearchParams, TextEncoder, TextDecoder, crypto, console, setTimeout, clearTimeout, fetch: async () => ({ ok: false, json: async () => ({}) }) };
vm.createContext(sb); vm.runInContext(js, sb);

(async () => {
  // Le plafond simulé coupe bien une lecture simple (sinon le test ne prouverait rien).
  const brut = await client.from('performances').select('*').eq('athlete_id', '1');
  eq(brut.data.length === 1000, 'plafond simulé : une requête simple ne rend que 1 000 lignes', brut.data.length);
  const tout = await sb.__api._toutLire(() => client.from('performances').select('*').eq('athlete_id', '1').order('date', { ascending: false }).order('id'));
  eq(tout.data.length === 2500 && new Set(tout.data.map(r => r.id)).size === 2500, '_toutLire : les 2 500 lignes, sans doublon', tout.data.length);
  const d = await (await sb.__api.handleGetAppData(new URLSearchParams({ athlete_id: '1' }))).json();
  eq(d.global && d.global.total_seances === 250, 'getAppData : les 250 séances comptées (pas 100)', d.global && d.global.total_seances);
  const dm = d.historique && d.historique.daily_muscu ? Object.keys(d.historique.daily_muscu).sort() : [];
  eq(dm[0] === '2025-01-06', 'getAppData : la 1re séance (06/01/2025) est bien lue', dm[0]);
  console.log('-'.repeat(70));
  console.log('lecture complète : ' + ok + ' OK / ' + ko + ' KO');
  if (ko) process.exitCode = 1;
})();
