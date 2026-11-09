/* Comptes de démo / test (09/11/2026) — colonne is_demo (athletes, coachs).
 * VRAI code d'index.ts sur une base en mémoire :
 *  - alertes push du matin (cronPushAlertes) : les comptes démo ne sont plus analysés / notifiés,
 *    ni comme athlète, ni comme coach ; les vrais comptes, si ;
 *  - résumés e-mail (cronResumes) : aucun e-mail vers un compte démo ;
 *  - sans la colonne (migration pas encore appliquée) : rien n'est exclu et rien ne casse. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const ROOT = path.join(__dirname, '..');
const T = fs.readFileSync(path.join(__dirname, 'e2e-parcours.test.js'), 'utf8');
eval(T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend')));

function load(store, env) {
  const client = makeEngine(store); let handler = null; const mails = [];
  let js = stripTypeScriptTypes(fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
  js = js.split('\n').filter((l) => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { _comptesDemo };';
  const fetchMock = async (url, init) => { if (String(url).includes('resend')) { try { mails.push(JSON.parse(init.body).to); } catch (_) {} return { ok: true, status: 200, json: async () => ({ id: 'x' }), text: async () => '' }; } return { ok: false, status: 500, json: async () => ({}), text: async () => '' }; };
  const sb = { createClient: () => client, webpush: { setVapidDetails() {}, sendNotification: async () => {} },
    Deno: { env: { get: (k) => env[k] }, serve: (fn) => { handler = fn; } },
    Response, Request, URL, URLSearchParams, TextEncoder, TextDecoder, crypto, atob, btoa, setTimeout, clearTimeout, fetch: fetchMock,
    console: { log() {}, error() {}, warn() {} } };
  vm.createContext(sb); vm.runInContext(js, sb);
  return { api: sb.__api, handler, mails };
}
const U = 'https://x.supabase.co/functions/v1/smooth-service';
const post = (h, body) => h(new Request(U, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) }));
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };
const ENV = { CRON_SECRET: 's3cret', RESEND_API_KEY: 'test', PEPPER: 'p' };

function base(avecColonne) {
  const d = (v) => (avecColonne ? { is_demo: v } : {});
  return {
    athletes: [
      Object.assign({ id: 'R1', login: '1001', nom: 'Vrai', coach_id: 'C1', email: 'vrai@ex.fr', recap_freq: 'semaine' }, d(false)),
      Object.assign({ id: 'D1', login: '9001', nom: 'Demo', coach_id: 'C2', email: 'demo@ex.fr', recap_freq: 'semaine' }, d(true)),
    ],
    coachs: [
      Object.assign({ coach_id: 'C1', login: 'c1', nom: 'Coach vrai', email: 'cv@ex.fr', recap_freq: 'semaine' }, d(false)),
      Object.assign({ coach_id: 'C2', login: 'c2', nom: 'Coach demo', email: 'cd@ex.fr', recap_freq: 'semaine' }, d(true)),
    ],
    native_push_tokens: [{ token: 't1', athlete_id: 'R1' }, { token: 't2', athlete_id: 'D1' }, { token: 't3', athlete_id: 'coach:C2' }],
    push_subscriptions: [], performances: [], indicateurs: [], bien_etre: [], programme: [], exercices: [], volume_obti: [],
  };
}

(async () => {
  // 1. Liste des comptes démo
  { const { api } = load(base(true), ENV); const dm = await api._comptesDemo();
    eq(dm.ath.has('D1') && !dm.ath.has('R1'), 'athlète démo repéré, vrai athlète non', [...dm.ath]);
    eq(dm.coach.has('C2') && !dm.coach.has('C1'), 'coach démo repéré, vrai coach non', [...dm.coach]); }
  // 2. Alertes push du matin : seul le vrai athlète est analysé
  { const { handler } = load(base(true), ENV);
    const r = await (await post(handler, { action: 'cronPushAlertes', secret: 's3cret' })).json();
    eq(r.ok === true && r.scanned === 1, 'cronPushAlertes : 1 seul athlète analysé (le démo et l\'équipe du coach démo sont exclus)', r); }
  // 3. Résumés e-mail : aucun e-mail vers un compte démo
  { const { handler, mails } = load(base(true), ENV);
    const r = await (await post(handler, { action: 'cronResumes', secret: 's3cret' })).json();
    eq(r.ok === true, 'cronResumes répond', r);
    const dest = mails.map(String);
    eq(!dest.some((m) => m.includes('demo@ex.fr') || m.includes('cd@ex.fr')), 'aucun e-mail vers un compte démo', dest);
    eq(r.coachsSkip >= 1 && r.athletesSkip >= 1, 'comptes démo comptés comme ignorés', r); }
  // 4. Sans la colonne is_demo : comportement d'avant (rien d'exclu, pas d'erreur)
  { const { api, handler } = load(base(false), ENV); const dm = await api._comptesDemo();
    eq(dm.ath.size === 0 && dm.coach.size === 0, 'sans colonne : aucune exclusion');
    const r = await (await post(handler, { action: 'cronPushAlertes', secret: 's3cret' })).json();
    eq(r.ok === true && r.scanned === 2, 'sans colonne : les 2 athlètes analysés comme avant', r); }

  console.log(`comptes-demo : ${ok} OK / ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
