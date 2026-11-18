/* Canal « Message de Novalyz » (18/11/2026) — VRAI index.ts sur une base en mémoire.
 *  1. getAppData ne renvoie les messages qu'à la session de l'athlète (jamais au coach, au cron, à l'IA).
 *  2. lireMessagesNovalyz : marque lus SEULEMENT les messages de l'équipe de CET athlète.
 *  3. repondreMessageNovalyz : réservé à l'athlète, rangé en base (auteur athlete) + e-mail à l'équipe, plafond/jour.
 *  4. pushMessagesNovalyz : une notification par message, jamais deux (push_at posé avant l'envoi), rien renvoyé.
 *  5. Table absente (migration pas appliquée) : getAppData ne casse pas.
 *  6. Front : fil, pastille, carte Aujourd'hui (js/messages-novalyz.js) — rendu sans erreur. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const ROOT = path.join(__dirname, '..');
const T = fs.readFileSync(path.join(__dirname, 'e2e-parcours.test.js'), 'utf8');
// Moteur en mémoire de l'e2e, avec update(...).select() qui renvoie les lignes modifiées (comme PostgREST).
let SRC = T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend'));
SRC = SRC.replace("if (op === 'update') { base().filter(matches).forEach(r => Object.assign(r, payload)); return { data: null, error: null }; }",
  "if (op === 'update') { const m = base().filter(matches); m.forEach(r => Object.assign(r, payload)); return { data: m.map(r => ({ ...r })), error: null }; }");
eval(SRC);

let ok = 0, ko = 0;
const eq = (c, n, got) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (got !== undefined ? ' (got ' + JSON.stringify(got) + ')' : '')); } };

function charger(store, opts = {}) {
  let js = stripTypeScriptTypes(fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
  js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n');
  js += '\n;this.__api = { handleGetAppData, handleLireMessagesNovalyz, handleRepondreMessageNovalyz, handlePushMessagesNovalyz, _messagesNovalyz };';
  const base = makeEngine(store);
  const client = opts.sansTable ? { from: (t) => {
    if (t !== 'messages_novalyz') return base.from(t);
    const err = { data: null, error: { code: '42P01', message: 'relation does not exist' } };
    const z = new Proxy({}, { get: (_, k) => (k === 'then' ? (r) => r(err) : () => z) }); return z;
  } } : base;
  const sandbox = {
    createClient: () => client, webpush: { setVapidDetails() {}, sendNotification: async () => {} },
    Deno: { env: { get: () => undefined }, serve: () => {} },
    Response, Request, URLSearchParams, TextEncoder, TextDecoder, crypto, console, setTimeout, clearTimeout,
    fetch: async () => ({ ok: false, status: 0, text: async () => '', json: async () => ({}) }),
  };
  vm.createContext(sandbox); vm.runInContext(js, sandbox);
  sandbox.__push = []; sandbox.__mails = [];
  sandbox.notifyAthlete = async (id, p) => { sandbox.__push.push({ id, p }); return 1; };
  sandbox._envoyerEmail = async (to, sujet, html) => { sandbox.__mails.push({ to, sujet, html }); return true; };
  return sandbox;
}
const J = async (rp) => (await (await rp).json());
const now = new Date().toISOString();
const store = () => ({
  athletes: [{ id: '17', login: '2814', nom: 'Athlète Test', sport: 'muscu', annees: 1, prefs: {} }, { id: '18', login: '3000', nom: 'Autre', sport: 'muscu', annees: 1, prefs: {} }],
  messages_novalyz: [
    { id: 1, created_at: now, athlete_id: '17', auteur: 'novalyz', message: 'Salut ! Petit point sur le RPE.', lu_at: null, push_at: null },
    { id: 2, created_at: now, athlete_id: '18', auteur: 'novalyz', message: 'Message pour un autre athlète.', lu_at: null, push_at: null },
  ],
});

(async () => {
  // 1. Lecture : athlète seulement.
  let S = store(), A = charger(S).__api;
  let d = await J(A.handleGetAppData(new URLSearchParams({ athlete_id: '17', _sess_role: 'a' })));
  eq(Array.isArray(d.messages_novalyz) && d.messages_novalyz.length === 1 && d.messages_novalyz[0].id === 1, 'athlète : reçoit SES messages (1)', d.messages_novalyz);
  d = await J(A.handleGetAppData(new URLSearchParams({ athlete_id: '17', _sess_role: 'c' })));
  eq(Array.isArray(d.messages_novalyz) && d.messages_novalyz.length === 0, 'coach : aucun message de l\'équipe dans les données', d.messages_novalyz);
  d = await J(A.handleGetAppData(new URLSearchParams({ athlete_id: '17' })));
  eq(Array.isArray(d.messages_novalyz) && d.messages_novalyz.length === 0, 'appel interne (cron / IA) : aucun message', d.messages_novalyz);

  // 2. Marquer lu : seulement les siens.
  let r = await J(A.handleLireMessagesNovalyz({ _sessRole: 'c', _sessId: '9' }));
  eq(r.success === false && !S.messages_novalyz[0].lu_at, 'coach : ne peut pas marquer lu');
  r = await J(A.handleLireMessagesNovalyz({ _sessRole: 'a', _sessId: '17' }));
  eq(r.success && !!S.messages_novalyz[0].lu_at && !S.messages_novalyz[1].lu_at, 'athlète 17 : son message lu, pas celui de 18', S.messages_novalyz.map(m => m.lu_at));

  // 3. Réponse.
  let sb = charger(S); A = sb.__api;
  r = await J(A.handleRepondreMessageNovalyz({ _sessRole: 'c', _sessId: '9', message: 'Coucou' }));
  eq(r.success === false, 'coach : ne peut pas répondre à la place de l\'athlète');
  r = await J(A.handleRepondreMessageNovalyz({ _sessRole: 'a', _sessId: '17', message: 'ok' }));
  eq(r.success === false, 'réponse trop courte refusée');
  r = await J(A.handleRepondreMessageNovalyz({ _sessRole: 'a', _sessId: '17', athlete_id: '18', message: 'Merci, compris !' }));
  const rep = S.messages_novalyz.filter(m => m.auteur === 'athlete');
  eq(r.success && rep.length === 1 && rep[0].athlete_id === '17', 'réponse rangée chez l\'athlète de la SESSION (pas l\'athlete_id envoyé)', rep);
  eq(sb.__mails.length === 1 && /2814/.test(sb.__mails[0].sujet) && /Merci, compris/.test(sb.__mails[0].html), 'réponse envoyée par e-mail à l\'équipe (login cité)', sb.__mails.map(m => m.sujet));
  for (let i = 0; i < 12; i++) S.messages_novalyz.push({ id: 100 + i, created_at: new Date().toISOString(), athlete_id: '17', auteur: 'athlete', message: 'x' + i, lu_at: null, push_at: null });
  r = await J(A.handleRepondreMessageNovalyz({ _sessRole: 'a', _sessId: '17', message: 'Encore un message' }));
  eq(r.success === false && /beaucoup/.test(r.error || ''), 'plafond de 10 réponses / 24 h', r);

  // 4. Notifications : une seule fois par message.
  S = store(); sb = charger(S); A = sb.__api;
  r = await J(A.handlePushMessagesNovalyz());
  eq(r.success === true && Object.keys(r).length === 1, 'route publique : ne renvoie aucune donnée', r);
  eq(sb.__push.length === 2 && sb.__push.every(x => x.p.target === 'novalyz') && sb.__push.some(x => x.id === '17' && /RPE/.test(x.p.body)), '1 notification par message, cible « novalyz »', sb.__push);
  await J(A.handlePushMessagesNovalyz());
  eq(sb.__push.length === 2, 'deuxième appel : aucune nouvelle notification', sb.__push.length);
  S.messages_novalyz.push({ id: 3, created_at: new Date(Date.now() - 8 * 864e5).toISOString(), athlete_id: '17', auteur: 'novalyz', message: 'Vieux message', lu_at: null, push_at: null });
  await J(A.handlePushMessagesNovalyz());
  eq(sb.__push.length === 2, 'message de plus de 7 jours : pas de notification tardive', sb.__push.length);

  // 5. Table absente.
  A = charger(store(), { sansTable: true }).__api;
  d = await J(A.handleGetAppData(new URLSearchParams({ athlete_id: '17', _sess_role: 'a' })));
  eq(Array.isArray(d.messages_novalyz) && d.messages_novalyz.length === 0 && !d.erreur, 'table absente : getAppData répond, sans message');

  // 6. Front.
  const els = {};
  const el = (id) => (els[id] || (els[id] = { innerHTML: '', style: {}, value: '', scrollTop: 0, scrollHeight: 0, textContent: '' }));
  const fb = { dernierAppData: { messages_novalyz: [
    { id: 1, created_at: now, auteur: 'novalyz', message: 'Salut <b>Célia</b> ! RPE 10 = plus aucune rep possible.', lu_at: null },
    { id: 2, created_at: now, auteur: 'athlete', message: 'Merci', lu_at: null }] },
    document: { getElementById: el }, posts: [], _cvShow: (v) => { fb.vue = v; }, showToast: () => {}, majBadgeConseils: () => { fb.badge = (fb.badge || 0) + 1; } };
  fb.escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  fb._cdPost = async (o) => { fb.posts.push(o); return { success: true }; };
  vm.createContext(fb);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'messages-novalyz.js'), 'utf8'), fb);
  eq(fb.nvmNonLus() === 1, 'front : 1 message non lu (les réponses de l\'athlète ne comptent pas)');
  const th = fb.nvmThreadHtml();
  eq(/Novalyz/.test(th) && /cv-unread">1</.test(th) && /Toi : Merci/.test(th), 'front : fil « Novalyz » avec pastille 1 et dernier message', th);
  fb.nvmCarteAccueil();
  eq(els['tj-msg-novalyz'].style.display === 'block' && /Nouveau message de Novalyz/.test(els['tj-msg-novalyz'].innerHTML) && !/<b>Célia/.test(els['tj-msg-novalyz'].innerHTML), 'front : carte Aujourd\'hui (texte échappé)', els['tj-msg-novalyz'].innerHTML);
  fb.nvmOuvrir();
  eq(fb.vue === 'nv' && /&lt;b&gt;Célia/.test(els['cv-nv-msgs'].innerHTML) && /cv-me/.test(els['cv-nv-msgs'].innerHTML), 'front : fil affiché, message échappé, réponse à droite');
  eq(fb.posts.some(p => p.action === 'lireMessagesNovalyz') && fb.nvmNonLus() === 0 && els['tj-msg-novalyz'].style.display === 'none', 'front : ouverture → marqué lu, carte masquée');
  el('cv-nv-input').value = 'Bien reçu, merci !';
  await fb.nvmRepondre();
  eq(fb.posts.some(p => p.action === 'repondreMessageNovalyz' && p.message === 'Bien reçu, merci !') && el('cv-nv-input').value === '' && /Bien reçu/.test(els['cv-nv-msgs'].innerHTML), 'front : réponse envoyée et affichée');

  console.log('-'.repeat(70));
  console.log('messages Novalyz : ' + ok + ' OK / ' + ko + ' KO');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
