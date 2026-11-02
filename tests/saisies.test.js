/* Audit saisies (02/11/2026) — vrais handlers, base en mémoire.
 * S1 RPE cardio unique (bilan) + charge interne + anciens RPE relus · S2 note gardée · S4 bilan remplacé · S5 bornes. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const T = fs.readFileSync(path.join(__dirname, 'e2e-parcours.test.js'), 'utf8');
eval(T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend')));
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g).slice(0, 300) + ')' : '')); } };
const store = { athletes: [{ id: 'A1', nom: 'Léa', sport: 'muscu' }], indicateurs: [], bien_etre: [], performances: [] };
const client = makeEngine(store);
let js = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { handleSaveBilanSeance, handleSaveCardio, handleGetAppData };';
const sb = { createClient: () => client, webpush: { setVapidDetails() {}, sendNotification: async () => {} }, Deno: { env: { get: () => undefined }, serve: () => {} },
  Response, Request, URLSearchParams, TextEncoder, TextDecoder, crypto, console: { log() {}, error() {}, warn() {} }, atob, btoa, setTimeout, clearTimeout, Intl, fetch: async () => ({ ok: false, json: async () => ({}) }) };
vm.createContext(sb); vm.runInContext(js, sb);
const A = sb.__api, J = async (r) => (await r).json();
const rows = (sid, cle) => store.indicateurs.filter(r => r.seance_id === sid && (!cle || r.cle === cle));
(async () => {
  // S5 — bornes et date future.
  eq((await J(A.handleSaveCardio({ athlete_id: 'A1', date: '2026-10-30', type_cardio: 'footing', duree: '-20' }))).success === false, 'S5 : durée négative refusée');
  eq((await J(A.handleSaveCardio({ athlete_id: 'A1', date: '2026-10-30', type_cardio: 'footing', duree: '30', fc_moy: '260' }))).success === false, 'S5 : FC 260 refusée');
  eq((await J(A.handleSaveCardio({ athlete_id: 'A1', date: '2099-01-01', type_cardio: 'footing', duree: '30' }))).success === false, 'S5 : date future refusée');
  const c = await J(A.handleSaveCardio({ athlete_id: 'A1', date: '2026-10-30', type_cardio: 'footing', duree: '40', distance: '8' }));
  eq(c.success && !rows(c.seance_id, 'rpe').length, 'Cardio sans RPE dans le formulaire');
  // S1 — RPE du bilan → recopié sur la séance + charge interne = 7 × 40.
  await J(A.handleSaveBilanSeance({ athlete_id: 'A1', type: 'cardio', seance_id: c.seance_id, date: '2026-10-30', rpe: 7, douleur: 1, note: 'Jambes lourdes' }));
  eq(rows(c.seance_id, 'rpe_cardio').length === 1 && rows(c.seance_id, 'rpe')[0]?.valeur === '7' && rows(c.seance_id, 'charge_interne')[0]?.valeur === '280', 'S1 : RPE du bilan → rpe + charge interne 280', rows(c.seance_id).map(r => r.cle + '=' + r.valeur));
  // S4 — 2e envoi du même bilan : remplacé, pas ajouté.
  await J(A.handleSaveBilanSeance({ athlete_id: 'A1', type: 'cardio', seance_id: c.seance_id, date: '2026-10-30', rpe: 6, note: 'Jambes lourdes' }));
  eq(rows(c.seance_id, 'rpe_cardio').length === 1 && rows(c.seance_id, 'rpe_cardio')[0].valeur === '6' && rows(c.seance_id, 'rpe').length === 1 && rows(c.seance_id, 'charge_interne')[0].valeur === '240' && rows(c.seance_id, 'note_cardio').length === 1, 'S4 : bilan renvoyé = remplacé (RPE 6, charge 240, 1 note)');
  // S2 — note muscu sans coach gardée avec la séance.
  await J(A.handleSaveBilanSeance({ athlete_id: 'A1', type: 'muscu', seance_id: 'pec epaule', date: '02/11/2026', rpe: 8, note: 'Épaule qui tire' }));
  eq(rows('pec epaule', 'note_muscu')[0]?.valeur === 'Épaule qui tire', 'S2 : note muscu enregistrée avec la séance');
  // S1 — ancienne séance cardio avec RPE du formulaire, sans bilan → lue par « Effort ».
  store.indicateurs.push({ id: 900, date: '2026-09-23', athlete_id: 'A1', seance_id: 'cardio_ancien', cle: 'type_cardio', valeur: 'velo', unite: '', source: 'saisie' },
    { id: 901, date: '2026-09-23', athlete_id: 'A1', seance_id: 'cardio_ancien', cle: 'rpe', valeur: '8', unite: '1-10', source: 'saisie' },
    { id: 902, date: '2026-09-20', athlete_id: 'A1', seance_id: 'm123', cle: 'rpe', valeur: '9', unite: '1-10', source: 'saisie' });
  const d = await J(A.handleGetAppData(new URLSearchParams({ athlete_id: 'A1' })));
  const rc = (d.analyses && d.analyses.rpe_cardio) || [];
  eq(rc.some(x => x.seance_id === 'cardio_ancien' && x.valeur === 8), 'S1 : ancien RPE du formulaire visible dans Effort', rc);
  eq(!rc.some(x => x.seance_id === 'm123'), 'S1 : un RPE de match n\'est pas pris pour du cardio');
  eq(rc.filter(x => x.seance_id === c.seance_id).length === 1, 'S1 : séance avec bilan comptée une seule fois');
  eq((d.analyses.notes_muscu || []).some(n => n.note === 'Épaule qui tire' && n.date === '2026-11-02'), 'S2 : note renvoyée à l\'app (Par séance)');
  console.log('-'.repeat(70)); console.log('saisies : ' + ok + ' OK / ' + ko + ' KO'); if (ko) process.exitCode = 1;
})();
