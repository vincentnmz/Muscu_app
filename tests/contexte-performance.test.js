/* =============================================================================
 * Audit Contexte de performance (01/11/2026) — vrai backend sur base en mémoire :
 *  X7 poser un état REMPLACE celui en cours (double appui = pas de doublon) ;
 *  X9 « Terminer » clôt aussi un état qui a une date de fin ;
 *  X3 intensification : fatigue 4/5 ne met plus en Vigilance (5/5 oui).
 * ========================================================================== */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const T = fs.readFileSync(path.join(__dirname, 'e2e-parcours.test.js'), 'utf8');
eval(T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend')));
let ok = 0, ko = 0;
const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };
const store = { contexte_athlete: [] };
const client = makeEngine(store);
let js = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { handleSaveContexte, handleCloreContexte, evaluerEtatAthlete, fmtYMD, minus };';
const sb = { createClient: () => client, webpush: { setVapidDetails() {}, sendNotification: async () => {} }, Deno: { env: { get: () => 'x' }, serve: () => {} },
  Response, Request, URLSearchParams, TextEncoder, TextDecoder, crypto, console, setTimeout, clearTimeout, fetch: async () => ({}) };
vm.createContext(sb); vm.runInContext(js, sb);
const A = sb.__api, J = async (r) => (await r).json();
(async () => {
  const auj = A.fmtYMD(new Date()), fin = A.fmtYMD(A.minus(new Date(), -14));
  const body = { athlete_id: '2', etat: 'retour_vacances', date_debut: auj, date_fin: fin, source: 'coach' };
  for (let i = 0; i < 6; i++) await J(A.handleSaveContexte(body));
  eq(store.contexte_athlete.length === 1, 'X7 : 6 appuis sur « Appliquer » → 1 seule ligne', store.contexte_athlete.length);
  await J(A.handleSaveContexte({ athlete_id: '2', etat: 'deload', date_debut: auj, date_fin: A.fmtYMD(A.minus(new Date(), -7)) }));
  eq(store.contexte_athlete.length === 1 && store.contexte_athlete[0].etat === 'deload', 'X7 : un nouvel état le même jour remplace le précédent', store.contexte_athlete.map(r => r.etat));
  // État commencé il y a 3 jours, avec date de fin → « Terminer » doit le clore (fin = hier).
  store.contexte_athlete = [{ id: 'c1', athlete_id: '3', etat: 'retour_blessure', date_debut: A.fmtYMD(A.minus(new Date(), 3)), date_fin: A.fmtYMD(A.minus(new Date(), -18)), source: 'coach' }];
  const r = await J(A.handleCloreContexte({ athlete_id: '3' }));
  eq(r.success === true && store.contexte_athlete[0].date_fin === A.fmtYMD(A.minus(new Date(), 1)), 'X9 : « Terminer » clôt un état qui a une date de fin (fin = hier)', [r, store.contexte_athlete[0].date_fin]);
  // X3 : intensification.
  const base = { acwr: 1.0, acwrFiable: true, seances7: 3, douleur: 0, sommeil: 4, courbatures: null, injStatut: null, q: { jours: 60, wellnessN: 5, hasCharge: true } };
  const n4 = A.evaluerEtatAthlete(Object.assign({}, base, { fatigue: 4, ctxEtat: 'saison_normale' }));
  const i4 = A.evaluerEtatAthlete(Object.assign({}, base, { fatigue: 4, ctxEtat: 'intensification' }));
  const i5 = A.evaluerEtatAthlete(Object.assign({}, base, { fatigue: 5, ctxEtat: 'intensification' }));
  eq(n4.niveau === 1 && i4.niveau === 0 && i5.niveau === 1, 'X3 : fatigue 4/5 → Vigilance en saison normale, pas en intensification ; 5/5 → Vigilance', [n4.niveau, i4.niveau, i5.niveau]);
  console.log('-'.repeat(70)); console.log('contexte de performance : ' + ok + ' OK / ' + ko + ' KO'); if (ko) process.exitCode = 1;
})();
