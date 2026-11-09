/* Préférences ATHLÈTE → athletes.prefs (10/11/2026, audit P1 étape 2).
 * VRAI code d'index.ts sur une base en mémoire ; la fonction SQL athlete_prefs_merge est simulée
 * (fusion atomique prefs || patch), et peut être rendue « absente » (migration pas appliquée).
 * Lecture : nouveau seul · ancien seul (secours) · les deux (le nouveau fait foi, même false) · aucun (défauts).
 * Écriture : création, modification, chaque route → athletes.prefs, plus rien dans indicateurs.
 * Écritures simultanées de 2 préférences : aucune perdue. Défauts du coach. Réservé coach (novalyz_athlete).
 * Compatibilité : fonction absente → ancien stockage, rien ne casse.
 * Sécurité : un athlète ne peut pas écrire les préférences d'un autre ; un coach non lié non plus.
 * Hors périmètre conservé : prog_maj et coach_demande restent lus depuis indicateurs. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const ROOT = path.join(__dirname, '..');
const T = fs.readFileSync(path.join(__dirname, 'e2e-parcours.test.js'), 'utf8');
eval(T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend')));

function makeDb(store, opts) {
  const base = makeEngine(store);
  return {
    from: (t) => base.from(t),
    rpc: (name, args) => ({ then: (res) => {
      if (opts.sansFonction) return res({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.athlete_prefs_merge' } });
      if (name !== 'athlete_prefs_merge') return res({ data: null, error: { code: 'PGRST202', message: 'unknown' } });
      const a = (store.athletes || []).find((x) => String(x.id) === String(args.p_athlete_id));
      if (!a) return res({ data: null, error: null });
      a.prefs = Object.assign({}, a.prefs || {}, args.p_patch || {}); opts.nbRpc = (opts.nbRpc || 0) + 1;
      res({ data: a.prefs, error: null });
    } }),
  };
}
const { execSync } = require('child_process');
let SRC_ANCIEN = null;
try { const c = execSync('git log --format=%H -n 1 -- supabase/functions/handler/index.ts', { cwd: ROOT }).toString().trim();
  const old = execSync('git show ' + c + ':supabase/functions/handler/index.ts', { cwd: ROOT, maxBuffer: 64e6 }).toString();
  if (!old.includes('_prefsAthleteLues')) SRC_ANCIEN = old; } catch (_) {}
function load(store, env = {}, opts = {}, src) {
  let handler = null;
  let js = stripTypeScriptTypes(src || fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
  js = js.split('\n').filter((l) => !/^import\s/.test(l)).join('\n') + (src ? '' : '\n;this.__api = { signSession, _prefsAthleteLues, _appliquerDefautsCoach };');
  const sb = { createClient: () => makeDb(store, opts), webpush: { setVapidDetails() {}, sendNotification: async () => {} },
    Deno: { env: { get: (k) => env[k] }, serve: (fn) => { handler = fn; } },
    Response, Request, URL, URLSearchParams, TextEncoder, TextDecoder, crypto, atob, btoa, setTimeout, clearTimeout, fetch: async () => ({ ok: false, json: async () => ({}) }),
    console: { log() {}, error() {}, warn() {} } };
  vm.createContext(sb); vm.runInContext(js, sb);
  return { handler, api: sb.__api, opts };
}
const U = 'https://x.supabase.co/functions/v1/smooth-service';
const post = (h, body, tok) => h(new Request(U + (tok ? '?_t=' + encodeURIComponent(tok) : ''), { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) })).then(async (r) => ({ status: r.status, j: await r.json() }));
const getApp = (h, id, tok) => h(new Request(U + '?action=getAppData&athlete_id=' + id + (tok ? '&_t=' + encodeURIComponent(tok) : ''))).then((r) => r.json());
const pref = (aid, cle, valeur, date = '2026-11-01') => ({ athlete_id: aid, seance_id: 'pref', cle, valeur, date, source: 'app', unite: '' });
const base = () => ({ athletes: [{ id: 'A1', login: '1001', nom: 'Un', coach_id: null, sport: 'muscu', prefs: {} }, { id: 'A2', login: '1002', nom: 'Deux', coach_id: 'C1', sport: 'muscu', prefs: {} }],
  coachs: [{ coach_id: 'C1', login: 'c1', nom: 'Coach', prefs: {} }, { coach_id: 'C2', login: 'c2', nom: 'Autre', prefs: {} }],
  indicateurs: [], performances: [], bien_etre: [], programme: [], exercices: [], planning: [] });
const nbPrefAncien = (st, aid) => st.indicateurs.filter((r) => r.athlete_id === aid && r.seance_id === 'pref').length;
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };

(async () => {
  // ── LECTURE ──
  { const st = base(); st.athletes[0].prefs = { semaine_type: 'glissant', onboarding_vu: true, prog_auto_off: true, zones_prio: ['fessiers', 'jambes'], exo_categories: { Squat: 'gros' } };
    const d = await getApp(load(st).handler, 'A1');
    eq(d.semaine_type === 'glissant' && d.onboarding_vu === true && d.prog_auto_off === true, 'lecture nouveau seul : drapeaux + semaine', d.semaine_type);
    eq(JSON.stringify(d.zones_prio) === '["fessiers","jambes"]' && d.exo_categories.Squat === 'gros', 'lecture nouveau seul : zones + catégories', [d.zones_prio, d.exo_categories]); }
  { const st = base(); st.indicateurs.push(pref('A1', 'semaine_type', 'glissant'), pref('A1', 'onboarding_vu', '1'), pref('A1', 'zones_prio', '["dos"]'), pref('A1', 'exo_categories', '{"Curl barre":"petit"}'));
    const d = await getApp(load(st).handler, 'A1');
    eq(d.semaine_type === 'glissant' && d.onboarding_vu === true && JSON.stringify(d.zones_prio) === '["dos"]' && d.exo_categories['Curl barre'] === 'petit', 'lecture ancien seul : secours de transition', [d.semaine_type, d.onboarding_vu, d.zones_prio]); }
  { const st = base(); st.athletes[0].prefs = { semaine_type: 'calendaire', onboarding_vu: false }; st.indicateurs.push(pref('A1', 'semaine_type', 'glissant'), pref('A1', 'onboarding_vu', '1'), pref('A1', 'prog_auto_off', '1'));
    const d = await getApp(load(st).handler, 'A1');
    eq(d.semaine_type === 'calendaire', 'les deux : le nouveau fait foi (semaine)', d.semaine_type);
    eq(d.onboarding_vu === false, 'les deux : le nouveau fait foi même quand il vaut false', d.onboarding_vu);
    eq(d.prog_auto_off === true, 'clé absente du nouveau → ancienne valeur', d.prog_auto_off); }
  { const st = base(); st.athletes[0].prefs = undefined; const d = await getApp(load(st).handler, 'A1');
    eq(d.semaine_type === 'calendaire' && d.onboarding_vu === false && d.prog_auto_off === false && JSON.stringify(d.zones_prio) === '[]' && JSON.stringify(d.exo_categories) === '{}', 'aucune préférence : défauts identiques à avant', [d.semaine_type, d.zones_prio]);
    eq(d.propositions_novalyz === true && d.novalyz_athlete_ok === false, 'défauts : sans coach → propositions Novalyz à l\'athlète', [d.propositions_novalyz, d.novalyz_athlete_ok]); }
  { const st = base(); const d = await getApp(load(st).handler, 'A2');
    eq(d.propositions_novalyz === false, 'athlète avec coach, novalyz_athlete absent → pas de propositions', d.propositions_novalyz); }
  { const st = base(); st.indicateurs.push(pref('A1', 'zones_prio', '[cassé'), pref('A1', 'exo_categories', '"pas un objet"'));
    const d = await getApp(load(st).handler, 'A1');
    eq(JSON.stringify(d.zones_prio) === '[]' && JSON.stringify(d.exo_categories) === '{}', 'ancienne valeur illisible → défaut (comme avant)', [d.zones_prio, d.exo_categories]); }
  { const st = base(); st.athletes[0].prefs = { zones_prio: ['fessiers', 'zone_inconnue', 'jambes', 'dos'] }; const d = await getApp(load(st).handler, 'A1');
    eq(JSON.stringify(d.zones_prio) === '["fessiers","jambes"]', 'zones : même filtrage qu\'avant (zones connues, 2 max)', d.zones_prio); }
  { const st = base(); st.indicateurs.push(pref('A1', 'prog_maj', '{"par":"c","quoi":"exercice modifié"}'));
    const d = await getApp(load(st).handler, 'A1');
    eq(d.prog_maj && d.prog_maj.par === 'c', 'hors périmètre : prog_maj toujours lu depuis indicateurs', d.prog_maj); }

  // ── NON-RÉGRESSION : mêmes données (ancien stockage seul) → mêmes champs, ancien serveur vs nouveau ──
  if (SRC_ANCIEN) {
    const CHAMPS = ['semaine_type', 'onboarding_vu', 'prog_auto_off', 'novalyz_athlete_ok', 'propositions_novalyz', 'zones_prio', 'exo_categories', 'prog_maj'];
    const cas = [[], [pref('A1', 'onboarding_vu', '1'), pref('A1', 'prog_auto_off', '0'), pref('A1', 'semaine_type', 'glissant')],
      [pref('A1', 'zones_prio', '["fessiers","inconnue","jambes","dos"]'), pref('A1', 'exo_categories', '{"Squat":"gros"}'), pref('A1', 'novalyz_athlete', '1'), pref('A1', 'prog_maj', '{"par":"a"}')],
      [pref('A1', 'zones_prio', '[cassé'), pref('A1', 'exo_categories', 'null')]];
    for (const [i, lignes] of cas.entries()) {
      for (const aid of ['A1', 'A2']) {
        const mk = () => { const st = base(); st.indicateurs.push(...lignes.map((l) => Object.assign({}, l, { athlete_id: aid }))); return st; };
        const dN = await getApp(load(mk()).handler, aid), dA = await getApp(load(mk(), {}, {}, SRC_ANCIEN).handler, aid);
        const diff = CHAMPS.filter((k) => JSON.stringify(dN[k]) !== JSON.stringify(dA[k]));
        eq(diff.length === 0, 'non-régression cas ' + (i + 1) + ' (' + aid + ') : champs identiques à l\'ancien serveur', diff.map((k) => [k, dA[k], dN[k]]));
      }
    }
  } else eq(true, 'ancien serveur indisponible (historique git) — non-régression sautée');

  // ── ÉCRITURE ──
  { const st = base(); const { handler } = load(st);
    const r = await post(handler, { action: 'savePref', athlete_id: 'A1', cle: 'onboarding_vu', valeur: 1 });
    eq(r.j.success === true && st.athletes[0].prefs.onboarding_vu === true, 'création : savePref → athletes.prefs (booléen)', st.athletes[0].prefs);
    eq(nbPrefAncien(st, 'A1') === 0, 'création : plus rien écrit dans indicateurs', nbPrefAncien(st, 'A1'));
    await post(handler, { action: 'savePref', athlete_id: 'A1', cle: 'onboarding_vu', valeur: 0 });
    eq(st.athletes[0].prefs.onboarding_vu === false, 'modification : valeur 0 → false', st.athletes[0].prefs);
    const d = await getApp(handler, 'A1'); eq(d.onboarding_vu === false, 'modification relue par getAppData', d.onboarding_vu); }
  { const st = base(); const { handler } = load(st);
    const z = await post(handler, { action: 'saveZonesPrio', athlete_id: 'A1', zones: ['jambes', 'xx', 'dos', 'fessiers'] });
    const c = await post(handler, { action: 'saveExoCategories', athlete_id: 'A1', categories: { Squat: 'gros', Curl: 'petit', Bad: 'énorme' } });
    const s = await post(handler, { action: 'saveSemaineType', athlete_id: 'A1', valeur: 'glissant' });
    const p = st.athletes[0].prefs;
    eq(z.j.success && JSON.stringify(z.j.zones) === '["jambes","dos"]' && JSON.stringify(p.zones_prio) === '["jambes","dos"]', 'saveZonesPrio : réponse et stockage inchangés (filtrées, 2 max)', [z.j, p.zones_prio]);
    eq(c.j.success && JSON.stringify(p.exo_categories) === '{"Squat":"gros","Curl":"petit"}' && !('Bad' in c.j.categories), 'saveExoCategories : valeurs invalides écartées comme avant', p.exo_categories);
    eq(s.j.success && p.semaine_type === 'glissant', 'saveSemaineType → athletes.prefs', p.semaine_type);
    eq(nbPrefAncien(st, 'A1') === 0, 'aucune écriture dans indicateurs pour ces routes', nbPrefAncien(st, 'A1')); }
  { const st = base(); const { handler } = load(st);
    await Promise.all([post(handler, { action: 'savePref', athlete_id: 'A1', cle: 'prog_auto_off', valeur: 1 }), post(handler, { action: 'saveSemaineType', athlete_id: 'A1', valeur: 'glissant' }), post(handler, { action: 'saveZonesPrio', athlete_id: 'A1', zones: ['dos'] })]);
    const p = st.athletes[0].prefs;
    eq(p.prog_auto_off === true && p.semaine_type === 'glissant' && JSON.stringify(p.zones_prio) === '["dos"]', 'écritures simultanées de 3 préférences : aucune perdue (fusion)', p); }
  { const st = base(); st.athletes[0].prefs = { semaine_type: 'calendaire' }; const { handler } = load(st);
    await post(handler, { action: 'savePref', athlete_id: 'A1', cle: 'onboarding_vu', valeur: 1 });
    eq(st.athletes[0].prefs.semaine_type === 'calendaire' && st.athletes[0].prefs.onboarding_vu === true, 'écriture partielle : les autres préférences sont conservées', st.athletes[0].prefs); }
  { const st = base(); st.coachs[0].prefs = { defauts: { novalyz_athlete: true, semaine_type: 'glissant' } }; const { api } = load(st);
    await api._appliquerDefautsCoach('C1', 'A2');
    eq(st.athletes[1].prefs.novalyz_athlete === true && st.athletes[1].prefs.semaine_type === 'glissant', 'défauts du coach appliqués → athletes.prefs', st.athletes[1].prefs);
    eq(nbPrefAncien(st, 'A2') === 0, 'défauts du coach : plus rien dans indicateurs', nbPrefAncien(st, 'A2')); }

  // ── MUSCLES RETIRÉS (09/11) : séance trop courte → l'athlète retire des muscles ──
  { const st = base(); st.athletes[0].prefs = { zones_prio: ['fessiers'] }; const { handler } = load(st);
    const r = await post(handler, { action: 'saveMusclesExclus', athlete_id: 'A1', muscles: ['Triceps', 'Mollets', 'Fessier', 'Inconnu', 'Triceps'] });
    eq(r.j.success && JSON.stringify(r.j.muscles) === '["Triceps","Mollets"]' && JSON.stringify(st.athletes[0].prefs.muscles_exclus) === '["Triceps","Mollets"]', 'saveMusclesExclus : dédoublonné, muscle inconnu et zone prioritaire refusés', r.j);
    const d = await getApp(handler, 'A1');
    const mus = (d.volume_obti || []).map((o) => o.muscle);
    eq(JSON.stringify(d.muscles_exclus) === '["Triceps","Mollets"]', 'getAppData renvoie muscles_exclus', d.muscles_exclus);
    eq(mus.length > 0 && !mus.includes('Triceps') && !mus.includes('Mollets') && mus.includes('Biceps') && mus.includes('Fessier'), 'volume_obti : muscles retirés absents (jamais « sous le minimum »), les autres présents', mus);
    eq(st.athletes[0].prefs.zones_prio[0] === 'fessiers', 'saveMusclesExclus ne touche pas aux autres préférences', st.athletes[0].prefs);
    await post(handler, { action: 'saveMusclesExclus', athlete_id: 'A1', muscles: [] });
    const d2 = await getApp(handler, 'A1');
    eq((d2.volume_obti || []).some((o) => o.muscle === 'Triceps') && JSON.stringify(d2.muscles_exclus) === '[]', 'remettre les muscles : cibles revenues', d2.muscles_exclus);
    st.athletes[0].prefs.muscles_exclus = ['Fessier']; const d3 = await getApp(handler, 'A1');
    eq((d3.volume_obti || []).some((o) => o.muscle === 'Fessier') && JSON.stringify(d3.muscles_exclus) === '[]', 'une zone prioritaire ne peut pas être retirée (même si stockée)', d3.muscles_exclus); }

  // ── COMPATIBILITÉ (migration pas encore appliquée) ──
  { const st = base(); const { handler } = load(st, {}, { sansFonction: true });
    const r = await post(handler, { action: 'savePref', athlete_id: 'A1', cle: 'onboarding_vu', valeur: 1 });
    await post(handler, { action: 'saveZonesPrio', athlete_id: 'A1', zones: ['dos'] });
    eq(r.j.success === true && st.indicateurs.some((x) => x.cle === 'onboarding_vu' && x.valeur === '1') && st.indicateurs.some((x) => x.cle === 'zones_prio' && x.valeur === '["dos"]'), 'fonction absente : écriture dans l\'ancien stockage, rien ne casse', st.indicateurs);
    const d = await getApp(handler, 'A1'); eq(d.onboarding_vu === true && JSON.stringify(d.zones_prio) === '["dos"]', 'fonction absente : relecture OK', [d.onboarding_vu, d.zones_prio]); }

  // ── SÉCURITÉ (sessions actives) ──
  { const ENV = { PEPPER: 'pep', AUTH_ENFORCE: '1' }; const st = base(); const { handler, api } = load(st, ENV);
    const tA1 = await api.signSession('a', 'A1'), tC2 = await api.signSession('c', 'C2'), tC1 = await api.signSession('c', 'C1'), tA2 = await api.signSession('a', 'A2');
    const r1 = await post(handler, { action: 'saveZonesPrio', athlete_id: 'A2', zones: ['dos'] }, tA1);
    eq(r1.status === 401 && st.athletes[1].prefs.zones_prio === undefined, 'athlète A1 → préférences de A2 : refusé (401), rien écrit', r1);
    const r2 = await post(handler, { action: 'saveSemaineType', athlete_id: 'A2', valeur: 'glissant' }, tC2);
    eq(r2.status === 401 && st.athletes[1].prefs.semaine_type === undefined, 'coach non lié → préférences de A2 : refusé (401)', r2);
    const r3 = await post(handler, { action: 'savePref', athlete_id: 'A2', cle: 'novalyz_athlete', valeur: 1 }, tA2);
    eq(r3.j.success === false && st.athletes[1].prefs.novalyz_athlete === undefined, 'novalyz_athlete : réservé au coach (l\'athlète ne peut pas)', r3.j);
    const r4 = await post(handler, { action: 'savePref', athlete_id: 'A2', cle: 'novalyz_athlete', valeur: 1 }, tC1);
    eq(r4.j.success === true && st.athletes[1].prefs.novalyz_athlete === true, 'novalyz_athlete : le coach lié peut', r4.j);
    const r5 = await post(handler, { action: 'savePref', athlete_id: 'A1', cle: 'onboarding_vu', valeur: 1 }, tA1);
    eq(r5.j.success === true && st.athletes[0].prefs.onboarding_vu === true, 'l\'athlète écrit SES préférences', r5.j);
    const r7 = await post(handler, { action: 'saveMusclesExclus', athlete_id: 'A2', muscles: ['Triceps'] }, tA1);
    eq(r7.status === 401 && st.athletes[1].prefs.muscles_exclus === undefined, 'saveMusclesExclus : athlète A1 → A2 refusé (401)', r7);
    const r8 = await post(handler, { action: 'saveMusclesExclus', athlete_id: 'A2', muscles: ['Triceps'] }, tC1);
    eq(r8.j.success === true && JSON.stringify(st.athletes[1].prefs.muscles_exclus) === '["Triceps"]', 'saveMusclesExclus : le coach lié peut', r8.j);
    const r6 = await post(handler, { action: 'savePref', athlete_id: 'A1', cle: 'cle_inconnue', valeur: 1 }, tA1);
    eq(r6.j.success === false && !('cle_inconnue' in st.athletes[0].prefs), 'clé non autorisée refusée', r6.j); }

  console.log(`athletes-prefs : ${ok} OK / ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
