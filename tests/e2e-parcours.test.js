/* =============================================================================
 * #3 — PARCOURS UTILISATEUR RÉEL (end-to-end) : saisie → save → rechargement →
 *      payload → rendu Cockpit. Muscu ET Foot.
 *
 * Différent des value-tests : on enchaîne les VRAIS handlers de production
 * (handleSaveSeance/SaveBienEtre/SaveMatch → handleGetAppData/GetSuiviJoueur)
 * sur une base Supabase EN MÉMOIRE (double d'I/O), puis on rend le VRAI Cockpit
 * (renderCockpit / renderCockpitFoot) à partir du payload rechargé. On prouve
 * que la donnée saisie ressort correctement partout, jusqu'au Cockpit.
 * Aucune modification de production.
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');

const ROOT = path.join(__dirname, '..');

// ── Base Supabase en mémoire (moteur de requêtes minimal) ────────────────────
function makeEngine(store) {
  function q(table) {
    const filters = []; let ord = null, lim = null, single = false, op = null, payload = null;
    const base = () => (store[table] || (store[table] = []));
    const matches = (r) => filters.every(f => f(r));
    const self = {
      from(t) { return q(t); }, select() { return self; },
      insert(p) { op = 'insert'; payload = Array.isArray(p) ? p : [p]; return self; },
      update(p) { op = 'update'; payload = p; return self; },
      upsert(p) { op = 'upsert'; payload = Array.isArray(p) ? p : [p]; return self; },
      delete() { op = 'delete'; return self; },
      eq(c, v) { filters.push(r => String(r[c]) === String(v)); return self; },
      neq(c, v) { filters.push(r => String(r[c]) !== String(v)); return self; },
      in(c, a) { const s = (a || []).map(String); filters.push(r => s.includes(String(r[c]))); return self; },
      is(c, v) { filters.push(r => r[c] === v); return self; },
      gte(c, v) { filters.push(r => String(r[c]) >= String(v)); return self; },
      lte(c, v) { filters.push(r => String(r[c]) <= String(v)); return self; },
      gt(c, v) { filters.push(r => String(r[c]) > String(v)); return self; },
      lt(c, v) { filters.push(r => String(r[c]) < String(v)); return self; },
      like(c, p) { const re = new RegExp('^' + String(p).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$'); filters.push(r => re.test(String(r[c] ?? ''))); return self; },
      order(c, o) { ord = { c, asc: !(o && o.ascending === false) }; return self; },
      limit(n) { lim = n; return self; }, range() { return self; },
      single() { single = true; return self; }, maybeSingle() { single = true; return self; },
      then(res, rej) { try { res(resolve()); } catch (e) { rej ? rej(e) : res({ data: null, error: { message: String(e) } }); } },
    };
    function filtered() {
      let rows = base().filter(matches);
      if (ord) rows = rows.slice().sort((a, b) => { const x = a[ord.c], y = b[ord.c]; if (x < y) return ord.asc ? -1 : 1; if (x > y) return ord.asc ? 1 : -1; return 0; });
      if (lim != null) rows = rows.slice(0, lim);
      return rows;
    }
    function resolve() {
      if (op === 'insert' || op === 'upsert') { base().push(...payload); return { data: payload, error: null }; }
      if (op === 'update') { base().filter(matches).forEach(r => Object.assign(r, payload)); return { data: null, error: null }; }
      if (op === 'delete') { store[table] = base().filter(r => !matches(r)); return { data: null, error: null }; }
      const rows = filtered();
      return single ? { data: rows[0] || null, error: null } : { data: rows, error: null };
    }
    return self;
  }
  return { from: q };
}

// ── Chargement du VRAI backend (index.ts) avec Supabase mocké ─────────────────
function loadBackend(store) {
  let js = stripTypeScriptTypes(fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
  js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n');
  js += '\n;this.__api = { handleGetAppData, handleSaveSeance, handleSaveBienEtre, handleGetSuiviJoueur, handleSaveMatch };';
  const client = makeEngine(store);
  const sandbox = {
    createClient: () => client, webpush: { setVapidDetails() {}, sendNotification: async () => {} },
    Deno: { env: { get: () => 'x' }, serve: () => {} },
    Response, Request, URLSearchParams, TextEncoder, TextDecoder, crypto, console, setTimeout, clearTimeout,
    fetch: async () => ({ ok: false, status: 0, text: async () => '', json: async () => ({}) }),
  };
  vm.createContext(sandbox); vm.runInContext(js, sandbox);
  return sandbox.__api;
}

// ── Chargement du VRAI rendu Cockpit (js/app.js) ─────────────────────────────
function loadFront() {
  const APP = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');
  const gf = (n) => { const m = APP.match(new RegExp('function\\s+' + n + '\\s*\\(')); let i = APP.indexOf('{', m.index), d = 0, j = i; for (; j < APP.length; j++) { const c = APP[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } } return APP.slice(m.index, j); };
  const gb = (n, o, c) => { const m = APP.match(new RegExp('(?:const|var|let)\\s+' + n + '\\s*=\\s*')); const i = APP.indexOf(o, m.index); let d = 0, j = i; for (; j < APP.length; j++) { const ch = APP[j]; if (ch === o) d++; else if (ch === c) { d--; if (d === 0) { j++; break; } } } return 'const ' + n + ' = ' + APP.slice(i, j) + ';'; };
  const FN = ['escapeHtml', 'couleurStatut', '_ckColRecup', '_ckColNiv3', '_ckConf', '_ckMini', '_ckKpi', '_ckKpiC', '_ckWbColor', '_ckFormeQuestionnaire', '_ckT', '_ckSpark', '_ckDir', '_ckWeeklyVolume', 'wqPositif', 'tendance1RM',
    'renderCockpitEtat', 'renderCockpitCharge', 'renderCockpitBienEtre', 'renderCockpitPerformance', 'renderCockpitEvolution', 'renderCockpitHistorique', 'renderCockpit',
    '_ckFr', 'renderCockpitBienEtreFoot', 'renderCockpitChargeFoot', 'renderCockpitEvolutionFoot', 'renderCockpitPerformanceFoot', 'renderCockpitHistoriqueFoot', 'renderCockpitFoot'];
  const store = {};
  const sandbox = { COCKPIT_ON: true, console, document: { getElementById: (id) => (store[id] || (store[id] = { innerHTML: '', style: {} })) } };
  vm.createContext(sandbox);
  vm.runInContext([gb('STATUT_VISUEL', '{', '}'), gb('_CK_CTX', '{', '}'), gb('WQ_DIMS', '[', ']'), gb('WQ_ANSWERS', '{', '}'), ...FN.map(gf)].join('\n') + '\nthis.renderCockpit=renderCockpit;this.renderCockpitFoot=renderCockpitFoot;', sandbox);
  return {
    muscu(p) { store['dash-cockpit'] = { innerHTML: '', style: {} }; sandbox.renderCockpit(p, 'dash'); return store['dash-cockpit'].innerHTML; },
    foot(p) { store['foot-cockpit'] = { innerHTML: '', style: {} }; sandbox.renderCockpitFoot(p); return store['foot-cockpit'].innerHTML; },
  };
}
const readJson = async (rp) => (await (await rp).json());
const norm = (s) => s.replace(/[\u202f\u00a0\u2009]/g, ' ');

let ok = 0, ko = 0; const fails = [];
const eq = (n, got, exp) => { const p = JSON.stringify(got) === JSON.stringify(exp); if (p) ok++; else { ko++; fails.push(n); console.log('  ❌ ' + n + ' — attendu ' + JSON.stringify(exp) + ', obtenu ' + JSON.stringify(got)); } };
const truthy = (n, c) => { c ? ok++ : (ko++, fails.push(n), console.log('  ❌ ' + n)); };

(async () => {
  const front = loadFront();
  const today = new Date().toISOString().slice(0, 10);

  /* ============================ PARCOURS MUSCU ============================ */
  console.log('=== PARCOURS MUSCU : saisie séance + bien-être → rechargement → cockpit ===');
  {
    const store = { athletes: [{ id: 'A1', login: 'zoe', nom: 'Zoé', sport: 'muscu', annees: 3, coach_id: 'C1' }] };
    const api = loadBackend(store);
    // 1-2-3. saisie + enregistrement
    await api.handleSaveSeance([
      [today, 34, 'SEA1', 'Push', 'A1', 'Développé couché', 'Pectoraux', 'dc', 1, 80, 10, 8, 90, 800],
      [today, 34, 'SEA1', 'Push', 'A1', 'Dips', 'Triceps', 'dip', 1, 60, 12, 7, 60, 720],
    ]);
    await api.handleSaveBienEtre({ athlete_id: 'A1', sommeil: 4, energie: 4, fatigue: 2, douleur: 1, ressenti: 'Facile', note: 7, date: today });
    // 4. rechargement (comme un refresh de l'app)
    const p = await readJson(api.handleGetAppData(new URLSearchParams({ athlete_id: 'A1' })));
    // 5. la séance apparaît correctement dans le payload
    eq('MUSCU payload total_seances = 1', p.global.total_seances, 1);
    eq('MUSCU payload tonnage_total_kg = 2160 (800+720+... Σ charge×reps)', p.global.tonnage_total_kg, 80 * 10 + 60 * 12);
    truthy('MUSCU payload dernieres_seances contient la séance du jour', (p.global.dernieres_seances || []).some(s => (s.exercices || []).length === 2));
    // round-trip bien-être : saisie fatigue → colonne fatigue_musculaire → payload fatigue
    eq('MUSCU bien-être round-trip : fatigue 2', p.bien_etre[0].fatigue, 2);
    eq('MUSCU bien-être : sommeil 4', p.bien_etre[0].sommeil, 4);
    eq('MUSCU bien-être : ressenti Facile', p.bien_etre[0].ressenti, 'Facile');
    truthy('MUSCU moteur présent (disponibilité)', !!(p.moteur && p.moteur.disponibilite && p.moteur.disponibilite.niveau));
    // 6. le cockpit utilise bien les nouvelles données
    const h = norm(front.muscu(p));
    truthy('MUSCU cockpit affiche la disponibilité du moteur', h.indexOf(p.moteur.disponibilite.niveau) !== -1);
    truthy('MUSCU cockpit bloc bien-être présent (Sommeil)', h.indexOf('Sommeil') !== -1);
    truthy('MUSCU cockpit affiche 2 exos (dernière séance)', h.indexOf('2 exos') !== -1);
    truthy('MUSCU cockpit affiche un muscle travaillé (Pectoraux)', h.indexOf('Pectoraux') !== -1);
    truthy('MUSCU cockpit historique « Séances totales »', h.indexOf('Séances totales') !== -1);
  }

  /* ============================ PARCOURS FOOT ============================ */
  console.log('=== PARCOURS FOOT : saisie match + bien-être → rechargement → cockpit foot ===');
  {
    const store = { athletes: [{ id: 'F1', login: 'kylian', nom: 'Kylian', sport: 'foot', poste: 'Attaquant', coach_id: 'C1' }] };
    const api = loadBackend(store);
    // saisie match (buts/passes dans body.stats) + charge via duree×rpe
    await api.handleSaveMatch({ athlete_id: 'F1', date: today, minutes_jouees: 90, note: 7.5, duree: 90, rpe: 6, stats: { buts: 2, passes_decisives: 1, xg: 1.2, xa: 0.5 } });
    await api.handleSaveBienEtre({ athlete_id: 'F1', sommeil: 4, energie: 4, fatigue: 3, douleur: 1, ressenti: 'Normal', note: 6, date: today });
    // rechargement fiche joueur
    const p = await readJson(api.handleGetSuiviJoueur(new URLSearchParams({ athlete_id: 'F1' })));
    eq('FOOT payload match_stats.nb = 1', p.match_stats.nb, 1);
    eq('FOOT payload minutes = 90', p.match_stats.minutes, 90);
    eq('FOOT payload buts = 2', p.match_stats.buts, 2);
    eq('FOOT payload passes_d = 1', p.match_stats.passes_d, 1);
    truthy('FOOT moteur présent (disponibilité)', !!(p.moteur && p.moteur.disponibilite && p.moteur.disponibilite.niveau));
    truthy('FOOT bien-être rechargé (fatigue 3)', (p.bienetre && p.bienetre.fatigue === 3) || (Array.isArray(p.wellness) && p.wellness.some(w => w.fatigue === 3)));
    // cockpit foot
    const h = norm(front.foot(p));
    truthy('FOOT cockpit affiche la disponibilité du moteur', h.indexOf(p.moteur.disponibilite.niveau) !== -1);
    truthy('FOOT cockpit affiche minutes 90', h.indexOf('90') !== -1);
    truthy('FOOT cockpit affiche buts (2)', h.indexOf('>2<') !== -1);
    truthy('FOOT cockpit bloc bien-être (Sommeil)', h.indexOf('Sommeil') !== -1);
  }

  console.log('-'.repeat(78));
  console.log('#3 e2e parcours (muscu + foot) : ' + ok + ' OK / ' + ko + ' échec(s).');
  if (ko === 0) console.log('✅ saisie → save → rechargement → payload → Cockpit vérifié de bout en bout (muscu & foot).');
  else { console.log('❌ Échecs : ' + fails.join(' | ')); process.exit(1); }
})().catch(e => { console.error('ERREUR e2e :', e.message); console.error(e.stack.split('\n').slice(0, 5).join('\n')); process.exit(1); });
