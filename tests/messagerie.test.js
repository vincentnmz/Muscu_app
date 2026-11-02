/* =============================================================================
 * Audit Messagerie athlète ↔ coach (01/11/2026) — vrais handlers, base en mémoire.
 * M1 heure de Paris · M2 coach du moment + fil filtré · M3 auteur = session ·
 * M4 suppression de ses seuls messages · M5 anti-doublon 5 s · M6 4 000 caractères.
 * ========================================================================== */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const T = fs.readFileSync(path.join(__dirname, 'e2e-parcours.test.js'), 'utf8');
eval(T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend')));
let ok = 0, ko = 0;
const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g).slice(0, 300) + ')' : '')); } };
const store = { athletes: [{ id: 'A1', nom: 'Léa Test', coach_id: 'C2' }], coachs: [{ coach_id: 'C1', nom: 'Ancien Coach' }, { coach_id: 'C2', nom: 'Nouveau Coach' }],
  commentaires: [{ comment_id: 1000000000001, athlete_id: 'A1', coach_id: 'C1', auteur: 'coach', message: 'ancien fil', date: '01/01/2026 10:00' }], native_push_tokens: [], push_subscriptions: [] };
const client = makeEngine(store);
client.storage = { from: () => ({ createSignedUrls: async () => ({ data: [] }), remove: async () => ({}) }) };
let js = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { handleSaveCommentaire, handleGetCommentaires, handleSupprimerCommentaire, _dateParis };';
const sb = { createClient: () => client, webpush: { setVapidDetails() {}, sendNotification: async () => {} }, Deno: { env: { get: () => undefined }, serve: () => {} },
  Response, Request, URLSearchParams, TextEncoder, TextDecoder, crypto, console, atob, btoa, setTimeout, clearTimeout, Intl, fetch: async () => ({ ok: false, json: async () => ({}) }) };
vm.createContext(sb); vm.runInContext(js, sb);
const A = sb.__api, J = async (r) => (await r).json();
(async () => {
  eq(A._dateParis(new Date('2026-10-15T19:25:00Z')) === '15/10/2026 21:25', 'M1 : 19:25 UTC → 21:25 à Paris (heure d\'été)', A._dateParis(new Date('2026-10-15T19:25:00Z')));
  eq(A._dateParis(new Date('2026-11-02T08:00:00Z')) === '02/11/2026 09:00', 'M1 : heure d\'hiver (+1 h)');
  // M3 : session athlète qui se déclare « coach » → enregistré comme athlète, coach et noms lus en base.
  await J(A.handleSaveCommentaire({ athlete_id: 'A1', message: 'Salut coach', auteur: 'coach', auteur_nom: 'Faux Nom', coach_id: 'C1', _sessRole: 'a' }));
  const m = store.commentaires[store.commentaires.length - 1];
  eq(m.auteur === 'athlete' && m.coach_id === 'C2' && m.auteur_nom === 'Léa' && m.coach_nom === 'Nouveau Coach', 'M2/M3 : auteur = session, coach du moment et noms depuis la base', m);
  // M5 : même message renvoyé aussitôt → ignoré.
  const n0 = store.commentaires.length;
  const r5 = await J(A.handleSaveCommentaire({ athlete_id: 'A1', message: 'Salut coach', _sessRole: 'a' }));
  eq(store.commentaires.length === n0 && r5.deja === true, 'M5 : doublon < 5 s ignoré');
  // M6 : trop long.
  const r6 = await J(A.handleSaveCommentaire({ athlete_id: 'A1', message: 'x'.repeat(4001), _sessRole: 'a' }));
  eq(r6.success === false && /4000/.test(r6.error), 'M6 : plus de 4 000 caractères refusé', r6);
  // M2 : l'athlète ne voit que la conversation avec son coach actuel (C2), pas l'ancien fil (C1).
  const g = await J(A.handleGetCommentaires(new URLSearchParams({ athlete_id: 'A1', _sess_role: 'a' })));
  eq(g.commentaires.length === 1 && g.commentaires[0].message === 'Salut coach', 'M2 : fil athlète = coach actuel uniquement', g.commentaires.map(c => c.message));
  const gc = await J(A.handleGetCommentaires(new URLSearchParams({ athlete_id: 'A1', coach_id: 'C2' })));
  eq(gc.commentaires.every(c => c.coach_id === 'C2'), 'M2 : le nouveau coach ne lit pas l\'ancienne conversation');
  // M4 : l'athlète ne peut pas supprimer un message du coach ; il peut supprimer le sien.
  const rKo = await J(A.handleSupprimerCommentaire({ id: 1000000000001, _sessRole: 'a' }));
  eq(rKo.success === false && store.commentaires.some(c => c.comment_id === 1000000000001), 'M4 : message du coach non supprimable par l\'athlète', rKo);
  const rOk = await J(A.handleSupprimerCommentaire({ id: m.comment_id, _sessRole: 'a' }));
  eq(rOk.success === true && !store.commentaires.some(c => c.comment_id === m.comment_id), 'M4 : l\'athlète supprime son propre message');
  console.log('-'.repeat(70)); console.log('messagerie : ' + ok + ' OK / ' + ko + ' KO'); if (ko) process.exitCode = 1;
})();
