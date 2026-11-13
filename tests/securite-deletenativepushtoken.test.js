/* SÉCURITÉ — deleteNativePushToken (🟠 audit P2.1, diagnostic du 11/11 reproduit en préprod).
 * Avant : sans athlete_id, n'importe quel compte connecté supprimait le jeton Android d'un autre (filtre
 * propriétaire facultatif) ; un coach supprimait celui de son athlète. Après : suppression toujours filtrée sur
 * jeton + propriétaire de la SESSION (athlète : id ; coach : coach:<id>). Téléphone partagé (clé token +
 * athlete_id) : chaque rôle ne retire que sa ligne. VRAI index.ts, AUTH_ENFORCE=1, sessions signées. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const ROOT = path.join(__dirname, '..');
const T = fs.readFileSync(path.join(__dirname, 'e2e-parcours.test.js'), 'utf8');
eval(T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend')));

let STORE = null;
const base = () => ({
  athletes: [{ id: 'A', login: '1001', nom: 'John', coach_id: 'C1' }, { id: 'B', login: '1002', nom: 'Lucas', coach_id: 'C1' }],
  coachs: [{ coach_id: 'C1', login: '2001', nom: 'jim' }, { coach_id: 'C2', login: '2002', nom: 'autre' }],
  native_push_tokens: [
    { token: 'T_A', athlete_id: 'A', platform: 'android' },
    { token: 'T_B', athlete_id: 'B', platform: 'android' },
    { token: 'T_C1', athlete_id: 'coach:C1', platform: 'android' },
    { token: 'T_C2', athlete_id: 'coach:C2', platform: 'android' },
    { token: 'T_TEL', athlete_id: 'A', platform: 'android' },          // même téléphone : John…
    { token: 'T_TEL', athlete_id: 'coach:C1', platform: 'android' },   // …et son coach
  ],
  push_subscriptions: [{ id: 1, athlete_id: 'A', endpoint: 'https://push/E_A', p256dh: 'k', auth: 'k' }, { id: 2, athlete_id: 'B', endpoint: 'https://push/E_B', p256dh: 'k', auth: 'k' }],
  login_echecs: [],
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
const call = async (action, tok, extra) => {
  STORE = base();
  const r = await handler(new Request('https://x/functions/v1/smooth-service' + (tok ? '?_t=' + encodeURIComponent(tok) : ''), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8', 'x-forwarded-for': '10.5.0.' + (++ip) }, body: JSON.stringify(Object.assign({ action }, extra)) }));
  let j = null; try { j = await r.json(); } catch (_) {}
  return { status: r.status, j };
};
const del = (tok, extra) => call('deleteNativePushToken', tok, extra);
const a = (token, own) => STORE.native_push_tokens.some((r) => r.token === token && r.athlete_id === own);
const tout = () => STORE.native_push_tokens.length === 6;
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };

(async () => {
  const tA = await sb.__api.signSession('a', 'A'), tC1 = await sb.__api.signSession('c', 'C1'), tC2 = await sb.__api.signSession('c', 'C2');

  // ★ L'ancien trou : John SANS athlete_id → jeton de Lucas → 200 mais jeton de Lucas inchangé.
  { const r = await del(tA, { token: 'T_B' }); eq(r.status === 200 && r.j.success === true && a('T_B', 'B') && tout(), '★ John sans athlete_id → jeton de Lucas : 200, jeton de Lucas INCHANGÉ', r); }
  { const r = await del(tA, { token: 'T_B', athlete_id: 'A' }); eq(r.j.success === true && a('T_B', 'B'), 'John avec son athlete_id → jeton de Lucas : inchangé', r.j); }

  // Légitime
  { const r = await del(tA, { token: 'T_A', athlete_id: 'A' }); eq(r.j.success === true && !a('T_A', 'A') && STORE.native_push_tokens.length === 5, 'John → son jeton (avec athlete_id, comme l\'app) : supprimé', r.j); }
  { const r = await del(tA, { token: 'T_A' }); eq(r.j.success === true && !a('T_A', 'A'), 'John → son jeton (sans athlete_id) : supprimé', r.j); }
  { const r = await del(tC1, { token: 'T_C1', athlete_id: 'coach:C1' }); eq(r.j.success === true && !a('T_C1', 'coach:C1') && STORE.native_push_tokens.length === 5, 'coach → son jeton (coach:<id>) : supprimé', r.j); }

  // ★ Téléphone partagé (clé token + athlete_id) : chaque rôle ne retire que SA ligne.
  { const r = await del(tA, { token: 'T_TEL', athlete_id: 'A' }); eq(r.j.success === true && !a('T_TEL', 'A') && a('T_TEL', 'coach:C1'), '★ téléphone partagé : John supprime sa ligne, la ligne coach:<id> RESTE', r.j); }
  { const r = await del(tC1, { token: 'T_TEL', athlete_id: 'coach:C1' }); eq(r.j.success === true && a('T_TEL', 'A') && !a('T_TEL', 'coach:C1'), 'téléphone partagé : le coach supprime sa ligne, celle de John reste', r.j); }
  { const r = await del(tA, { token: 'T_TEL' }); eq(r.j.success === true && !a('T_TEL', 'A') && a('T_TEL', 'coach:C1'), 'téléphone partagé, John sans athlete_id : seule sa ligne part', r.j); }

  // Coach ↔ athlète (changement de comportement validé : la permission coach→athlète ne gère pas son terminal)
  { const r = await del(tC1, { token: 'T_A', athlete_id: 'A' }); eq(r.j.success === true && a('T_A', 'A') && tout(), 'coach → jeton de SON athlète (athlete_id = l\'athlète) : sans effet', r.j); }
  { const r = await del(tC1, { token: 'T_A' }); eq(r.j.success === true && a('T_A', 'A') && tout(), 'coach → jeton de son athlète (sans athlete_id) : sans effet', r.j); }
  { const r = await del(tA, { token: 'T_C1' }); eq(r.j.success === true && a('T_C1', 'coach:C1') && tout(), 'athlète → jeton de son coach : sans effet', r.j); }
  { const r = await del(tC2, { token: 'T_A' }); eq(a('T_A', 'A') && tout(), 'coach hors périmètre → jeton d\'un athlète : sans effet', r); }
  { const r = await del(tC2, { token: 'T_C1' }); eq(r.j.success === true && a('T_C1', 'coach:C1') && tout(), 'coach C2 → jeton du coach C1 : sans effet', r.j); }

  // Identités manipulées
  { const r = await del(tA, { token: 'T_B', athlete_id: 'B' }); eq(r.status === 401 && a('T_B', 'B'), 'John + athlete_id=Lucas : 401', r.status); }
  { const r = await del(tA, { token: 'T_C1', athlete_id: 'coach:C1' }); eq(r.status === 401 && a('T_C1', 'coach:C1'), 'John + athlete_id=coach:C1 : 401', r.status); }
  { const r = await del(tA, { token: 'T_B', _sessId: 'B', _sessRole: 'a' }); eq(r.j.success === true && a('T_B', 'B') && tout(), 'John + faux _sessId=Lucas : ignoré, jeton de Lucas inchangé', r.j); }
  { const r = await del(tA, { token: 'T_C1', _sessId: 'C1', _sessRole: 'c' }); eq(r.j.success === true && a('T_C1', 'coach:C1') && tout(), 'John + faux rôle coach : ignoré, jeton du coach inchangé', r.j); }

  // Sans session / paramètres
  { const r = await del(null, { token: 'T_B', athlete_id: 'B' }); eq(r.status === 401 && tout(), 'sans session : 401, rien supprimé', r.status); }
  { const r = await del(tA, { token: '' }); eq(r.j.success === false && r.j.error === 'token manquant' && tout(), 'jeton vide : « token manquant » (inchangé)', r.j); }
  { const r = await del(tA, { token: 'INCONNU' }); eq(r.j.success === true && tout(), 'jeton inconnu : succès, rien supprimé', r.j); }

  // Non-régression : saveNativePushToken et deletePushSub
  { const r = await call('saveNativePushToken', tA, { athlete_id: 'A', token: 'T_NOUVEAU', platform: 'android' }); eq(r.j.success === true && a('T_NOUVEAU', 'A'), 'saveNativePushToken : enregistre toujours le jeton de John', r.j); }
  { const r = await call('saveNativePushToken', tC1, { athlete_id: 'coach:C1', token: 'T_NOUVEAU_C', platform: 'android' }); eq(r.j.success === true && a('T_NOUVEAU_C', 'coach:C1'), 'saveNativePushToken : enregistre toujours le jeton du coach', r.j); }
  { const r = await call('deletePushSub', tA, { endpoint: 'https://push/E_B' }); eq(r.j.success === true && STORE.push_subscriptions.some((s) => s.endpoint === 'https://push/E_B'), 'deletePushSub : John → abonnement web de Lucas toujours conservé', r.j); }

  console.log(`securite-deletenativepushtoken : ${ok} OK / ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
