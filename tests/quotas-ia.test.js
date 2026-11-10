/* Quotas IA / morpho atomiques (10/11/2026, audit P1 étape 3 point 1 — table quotas_jour).
 * VRAI code d'index.ts sur une base en mémoire ; les fonctions SQL quota_reserver / quota_rendre sont
 * simulées à l'identique (réservation en une seule opération, plafond jamais dépassé, rendue ≥ 0).
 * L'appel à l'IA (api.anthropic.com) est simulé avec une latence → fenêtre de concurrence réelle.
 * Vérifie : quota du jour (2 questions), questions SIMULTANÉES (jamais plus que le quota — l'ancien
 * serveur, lui, dépasse), appel IA échoué → question rendue, crédits achetés consommés atomiquement,
 * quota du coach séparé, morpho 1/jour, et compatibilité (migration pas appliquée → ancien stockage). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const ROOT = path.join(__dirname, '..');
const T = fs.readFileSync(path.join(__dirname, 'e2e-parcours.test.js'), 'utf8');
eval(T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend')));

function makeDb(store, opts) {
  const base = makeEngine(store);
  store.quotas_jour = store.quotas_jour || [];
  const absent = () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
  return {
    from: (t) => {
      if (t === 'quotas_jour' && opts.sansFonction) return { select: () => { const q = { eq: () => q, limit: () => q, then: (r) => r({ data: null, error: { code: '42P01', message: 'relation does not exist' } }) }; return q; } };
      return base.from(t);
    },
    rpc: (name, a) => ({ then: (res) => {
      if (opts.sansFonction) return res(absent());
      const Q = store.quotas_jour;
      if (name === 'quota_reserver') {
        let r = Q.find((x) => x.sujet === a.p_sujet && x.type === a.p_type && x.jour === a.p_jour);
        if (!r) { if (!(a.p_max >= 1)) return res({ data: null, error: null }); Q.push({ sujet: a.p_sujet, type: a.p_type, jour: a.p_jour, n: 1 }); return res({ data: 1, error: null }); }
        if (r.n < a.p_max) { r.n++; return res({ data: r.n, error: null }); }
        return res({ data: null, error: null });
      }
      if (name === 'quota_rendre') { const r = Q.find((x) => x.sujet === a.p_sujet && x.type === a.p_type && x.jour === a.p_jour); if (r) r.n = Math.max(0, r.n - 1); return res({ data: r ? r.n : null, error: null }); }
      return res(absent());
    } }),
  };
}
const { execSync } = require('child_process');
let SRC_ANCIEN = null;
try { const c = execSync('git log --format=%H -n 1 -- supabase/functions/handler/index.ts', { cwd: ROOT }).toString().trim();
  const old = execSync('git show ' + c + ':supabase/functions/handler/index.ts', { cwd: ROOT, maxBuffer: 64e6 }).toString();
  if (!old.includes('_quotaReserver')) SRC_ANCIEN = old; } catch (_) {}
function load(store, opts = {}, src) {
  let handler = null;
  let js = stripTypeScriptTypes(src || fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
  js = js.split('\n').filter((l) => !/^import\s/.test(l)).join('\n');
  const env = { ANTHROPIC_API_KEY: 'cle-de-test' };
  const fakeFetch = async (url) => {
    if (String(url).includes('api.anthropic.com')) {
      opts.nbIA = (opts.nbIA || 0) + 1;
      await new Promise((r) => setTimeout(r, 15));   // l'IA met du temps → fenêtre de concurrence
      if (opts.iaEnPanne) return { ok: false, status: 500, json: async () => ({ error: 'x' }) };
      return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: opts.texte || 'Continue comme ça.' }] }) };
    }
    return { ok: false, json: async () => ({}) };
  };
  const sb = { createClient: () => makeDb(store, opts), webpush: { setVapidDetails() {}, sendNotification: async () => {} },
    Deno: { env: { get: (k) => env[k] }, serve: (fn) => { handler = fn; } },
    Response, Request, URL, URLSearchParams, TextEncoder, TextDecoder, crypto, atob, btoa, setTimeout, clearTimeout, fetch: fakeFetch,
    console: { log() {}, error() {}, warn() {} } };
  vm.createContext(sb); vm.runInContext(js, sb);
  return { handler, opts };
}
const U = 'https://x.supabase.co/functions/v1/smooth-service';
const post = (h, body) => h(new Request(U, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) })).then((r) => r.json());
const base = () => ({ athletes: [{ id: 'A1', login: '1001', nom: 'Un Test', coach_id: 'C1', sport: 'muscu', prefs: {} }],
  coachs: [{ coach_id: 'C1', login: 'c1', nom: 'Coach', prefs: {} }],
  indicateurs: [], performances: [], bien_etre: [], programme: [], exercices: [], planning: [], objectif: [] });
const Q = (aid = 'A1') => ({ action: 'chatIA', athlete_id: aid, messages: [{ role: 'user', content: 'Comment je progresse ?' }] });
const ok = (j) => j && j.success === true && !j.limited;
const cpt = (st, sujet, type) => { const r = (st.quotas_jour || []).find((x) => x.sujet === sujet && x.type === type); return r ? r.n : 0; };
let nOK = 0, nKO = 0; const eq = (c, n, g) => { if (c) nOK++; else { nKO++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };

(async () => {
  // 1) Quota du jour : 2 questions, la 3e est limitée.
  { const st = base(); const { handler } = load(st);
    const r1 = await post(handler, Q()), r2 = await post(handler, Q()), r3 = await post(handler, Q());
    eq(ok(r1) && ok(r2) && r3.limited === true, '2 questions par jour, la 3e est limitée', [r1.success, r2.success, r3.limited]);
    eq(r1.remaining === 1 && r2.remaining === 0, 'questions restantes affichées (1 puis 0)', [r1.remaining, r2.remaining]);
    eq(cpt(st, 'A1', 'ia') === 2, 'compteur du jour = 2 (quotas_jour)', st.quotas_jour);
    eq(!st.indicateurs.some((x) => x.seance_id === 'ia_quota'), 'plus rien écrit dans indicateurs (ia_quota)'); }

  // 2) Questions SIMULTANÉES : jamais plus que le quota.
  { const st = base(); const o = {}; const { handler } = load(st, o);
    const R = await Promise.all(Array.from({ length: 6 }, () => post(handler, Q())));
    const passes = R.filter(ok).length;
    eq(passes === 2 && cpt(st, 'A1', 'ia') === 2, '6 questions envoyées en même temps → exactement 2 traitées', [passes, cpt(st, 'A1', 'ia')]);
    eq(o.nbIA === 2, 'exactement 2 appels payants à l\'IA', o.nbIA); }
  if (SRC_ANCIEN) { const st = base(); const o = {}; const { handler } = load(st, o, SRC_ANCIEN);
    const R = await Promise.all(Array.from({ length: 6 }, () => post(handler, Q())));
    eq(R.filter(ok).length > 2, 'ANCIEN serveur : le quota est dépassé en simultané (le défaut corrigé est bien réel)', R.filter(ok).length); }

  // 3) Appel IA en échec → la question est rendue.
  { const st = base(); const o = { iaEnPanne: true }; const { handler } = load(st, o);
    const r = await post(handler, Q());
    eq(r.success === false && cpt(st, 'A1', 'ia') === 0, 'IA en panne : question rendue (compteur à 0)', [r, cpt(st, 'A1', 'ia')]);
    o.iaEnPanne = false; const a = await post(handler, Q()), b = await post(handler, Q());
    eq(ok(a) && ok(b), 'après la panne, les 2 questions du jour restent disponibles', [a.success, b.success]); }
  { const st = base(); const { handler } = load(st);
    const r = await post(handler, { action: 'chatIA', athlete_id: 'A1', messages: [] });
    eq(r.success === false && cpt(st, 'A1', 'ia') === 0, 'message vide : rien consommé', [r, cpt(st, 'A1', 'ia')]); }

  // 4) Crédits achetés (boutique : 5 questions) consommés atomiquement, au-delà du quota du jour.
  { const st = base(); st.indicateurs.push({ athlete_id: 'A1', seance_id: 'recompense', cle: 'ia_plus5_1700000000000', valeur: '150', date: '2026-11-01', unite: 'pts', source: 'app' });
    const o = {}; const { handler } = load(st, o);
    const R = await Promise.all(Array.from({ length: 12 }, () => post(handler, Q())));
    eq(R.filter(ok).length === 7, '12 questions simultanées avec 5 crédits achetés → 2 (jour) + 5 (crédits) = 7 traitées', R.filter(ok).length);
    eq(cpt(st, 'A1', 'ia_bonus') === 5 && o.nbIA === 7, 'crédits consommés = 5, appels IA = 7', [cpt(st, 'A1', 'ia_bonus'), o.nbIA]);
    const d = await (await handler(new Request(U + '?action=getAppData&athlete_id=A1'))).json();
    eq(d.recompenses && d.recompenses.ia_credits === 0, 'crédits restants affichés = 0', d.recompenses && d.recompenses.ia_credits); }
  { const st = base(); st.indicateurs.push({ athlete_id: 'A1', seance_id: 'recompense', cle: 'ia_plus5_1700000000000', valeur: '150', date: '2026-11-01', unite: 'pts', source: 'app' });
    const o = {}; const { handler } = load(st, o);
    await post(handler, Q()); await post(handler, Q()); o.iaEnPanne = true;
    await post(handler, Q());
    eq(cpt(st, 'A1', 'ia_bonus') === 0, 'IA en panne sur une question achetée : crédit rendu', cpt(st, 'A1', 'ia_bonus')); }

  // 5) Mode coach : quota du coach, séparé de celui de l'athlète.
  { const st = base(); const { handler } = load(st);
    const C = { action: 'chatIA', mode: 'coach', coach_id: 'C1', athlete_id: 'A1', messages: [{ role: 'user', content: 'Où en est-il ?' }] };
    const a = await post(handler, C), b = await post(handler, C), c = await post(handler, C), d = await post(handler, Q());
    eq(ok(a) && ok(b) && c.limited === true && ok(d), 'coach : 2 questions par jour, sans toucher au quota de l\'athlète', [a.success, b.success, c.limited, d.success]);
    eq(cpt(st, 'coach:C1', 'ia') === 2 && cpt(st, 'A1', 'ia') === 1, 'compteurs coach / athlète séparés', st.quotas_jour); }

  // 6) Morpho : 1 analyse par jour, simultanées comprises ; échec → rendue.
  { const st = base(); const o = { texte: '{"reco":"ok"}' }; const { handler } = load(st, o);
    const M = { action: 'analyseMorpho', athlete_id: 'A1', consent: true, images: [{ data: 'AAAA', media_type: 'image/jpeg' }] };
    const R = await Promise.all([post(handler, M), post(handler, M), post(handler, M)]);
    eq(R.filter((r) => r.success && !r.limited).length === 1 && cpt(st, 'A1', 'morpho') === 1, '3 analyses morpho simultanées → 1 seule', R.map((r) => r.limited)); }
  { const st = base(); const o = { iaEnPanne: true }; const { handler } = load(st, o);
    const M = { action: 'analyseMorpho', athlete_id: 'A1', consent: true, images: [{ data: 'AAAA', media_type: 'image/jpeg' }] };
    await post(handler, M);
    eq(cpt(st, 'A1', 'morpho') === 0, 'morpho en échec : analyse rendue', cpt(st, 'A1', 'morpho')); }

  // 7) Compatibilité : migration pas appliquée → ancien stockage, même comportement qu'avant.
  { const st = base(); const { handler } = load(st, { sansFonction: true });
    const r1 = await post(handler, Q()), r2 = await post(handler, Q()), r3 = await post(handler, Q());
    const l = st.indicateurs.find((x) => x.seance_id === 'ia_quota');
    eq(ok(r1) && ok(r2) && r3.limited === true && l && l.valeur === '2', 'sans migration : quota dans indicateurs comme avant (2/jour)', [r1.success, r2.success, r3.limited, l && l.valeur]); }

  console.log(`quotas-ia : ${nOK} OK / ${nKO} KO`);
  process.exit(nKO ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
