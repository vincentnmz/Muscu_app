/* Anti-doublon des envois de séance — table envois_recus (10/11/2026, audit P1 étape 1).
 * VRAI code d'index.ts sur une base en mémoire qui SIMULE la contrainte UNIQUE
 * (athlete_id, envoi_id) comme Postgres (erreur 23505).
 *  1. Deux envois SIMULTANÉS avec le même envoi_id → une seule séance écrite.
 *     (Même scénario rejoué sur l'ANCIEN serveur, version précédente du dépôt : il écrivait
 *      la séance deux fois → preuve que le test détecte bien le défaut corrigé.)
 *  2. Renvoi après succès → « déjà reçu », rien de réécrit.
 *  3. Échec d'écriture de la séance → réservation annulée → le renvoi passe.
 *  4. Réservation bloquée « en cours » > 3 min → reprise ; < 3 min → erreur temporaire (l'app réessaie).
 *  5. Ancien marqueur (indicateurs) seul → « déjà reçu » (données d'avant la migration).
 *  6. Table absente (migration pas appliquée) → ancien mécanisme, sans casse.
 *  7. Suppression de la séance → l'envoi_id est libéré (comme avant).
 *  8. Séance sans envoi_id → enregistrée normalement. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { execSync } = require('child_process');
const { stripTypeScriptTypes } = require('node:module');
const ROOT = path.join(__dirname, '..');
const T = fs.readFileSync(path.join(__dirname, 'e2e-parcours.test.js'), 'utf8');
eval(T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend')));

// Base en mémoire + contrainte UNIQUE (athlete_id, envoi_id) sur envois_recus, update ... select() renvoie les lignes.
function makeDb(store, opts = {}) {
  const base = makeEngine(store);
  const wrap = (t) => {
    const q = base.from(t);
    if (t === 'performances' && opts.perfFailOnce) {
      const ins = q.insert; q.insert = (p) => { if (opts.perfFailOnce) { opts.perfFailOnce = false; return { then: (r) => r({ data: null, error: { message: 'panne simulée' } }) }; } return ins(p); };
    }
    if (t !== 'envois_recus') return q;
    if (opts.sansTable) { const err = { data: null, error: { code: '42P01', message: 'relation "envois_recus" does not exist' } }; const z = new Proxy({}, { get: (_, k) => (k === 'then' ? (r) => r(err) : () => z) }); return z; }
    const ins = q.insert, upd = q.update;
    q.insert = (p) => {
      const rows = Array.isArray(p) ? p : [p];
      return { then: (res) => {
        const tab = store.envois_recus || (store.envois_recus = []);
        for (const r of rows) if (tab.some((x) => String(x.athlete_id) === String(r.athlete_id) && x.envoi_id === r.envoi_id)) return res({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "envois_recus_athlete_envoi_key"' } });
        const now = new Date().toISOString();
        for (const r of rows) tab.push(Object.assign({ statut: 'en_cours', created_at: now, updated_at: now }, r));
        res({ data: null, error: null });
      } };
    };
    q.update = (p) => {   // conserve les filtres, puis renvoie les lignes modifiées si .select()
      const filt = []; const self = {
        eq(c, v) { filt.push((r) => String(r[c]) === String(v)); return self; },
        lt(c, v) { filt.push((r) => String(r[c]) < String(v)); return self; },
        select() { self._sel = true; return self; },
        then(res) { const hit = (store.envois_recus || []).filter((r) => filt.every((f) => f(r))); hit.forEach((r) => Object.assign(r, p)); res({ data: self._sel ? hit.map((r) => ({ athlete_id: r.athlete_id })) : null, error: null }); },
      }; return self;
    };
    return q;
  };
  return { from: wrap };
}
function load(src, store, opts) {
  let handler = null;
  let js = stripTypeScriptTypes(src);
  js = js.split('\n').filter((l) => !/^import\s/.test(l)).join('\n');
  const sb = { createClient: () => makeDb(store, opts), webpush: { setVapidDetails() {}, sendNotification: async () => {} },
    Deno: { env: { get: () => undefined }, serve: (fn) => { handler = fn; } },
    Response, Request, URL, URLSearchParams, TextEncoder, TextDecoder, crypto, atob, btoa, setTimeout, clearTimeout, fetch: async () => ({ ok: false, json: async () => ({}) }),
    console: { log() {}, error() {}, warn() {} } };
  vm.createContext(sb); vm.runInContext(js, sb);
  return handler;
}
const SRC = fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'handler', 'index.ts'), 'utf8');
let SRC_ANCIEN = null;
try { const c = execSync('git log --format=%H -n 1 -- supabase/functions/handler/index.ts', { cwd: ROOT }).toString().trim();
  const old = execSync('git show ' + c + ':supabase/functions/handler/index.ts', { cwd: ROOT, maxBuffer: 64e6 }).toString();
  if (!old.includes('_reserverEnvoi')) SRC_ANCIEN = old; } catch (_) {}

const U = 'https://x.supabase.co/functions/v1/smooth-service';
const post = (h, body) => h(new Request(U, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) })).then((r) => r.json());
const lignes = (d = '10/11/2026', sid = 'Push') => [[d, 46, sid, sid, 'A1', 'Développé couché barre', 'Pectoraux', '67', 1, 60, 8, 8, 120, 480], [d, 46, sid, sid, 'A1', 'Développé couché barre', 'Pectoraux', '67', 2, 60, 7, 9, 120, 420]];
const nouvelleBase = () => ({ athletes: [{ id: 'A1', login: '1001', nom: 'Test', coach_id: null }], performances: [], indicateurs: [], bien_etre: [], envois_recus: [], exercices: [], programme: [] });
const nbPerf = (st) => st.performances.filter((r) => r.athlete_id === 'A1').length;
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };

(async () => {
  // 1. Concurrence : deux envois simultanés, même envoi_id
  { const st = nouvelleBase(); const h = load(SRC, st);
    const [r1, r2] = await Promise.all([post(h, { action: 'saveSeance', data: lignes(), envoi_id: 'env_X' }), post(h, { action: 'saveSeance', data: lignes(), envoi_id: 'env_X' })]);
    eq(nbPerf(st) === 2, 'simultané : la séance (2 séries) est écrite UNE seule fois', nbPerf(st));
    const reps = [r1, r2]; eq(reps.filter((r) => r.ok === true).length === 1, 'simultané : une seule requête écrit', reps);
    eq(reps.some((r) => r.deja_recu === true || r.en_cours === true), 'simultané : l\'autre répond « déjà reçu » ou « en cours » (l\'app réessaie)', reps);
    eq(st.envois_recus.length === 1 && st.envois_recus[0].statut === 'ok', 'simultané : une réservation, confirmée', st.envois_recus); }
  { if (SRC_ANCIEN) { const st = nouvelleBase(); const h = load(SRC_ANCIEN, st);
      await Promise.all([post(h, { action: 'saveSeance', data: lignes(), envoi_id: 'env_X' }), post(h, { action: 'saveSeance', data: lignes(), envoi_id: 'env_X' })]);
      eq(nbPerf(st) === 4, 'contrôle : l\'ANCIEN serveur écrivait la séance deux fois dans ce scénario (le test détecte bien le défaut)', nbPerf(st));
    } else eq(true, 'ancien serveur indisponible (historique git) — contrôle sauté'); }
  // 2. Renvoi après succès
  { const st = nouvelleBase(); const h = load(SRC, st);
    const a = await post(h, { action: 'saveSeance', data: lignes(), envoi_id: 'env_A' }); const b = await post(h, { action: 'saveSeance', data: lignes(), envoi_id: 'env_A' });
    eq(a.ok === true && b.success === true && b.deja_recu === true && nbPerf(st) === 2, 'renvoi : « déjà reçu », séance non doublée', [a, b, nbPerf(st)]);
    eq(st.indicateurs.some((r) => r.cle === 'envoi_id' && r.valeur === 'env_A'), 'transition : l\'ancien marqueur est encore écrit (retour arrière possible)'); }
  // 3. Échec d'écriture → réservation annulée → renvoi OK
  { const st = nouvelleBase(); const opts = { perfFailOnce: true }; const h = load(SRC, st, opts);
    const a = await post(h, { action: 'saveSeance', data: lignes(), envoi_id: 'env_F' });
    eq(!!a.erreur && st.envois_recus.length === 0, 'échec : erreur renvoyée et réservation annulée', [a, st.envois_recus]);
    const b = await post(h, { action: 'saveSeance', data: lignes(), envoi_id: 'env_F' });
    eq(b.ok === true && nbPerf(st) === 2, 'échec puis renvoi : séance écrite une fois', [b, nbPerf(st)]); }
  // 4. Réservation bloquée
  { const st = nouvelleBase(); const vieux = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    st.envois_recus.push({ athlete_id: 'A1', envoi_id: 'env_S', statut: 'en_cours', created_at: vieux, updated_at: vieux });
    const h = load(SRC, st); const a = await post(h, { action: 'saveSeance', data: lignes(), envoi_id: 'env_S' });
    eq(a.ok === true && nbPerf(st) === 2 && st.envois_recus[0].statut === 'ok', 'réservation bloquée > 3 min : reprise et séance écrite', [a, st.envois_recus]); }
  { const st = nouvelleBase(); const now = new Date().toISOString();
    st.envois_recus.push({ athlete_id: 'A1', envoi_id: 'env_C', statut: 'en_cours', created_at: now, updated_at: now });
    const h = load(SRC, st); const a = await post(h, { action: 'saveSeance', data: lignes(), envoi_id: 'env_C' });
    eq(!!a.erreur && a.en_cours === true && nbPerf(st) === 0, 'autre envoi en cours (< 3 min) : erreur temporaire, rien écrit (l\'app garde en file)', a); }
  // 5. Ancien marqueur seul
  { const st = nouvelleBase(); st.indicateurs.push({ athlete_id: 'A1', seance_id: 'Push', date: '2026-11-01', cle: 'envoi_id', valeur: 'env_OLD', source: 'app' });
    const h = load(SRC, st); const a = await post(h, { action: 'saveSeance', data: lignes(), envoi_id: 'env_OLD' });
    eq(a.deja_recu === true && nbPerf(st) === 0, 'ancien marqueur : « déjà reçu »', a);
    eq(st.envois_recus.length === 1 && st.envois_recus[0].statut === 'ok', 'ancien marqueur : repris dans la nouvelle table', st.envois_recus); }
  // 6. Table absente
  { const st = nouvelleBase(); const h = load(SRC, st, { sansTable: true });
    const a = await post(h, { action: 'saveSeance', data: lignes(), envoi_id: 'env_T' }); const b = await post(h, { action: 'saveSeance', data: lignes(), envoi_id: 'env_T' });
    eq(a.ok === true && b.deja_recu === true && nbPerf(st) === 2, 'sans table : ancien mécanisme, pas de doublon en séquence', [a, b, nbPerf(st)]); }
  // 7. Suppression de séance libère l'envoi
  { const st = nouvelleBase(); const h = load(SRC, st);
    await post(h, { action: 'saveSeance', data: lignes(), envoi_id: 'env_D' });
    await post(h, { action: 'deleteSeance', athlete_id: 'A1', seance_id: 'Push', date: '10/11/2026' });
    eq(nbPerf(st) === 0 && st.envois_recus.length === 0, 'suppression : séance et réservation effacées', st.envois_recus);
    const b = await post(h, { action: 'saveSeance', data: lignes(), envoi_id: 'env_D' });
    eq(b.ok === true && nbPerf(st) === 2, 'suppression puis renvoi : séance réécrite', b); }
  // 8. Sans envoi_id
  { const st = nouvelleBase(); const h = load(SRC, st); const a = await post(h, { action: 'saveSeance', data: lignes() });
    eq(a.ok === true && nbPerf(st) === 2 && st.envois_recus.length === 0, 'sans envoi_id : séance écrite, aucune réservation', a); }

  console.log(`envois-recus : ${ok} OK / ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
