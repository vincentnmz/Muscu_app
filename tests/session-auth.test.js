/* =============================================================================
 * Sessions (jeton signé) + droits d'accès — 28/10/2026. VRAI code d'index.ts,
 * y compris l'aiguillage Deno.serve (capturé), sur une base en mémoire.
 *   1. jeton : aller-retour, falsification, expiration, sans PEPPER ;
 *   2. droits : athlète = ses données (+ son coach) ; coach = ses athlètes ;
 *   3. parcours réel : inscription → jeton → getAppData ; mode observation
 *      (rien refusé) vs AUTH_ENFORCE=1 (401 sans jeton / mauvais athlète).
 * ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');

const ROOT = path.join(__dirname, '..');
const T = fs.readFileSync(path.join(__dirname, 'e2e-parcours.test.js'), 'utf8');
eval(T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend')));

function load(env) {
  const store = { athletes: [
    { id: 'A1', login: '1111', nom: 'Un', coach_id: 'C1', sport: 'muscu' },
    { id: 'A2', login: '2222', nom: 'Deux', coach_id: 'C2', sport: 'muscu' },
  ], coachs: [{ coach_id: 'C1', login: 'c1' }, { coach_id: 'C2', login: 'c2' }] };
  const client = makeEngine(store);
  let handler = null;
  let js = stripTypeScriptTypes(fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
  js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { signSession, verifySession, authCheck, withSession, jsonResp };';
  const warns = [];
  const sb = { createClient: () => client, webpush: { setVapidDetails() {}, sendNotification: async () => {} },
    Deno: { env: { get: (k) => env[k] }, serve: (fn) => { handler = fn; } },
    Response, Request, URL, URLSearchParams, TextEncoder, TextDecoder, crypto, atob, btoa, setTimeout, clearTimeout, fetch: async () => ({}),
    console: { log() {}, error() {}, warn: (m) => warns.push(m) } };
  vm.createContext(sb); vm.runInContext(js, sb);
  return { api: sb.__api, handler, store, warns };
}

let ok = 0, ko = 0; const fails = [];
const eq = (c, n, g) => { if (c) ok++; else { ko++; fails.push(n); console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };
const U = 'https://x.supabase.co/functions/v1/smooth-service';
const get = (h, q) => h(new Request(U + '?' + q));
const post = (h, body, q) => h(new Request(U + (q ? '?' + q : ''), { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) }));

(async () => {
  // ── 1. Jeton ──
  { const { api } = load({ PEPPER: 'pep' });
    const t = await api.signSession('a', 'A1');
    const v = await api.verifySession(t);
    eq(v && v.role === 'a' && v.id === 'A1', 'jeton : aller-retour', v);
    const parts = t.split('.'); parts[2] = Buffer.from('A2').toString('base64').replace(/=+$/, '');
    eq(await api.verifySession(parts.join('.')) === null, 'jeton falsifié (id changé) → refusé');
    eq(await api.verifySession(t.slice(0, -2) + 'xx') === null, 'signature altérée → refusée');
    const vieux = await api.signSession('a', 'A1', Date.now() / 1000 - 31 * 24 * 3600);
    eq(await api.verifySession(vieux) === null, 'jeton de plus de 30 jours → expiré');
    const autre = load({ PEPPER: 'autre' }).api;
    eq(await autre.verifySession(t) === null, 'jeton signé avec une autre clé → refusé'); }
  { const { api } = load({});
    eq(await api.signSession('a', 'A1') === null, 'sans PEPPER : pas de jeton (pas de faux sentiment de sécurité)'); }

  { const { api } = load({ PEPPER: 'pep' });
    const r = await api.withSession(api.jsonResp({ success: true, athlete: { athlete_id: 'A9' } }), 'a');
    const d = await r.json(); const v = await api.verifySession(d.token);
    eq(v && v.id === 'A9' && v.role === 'a', 'inscription réussie → jeton pour le nouvel athlète', d);
    const r2 = await api.withSession(api.jsonResp({ success: false, error: 'déjà pris' }), 'a');
    eq(!(await r2.json()).token, 'inscription échouée → pas de jeton');
    const r3 = await api.withSession(api.jsonResp({ success: true, coach: { coach_id: 'C9' } }), 'c');
    const v3 = await api.verifySession((await r3.json()).token);
    eq(v3 && v3.role === 'c' && v3.id === 'C9', 'coach inscrit → jeton coach', v3); }

  // ── 2. Droits ──
  { const { api } = load({ PEPPER: 'pep' });
    const tA1 = await api.signSession('a', 'A1'), tC1 = await api.signSession('c', 'C1');
    const P = (o) => new URLSearchParams(o);
    const chk = async (action, q, body) => (await api.authCheck(action, P(q || {}), body || null)).ok;
    eq(await chk('login', {}), 'route publique (login) sans jeton → OK');
    eq(!(await chk('getAppData', { athlete_id: 'A1' })), 'getAppData sans jeton → refusé');
    eq(await chk('getAppData', { athlete_id: 'A1', _t: tA1 }), 'athlète A1 → ses données');
    eq(!(await chk('getAppData', { athlete_id: 'A2', _t: tA1 })), 'athlète A1 → données de A2 refusées');
    eq(await chk('saveCommentaire', { _t: tA1 }, { athlete_id: 'A1', coach_id: 'C1' }), 'athlète A1 → message à SON coach C1');
    eq(!(await chk('saveCommentaire', { _t: tA1 }, { athlete_id: 'A1', coach_id: 'C2' })), 'athlète A1 → coach C2 refusé');
    eq(!(await chk('saveSeance', { _t: tA1 }, { data: { athlete_id: 'A2' } })), 'saveSeance pour A2 avec le jeton de A1 → refusé');
    eq(await chk('getAppData', { athlete_id: 'A1', _t: tC1 }), 'coach C1 → son athlète A1');
    eq(!(await chk('getAppData', { athlete_id: 'A2', _t: tC1 })), 'coach C1 → athlète A2 (non lié) refusé');
    eq(await chk('getCoachAthletes', { coach_id: 'C1', _t: tC1 }), 'coach C1 → sa liste');
    eq(!(await chk('getCoachAthletes', { coach_id: 'C2', _t: tC1 })), 'coach C1 → liste de C2 refusée');
    eq(!(await chk('getCoachAthletes', { coach_id: 'C1', _t: tA1 })), 'athlète A1 → liste des athlètes de SON coach refusée');
    eq(await chk('envoyerMediaCoach', { _t: tA1 }, { athlete_id: 'A1', coach_id: 'C1' }), 'athlète A1 → média à son coach C1'); }

  // ── 3. Parcours réel par l'aiguillage ──
  { const { handler, warns } = load({ PEPPER: 'pep' });   // mode observation
    const reg = await (await post(handler, { action: 'register', login: '4321', password: 'secret1', prenom: 'Zoé', ddn: '2000-01-01', taille: '170', poids: '60', annees: '2', sport: 'muscu', email: 'z@x.fr' })).json();
    eq(reg.success, 'inscription OK', reg);
    // (la base EN MÉMOIRE renvoie un tableau sur insert().select().single() → pas d'id ;
    //  en prod Supabase renvoie la ligne : le jeton d'inscription est testé via withSession
    //  ci-dessous, et la connexion — qui lit l'athlète — est testée ici)
    const lg = await (await post(handler, { action: 'login', login: '4321', password: 'secret1' })).json();
    eq(lg.success && typeof lg.token === 'string' && lg.token.split('.').length === 5, 'connexion → jeton renvoyé', lg);
    const r1 = await get(handler, 'action=getAppData&athlete_id=A2');
    eq(r1.status === 200, 'observation : appel sans jeton NON refusé', r1.status);
    eq(warns.some(w => /observation/.test(w) && /getAppData/.test(w)), 'observation : appel journalisé', warns); }
  { const { handler } = load({ PEPPER: 'pep', AUTH_ENFORCE: '1' });   // mode strict
    const reg = await (await post(handler, { action: 'register', login: '5678', password: 'secret1', prenom: 'Léo', ddn: '2000-01-01', taille: '180', poids: '75', annees: '2', sport: 'muscu', email: 'l@x.fr' })).json();
    const lg0 = await (await post(handler, { action: 'login', login: '5678', password: 'secret1' })).json();
    const id = lg0.athlete.athlete_id, tok = lg0.token;
    const sans = await get(handler, 'action=getAppData&athlete_id=' + id);
    const sansJ = await sans.json();
    eq(sans.status === 401 && sansJ.auth === true, 'strict : sans jeton → 401 (auth)', sans.status);
    const avec = await get(handler, 'action=getAppData&athlete_id=' + id + '&_t=' + encodeURIComponent(tok));
    eq(avec.status === 200, 'strict : avec son jeton → 200', avec.status);
    const autre = await get(handler, 'action=getAppData&athlete_id=A1&_t=' + encodeURIComponent(tok));
    eq(autre.status === 401, 'strict : son jeton sur un autre athlète → 401', autre.status);
    const login = await (await post(handler, { action: 'login', login: '5678', password: 'secret1' })).json();
    eq(login.success && login.token, 'strict : login → nouveau jeton', login);
    const ping = await get(handler, 'action=ping');
    eq(ping.status === 200, 'strict : ping reste public', ping.status); }

  console.log('-'.repeat(70));
  console.log('sessions + droits : ' + ok + ' OK / ' + ko + ' KO');
  if (ko) { console.log('Échecs : ' + fails.join(' | ')); process.exit(1); }
})();
