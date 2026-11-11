/* =============================================================================
 * AUDIT P2.1 — droits d'accès ROUTE PAR ROUTE (10/11/2026). Lecture seule : ne modifie pas l'app.
 * Exécute le VRAI index.ts (AUTH_ENFORCE=1, sessions signées réelles) sur une base en mémoire NEUVE
 * pour chaque appel. Les données d'un autre athlète (A2, coach C2) sont marquées « SECRET_A2 » /
 * « SECRET_C2 ». Pour chaque route et chaque scénario on MESURE :
 *   - le statut HTTP (401 = refusé par authCheck) ;
 *   - une FUITE : marqueur présent dans la réponse, dans un e-mail / push sortant, ou lien signé
 *     vers un fichier de A2 ;
 *   - une MODIFICATION : ligne de A2 / C2 changée, supprimée ou ajoutée, fichier de A2 supprimé ;
 *   - une erreur serveur (500).
 * Sortie : scripts/audit-droits/resultats.json (brut) — la matrice est construite par matrice.js.
 * Usage : node scripts/audit-droits/audit.js
 * ========================================================================== */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const ROOT = path.join(__dirname, '..', '..');
const T = fs.readFileSync(path.join(ROOT, 'tests', 'e2e-parcours.test.js'), 'utf8');
eval(T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend')));
const ROUTES = JSON.parse(fs.readFileSync(path.join(__dirname, 'routes.json'), 'utf8'));

// ── Base de départ (identique à chaque appel) ─────────────────────────────────
const AUJ = new Date().toISOString().slice(0, 10);
function graine() {
  const s = {};
  s.athletes = [
    { id: 'A1', login: '1001', nom: 'Ana MINE_A1', coach_id: 'C1', sport: 'muscu', email: 'a1@test.fr', password_hash: 'x', prefs: {} },
    { id: 'A2', login: '1002', nom: 'Bob SECRET_A2', coach_id: 'C2', sport: 'muscu', email: 'secret_a2@test.fr', password_hash: 'x', prefs: { note: 'SECRET_A2' } },
    { id: 'A3', login: '1003', nom: 'Cid SECRET_A3 sans coach', coach_id: null, sport: 'muscu', email: 'a3@test.fr', password_hash: 'x', prefs: {} },
  ];
  s.coachs = [
    { coach_id: 'C1', login: 'coach1', nom: 'Coach Un', email: 'c1@test.fr', password_hash: 'x', prefs: {} },
    { coach_id: 'C2', login: 'coach2', nom: 'Coach SECRET_C2', email: 'secret_c2@test.fr', password_hash: 'x', prefs: { note: 'SECRET_C2' } },
  ];
  const pour = (aid, tag, cid) => {
    s.performances = (s.performances || []).concat([{ id: aid + 'p1', date: AUJ, semaine: '', seance_id: 'S_' + aid, nom: tag, athlete_id: aid, exercice: 'Squat ' + tag, muscle: 'Quadriceps', serie: 1, charge: 50, reps: 8, rpe: 8 }]);
    s.indicateurs = (s.indicateurs || []).concat([
      { id: aid + 'i1', date: AUJ, athlete_id: aid, seance_id: 'S_' + aid, cle: 'tonnage_total', valeur: '400 ' + tag, unite: '', source: 'app' },
      { id: aid + 'i2', date: AUJ, athlete_id: aid, seance_id: 'cardio_' + aid, cle: 'type_cardio', valeur: 'course ' + tag, unite: '', source: 'app' },
      { id: aid + 'i3', date: AUJ, athlete_id: aid, seance_id: 'pref', cle: 'coach_demande', valeur: cid === 'C1' ? 'C2' : 'C1', unite: '', source: 'app' },
      { id: aid + 'i4', date: AUJ, athlete_id: aid, seance_id: 'suivi_photo', cle: 'face', valeur: aid + '/photo.jpg', unite: '', source: 'app' },
      { id: aid + 'i5', date: AUJ, athlete_id: aid, seance_id: 'mensuration', cle: 'taille', valeur: '80 ' + tag, unite: 'cm', source: 'app' },
    ]);
    s.bien_etre = (s.bien_etre || []).concat([{ id: aid + 'b1', date: AUJ, seance_id: 'S_' + aid, athlete_id: aid, sommeil: 3, energie: 3, fatigue_musculaire: 2, douleur: 1, zone_douloureuse: '', ressenti_global: 3, note: 'note ' + tag }]);
    s.programme = (s.programme || []).concat([{ id: 'P_' + aid, athlete_id: aid, athlete_nom: tag, seance_id: 'Full ' + tag, exercice: 'Squat ' + tag, series_prevues: 3, reps_mini: 8, reps_max: 12 }]);
    s.planning = (s.planning || []).concat([{ id: 'PL_' + aid, athlete_id: aid, date: AUJ, seance_id: 'Full ' + tag, statut: 'prevu', source: 'app' }]);
    s.commentaires = (s.commentaires || []).concat([{ comment_id: 'CM_' + aid, athlete_id: aid, coach_id: cid, message: 'message ' + tag, auteur: 'coach', lu: false, date: AUJ }]);
    s.objectifs = (s.objectifs || []).concat([{ id: 'O_' + aid, athlete_id: aid, categorie: 'tech', description: 'obj ' + tag, statut: 'en_cours', date: AUJ }]);
    s.objectif = (s.objectif || []).concat([{ id: 'OB_' + aid, athlete_id: aid, objectif: 'obj ' + tag, strategie: '', seances_semaine: 3 }]);
    s.blessures = (s.blessures || []).concat([{ id: 'B_' + aid, athlete_id: aid, date: AUJ, type: 'entorse', localisation: 'cheville ' + tag, gravite: 2, statut: 'active' }]);
    s.contexte_athlete = (s.contexte_athlete || []).concat([{ id: 'CX_' + aid, athlete_id: aid, etat: 'deload', cle: 'k', date_debut: AUJ, note: 'ctx ' + tag }]);
    s.tests = (s.tests || []).concat([{ id: aid + 't1', date: AUJ, athlete_id: aid, cle: 'cmj ' + tag, valeur: 40, unite: 'cm' }]);
    s.push_subscriptions = (s.push_subscriptions || []).concat([{ athlete_id: aid, endpoint: 'https://push.test/' + tag, p256dh: 'k', auth: 'a' }]);
    s.native_push_tokens = (s.native_push_tokens || []).concat([{ athlete_id: aid, token: 'TOK_' + tag, platform: 'android' }]);
    s.pauses = (s.pauses || []).concat([{ athlete_id: aid, debut: AUJ, fin: AUJ, motif: tag }]);
    s.notes = (s.notes || []).concat([{ athlete_id: aid, date: AUJ, note: 'note ' + tag, seance_id: 'S_' + aid }]);
    s.activites = (s.activites || []).concat([{ athlete_id: aid, seance_id: 'S_' + aid, date: AUJ, type: 'muscu', titre: tag }]);
    s.alertes_traitees = (s.alertes_traitees || []).concat([{ coach_id: cid, athlete_id: aid, cle: 'absence|' + tag, semaine: AUJ }]);
  };
  pour('A1', 'MINE_A1', 'C1'); pour('A2', 'SECRET_A2', 'C2'); pour('A3', 'SECRET_A3', null);
  s.exercices = [{ exercice_id: '1', exercice: 'Squat', muscle: 'Quadriceps', statut: 'valide' }, { exercice_id: '2', exercice: 'Privé SECRET_C2', muscle: 'Dos', statut: 'en_attente', cree_par: 'coach:C2' }];
  s.password_reset_tokens = []; s.login_echecs = []; s.quotas_jour = []; s.envois_recus = []; s.jetons_admin = [];
  return s;
}
// Lignes « à A2 / C2 » (pour détecter une modification).
const estCible = (t, r) => r && (r.athlete_id === 'A2' || r.coach_id === 'C2' || r.id === 'A2' || (t === 'coachs' && r.coach_id === 'C2') || JSON.stringify(r).includes('SECRET_A2') || JSON.stringify(r).includes('SECRET_C2'));
const photo = (s) => { const o = {}; for (const t of Object.keys(s)) { const L = (s[t] || []).filter((r) => estCible(t, r)).map((r) => JSON.stringify(r)).sort(); if (L.length) o[t] = L; } return o; };
function diff(a, b) {
  const out = []; const ts = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const t of ts) { const x = a[t] || [], y = b[t] || []; if (JSON.stringify(x) !== JSON.stringify(y)) out.push(t + ' (' + x.length + '→' + y.length + (x.length === y.length ? ', modifiée' : '') + ')'); }
  return out;
}

// ── Chargement du vrai index.ts (une fois) ; la base est changée à chaque appel ─────────────
let STORE = null, SORTIES = [], STOCKAGE = [], NIP = 0;
const ENV = { PEPPER: 'poivre-audit', AUTH_ENFORCE: '1', CRON_SECRET: 'secret-cron-audit', RESEND_API_KEY: 'x', ANTHROPIC_API_KEY: 'x' };
function makeDb() {
  const st = {
    from: (b) => ({
      createSignedUploadUrl: async (p) => { STOCKAGE.push({ op: 'upload', b, p }); return { data: { path: p, signedUrl: 'https://st/' + p, token: 't' }, error: null }; },
      createSignedUrl: async (p) => { STOCKAGE.push({ op: 'url', b, p }); return { data: { signedUrl: 'https://st/' + p }, error: null }; },
      createSignedUrls: async (ps) => { (ps || []).forEach((p) => STOCKAGE.push({ op: 'url', b, p })); return { data: (ps || []).map((p) => ({ path: p, signedUrl: 'https://st/' + p })), error: null }; },
      remove: async (ps) => { (ps || []).forEach((p) => STOCKAGE.push({ op: 'remove', b, p })); return { data: [], error: null }; },
      list: async (p) => { STOCKAGE.push({ op: 'list', b, p }); return { data: [], error: null }; },
    }),
  };
  return {
    from: (t) => { const q = makeEngine(STORE).from(t); if (!q.ilike) { const L = q.like; q.ilike = function (c, v) { return L.call(this, c, String(v).toLowerCase()); }; } return q; },
    rpc: (name, a) => ({ then: (res) => {
      if (name === 'athlete_prefs_merge') { const r = STORE.athletes.find((x) => x.id === a.p_athlete_id); if (r) r.prefs = Object.assign({}, r.prefs, a.p_patch); return res({ data: r ? r.prefs : null, error: null }); }
      if (name === 'quota_reserver') return res({ data: 1, error: null });
      if (name === 'quota_rendre') return res({ data: 0, error: null });
      return res({ data: null, error: { code: 'PGRST202' } });
    } }),
    storage: st,
  };
}
let HANDLER = null, API = null;
{
  let js = stripTypeScriptTypes(fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
  js = js.split('\n').filter((l) => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { signSession, _sessDepuisCache };';
  const fakeFetch = async (url, init) => { SORTIES.push({ url: String(url), body: String((init && init.body) || '') }); return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: 'ok' }], id: 'x', access_token: 'x' }), text: async () => '' }; };
  const sb = { createClient: () => makeDb(), webpush: { setVapidDetails() {}, sendNotification: async (sub, p) => { SORTIES.push({ url: 'webpush:' + (sub && sub.endpoint), body: String(p || '') }); } },
    Deno: { env: { get: (k) => ENV[k] }, serve: (fn) => { HANDLER = fn; } },
    Response, Request, URL, URLSearchParams, TextEncoder, TextDecoder, crypto, atob, btoa, setTimeout, clearTimeout, fetch: fakeFetch, console: { log() {}, error() {}, warn() {} } };
  vm.createContext(sb); vm.runInContext(js, sb); API = sb.__api;
}

// ── Charge utile : chaque clé lue par le traitement, remplie pour une CIBLE ─────────────────
function charge(route, c) {
  const p = {};
  const A = c.aid, Cc = c.cid, R = c.res;   // R = athlète dont on vise les RESSOURCES (id de ligne, chemin…)
  const ID = { supprimerCommentaire: 'CM_' + R, deleteObjectifJoueur: 'O_' + R, saveObjectifJoueur: 'O_' + R, deleteBlessure: 'B_' + R, saveBlessure: 'B_' + R,
    movePlanning: 'PL_' + R, unplanPlanning: 'PL_' + R, cloreContexte: 'CX_' + R, marquerAlerteLue: 'absence|2026-11-02' };
  for (const k of route.cles) {
    if (k === 'athlete_id') p[k] = A;
    else if (k === 'coach_id') p[k] = Cc;
    else if (k === 'id') p[k] = ID[route.action] || ('X_' + R);
    else if (k === 'row_index') p[k] = 'P_' + R;
    else if (k === 'ids') p[k] = ['CM_' + R];
    else if (k === 'seance_id') p[k] = route.action.includes('Cardio') ? 'cardio_' + R : 'S_' + R;
    else if (k === 'path') p[k] = R + '/photo.jpg';
    else if (k === 'media_path') p[k] = R + '/media.jpg';
    else if (k === 'endpoint') p[k] = 'https://push.test/' + (R === 'A2' ? 'SECRET_A2' : 'MINE_A1');
    else if (k === 'token') p[k] = route.action === 'deleteNativePushToken' ? 'TOK_' + (R === 'A2' ? 'SECRET_A2' : 'MINE_A1') : 'jeton-inexistant';
    else if (k === 'login_athlete') p[k] = R === 'A2' ? '1002' : '1001';
    else if (k === 'coach_id_vu') p[k] = R === 'A2' ? 'C1' : 'C2';
    else if (k === 'date' || k === 'debut' || k === 'fin' || k === 'date_debut' || k === 'from') p[k] = AUJ;
    else if (k === 'to') p[k] = 'attaquant@pirate.fr';
    else if (k === 'consent') p[k] = true;
    else if (k === 'messages') p[k] = [{ role: 'user', content: 'Résume ses données' }];
    else if (k === 'images') p[k] = [{ data: 'AAAA', media_type: 'image/jpeg' }];
    else if (k === 'lignes') p[k] = [{ seance_id: 'X', exercice: 'Squat', series_prevues: 3 }];
    else if (k === 'entries') p[k] = [{ date: AUJ, pas: 1000, kcal: 2000 }];
    else if (k === 'zones') p[k] = ['dos'];
    else if (k === 'muscles') p[k] = ['Triceps'];
    else if (k === 'categories') p[k] = { Squat: 'gros' };
    else if (k === 'accepter') p[k] = true;
    else if (k === 'mode') p[k] = c.role === 'c' ? 'coach' : '';
    else if (k === 'secret') p[k] = 'mauvais-secret';
    else if (k === 'jeton') p[k] = '00000000-0000-0000-0000-000000000000';
    else if (k === 'cle') p[k] = route.action === 'savePref' ? 'onboarding_vu' : 'k';
    else if (k === 'valeur') p[k] = 1;
    else if (k === 'ancien_mdp' || k === 'mdp') p[k] = 'faux-mot-de-passe';
    else if (k === 'nouveau_mdp' || k === 'password') p[k] = 'nouveau123';
    else if (k === 'email') p[k] = 'nouvelle@adresse.fr';
    else if (k === 'reward_id') p[k] = 'badge_pionnier';
    else if (k === 'data' && route.action === 'updateSeance') p[k] = [[AUJ, '', 'S_' + R, 'x', A, 'Squat', 'Quadriceps', '1', 1, 60, 8, 8, 90, 480]];
    else if (k === 'stats' || k === 'vals' || k === 'resultat' || k === 'segments' || k === 'questionnaire' || k === 'mesures') p[k] = {};
    else p[k] = 'x';
  }
  if (route.action === 'saveSeance') { p.data = [[AUJ, '', 'S_' + R, 'x', A, 'Squat', 'Quadriceps', '1', 1, 60, 8, 8, 90, 480]]; p.envoi_id = 'e' + Math.random(); }
  if (route.action === 'saveCardio') { p.type_cardio = 'course'; p.duree = 30; p.seance_id = 'cardio_' + R; }
  if (['photoProfilUploadUrl', 'photoProfil', 'supprimerPhotoProfil'].includes(route.action)) { if (c.role === 'c' && !c.forcerAthlete) p.coach_id = Cc; else p.athlete_id = A; }
  return p;
}

async function appel(route, payload, tok) {
  STORE = graine(); SORTIES = []; STOCKAGE = []; API._sessDepuisCache.clear();   // base neuve = aucun mot de passe changé
  const avant = photo(STORE);
  const U = 'https://x.supabase.co/functions/v1/smooth-service';
  let req; NIP++; const H = { 'x-forwarded-for': '10.0.' + Math.floor(NIP / 250) + '.' + (NIP % 250) };   // une IP par appel : la limite de débit (60/min/IP) ne doit pas masquer le contrôle des droits
  if (route.methode === 'GET') { const q = new URLSearchParams({ action: route.action }); for (const [k, v] of Object.entries(payload)) q.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v)); if (tok) q.set('_t', tok); req = new Request(U + '?' + q.toString(), { headers: H }); }
  else req = new Request(U + (tok ? '?_t=' + encodeURIComponent(tok) : ''), { method: 'POST', headers: Object.assign({ 'Content-Type': 'text/plain' }, H), body: JSON.stringify({ action: route.action, ...payload }) });
  let status = 0, txt = '';
  try { const r = await HANDLER(req); status = r.status; txt = await r.text(); } catch (e) { status = 'EXC'; txt = String(e && e.stack || e); }
  const apres = photo(STORE);
  const fuites = [];
  { const m = txt.match(/SECRET_A[23]|SECRET_C2/g); if (m) fuites.push('réponse (' + [...new Set(m)].join(',') + ')'); }
  for (const o of SORTIES) if (/SECRET_A2|SECRET_C2/.test(o.body) || /secret_a2@|secret_c2@/.test(o.body)) fuites.push('sortie ' + o.url.replace(/^https?:\/\//, '').slice(0, 30));
  for (const s of STOCKAGE) if (s.op === 'url' && (/^A2\//.test(s.p) || /coachs\/C2\//.test(s.p))) fuites.push('lien fichier ' + s.p);
  const modifs = diff(avant, apres);
  for (const s of STOCKAGE) if ((s.op === 'remove' || s.op === 'upload') && (/^A2\//.test(s.p) || /coachs\/C2\//.test(s.p))) modifs.push('fichier ' + s.op + ' ' + s.p);
  let corps = null; try { corps = JSON.parse(txt); } catch (_) {}
  return { extrait: txt.slice(0, 220), status, exc: status === 'EXC' ? txt.slice(0, 300) : undefined, fuites, modifs, erreurApp: corps && (corps.erreur || corps.error) ? String(corps.erreur || corps.error).slice(0, 80) : null, succes: !!(corps && (corps.success === true || corps.ok === true)) };
}

(async () => {
  const tA1 = await API.signSession('a', 'A1'), tA2 = await API.signSession('a', 'A2'), tC1 = await API.signSession('c', 'C1');
  const PUBLIC = new Set(['ping', 'login', 'register', 'loginDispo', 'loginCoach', 'registerCoach', 'requestPasswordReset', 'resetPassword', 'confirmerEmail', 'exercices', 'inscriptionBeta', 'cronPushAlertes', 'cronResumes', 'cronResumesAuto', 'envelopperHachages']);
  const res = [];
  for (const r of ROUTES) {
    const aCoach = r.cles.includes('coach_id'), aAth = r.cles.includes('athlete_id');
    const out = { action: r.action, methode: r.methode, handler: r.handler, cles: r.cles, sessRole: r.sessRole, public: PUBLIC.has(r.action), sc: {} };
    // S0 sans jeton
    out.sc.sansJeton = await appel(r, charge(r, { aid: 'A1', cid: 'C1', res: 'A1', role: 'a' }), null);
    // S1 athlète A1 → données / ressources de A2 (coach C2)
    out.sc.athAversB = await appel(r, charge(r, { aid: 'A2', cid: 'C2', res: 'A2', role: 'a' }), tA1);
    // S2 coach C1 → athlète A2 (hors périmètre) / coach C2
    out.sc.coachHorsPerimetre = await appel(r, charge(r, { aid: 'A2', cid: 'C2', res: 'A2', role: 'c' }), tC1);
    // S7 ID manipulé : A1 cite SON athlete_id mais des ressources (ligne, chemin, séance…) de A2
    out.sc.idManipule = await appel(r, charge(r, { aid: 'A1', cid: 'C1', res: 'A2', role: 'a' }), tA1);
    // S3 athlète → route coach (avec le coach_id de SON coach)
    if (aCoach) out.sc.athSurRouteCoach = await appel(r, charge(r, { aid: 'A1', cid: 'C1', res: 'A1', role: 'a' }), tA1);
    // S4 coach → route athlète, sur SON athlète A1
    if (aAth) out.sc.coachSurRouteAthlete = await appel(r, Object.assign(charge(r, { aid: 'A1', cid: 'C1', res: 'A1', role: 'c', forcerAthlete: true }), aCoach ? { coach_id: 'C1' } : {}), tC1);
    // S5 propriétaire légitime (contrôle positif : la route n'est pas refusée à tort). Route qui cite un coach_id
    // (hors messagerie) = route coach → propriétaire = le coach C1 (de A1) ; sinon l'athlète A1.
    const ACA = ['saveCommentaire', 'envoyerMediaCoach', 'mediaUploadUrl', 'getCommentaires', 'marquerCommentairesLus'];
    const proprio = (aCoach && !ACA.includes(r.action)) ? tC1 : tA1;
    out.sc.proprietaire = await appel(r, charge(r, { aid: 'A1', cid: 'C1', res: 'A1', role: proprio === tC1 ? 'c' : 'a' }), proprio);
    if (aCoach && aAth && proprio === tC1) { const pl = charge(r, { aid: 'A1', cid: 'C1', res: 'A1', role: 'a' }); delete pl.coach_id; out.sc.proprietaireAthlete = await appel(r, pl, tA1); }
    // S8 ressource seule : on retire athlete_id / coach_id, on garde l'identifiant de la ressource de A2
    { const pl = charge(r, { aid: 'A2', cid: 'C2', res: 'A2', role: 'a' }); const avait = ('athlete_id' in pl) || ('coach_id' in pl); delete pl.athlete_id; delete pl.coach_id; if (avait) out.sc.ressourceSeule = await appel(r, pl, tA1); }
    // S6 ID inexistant (propriétaire légitime, ressources inconnues)
    out.sc.idInexistant = await appel(r, charge(r, { aid: aAth ? 'A1' : 'A1', cid: 'C1', res: 'ZZ_INEXISTANT', role: proprio === tC1 ? 'c' : 'a' }), proprio);
    res.push(out);
  }
  fs.writeFileSync(path.join(__dirname, 'resultats.json'), JSON.stringify(res, null, 1));
  const nFuite = res.filter((x) => Object.entries(x.sc).some(([k, v]) => !k.startsWith('proprietaire') && k !== 'idInexistant' && (v.fuites.length || v.modifs.length))).length;
  const st = {}; for (const x of res) for (const v of Object.values(x.sc)) st[v.status] = (st[v.status] || 0) + 1;
  console.log('statuts :', JSON.stringify(st));
  if (st['429']) throw new Error('429 présents : résultats invalides');
  console.log(res.length + ' routes testées ; routes avec fuite ou modification dans un scénario d\'attaque : ' + nFuite);
})().catch((e) => { console.error(e); process.exit(1); });
