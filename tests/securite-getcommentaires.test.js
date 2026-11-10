/* SÉCURITÉ — getCommentaires (faille 🔴 de l'audit P2.1, 10/11/2026, docs/audit-droits-routes-2026-11-10.md).
 * Avant : un athlète connecté qui appelait getCommentaires SANS athlete_id recevait les messages privés de
 * TOUS les athlètes (+ liens signés de leurs photos / vidéos). Reproduit en préprod (John → message de Lucas).
 * VRAI index.ts, AUTH_ENFORCE=1, sessions signées réelles, base en mémoire.
 * John et Lucas ont le MÊME coach (comme en préprod) : le filtre coach ne suffit pas, il faut l'athlète. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const ROOT = path.join(__dirname, '..');
const T = fs.readFileSync(path.join(__dirname, 'e2e-parcours.test.js'), 'utf8');
eval(T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend')));

let STORE = null, LIENS = [];
const base = () => ({
  athletes: [{ id: 'JOHN', login: '0101', nom: 'John', coach_id: 'JIM' }, { id: 'LUCAS', login: '9035', nom: 'Lucas', coach_id: 'JIM' }, { id: 'SOLO', login: '7777', nom: 'Solo', coach_id: null }],
  coachs: [{ coach_id: 'JIM', login: '0202', nom: 'jim' }, { coach_id: 'AUTRE', login: '0303', nom: 'autre' }],
  commentaires: [
    { comment_id: 1, athlete_id: 'JOHN', coach_id: 'JIM', message: 'pour John', auteur: 'coach', lu: false, date: '2026-11-10' },
    { comment_id: 2, athlete_id: 'LUCAS', coach_id: 'JIM', message: 'PRIVE Lucas', auteur: 'coach', lu: false, date: '2026-11-10', media_path: 'LUCAS/photo-privee.jpg', media_type: 'image' },
    { comment_id: 3, athlete_id: 'SOLO', coach_id: 'AUTRE', message: 'PRIVE Solo', auteur: 'athlete', lu: false, date: '2026-11-10' },
    { comment_id: 4, athlete_id: 'JOHN', coach_id: 'JIM', message: 'photo de John', auteur: 'athlete', lu: false, date: '2026-11-10', media_path: 'JOHN/ma-photo.jpg', media_type: 'image' },
  ],
  login_echecs: [],
});
const client = {
  from: (t) => makeEngine(STORE).from(t),
  rpc: () => ({ then: (r) => r({ data: null, error: { code: 'PGRST202' } }) }),
  storage: { from: () => ({ createSignedUrls: async (ps) => { LIENS.push(...ps); return { data: ps.map((p) => ({ path: p, signedUrl: 'https://st/' + p })), error: null }; } }) },
};
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
const get = async (qs, tok) => {
  STORE = base(); LIENS = [];
  const r = await handler(new Request('https://x/functions/v1/smooth-service?action=getCommentaires' + qs + (tok ? '&_t=' + encodeURIComponent(tok) : ''), { headers: { 'x-forwarded-for': '10.9.0.' + (++ip) } }));
  let j = null; try { j = await r.json(); } catch (_) {}
  const L = (j && j.commentaires) || [];
  return { status: r.status, ids: L.map((c) => c.athlete_id), msgs: L.map((c) => c.message).join('|'), liens: LIENS.slice(), media: L.map((c) => c.media_url).filter(Boolean).join('|') };
};
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };
const rienDesAutres = (r) => !r.ids.some((i) => i !== 'JOHN') && !/PRIVE/.test(r.msgs) && !r.liens.some((p) => !p.startsWith('JOHN/')) && !/LUCAS|SOLO/.test(r.media);

(async () => {
  const tJohn = await sb.__api.signSession('a', 'JOHN'), tJim = await sb.__api.signSession('c', 'JIM'), tAutre = await sb.__api.signSession('c', 'AUTRE');

  // Test 1 — John SANS athlete_id → uniquement ses messages, aucun lien de média d'un autre.
  { const r = await get('', tJohn);
    eq(r.status === 200 && r.ids.length === 2 && rienDesAutres(r), '1. John sans athlete_id → uniquement ses 2 messages (avant : tous)', r);
    eq(r.liens.length === 1 && r.liens[0] === 'JOHN/ma-photo.jpg', '1. aucun lien signé vers la photo de Lucas', r.liens); }

  // Test 2 — John cible Lucas → refus (convention : 401), jamais de données de Lucas.
  { const r = await get('&athlete_id=LUCAS', tJohn);
    eq(r.status === 401 && r.ids.length === 0 && !r.liens.length, '2. John → athlete_id=Lucas : refusé (401), rien de Lucas', r); }

  // Test 3 — John sur ses propres données : comportement légitime inchangé.
  { const r = await get('&athlete_id=JOHN', tJohn);
    eq(r.status === 200 && r.ids.length === 2 && rienDesAutres(r) && /pour John/.test(r.msgs) && /JOHN\/ma-photo/.test(r.media), '3. John → John : ses messages + le lien de SA photo', r); }

  // Test 4 — coach autorisé (jim) sur ses athlètes : accès conservé.
  { const r = await get('&athlete_id=LUCAS', tJim);
    eq(r.status === 200 && r.ids.length === 1 && r.ids[0] === 'LUCAS' && /LUCAS\/photo-privee/.test(r.media), '4. coach jim → Lucas : accès conservé (message + média)', r);
    const t = await get('', tJim);
    eq(t.status === 200 && t.ids.length === 3 && !t.ids.includes('SOLO'), '4. coach jim sans athlete_id : les conversations de SES athlètes seulement (comme avant)', t); }

  // Test 5 — coach hors périmètre → refus.
  { const r = await get('&athlete_id=LUCAS', tAutre);
    eq(r.status === 401 && r.ids.length === 0, '5. coach « autre » → Lucas (non rattaché) : refusé (401)', r);
    const c = await get('&coach_id=JIM', tAutre);
    // coach_id est remplacé par celui de la session (comportement existant) : il ne voit que SES conversations.
    eq(!c.ids.includes('JOHN') && !c.ids.includes('LUCAS'), '5. coach « autre » → coach_id=jim : jamais les conversations de jim', c); }

  // Test 6 — aucune variante d'identifiant ne provoque de lecture globale.
  for (const [lib, qs] of [['absent', ''], ['vide', '&athlete_id='], ['espaces', '&athlete_id=%20%20'], ['null', '&athlete_id=null'], ['undefined', '&athlete_id=undefined'], ['invalide', '&athlete_id=%27%20OR%201%3D1'], ['coach_id vide', '&coach_id='], ['coach_id d\'un autre', '&coach_id=AUTRE'], ['coach_id de son coach', '&coach_id=JIM'], ['les deux vides', '&athlete_id=&coach_id=']]) {
    const r = await get(qs, tJohn);
    eq(rienDesAutres(r), '6. John, identifiant ' + lib + ' → jamais les messages d\'un autre', r);
  }
  // Sans session : refus.
  { const r = await get('', null); eq(r.status === 401 && r.ids.length === 0, 'sans jeton : refusé (401)', r); }

  console.log(`securite-getcommentaires : ${ok} OK / ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
