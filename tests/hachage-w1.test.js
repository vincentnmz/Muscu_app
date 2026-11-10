/* Hachage lent des mots de passe « w1 » (10/11/2026 — docs/note-hachage-mdp-2026-11-10.md, option C).
 * VRAI code d'index.ts (WebCrypto réel : PBKDF2-SHA256 600 000 tours) sur une base en mémoire.
 * Vérifie : connexion s2 → OK puis converti en w1 (+ copie de secours s2) ; connexion w1 OK, mauvais mot
 * de passe refusé (tous formats) ; inscription / changement / réinitialisation par le coach → w1 ;
 * conversion des comptes existants par lots (jeton obligatoire, aucun hash renvoyé) ; RETOUR ARRIÈRE :
 * l'ancien serveur accepte les copies de secours ; migration absente → comportement d'avant (s2) ;
 * comptes de démo restent s2 ; sels aléatoires ; comparaison en temps constant. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const ROOT = path.join(__dirname, '..');
const T = fs.readFileSync(path.join(__dirname, 'e2e-parcours.test.js'), 'utf8');
eval(T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend')));

// Base simulée ; sansColonne = la migration n'est pas appliquée (password_hash_s2 inconnue → erreur 42703).
function makeDb(store, opts) {
  const base = makeEngine(store);
  return {
    from: (t) => {
      const q = base.from(t);
      if (!opts.sansColonne) return q;
      const refus = { then: (r) => r({ data: null, error: { code: '42703', message: 'column "password_hash_s2" does not exist' } }) };
      const chain = () => { const c = { eq: () => c, select: () => c, single: () => c, then: refus.then }; return c; };
      const up = q.update.bind(q), ins = q.insert.bind(q);
      q.update = (p) => (p && 'password_hash_s2' in p) ? chain() : up(p);
      q.insert = (p) => ((Array.isArray(p) ? p : [p]).some((x) => x && 'password_hash_s2' in x)) ? chain() : ins(p);
      return q;
    },
    rpc: () => ({ then: (r) => r({ data: null, error: { code: 'PGRST202' } }) }),
    storage: { from: () => ({ createSignedUrls: async () => ({ data: [] }), remove: async () => ({}) }) },
  };
}
function load(store, opts = {}, src) {
  let handler = null;
  let js = stripTypeScriptTypes(src || fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
  js = js.split('\n').filter((l) => !/^import\s/.test(l)).join('\n') + (src ? '' : '\n;this.__api = { hashSalted, verifyPwd, _egal, envelopperS2 };');
  const env = { PEPPER: 'poivre-de-test' };
  const sb = { createClient: () => makeDb(store, opts), webpush: { setVapidDetails() {}, sendNotification: async () => {} },
    Deno: { env: { get: (k) => env[k] }, serve: (fn) => { handler = fn; } },
    Response, Request, URL, URLSearchParams, TextEncoder, TextDecoder, crypto, atob, btoa, setTimeout, clearTimeout, fetch: async () => ({ ok: false, json: async () => ({}) }),
    console: { log() {}, error() {}, warn() {} } };
  vm.createContext(sb); vm.runInContext(js, sb);
  return { handler, api: sb.__api };
}
const { execSync } = require('child_process');
let SRC_ANCIEN = null;
try { const c = execSync('git log --format=%H -n 1 -- supabase/functions/handler/index.ts', { cwd: ROOT }).toString().trim();
  const old = execSync('git show ' + c + ':supabase/functions/handler/index.ts', { cwd: ROOT, maxBuffer: 64e6 }).toString();
  if (!old.includes('envelopperS2')) SRC_ANCIEN = old; } catch (_) {}
const U = 'https://x.supabase.co/functions/v1/smooth-service';
const post = (h, body) => h(new Request(U, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) })).then(async (r) => ({ status: r.status, j: await r.json() }));
const loginA = (h, login, pwd) => post(h, { action: 'login', login, password: pwd }).then((r) => r.j);
const loginC = (h, login, pwd) => post(h, { action: 'loginCoach', login, password: pwd }).then((r) => r.j);
const okA = (j) => !!(j && j.athlete && j.athlete.athlete_id);
const okC = (j) => !!(j && j.success && j.coach);
let nOK = 0, nKO = 0; const eq = (c, n, g) => { if (c) nOK++; else { nKO++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g).slice(0, 200) + ')' : '')); } };

(async () => {
  const { api } = load({});
  const s2 = (pwd, login) => api.hashSalted(pwd, login);
  const base = async () => ({
    athletes: [{ id: '1', login: '1001', nom: 'Ana', password_hash: await s2('secret1', '1001'), coach_id: 'C1', sport: 'muscu' },
               { id: '2', login: '1002', nom: 'Bob', password_hash: await s2('secret2', '1002'), coach_id: 'C1', sport: 'muscu' },
               { id: '3', login: '1003', nom: 'Cid', password_hash: await s2('secret1', '1003'), sport: 'muscu' }],
    coachs: [{ coach_id: 'C1', login: 'coach1', nom: 'Coach', password_hash: await s2('coachpw', 'coach1') }],
    indicateurs: [], performances: [], bien_etre: [], programme: [], objectif: [], login_echecs: [], jetons_admin: [], password_reset_tokens: [] });

  // 1) Connexion s2 → OK, puis converti en w1 avec copie de secours.
  { const st = await base(); const { handler } = load(st); const avant = st.athletes[0].password_hash;
    eq(!okA(await loginA(handler, '1001', 'mauvais')), 's2 : mauvais mot de passe refusé');
    eq(okA(await loginA(handler, '1001', 'secret1')), 's2 : bon mot de passe accepté');
    const a = st.athletes[0];
    eq(a.password_hash.startsWith('w1$600000$') && a.password_hash_s2 === avant, 'après connexion : w1 (600 000 tours) + copie s2 de secours', [a.password_hash.slice(0, 12), a.password_hash_s2 === avant]);
    eq(okA(await loginA(handler, '1001', 'secret1')), 'w1 : bon mot de passe accepté');
    eq(!okA(await loginA(handler, '1001', 'secret2')), 'w1 : mauvais mot de passe refusé');
    eq(okC(await loginC(handler, 'coach1', 'coachpw')) && st.coachs[0].password_hash.startsWith('w1$') && okC(await loginC(handler, 'coach1', 'coachpw')), 'coach : connexion s2 → w1 → reconnexion OK');
    eq(!okC(await loginC(handler, 'coach1', 'faux')), 'coach w1 : mauvais mot de passe refusé'); }

  // 2) Sels aléatoires : même mot de passe → hash w1 différents ; comparaison en temps constant.
  { const a = await api.envelopperS2('s2$abc'), b = await api.envelopperS2('s2$abc');
    eq(a !== b && a.split('$')[2] !== b.split('$')[2], 'sel aléatoire : deux enveloppes du même s2 diffèrent');
    eq(api._egal('abc', 'abc') && !api._egal('abc', 'abd') && !api._egal('abc', 'ab'), 'comparaison en temps constant correcte'); }

  // 3) Inscription / changement / réinitialisation par le coach → w1 + secours.
  { const st = await base(); const { handler } = load(st);
    await post(handler, { action: 'register', login: '2001', password: 'nouveau1', prenom: 'Nina', annees: 1, sexe: 'F', email: 'x@test.fr', ddn: '2000-01-01', taille: 170, poids: 60, sport: 'muscu', });
    const n = st.athletes.find((x) => x.login === '2001');
    eq(n && n.password_hash.startsWith('w1$') && n.password_hash_s2 === await s2('nouveau1', '2001'), 'inscription : w1 + secours s2', n && n.password_hash.slice(0, 4));
    eq(okA(await loginA(handler, '2001', 'nouveau1')), 'inscription : connexion OK');
    const r = await post(handler, { action: 'changePassword', athlete_id: '2', ancien_mdp: 'secret2', nouveau_mdp: 'changé22' });
    eq(r.j.success && st.athletes[1].password_hash.startsWith('w1$') && okA(await loginA(handler, '1002', 'changé22')) && !okA(await loginA(handler, '1002', 'secret2')), 'changement de mot de passe : w1, nouveau OK, ancien refusé', r.j);
    const rc = await post(handler, { action: 'changePasswordCoach', coach_id: 'C1', ancien_mdp: 'coachpw', nouveau_mdp: 'coachpw2' });
    eq(rc.j.success && st.coachs[0].password_hash.startsWith('w1$') && okC(await loginC(handler, 'coach1', 'coachpw2')), 'changement coach : w1, connexion OK', rc.j); }

  // 4) Conversion des comptes existants : jeton obligatoire, lots de 3, aucun hash renvoyé.
  { const st = await base(); st.athletes.push({ id: '4', login: '1004', nom: 'Dan', password_hash: await s2('secret4', '1004'), sport: 'muscu' });
    const { handler } = load(st);
    const r0 = await post(handler, { action: 'envelopperHachages', jeton: '00000000-0000-0000-0000-000000000000' });
    eq(r0.status === 401 && st.athletes.every((a) => a.password_hash.startsWith('s2$')), 'sans jeton valide : refusé (401), rien converti', r0);
    st.jetons_admin.push({ jeton: '11111111-2222-3333-4444-555555555555', action: 'envelopperHachages', expire: new Date(Date.now() - 1000).toISOString() });
    const r1 = await post(handler, { action: 'envelopperHachages', jeton: '11111111-2222-3333-4444-555555555555' });
    eq(r1.status === 401, 'jeton expiré : refusé', r1.status);
    st.jetons_admin.push({ jeton: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', action: 'envelopperHachages', expire: new Date(Date.now() + 600000).toISOString() });
    const avant = st.athletes.map((a) => a.password_hash).concat(st.coachs.map((c) => c.password_hash));
    const a = await post(handler, { action: 'envelopperHachages', jeton: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' });
    eq(a.j.success && a.j.traites === 3 && a.j.restants === 2, '1er lot : 3 convertis, 2 restants', a.j);
    const b = await post(handler, { action: 'envelopperHachages', jeton: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' });
    eq(b.j.traites === 2 && b.j.restants === 0, '2e lot : 2 convertis, 0 restant', b.j);
    const c = await post(handler, { action: 'envelopperHachages', jeton: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' });
    eq(c.j.traites === 0 && c.j.restants === 0, 'relancé : rien à faire (rejouable)', c.j);
    const txt = JSON.stringify([a.j, b.j, c.j]);
    eq(!/s2\$|w1\$/.test(txt) && !avant.some((h) => txt.includes(h.slice(3, 20))), 'aucun hash dans les réponses');
    eq(st.athletes.every((x) => x.password_hash.startsWith('w1$') && x.password_hash_s2.startsWith('s2$')) && st.coachs.every((x) => x.password_hash.startsWith('w1$')), 'tous les comptes en w1, copies de secours présentes');
    eq(okA(await loginA(handler, '1001', 'secret1')) && okA(await loginA(handler, '1002', 'secret2')) && okA(await loginA(handler, '1003', 'secret1')) && okA(await loginA(handler, '1004', 'secret4')) && okC(await loginC(handler, 'coach1', 'coachpw')), 'après conversion : chaque compte se connecte avec SON mot de passe');
    eq(!okA(await loginA(handler, '1003', 'secret2')), 'après conversion : mauvais mot de passe refusé');
    // 5) RETOUR ARRIÈRE : on remet les copies s2 → l'ANCIEN serveur accepte tout le monde.
    if (SRC_ANCIEN) {
      st.athletes.forEach((x) => { x.password_hash = x.password_hash_s2; }); st.coachs.forEach((x) => { x.password_hash = x.password_hash_s2; });
      const { handler: h0 } = load(st, {}, SRC_ANCIEN);
      eq(okA(await loginA(h0, '1001', 'secret1')) && okA(await loginA(h0, '1004', 'secret4')) && okC(await loginC(h0, 'coach1', 'coachpw')), 'retour arrière : l\'ancien serveur accepte les copies de secours');
      const st2 = await base(); const { handler: hn } = load(st2); await loginA(hn, '1001', 'secret1');
      const { handler: h1 } = load(st2, {}, SRC_ANCIEN);
      eq(!okA(await loginA(h1, '1001', 'secret1')), 'sans remettre les copies, l\'ancien serveur refuse un w1 (d\'où la colonne de secours)');
    } }

  // 6) Migration absente (colonne inconnue) : comportement d'AVANT, tout reste en s2, rien ne casse.
  { const st = await base(); const { handler } = load(st, { sansColonne: true });
    eq(okA(await loginA(handler, '1001', 'secret1')) && st.athletes[0].password_hash.startsWith('s2$'), 'sans migration : connexion OK, reste en s2');
    await post(handler, { action: 'register', login: '3001', password: 'nouveau3', prenom: 'Zoé', annees: 1, sexe: 'F', email: 'x@test.fr', ddn: '2000-01-01', taille: 170, poids: 60, sport: 'muscu', });
    const z = st.athletes.find((x) => x.login === '3001');
    eq(z && z.password_hash.startsWith('s2$') && !('password_hash_s2' in z) && okA(await loginA(handler, '3001', 'nouveau3')), 'sans migration : inscription en s2 comme avant, connexion OK', z && z.password_hash.slice(0, 3));
    const r = await post(handler, { action: 'changePassword', athlete_id: '2', ancien_mdp: 'secret2', nouveau_mdp: 'autre222' });
    eq(r.j.success && st.athletes[1].password_hash.startsWith('s2$') && okA(await loginA(handler, '1002', 'autre222')), 'sans migration : changement de mot de passe en s2 comme avant', r.j); }

  // 7) Ancien format (SHA-256 nu) : accepté puis converti en w1.
  { const st = await base(); const h = require('crypto').createHash('sha256').update('vieux12').digest('hex');
    st.athletes[2].password_hash = h; const { handler } = load(st);
    eq(okA(await loginA(handler, '1003', 'vieux12')) && st.athletes[2].password_hash.startsWith('w1$') && okA(await loginA(handler, '1003', 'vieux12')), 'ancien SHA-256 nu : accepté puis converti en w1'); }

  // 8) Format w1 invalide / altéré : refusé sans planter.
  { const st = await base(); st.athletes[0].password_hash = 'w1$12$xx$yy'; const { handler } = load(st);
    eq(!okA(await loginA(handler, '1001', 'secret1')), 'w1 altéré (tours invalides) : refusé'); }

  console.log(`hachage-w1 : ${nOK} OK / ${nKO} KO`);
  process.exit(nKO ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
