/* SÉCURITÉ / RÈGLE MÉTIER — repondreDemandeCoach (🟠 audit P2.1, règle validée par le porteur le 11/11).
 * « Une demande de coach appartient à l'athlète. Seul l'athlète peut l'accepter ou la refuser. Un coach, même
 *   le coach actuel de l'athlète, ne peut pas y répondre. L'athlète répond à la demande du coach_id_vu affiché.
 *   Un athlète déjà rattaché à un coach doit d'abord s'en détacher avant d'accepter une nouvelle demande. »
 * Avant : le coach actuel pouvait accepter à la place de l'athlète (transfert de l'athlète et de ses données à un
 * autre coach) ou refuser ; coach_id_vu facultatif ; un athlète déjà coaché pouvait accepter.
 * VRAI index.ts, AUTH_ENFORCE=1, sessions signées. Refus métier = HTTP 200 {success:false} (convention de la route). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const ROOT = path.join(__dirname, '..');
const T = fs.readFileSync(path.join(__dirname, 'e2e-parcours.test.js'), 'utf8');
eval(T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend')));

let STORE = null;
const DEM = (aid, cid) => ({ athlete_id: aid, date: '2026-11-11', seance_id: 'pref', cle: 'coach_demande', valeur: cid, unite: '', source: 'app' });
const base = () => ({
  athletes: [
    { id: 'A', login: '1001', nom: 'Libre', coach_id: null },
    { id: 'B', login: '1002', nom: 'Suivi', coach_id: 'C1' },
    { id: 'C', login: '1003', nom: 'Autre', coach_id: 'C1' },
  ],
  coachs: [{ coach_id: 'C1', login: '2001', nom: 'Coach actuel' }, { coach_id: 'C2', login: '2002', nom: 'Coach demandeur' }],
  indicateurs: [DEM('A', 'C2'), DEM('B', 'C2')],
  push_subscriptions: [], native_push_tokens: [], login_echecs: [],
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
const post = async (action, tok, extra, garder) => {
  if (!garder) STORE = base();
  const r = await handler(new Request('https://x/functions/v1/smooth-service' + (tok ? '?_t=' + encodeURIComponent(tok) : ''), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8', 'x-forwarded-for': '10.4.0.' + (++ip) }, body: JSON.stringify(Object.assign({ action }, extra)) }));
  let j = null; try { j = await r.json(); } catch (_) {}
  return { status: r.status, j };
};
const get = async (qs, tok, garder) => {
  if (!garder) STORE = base();
  const r = await handler(new Request('https://x/functions/v1/smooth-service?' + qs + (tok ? '&_t=' + encodeURIComponent(tok) : ''), { headers: { 'x-forwarded-for': '10.4.1.' + (++ip) } }));
  let j = null; try { j = await r.json(); } catch (_) {}
  return { status: r.status, j };
};
const rep = (tok, extra, garder) => post('repondreDemandeCoach', tok, extra, garder);
const coach = (id) => (STORE.athletes.find((a) => a.id === id) || {}).coach_id;
const dem = (id) => (STORE.indicateurs.find((r) => r.athlete_id === id && r.cle === 'coach_demande') || {}).valeur || null;
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };

(async () => {
  const tA = await sb.__api.signSession('a', 'A'), tB = await sb.__api.signSession('a', 'B'), tC = await sb.__api.signSession('a', 'C');
  const tC1 = await sb.__api.signSession('c', 'C1'), tC2 = await sb.__api.signSession('c', 'C2');

  // ── L'athlète décide (légitime) ──
  { const r = await rep(tA, { athlete_id: 'A', accepter: true, coach_id_vu: 'C2' }); eq(r.status === 200 && r.j.success === true && r.j.accepte === true && coach('A') === 'C2' && !dem('A'), 'athlète sans coach accepte → rattaché au coach demandeur, demande supprimée', r.j); }
  { const r = await rep(tA, { athlete_id: 'A', accepter: false, coach_id_vu: 'C2' }); eq(r.j.success === true && r.j.accepte === false && coach('A') === null && !dem('A'), 'athlète sans coach refuse → demande supprimée, toujours sans coach', r.j); }

  // ── ★ Le coach actuel ne peut ni accepter ni refuser ──
  { const r = await rep(tC1, { athlete_id: 'B', accepter: true, coach_id_vu: 'C2' }); eq(r.status === 200 && r.j.success === false && coach('B') === 'C1' && dem('B') === 'C2', '★ coach actuel accepte pour son athlète → refus 200, coach inchangé, demande intacte', r.j); }
  { const r = await rep(tC1, { athlete_id: 'B', accepter: false, coach_id_vu: 'C2' }); eq(r.status === 200 && r.j.success === false && coach('B') === 'C1' && dem('B') === 'C2', '★ coach actuel refuse pour son athlète → refus 200, demande intacte', r.j); }
  { const r = await rep(tC1, { athlete_id: 'B', accepter: true, coach_id_vu: 'C2', _sessRole: 'a', _sessId: 'B' }); eq(r.j.success === false && coach('B') === 'C1' && dem('B') === 'C2', 'coach actuel + faux rôle athlète (_sessRole/_sessId) → ignorés, refus', r.j); }

  // ── Le coach demandeur ne peut pas accepter sa propre demande ──
  { const r = await rep(tC2, { athlete_id: 'A', accepter: true, coach_id_vu: 'C2' }); eq(r.status === 401 && coach('A') === null && dem('A') === 'C2', 'coach demandeur accepte sa demande → 401, rien ne change', r.status); }
  { const r = await rep(tC2, { athlete_id: 'B', accepter: true, coach_id_vu: 'C2' }); eq(r.status === 401 && coach('B') === 'C1' && dem('B') === 'C2', 'coach demandeur sur l\'athlète d\'un autre → 401', r.status); }

  // ── Autres comptes / sans session ──
  { const r = await rep(tC, { athlete_id: 'A', accepter: true, coach_id_vu: 'C2' }); eq(r.status === 401 && coach('A') === null && dem('A') === 'C2', 'un autre athlète répond pour A → 401', r.status); }
  { const r = await rep(tC, { athlete_id: 'C', accepter: true, coach_id_vu: 'C2', _sessId: 'A' }); eq(r.j.success === false && coach('A') === null && dem('A') === 'C2', 'faux _sessId : ignoré, rien ne change chez A', r.j); }
  { const r = await rep(null, { athlete_id: 'A', accepter: true, coach_id_vu: 'C2' }); eq(r.status === 401 && coach('A') === null && dem('A') === 'C2', 'sans session → 401, rien ne change', r.status); }

  // ── coach_id_vu obligatoire ──
  { const r = await rep(tA, { athlete_id: 'A', accepter: true }); eq(r.j.success === false && coach('A') === null && dem('A') === 'C2', 'coach_id_vu absent → refus, demande intacte', r.j); }
  { const r = await rep(tA, { athlete_id: 'A', accepter: true, coach_id_vu: 'C1' }); eq(r.j.success === false && /La demande a changé/.test(r.j.error) && coach('A') === null && dem('A') === 'C2', 'coach_id_vu différent → « La demande a changé », demande intacte', r.j); }
  { const r = await rep(tA, { athlete_id: 'A', accepter: false }); eq(r.j.success === false && dem('A') === 'C2', 'refus sans coach_id_vu → refusé aussi, demande intacte', r.j); }

  // ── ★ Athlète déjà coaché : quitter d'abord ──
  { const r = await rep(tB, { athlete_id: 'B', accepter: true, coach_id_vu: 'C2' }); eq(r.status === 200 && r.j.success === false && /Quitte d'abord/.test(r.j.error) && coach('B') === 'C1' && dem('B') === 'C2', '★ athlète déjà coaché accepte → refus « Quitte d\'abord », coach et demande inchangés', r.j); }
  { const r = await rep(tB, { athlete_id: 'B', accepter: false, coach_id_vu: 'C2' }); eq(r.j.success === true && r.j.accepte === false && coach('B') === 'C1' && !dem('B'), 'athlète déjà coaché refuse → OK (refuser reste possible), coach inchangé', r.j); }
  { STORE = base();
    const d = await post('detacherCoach', tB, { athlete_id: 'B' }, true);
    const r = await rep(tB, { athlete_id: 'B', accepter: true, coach_id_vu: 'C2' }, true);
    eq(d.j && d.j.success !== false && r.j.success === true && coach('B') === 'C2' && !dem('B'), 'après s\'être détaché, l\'athlète accepte → rattaché au nouveau coach', { d: d.j, r: r.j, coach: coach('B') }); }

  // ── Divers ──
  { const r = await rep(tC, { athlete_id: 'C', accepter: true, coach_id_vu: 'C2' }); eq(r.j.success === false && /Aucune demande/.test(r.j.error) && coach('C') === 'C1', 'aucune demande en attente → refus, rien ne change', r.j); }
  { STORE = base(); STORE.indicateurs = [DEM('A', 'FANTOME')];
    const r = await rep(tA, { athlete_id: 'A', accepter: true, coach_id_vu: 'FANTOME' }, true); eq(r.j.success === false && coach('A') === null, 'coach demandeur supprimé entre-temps → refus, athlète sans coach', r.j); }

  // ── Non-régression lierAthlete ──
  { const r = await get('action=lierAthlete&coach_id=C2&login_athlete=1002', tC2); eq(r.j && r.j.success === false && r.j.deja_autre === true && dem('B') === 'C2' && STORE.indicateurs.length === 2, 'lierAthlete : pas de demande vers l\'athlète d\'un autre coach (inchangé)', r.j); }
  { STORE = base(); STORE.indicateurs = [];
    const r = await get('action=lierAthlete&coach_id=C1&login_athlete=1001', tC1, true); eq(r.j && r.j.success === true && dem('A') === 'C1' && coach('A') === null, 'lierAthlete : demande créée pour un athlète sans coach, rien n\'est rattaché tant qu\'il n\'a pas accepté', r.j); }

  console.log(`securite-repondredemandecoach : ${ok} OK / ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
