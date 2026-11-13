/* SÉCURITÉ — savePushSub (🟠 audit P2.1, diagnostic du 11/11 reproduit en préprod).
 * Avant : upsert sur l'endpoint avec le propriétaire envoyé par l'app → un compte réattribuait à son nom
 * l'abonnement push d'un autre (la victime ne recevait plus rien), et un coach pouvait abonner SON appareil
 * sous l'id de son athlète. Après : propriétaire = session ; adresse d'un autre = refus, base inchangée.
 * VRAI index.ts, AUTH_ENFORCE=1, sessions signées. La table push_subscriptions simulée applique UNIQUE(endpoint)
 * comme PostgreSQL (erreur 23505) et renvoie les lignes mises à jour (.select()). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const ROOT = path.join(__dirname, '..');
const T = fs.readFileSync(path.join(__dirname, 'e2e-parcours.test.js'), 'utf8');
eval(T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend')));

let STORE = null;
const base = () => ({
  athletes: [{ id: 'A', login: '1001', nom: 'A', coach_id: 'C1' }, { id: 'B', login: '1002', nom: 'B', coach_id: 'C1' }],
  coachs: [{ coach_id: 'C1', login: '2001', nom: 'c1' }, { coach_id: 'C2', login: '2002', nom: 'c2' }],
  push_subscriptions: [
    { id: 1, athlete_id: 'A', endpoint: 'https://push/E_A', p256dh: 'kA', auth: 'aA' },
    { id: 2, athlete_id: 'B', endpoint: 'https://push/E_B', p256dh: 'kB', auth: 'aB' },
    { id: 3, athlete_id: 'coach:C1', endpoint: 'https://push/E_C1', p256dh: 'kC', auth: 'aC' },
  ], login_echecs: [],
});
// Table push_subscriptions « comme PostgreSQL » : UNIQUE(endpoint) + update().eq().select() renvoie les lignes.
function pushTable() {
  const T = STORE.push_subscriptions, f = []; let op = null, pay = null;
  const self = {
    insert(p) { op = 'insert'; pay = p; return self; }, update(p) { op = 'update'; pay = p; return self; },
    upsert(p) { op = 'upsert'; pay = p; return self; }, delete() { op = 'delete'; return self; },
    select() { if (!op) op = 'select'; return self; }, eq(c, v) { f.push((r) => String(r[c]) === String(v)); return self; }, limit() { return self; },
    then(res) {
      const m = (r) => f.every((x) => x(r));
      if (op === 'insert') { if (T.some((r) => r.endpoint === pay.endpoint)) return res({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "push_subscriptions_endpoint_key"' } }); T.push(Object.assign({ id: T.length + 100 }, pay)); return res({ data: null, error: null }); }
      if (op === 'upsert') { const i = T.findIndex((r) => r.endpoint === pay.endpoint); if (i >= 0) Object.assign(T[i], pay); else T.push(pay); return res({ data: null, error: null }); }
      if (op === 'update') { const rows = T.filter(m); rows.forEach((r) => Object.assign(r, pay)); return res({ data: rows.map((r) => ({ id: r.id })), error: null }); }
      if (op === 'delete') { STORE.push_subscriptions = T.filter((r) => !m(r)); return res({ data: null, error: null }); }
      return res({ data: T.filter(m), error: null });
    },
  };
  return self;
}
const client = { from: (t) => (t === 'push_subscriptions' ? pushTable() : makeEngine(STORE).from(t)), rpc: () => ({ then: (r) => r({ data: null, error: { code: 'PGRST202' } }) }) };
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
const call = async (action, tok, extra, garder) => {
  if (!garder) STORE = base();
  const r = await handler(new Request('https://x/functions/v1/smooth-service' + (tok ? '?_t=' + encodeURIComponent(tok) : ''), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8', 'x-forwarded-for': '10.6.0.' + (++ip) }, body: JSON.stringify(Object.assign({ action }, extra)) }));
  let j = null; try { j = await r.json(); } catch (_) {}
  return { status: r.status, j };
};
const save = (tok, extra, garder) => call('savePushSub', tok, Object.assign({ p256dh: 'kX', auth: 'aX', user_agent: 'test' }, extra), garder);
const ligne = (e) => STORE.push_subscriptions.find((r) => r.endpoint === 'https://push/' + e);
const intacte = (e, own, k) => { const r = ligne(e); return !!r && r.athlete_id === own && r.p256dh === k; };
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };
const E = (x) => 'https://push/' + x;

(async () => {
  const tA = await sb.__api.signSession('a', 'A'), tB = await sb.__api.signSession('a', 'B'), tC1 = await sb.__api.signSession('c', 'C1'), tC2 = await sb.__api.signSession('c', 'C2');

  // Légitime
  { const r = await save(tA, { athlete_id: 'A', endpoint: E('E_A'), p256dh: 'kA2' }); eq(r.j.success === true && ligne('E_A').p256dh === 'kA2' && ligne('E_A').athlete_id === 'A', 'A → son abonnement : clés mises à jour', r.j); }
  { const r = await save(tA, { athlete_id: 'A', endpoint: E('NOUVEAU') }); eq(r.j.success === true && (ligne('NOUVEAU') || {}).athlete_id === 'A', 'A → adresse nouvelle : créée à son nom', r.j); }
  { const r = await save(tC1, { athlete_id: 'coach:C1', endpoint: E('E_C1'), p256dh: 'kC2' }); eq(r.j.success === true && intacte('E_C1', 'coach:C1', 'kC2'), 'coach → son abonnement (coach:<id>) : mis à jour', r.j); }
  { const r = await save(tC1, { athlete_id: 'coach:C1', endpoint: E('NOUVEAU_C') }); eq(r.j.success === true && (ligne('NOUVEAU_C') || {}).athlete_id === 'coach:C1', 'coach → adresse nouvelle : créée sous coach:<id>', r.j); }

  // L'attaque : A connaît l'adresse de B
  { const r = await save(tA, { athlete_id: 'A', endpoint: E('E_B') }); eq(r.status === 200 && r.j.success === false && intacte('E_B', 'B', 'kB'), 'A → adresse de B : refus, ligne de B inchangée (propriétaire ET clés)', r.j); }
  { const r = await save(tB, { athlete_id: 'B', endpoint: E('E_A') }); eq(r.j.success === false && intacte('E_A', 'A', 'kA'), 'B → adresse de A : refus, ligne de A inchangée', r.j); }

  // Coach ↔ athlète, dans les deux sens
  { const r = await save(tC1, { athlete_id: 'coach:C1', endpoint: E('E_A') }); eq(r.j.success === false && intacte('E_A', 'A', 'kA'), 'coach → adresse de son athlète (sous coach:<id>) : refus, inchangée', r.j); }
  { const r = await save(tC1, { athlete_id: 'A', endpoint: E('E_A') }); eq(r.j.success === false && intacte('E_A', 'A', 'kA'), 'coach → adresse de son athlète (sous l\'id de l\'athlète) : refus, inchangée', r.j); }
  { const n0 = base().push_subscriptions.length; const r = await save(tC1, { athlete_id: 'A', endpoint: E('APPAREIL_COACH') }); eq(r.j.success === false && !ligne('APPAREIL_COACH') && STORE.push_subscriptions.length === n0, 'coach → SON appareil sous l\'id de son athlète : refus, aucune ligne créée', r.j); }
  { const r = await save(tA, { athlete_id: 'A', endpoint: E('E_C1') }); eq(r.j.success === false && intacte('E_C1', 'coach:C1', 'kC'), 'athlète → adresse de son coach : refus, inchangée', r.j); }
  { const r = await save(tA, { athlete_id: 'coach:C1', endpoint: E('E_C1') }); eq(r.status === 401 && intacte('E_C1', 'coach:C1', 'kC'), 'athlète + athlete_id=coach:C1 : 401', r.status); }
  { const r = await save(tC2, { athlete_id: 'coach:C2', endpoint: E('E_C1') }); eq(r.j.success === false && intacte('E_C1', 'coach:C1', 'kC'), 'coach C2 → adresse du coach C1 : refus, inchangée', r.j); }

  // Identités manipulées
  { const r = await save(tA, { athlete_id: 'B', endpoint: E('E_B') }); eq(r.status === 401 && intacte('E_B', 'B', 'kB'), 'A + athlete_id=B : 401', r.status); }
  { const r = await save(tA, { athlete_id: 'A', endpoint: E('E_B'), _sessId: 'B', _sessRole: 'a' }); eq(r.j.success === false && intacte('E_B', 'B', 'kB'), 'A + faux _sessId=B : ignoré, refus', r.j); }
  { const r = await save(tA, { athlete_id: 'coach:C1', endpoint: E('X'), _sessId: 'C1', _sessRole: 'c' }); eq(r.status === 401 && !ligne('X'), 'A + faux rôle coach : 401, rien créé', r.status); }

  // Sans session / paramètres
  { const r = await save(null, { athlete_id: 'A', endpoint: E('E_A') }); eq(r.status === 401 && intacte('E_A', 'A', 'kA'), 'sans session : 401', r.status); }
  { const r = await save(tA, { athlete_id: 'A', endpoint: '' }); eq(r.j.success === false && r.j.error === 'Paramètres manquants', 'adresse vide : « Paramètres manquants » (inchangé)', r.j); }
  { const r = await save(tA, { athlete_id: '', endpoint: E('Y') }); eq(r.j.success === false && !ligne('Y'), 'athlete_id vide : refus, rien créé', r.j); }

  // Deux comptes enregistrent la même NOUVELLE adresse en même temps : un seul propriétaire à la fin.
  { STORE = base(); const [r1, r2] = await Promise.all([save(tA, { athlete_id: 'A', endpoint: E('COURSE') }, true), save(tB, { athlete_id: 'B', endpoint: E('COURSE') }, true)]);
    const lignes = STORE.push_subscriptions.filter((r) => r.endpoint === E('COURSE'));
    eq(lignes.length === 1 && [r1.j.success, r2.j.success].filter(Boolean).length === 1, 'même adresse en simultané : une seule ligne, un seul succès', { n: lignes.length, s: [r1.j.success, r2.j.success] }); }

  // Non-régression deletePushSub : chacun supprime le sien, jamais celui d'un autre.
  { const r = await call('deletePushSub', tA, { endpoint: E('E_B') }); eq(r.j.success === true && intacte('E_B', 'B', 'kB'), 'deletePushSub : A → adresse de B, conservée', r.j); }
  { const r = await call('deletePushSub', tA, { endpoint: E('E_A') }); eq(r.j.success === true && !ligne('E_A'), 'deletePushSub : A → la sienne, supprimée', r.j); }

  console.log(`securite-savepushsub : ${ok} OK / ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
