/* =============================================================================
 * « Dernière fois » de la saisie (28/10/2026) — vrai handleGetLastPerf : la
 * référence = dernière date où l'exercice a été fait (quelle que soit la séance),
 * séries triées, avec RPE ET repos de chaque série (affichés dans le tableau S1…).
 * ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const ROOT = path.join(__dirname, '..');
const T = fs.readFileSync(path.join(__dirname, 'e2e-parcours.test.js'), 'utf8');
eval(T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend')));

let _id = 1; const P = (date, sid, serie, charge, reps, rpe, repos, exo) => ({ id: _id++, athlete_id: 'A1', date, seance_id: sid, exercice: exo || 'Leg curl', serie, charge, reps, rpe, repos });
const store = { performances: [
  P('2026-10-13', 'jambes', 1, 30, 10, 8, 90),
  P('2026-10-20', 'jambes 2', 2, 35, 8, 8, 120), P('2026-10-20', 'jambes 2', 1, 35, 8, 9, 90), P('2026-10-20', 'jambes 2', 3, 35, 7, null, null),
  // 21/11 : Squat dans 2 séances le même jour, charges différentes → la séance du soir (enregistrée après) fait référence.
  P('2026-10-27', 'matin', 1, 50, 10, 8, 90, 'Squat'), P('2026-10-27', 'matin', 2, 50, 10, 8, 90, 'Squat'),
  P('2026-10-27', 'soir', 1, 60, 6, 8, 120, 'Squat'), P('2026-10-27', 'soir', 2, 60, 6, 9, 120, 'Squat'),
] };
const client = makeEngine(store);
let js = stripTypeScriptTypes(fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { handleGetLastPerf };';
const sb = { createClient: () => client, webpush: { setVapidDetails() {}, sendNotification: async () => {} }, Deno: { env: { get: () => 'x' }, serve: () => {} },
  Response, Request, URL, URLSearchParams, TextEncoder, TextDecoder, crypto, console, setTimeout, clearTimeout, fetch: async () => ({}) };
vm.createContext(sb); vm.runInContext(js, sb);

let ok = 0, ko = 0; const fails = [];
const eq = (c, n, g) => { if (c) ok++; else { ko++; fails.push(n); console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };
(async () => {
  const d = await (await sb.__api.handleGetLastPerf(new URLSearchParams({ athlete_id: 'A1', seance_id: 'jambes' }))).json();
  const o = d.perfs['Leg curl'];
  eq(o && String(o.date).slice(0, 10) === '2026-10-20', 'référence = dernière fois (autre séance)', o && o.date);
  eq(o && o.series.map(s => s.serie).join() === '1,2,3', 'séries triées', o && o.series);
  eq(o && o.series[0].repos === 90 && o.series[1].repos === 120, 'repos de chaque série renvoyé', o && o.series);
  eq(o && o.series[2].repos === null && o.series[2].rpe === null, 'repos / RPE non saisis → null (pas inventé)', o && o.series[2]);
  eq(o && o.series[0].rpe === 9, 'RPE renvoyé', o && o.series[0]);
  eq(o && String(o.prev_date).slice(0, 10) === '2026-10-13' && o.prev_series.length === 1 && o.prev_series[0].reps === 10, 'avant-dernière fois : détail des séries (surcharge 2 séances de suite)', o && o.prev_series);
  const q = d.perfs['Squat'];
  eq(q && q.series.length === 2 && q.series.every(s => s.charge === 60) && q.last_charge === 60 && q.max_reps === 6, '2 séances le même jour : dernière fois = la dernière séance (60 × 6), pas un mélange', q && q.series);
  console.log('-'.repeat(70));
  console.log('dernière fois (repos) : ' + ok + ' OK / ' + ko + ' KO');
  if (ko) { console.log('Échecs : ' + fails.join(' | ')); process.exit(1); }
})();
