/* RETOURS UTILISATEURS (11/11/2026) — bouton « Signaler un problème / une idée » (athlète ET coach).
 * VRAI index.ts : action envoyerRetour enregistre le retour (table retours) avec écran, version, plateforme,
 * puis l'envoie par e-mail. Identité = session (jamais l'app) ; anti-abus 20 / 24 h ; table absente → e-mail seul. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const ROOT = path.join(__dirname, '..');
const T = fs.readFileSync(path.join(__dirname, 'e2e-parcours.test.js'), 'utf8');
eval(T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend')));

let STORE = null, MAILS = [], SANS_TABLE = false;
const base = () => ({
  athletes: [{ id: 'A', login: '1001', nom: 'Alice', coach_id: 'C1', email: '' }],
  coachs: [{ coach_id: 'C1', login: '2001', nom: 'Coach Un', email: '' }],
  retours: [], login_echecs: [],
});
const client = { from: (t) => { if (SANS_TABLE && t === 'retours') throw new Error('relation retours does not exist'); return makeEngine(STORE).from(t); }, rpc: () => ({ then: (r) => r({ data: null, error: { code: 'PGRST202' } }) }) };
let handler = null;
let js = stripTypeScriptTypes(fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
js = js.split('\n').filter((l) => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { signSession };';
const ENV = { PEPPER: 'poivre-test', AUTH_ENFORCE: '1' };
const sb = { createClient: () => client, webpush: { setVapidDetails() {}, sendNotification: async () => {} },
  Deno: { env: { get: (k) => ENV[k] }, serve: (fn) => { handler = fn; } },
  Response, Request, URL, URLSearchParams, TextEncoder, TextDecoder, crypto, atob, btoa, setTimeout, clearTimeout,
  fetch: async (u, o) => { MAILS.push(JSON.parse(o.body)); return { ok: true, status: 200, json: async () => ({ id: 'm1' }), text: async () => '' }; },
  console: { log() {}, error() {}, warn() {} } };
vm.createContext(sb); vm.runInContext(js, sb);
let ip = 0;
const send = async (tok, extra, garder) => {
  if (!garder) { STORE = base(); MAILS = []; }
  const r = await handler(new Request('https://x/functions/v1/smooth-service' + (tok ? '?_t=' + encodeURIComponent(tok) : ''), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8', 'x-forwarded-for': '10.7.0.' + (++ip) }, body: JSON.stringify(Object.assign({ action: 'envoyerRetour' }, extra)) }));
  let j = null; try { j = await r.json(); } catch (_) {}
  return { status: r.status, j, rows: STORE.retours.slice() };
};
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };

(async () => {
  const tA = await sb.__api.signSession('a', 'A'), tC = await sb.__api.signSession('c', 'C1');
  const OK = { type: 'bug', message: 'Le bouton Terminer ne répond pas', ecran: 'Entraînement', version: 'Novalyz 1.4 · dev', plateforme: 'android' };

  // Sans clé e-mail (préprod) : enregistré → succès.
  { const r = await send(tA, OK); const x = r.rows[0] || {};
    eq(r.status === 200 && r.j.success === true && r.j.enregistre === true, 'athlète, sans e-mail configuré : enregistré et succès', r.j);
    eq(r.rows.length === 1 && x.role === 'a' && x.compte_id === 'A' && x.type === 'bug' && x.ecran === 'Entraînement' && x.version === 'Novalyz 1.4 · dev' && x.plateforme === 'android' && x.message === OK.message, 'athlète : ligne complète (rôle, compte, type, écran, version, plateforme)', x); }

  // Avec clé e-mail : enregistré ET e-mail (sujet avec le type, contexte dans le corps).
  ENV.RESEND_API_KEY = 'cle-test';
  { const r = await send(tC, Object.assign({}, OK, { type: 'idee', ecran: 'Coach · fiche athlète', plateforme: 'web' })); const x = r.rows[0] || {}, m = MAILS[0] || {};
    eq(r.j.success === true && x.role === 'c' && x.compte_id === 'coach:C1' && x.type === 'idee', 'coach : enregistré sous coach:<id>', x);
    eq(MAILS.length === 1 && /\[Idée\]/.test(m.subject) && /Coach Un/.test(m.subject) && /fiche athlète/.test(m.html) && /web/.test(m.html), 'coach : e-mail avec type, écran et plateforme', { s: m.subject }); }

  // L'identité vient de la session, jamais de l'app.
  { const r = await send(tA, Object.assign({}, OK, { _sessRole: 'c', _sessId: 'C1', compte_id: 'X', role: 'c' })); const x = r.rows[0] || {};
    eq(x.role === 'a' && x.compte_id === 'A', 'rôle / compte envoyés par l\'app ignorés : identité de session', x); }

  // Valeurs nettoyées / bornées.
  { const r = await send(tA, { type: 'pirate', message: 'Bonjour', ecran: 'x'.repeat(200), version: '', plateforme: 'windows' }); const x = r.rows[0] || {};
    eq(x.type === 'autre' && x.ecran.length === 60 && x.version === null && x.plateforme === null, 'type inconnu → autre ; écran tronqué à 60 ; plateforme inconnue → vide', x); }
  { const r = await send(tA, { message: 'ab' }); eq(r.j.success === false && r.rows.length === 0, 'message trop court : refusé, rien enregistré', r.j); }
  { const r = await send(tA, { type: 'bug', message: 'a'.repeat(5000) }); eq((r.rows[0] || {}).message.length === 3000, 'message tronqué à 3000 caractères', (r.rows[0] || {}).message && r.rows[0].message.length); }

  // Sans session : 401, rien enregistré.
  { const r = await send(null, OK); eq(r.status === 401 && r.rows.length === 0 && MAILS.length === 0, 'sans session : 401, ni ligne ni e-mail', r.status); }

  // Anti-abus : 20 retours / 24 h par compte, le 21e est refusé ; un autre compte n'est pas bloqué.
  { STORE = base(); MAILS = [];
    for (let i = 0; i < 20; i++) STORE.retours.push({ id: i + 1, role: 'a', compte_id: 'A', type: 'bug', message: 'm' + i, created_at: new Date().toISOString() });
    const r = await send(tA, OK, true);
    eq(r.j.success === false && STORE.retours.length === 20 && MAILS.length === 0, '21e retour en 24 h : refusé, rien enregistré ni envoyé', r.j);
    const c = await send(tC, OK, true);
    eq(c.j.success === true && STORE.retours.length === 21, 'un autre compte n\'est pas bloqué', c.j); }
  { STORE = base(); MAILS = [];
    for (let i = 0; i < 20; i++) STORE.retours.push({ id: i + 1, role: 'a', compte_id: 'A', type: 'bug', message: 'm' + i, created_at: new Date(Date.now() - 2 * 86400000).toISOString() });
    const r = await send(tA, OK, true); eq(r.j.success === true && STORE.retours.length === 21, 'retours de plus de 24 h : ne comptent pas', r.j); }

  // Migration pas encore appliquée (table absente) : e-mail seul, comme avant.
  SANS_TABLE = true;
  { const r = await send(tA, OK); eq(r.j.success === true && r.j.enregistre === false && MAILS.length === 1, 'table absente + e-mail : succès par e-mail (comportement d\'avant)', r.j); }
  delete ENV.RESEND_API_KEY;
  { const r = await send(tA, OK); eq(r.j.success === false, 'table absente ET pas d\'e-mail : échec signalé (rien n\'est perdu en silence)', r.j); }
  SANS_TABLE = false;

  // Front : les deux entrées ouvrent la même fenêtre ; l'envoi joint écran / version / plateforme.
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), app = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');
  eq((html.match(/onclick="ouvrirRetour\(\)"/g) || []).length === 4, 'index.html : icône d\'en-tête + Réglages, athlète ET coach (4 entrées)');
  eq(/id="btn-retour-hdr" onclick="ouvrirRetour\(\)"/.test(html), 'index.html : icône dans l\'en-tête athlète');
  eq(/_annonceRetour\('a'\)/.test(app) && /_annonceRetour\('c'\)/.test(app) && /nv_annonce_retour_v1/.test(app), 'app.js : annonce unique à l\'ouverture (athlète et coach)');
  eq(/\['onb-overlay', 'nvt-ov', 'nvg-ov', 'retour-overlay'\]/.test(app), 'app.js : annonce jamais par-dessus l\'onboarding / la visite');
  eq(/action: 'envoyerRetour', type: _retourType, message: m, ecran: _ecranRetour\(\), version: _versionRetour\(\), plateforme: _plateformeRetour\(\)/.test(app), 'app.js : écran, version et plateforme envoyés');
  eq(/if \(tab !== 'reglages'\) _nvEcranRetour = TAB_LABELS\[tab\]/.test(app), 'app.js : dernier écran visité mémorisé (hors Réglages)');

  console.log(`retours : ${ok} OK / ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
