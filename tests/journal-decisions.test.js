/* JOURNAL DES DÉCISIONS (P1-1, 13/11/2026) — routes enregistrerPlan / getDecisions sur le VRAI index.ts
 * (contrôle d'accès compris : AUTH_ENFORCE=1, sessions signées réelles, requêtes HTTP).
 * Garde-fous du porteur : (1) athlète = session, coach jamais en écriture ; (2) semaine courante seulement ;
 * (3) une seule version par semaine, aucun doublon ; (4) rien sans données complètes ; (5) contrôle de forme, pas de recalcul. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const ROOT = path.join(__dirname, '..');
const T = fs.readFileSync(path.join(__dirname, 'e2e-parcours.test.js'), 'utf8');
eval(T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend')));
const SRC = fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'handler', 'index.ts'), 'utf8');

let STORE = null, INSERT_23505 = false, NIP = 0;
const ENV = { PEPPER: 'p', AUTH_ENFORCE: '1' };
function db() {
  return { from: (t) => { const q = makeEngine(STORE).from(t);
    if (t === 'decisions' && INSERT_23505) { q.insert = () => { const ko = { data: null, error: { code: '23505' } }; const th = { then: (r) => r(ko), select: () => th }; return th; }; }
    return q; }, rpc: () => ({ then: (r) => r({ data: null, error: null }) }), storage: { from: () => ({}) } };
}
let HANDLER = null, API = null;
{ let js = stripTypeScriptTypes(SRC).split('\n').filter((l) => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { signSession, _sessDepuisCache, _lundisCourants, fmtYMD, getLundi, minus };';
  const sb = { createClient: () => db(), webpush: { setVapidDetails() {}, sendNotification: async () => {} }, Deno: { env: { get: (k) => ENV[k] }, serve: (fn) => { HANDLER = fn; } },
    Response, Request, URL, URLSearchParams, TextEncoder, TextDecoder, crypto, atob, btoa, setTimeout, clearTimeout, fetch: async () => ({ ok: true, json: async () => ({}) }), console: { log() {}, error() {}, warn() {} } };
  vm.createContext(sb); vm.runInContext(js, sb); API = sb.__api; }

const U = 'https://x.supabase.co/functions/v1/smooth-service';
async function post(body, tok) { NIP++; const r = await HANDLER(new Request(U + (tok ? '?_t=' + encodeURIComponent(tok) : ''), { method: 'POST', headers: { 'Content-Type': 'text/plain', 'x-forwarded-for': '10.1.' + Math.floor(NIP / 250) + '.' + (NIP % 250) }, body: JSON.stringify(body) })); return { status: r.status, j: await r.json() }; }
async function get(params, tok) { NIP++; const q = new URLSearchParams(params); if (tok) q.set('_t', tok); const r = await HANDLER(new Request(U + '?' + q.toString(), { headers: { 'x-forwarded-for': '10.2.' + Math.floor(NIP / 250) + '.' + (NIP % 250) } })); return { status: r.status, j: await r.json() }; }

let ok = 0, ko = 0;
const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };
const graine = () => ({ athletes: [{ id: 'A1', login: '1001', coach_id: 'C1', prefs: {} }, { id: 'A2', login: '1002', coach_id: 'C2', prefs: {} }],
  coachs: [{ coach_id: 'C1', login: 'c1', prefs: {} }, { coach_id: 'C2', login: 'c2', prefs: {} }], decisions: [], login_echecs: [], quotas_jour: [] });
const lundi = API.fmtYMD(API.getLundi(new Date()));
const plan = (o) => Object.assign({ action: 'enregistrerPlan', semaine: lundi, regle_version: 'plan-2026-11-13', donnees_completes: true, actions: [
  { type: 'charge', exo: 'Développé incliné', titre: 'Développé incliné : proposé 75 kg (ou 70 kg)', raison: 'Pour revenir dans ta fourchette 6-10.', critere: { charge: 75, alt: 70, reps: 6 }, donnees_entree: { c: 80, r: 4, rpe: 10, n: 3 } },
  { type: 'series', exo: 'Belt squat', muscle: 'Quadriceps', titre: 'Quadriceps : 8 séries cette semaine', critere: { min: 8, add: 3, parSem: 5.5 } },
  { type: 'rpe', exo: 'Leg curl', titre: 'Leg curl : garde 40 kg, vise RPE 8', critere: { charge: 40 } },
] }, o || {});

(async () => {
  const tA1 = await API.signSession('a', 'A1'), tA2 = await API.signSession('a', 'A2'), tC1 = await API.signSession('c', 'C1'), tC2 = await API.signSession('c', 'C2');
  const reset = () => { STORE = graine(); INSERT_23505 = false; API._sessDepuisCache.clear(); };

  // (1)+(3) Athlète, plan valide → 3 lignes, athlète = session.
  reset();
  let r = await post(plan(), tA1);
  eq(r.status === 200 && r.j.success === true && r.j.enregistrees === 3, 'athlète : plan valide enregistré (3 actions)', r);
  eq(STORE.decisions.length === 3 && STORE.decisions.every((d) => d.athlete_id === 'A1' && d.semaine === lundi && d.regle_version === 'plan-2026-11-13'), 'lignes : athlète de la session, semaine, version', STORE.decisions);
  eq(STORE.decisions.find((d) => d.type_action === 'series').cle === 'Quadriceps', 'action « séries » : clé = muscle');
  eq(JSON.stringify(STORE.decisions[0].critere) === JSON.stringify({ charge: 75, alt: 70, reps: 6 }), 'critère de réussite enregistré tel quel');
  // (3) Renvoi / plan différent la même semaine → rien de plus (première version valide).
  r = await post(plan(), tA1);
  eq(r.j.success === true && r.j.deja === true && STORE.decisions.length === 3, 'même plan renvoyé → aucun doublon', r);
  r = await post(plan({ actions: [{ type: 'cible', exo: 'Rowing', titre: 'Rowing : vise 62,5 kg × 8', critere: { charge: 62.5, reps: 8 } }] }), tA1);
  eq(r.j.deja === true && STORE.decisions.length === 3 && !STORE.decisions.some((d) => d.cle === 'Rowing'), 'autre plan la même semaine → ignoré (la 1re version valide reste)', STORE.decisions.length);
  // (3) Envoi simultané : la contrainte UNIQUE de la base répond 23505 → traité comme « déjà enregistré ».
  reset(); INSERT_23505 = true;
  r = await post(plan(), tA1);
  eq(r.j.success === true && r.j.deja === true, 'conflit UNIQUE (envoi simultané) → « déjà enregistré », pas d\'erreur', r);

  // (1) Identité : jamais celle envoyée.
  reset();
  r = await post(plan({ athlete_id: 'A2' }), tA1);
  eq(r.status === 401 && !STORE.decisions.length, 'athlète A1 qui cite A2 → refusé (401), rien écrit', r);
  r = await post(plan({ athlete_id: 'A1' }), tA1);
  eq(r.j.success === true && STORE.decisions.every((d) => d.athlete_id === 'A1'), 'athlete_id = celui de la session → accepté (contrôle de cohérence)');
  reset();
  r = await post(plan({ athlete_id: 'A1' }), tC1);
  eq(r.status === 401 && !STORE.decisions.length, 'coach (même SON athlète) → refusé (401), rien écrit', r);
  r = await post(plan(), tC1);
  eq(r.status === 401 && !STORE.decisions.length, 'coach sans athlete_id → refusé (401)', r);
  r = await post(plan(), null);
  eq(r.status === 401 && !STORE.decisions.length, 'sans jeton → 401');

  // (4) Données incomplètes → rien.
  for (const v of [undefined, false, 'true', 1]) { reset(); const b = plan(); if (v === undefined) delete b.donnees_completes; else b.donnees_completes = v;
    r = await post(b, tA1); eq(r.j.success === false && !STORE.decisions.length, 'donnees_completes = ' + JSON.stringify(v) + ' → rien enregistré', r); }

  // (2) Semaine courante seulement.
  const dec = (n) => API.fmtYMD(API.minus(API.getLundi(new Date()), n));
  for (const [s, lib] of [[dec(7), 'semaine passée'], [dec(-7), 'semaine future'], [dec(-1), 'un mardi'], ['2026-13-40', 'date invalide'], ['', 'vide']]) {
    reset(); r = await post(plan({ semaine: s }), tA1);
    eq(r.j.success === false && !STORE.decisions.length, lib + ' (' + s + ') → refusé', r);
  }
  eq(API._lundisCourants(new Date('2026-11-15T23:30:00Z')).includes('2026-11-16'), 'dimanche 23 h 30 UTC = lundi 00 h 30 à Paris → lundi 16/11 accepté');
  eq(API._lundisCourants(new Date('2026-11-15T23:30:00Z')).includes('2026-11-09'), '… et lundi 09/11 (UTC) aussi, pas un autre');

  // (5) Contrôle de forme.
  const mauvais = [
    ['0 action', { actions: [] }], ['4 actions', { actions: [1, 2, 3, 4].map((i) => ({ type: 'cible', exo: 'E' + i, titre: 't', critere: {} })) }],
    ['type inconnu', { actions: [{ type: 'magie', exo: 'X', titre: 't' }] }],
    ['titre absent', { actions: [{ type: 'cible', exo: 'X' }] }], ['titre trop long', { actions: [{ type: 'cible', exo: 'X', titre: 'x'.repeat(201) }] }],
    ['exercice absent', { actions: [{ type: 'charge', titre: 't' }] }],
    ['critère inconnu', { actions: [{ type: 'cible', exo: 'X', titre: 't', critere: { pirate: 1 } }] }],
    ['critère hors bornes', { actions: [{ type: 'cible', exo: 'X', titre: 't', critere: { charge: 5000 } }] }],
    ['critère texte', { actions: [{ type: 'cible', exo: 'X', titre: 't', critere: { charge: '75' } }] }],
    ['action en double', { actions: [{ type: 'cible', exo: 'X', titre: 't' }, { type: 'cible', exo: 'X', titre: 't2' }] }],
    ['données d\'entrée trop longues', { actions: [{ type: 'cible', exo: 'X', titre: 't', donnees_entree: { a: 'x'.repeat(2100) } }] }],
    ['version absente', { regle_version: '' }], ['version invalide', { regle_version: 'Plan V1!' }],
  ];
  for (const [lib, o] of mauvais) { reset(); r = await post(plan(o), tA1); eq(r.j.success === false && !STORE.decisions.length, 'forme : ' + lib + ' → refusé, rien écrit', r.j); }
  reset(); r = await post(plan({ actions: [{ type: 'reprise', titre: 'Reprendre : 1 séance de muscu cette semaine', critere: { seances: 1 } }] }), tA1);
  eq(r.j.success === true && STORE.decisions[0].cle === 'reprise', 'action « reprise » (sans exercice) acceptée', r.j);

  // Lecture : athlète (le sien), son coach ; refus pour les autres.
  reset(); await post(plan(), tA1); STORE.decisions.push({ athlete_id: 'A2', semaine: lundi, type_action: 'cible', cle: 'X', titre: 'SECRET_A2', critere: {}, donnees_entree: {}, regle_version: 'v-1' });
  r = await get({ action: 'getDecisions', athlete_id: 'A1' }, tA1);
  eq(r.status === 200 && r.j.decisions.length === 3 && !JSON.stringify(r.j).includes('SECRET_A2'), 'athlète : lit SON journal (3), rien d\'un autre', r.j);
  r = await get({ action: 'getDecisions', athlete_id: 'A1' }, tC1);
  eq(r.status === 200 && r.j.decisions.length === 3, 'coach : lit le journal de SON athlète', r.status);
  r = await get({ action: 'getDecisions', athlete_id: 'A2' }, tA1); eq(r.status === 401, 'athlète A1 → journal de A2 : 401');
  r = await get({ action: 'getDecisions', athlete_id: 'A2' }, tC1); eq(r.status === 401, 'coach hors périmètre → 401');
  r = await get({ action: 'getDecisions', athlete_id: 'A1' }, null); eq(r.status === 401, 'lecture sans jeton → 401');

  // Journal en ajout seul + le serveur ne recalcule pas le plan.
  const ecr = [...SRC.matchAll(/from\('decisions'\)\.(insert|update|upsert|delete)/g)].map((m) => m[1]);
  eq(JSON.stringify(ecr.sort()) === JSON.stringify(['delete', 'insert']), 'écritures sur decisions : 1 insertion (enregistrerPlan) + 1 suppression (suppression du compte), aucune modification', ecr);
  const corps = SRC.slice(SRC.indexOf('async function handleEnregistrerPlan'), SRC.indexOf('async function handleGetDecisions'));
  eq(!/_rcLectureExos|_lv3|progression_par_exo|performances/.test(corps), 'enregistrerPlan ne recalcule pas le moteur (aucune lecture des séances)');

  console.log(`journal-decisions : ${ok} OK / ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
