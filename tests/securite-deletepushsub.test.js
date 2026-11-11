/* SÉCURITÉ — deletePushSub (🟠 audit P2.1, docs/audit-droits-routes-2026-11-10.md).
 * Avant : n'importe quel compte connecté supprimait l'abonnement push web d'un autre s'il connaissait
 * son endpoint (aucun contrôle de propriétaire). Après : seul l'abonnement de la session est supprimé
 * (athlète : son id ; coach : « coach:<id> »). VRAI index.ts, AUTH_ENFORCE=1, sessions signées réelles. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const ROOT = path.join(__dirname, '..');
const T = fs.readFileSync(path.join(__dirname, 'e2e-parcours.test.js'), 'utf8');
eval(T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend')));

let STORE = null;
const SUBS = () => [
  { id: 1, athlete_id: 'A', endpoint: 'https://push/E_A', p256dh: 'k', auth: 'k' },
  { id: 2, athlete_id: 'B', endpoint: 'https://push/E_B', p256dh: 'k', auth: 'k' },
  { id: 3, athlete_id: 'coach:C1', endpoint: 'https://push/E_C1', p256dh: 'k', auth: 'k' },
  { id: 4, athlete_id: 'coach:C2', endpoint: 'https://push/E_C2', p256dh: 'k', auth: 'k' },
];
const base = () => ({
  athletes: [{ id: 'A', login: '1001', nom: 'A', coach_id: 'C1' }, { id: 'B', login: '1002', nom: 'B', coach_id: 'C1' }],
  coachs: [{ coach_id: 'C1', login: '2001', nom: 'c1' }, { coach_id: 'C2', login: '2002', nom: 'c2' }],
  push_subscriptions: SUBS(), login_echecs: [],
});
const client = { from: (t) => makeEngine(STORE).from(t), rpc: () => ({ then: (r) => r({ data: null, error: { code: 'PGRST202' } }) }) };
let handler = null;
let js = stripTypeScriptTypes(fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
js = js.split('\n').filter((l) => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { signSession };';
const ENV = { PEPPER: 'poivre-test', AUTH_ENFORCE: '1' };
const sb = { createClient: () => client, webpush: { setVapidDetails() {}, sendNotification: async () => {} },
  Deno: { env: { get: (k) => ENV[k] }, serve: (fn) => { handler = fn; } },
  Response, Request, URL, URLSearchParams, TextEncoder, TextDecoder, crypto, atob, btoa, setTimeout, clearTimeout, fetch: async () => ({ ok: false, json: async () => ({}) }),
  console: { log() {}, error() {}, warn() {} } };
vm.createContext(sb); vm.runInContext(js, sb);
let ip = 0;
// Même forme d'appel que l'app (js/app.js desactiverNotifications) : POST { action, endpoint }, jeton en _t.
const del = async (tok, extra) => {
  STORE = base();
  const r = await handler(new Request('https://x/functions/v1/smooth-service' + (tok ? '?_t=' + encodeURIComponent(tok) : ''), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8', 'x-forwarded-for': '10.8.0.' + (++ip) }, body: JSON.stringify(Object.assign({ action: 'deletePushSub' }, extra)) }));
  let j = null; try { j = await r.json(); } catch (_) {}
  return { status: r.status, j, reste: STORE.push_subscriptions.map((s) => s.endpoint.slice(13)).sort().join(',') };
};
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };
const TOUS = 'E_A,E_B,E_C1,E_C2';

(async () => {
  const tA = await sb.__api.signSession('a', 'A'), tB = await sb.__api.signSession('a', 'B'), tC1 = await sb.__api.signSession('c', 'C1'), tC2 = await sb.__api.signSession('c', 'C2');
  const E = (x) => 'https://push/' + x;

  // ── L'attaque : A connaît l'endpoint de B ──
  { const r = await del(tA, { endpoint: E('E_B') }); eq(r.reste === TOUS, 'A → endpoint de B : l\'abonnement de B existe toujours', r); eq(r.status === 200 && r.j && r.j.success === true, 'A → endpoint de B : même format de réponse ({success:true})', r); }
  { const r = await del(tB, { endpoint: E('E_A') }); eq(r.reste === TOUS, 'B → endpoint de A : l\'abonnement de A existe toujours', r); }

  // ── Légitime : chacun supprime le sien ──
  { const r = await del(tA, { endpoint: E('E_A') }); eq(r.status === 200 && r.j.success === true && r.reste === 'E_B,E_C1,E_C2', 'A → son endpoint : supprimé (comportement de l\'app conservé)', r); }
  { const r = await del(tC1, { endpoint: E('E_C1') }); eq(r.status === 200 && r.j.success === true && r.reste === 'E_A,E_B,E_C2', 'coach C1 → son endpoint (coach:C1) : supprimé', r); }

  // ── Coach ↔ athlète, dans les deux sens ──
  { const r = await del(tC1, { endpoint: E('E_A') }); eq(r.reste === TOUS, 'coach C1 → endpoint de SON athlète A : conservé', r); }
  { const r = await del(tA, { endpoint: E('E_C1') }); eq(r.reste === TOUS, 'athlète A → endpoint de SON coach C1 : conservé', r); }
  { const r = await del(tC2, { endpoint: E('E_A') }); eq(r.reste === TOUS, 'coach C2 (hors périmètre) → endpoint de A : conservé', r); }
  { const r = await del(tC1, { endpoint: E('E_C2') }); eq(r.reste === TOUS, 'coach C1 → endpoint du coach C2 : conservé', r); }

  // ── Identifiant manipulé dans le corps : refusé par le contrôle de session existant ──
  { const r = await del(tA, { endpoint: E('E_B'), athlete_id: 'B' }); eq(r.status === 401 && r.reste === TOUS, 'A + athlete_id=B : 401, rien supprimé', r); }
  { const r = await del(tA, { endpoint: E('E_C1'), athlete_id: 'coach:C1' }); eq(r.status === 401 && r.reste === TOUS, 'A + athlete_id=coach:C1 : 401, rien supprimé', r); }
  { const r = await del(tC2, { endpoint: E('E_C1'), athlete_id: 'coach:C1' }); eq(r.status === 401 && r.reste === TOUS, 'C2 + athlete_id=coach:C1 : 401, rien supprimé', r); }
  { const r = await del(tA, { endpoint: E('E_B'), _sessId: 'B', _sessRole: 'a' }); eq(r.reste === TOUS, 'A + faux _sessId=B dans le corps : ignoré, rien supprimé', r); }

  // ── Sans jeton / endpoint vide ou inexistant ──
  { const r = await del(null, { endpoint: E('E_B') }); eq(r.status === 401 && r.reste === TOUS, 'sans jeton : 401, rien supprimé', r); }
  { const r = await del(tA, { endpoint: '' }); eq(r.j && r.j.success === false && r.reste === TOUS, 'endpoint vide : erreur « endpoint manquant », rien supprimé', r); }
  { const r = await del(tA, { endpoint: E('INCONNU') }); eq(r.reste === TOUS, 'endpoint inexistant : rien supprimé', r); }

  console.log(`securite-deletepushsub : ${ok} OK / ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
