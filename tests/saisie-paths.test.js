/* =============================================================================
 * #3 — Value-tests des PARCOURS DE SAISIE (bien-être · séance · objectif · poids).
 *
 * On exécute les VRAIS handlers de production de supabase/functions/handler/
 * index.ts (types TS retirés), en remplaçant UNIQUEMENT le client Supabase par
 * un double de test qui CAPTURE ce qui serait écrit. La logique testée (mapping
 * des champs, coercition de type, dates, écrasement, valeurs manquantes) est le
 * vrai code — seule l'I/O base est mockée. Aucune modif de production.
 *
 * Objectif : verrouiller que la saisie qui ALIMENTE les agrégations/cockpit ne
 * se trompe pas de colonne, de type, de date, et gère l'absence de valeur.
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');

const JS = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
function extractFn(name) {
  const m = JS.match(new RegExp('(?:async )?function\\s+' + name + '\\s*\\('));
  if (!m) throw new Error('fn introuvable : ' + name);
  let i = JS.indexOf('{', m.index), d = 0, j = i;
  for (; j < JS.length; j++) { const c = JS[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return JS.slice(m.index, j);
}

const bundle = [
  extractFn('parseFR'), extractFn('fmtYMD'), extractFn('normDate'),
  extractFn('handleSaveSeance'), extractFn('handleSaveBienEtre'),
  extractFn('handleSaveObjectif'), extractFn('handleSavePoids'),
  // stub de réponse
  'function jsonResp(data, status){ return { __resp: data, status: status || 200 }; }',
  // double Supabase : capture les écritures, renvoie des données de select configurables
  'let _sb;',
  'function sb(){ return _sb; }',
  `function makeSb(selectData){
     const writes = []; selectData = selectData || {};
     function node(table){
       const self = {
         _t: table,
         from(t){ return node(t); },
         insert(p){ writes.push({ table: self._t, op: 'insert', payload: p }); return self; },
         update(p){ writes.push({ table: self._t, op: 'update', payload: p }); return self; },
         upsert(p){ writes.push({ table: self._t, op: 'upsert', payload: p }); return self; },
         delete(){ writes.push({ table: self._t, op: 'delete' }); return self; },
         select(){ return self; }, eq(){ return self; }, in(){ return self; }, neq(){ return self; },
         limit(){ return self; }, single(){ return self; }, maybeSingle(){ return self; },
         order(){ return self; }, like(){ return self; },
         then(res){ res({ data: (self._t in selectData ? selectData[self._t] : []), error: null }); },
       };
       return self;
     }
     return { from(t){ return node(t); }, __writes: writes };
   }`,
  `async function runSave(name, arg, selectData){
     _sb = makeSb(selectData);
     const fns = { handleSaveSeance, handleSaveBienEtre, handleSaveObjectif, handleSavePoids };
     const resp = await fns[name](arg);
     return { resp, writes: _sb.__writes };
   }`,
  'this.runSave = runSave; this.fmtYMD = fmtYMD; this.normDate = normDate;',
].join('\n');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(bundle, sandbox);
const { runSave, fmtYMD } = sandbox;
const TODAY = fmtYMD(new Date());

let ok = 0, ko = 0; const fails = [];
const eq = (n, got, exp) => { const p = JSON.stringify(got) === JSON.stringify(exp); if (p) ok++; else { ko++; fails.push(n); console.log('  ❌ ' + n + ' — attendu ' + JSON.stringify(exp) + ', obtenu ' + JSON.stringify(got)); } };
const truthy = (n, c) => { c ? ok++ : (ko++, fails.push(n), console.log('  ❌ ' + n)); };
const findW = (writes, table, op) => writes.find(w => w.table === table && (!op || w.op === op));

(async () => {
  /* ===================== 1) BIEN-ÊTRE ==================================== */
  console.log('=== 1) handleSaveBienEtre : mapping colonnes + types + date ===');
  let { writes } = await runSave('handleSaveBienEtre', {
    athlete_id: 'A1', seance_id: 'S1', date: '20/08/2026',
    sommeil: '4', energie: 3, fatigue: '5', douleur: 2, zone: 'Genou', ressenti: 'Facile', note: '7',
  }, {});
  let p = (findW(writes, 'bien_etre', 'insert') || {}).payload || {};
  eq('BE date normalisée FR→ISO', p.date, '2026-08-20');
  eq('BE athlete_id', p.athlete_id, 'A1');
  eq('BE seance_id', p.seance_id, 'S1');
  eq('BE sommeil (num)', p.sommeil, 4);
  eq('BE energie (num)', p.energie, 3);
  eq('BE fatigue → colonne fatigue_musculaire (mapping)', p.fatigue_musculaire, 5);
  truthy('BE pas de colonne « fatigue » brute', p.fatigue === undefined);
  eq('BE douleur (num)', p.douleur, 2);
  eq('BE zone → zone_douloureuse (mapping)', p.zone_douloureuse, 'Genou');
  eq('BE ressenti → ressenti_global (mapping, string)', p.ressenti_global, 'Facile');
  eq('BE note (num)', p.note, 7);
  // valeurs manquantes → null (jamais rejet)
  ({ writes } = await runSave('handleSaveBienEtre', { athlete_id: 'A1', sommeil: '', energie: 'abc', fatigue: null, douleur: 4 }, {}));
  p = (findW(writes, 'bien_etre', 'insert') || {}).payload || {};
  eq('BE sommeil vide → null', p.sommeil, null);
  eq('BE energie non-numérique → null', p.energie, null);
  eq('BE fatigue null → fatigue_musculaire null', p.fatigue_musculaire, null);
  eq('BE zone absente → null', p.zone_douloureuse, null);
  eq('BE date absente → aujourd’hui', p.date, TODAY);
  eq('BE seance_id absent → null', p.seance_id, null);
  // manque athlete_id → erreur, aucune écriture
  ({ writes } = await runSave('handleSaveBienEtre', { sommeil: 4 }, {}));
  eq('BE sans athlete_id → aucune écriture', writes.length, 0);

  /* ===================== 2) SÉANCE ====================================== */
  console.log('=== 2) handleSaveSeance : mapping colonnes + coercition + agrégats indicateurs ===');
  // data = [date, semaine, seance_id, nom, athlete_id, exercice, muscle, exercice_id, serie, charge, reps, rpe, repos, volume]
  const seanceData = [
    ['20/08/2026', 34, 'SEA1', 'Push', 'A1', 'Développé couché', 'Pectoraux', 'dc', 1, 80, 10, 8, 90, 800],
    ['20/08/2026', 34, 'SEA1', 'Push', 'A1', 'Développé couché', 'Pectoraux', 'dc', 2, 80, 8, 8, 90, 640],
    ['20/08/2026', 34, 'SEA1', 'Push', 'A1', 'Dips', 'Triceps', 'dip', 1, 0, 12, 7, 60, ''],
  ];
  ({ writes } = await runSave('handleSaveSeance', seanceData, {}));
  const perf = findW(writes, 'performances', 'insert');
  truthy('SEA insert performances présent', !!perf);
  const rows = perf.payload;
  eq('SEA 3 lignes de séries', rows.length, 3);
  eq('SEA row1 date ISO', rows[0].date, '2026-08-20');
  eq('SEA row1 charge = col[9] = 80', rows[0].charge, 80);
  eq('SEA row1 reps = col[10] = 10', rows[0].reps, 10);
  eq('SEA row1 rpe = col[11] = 8', rows[0].rpe, 8);
  eq('SEA row1 serie = col[8] = 1', rows[0].serie, 1);
  eq('SEA row1 athlete_id string', rows[0].athlete_id, 'A1');
  eq('SEA row3 volume vide → null (coercition)', rows[2].volume, null);
  eq('SEA row3 charge 0 → 0 (pas null)', rows[2].charge, 0);
  // indicateurs agrégés
  const indic = findW(writes, 'indicateurs', 'insert');
  truthy('SEA insert indicateurs présent', !!indic);
  const ind = indic.payload;
  const val = (cle) => { const r = ind.find(x => x.cle === cle && !x.seance_id.includes('_exo_')); return r ? r.valeur : undefined; };
  // tonnage_total = 80*10 + 80*8 + 0*12 = 800 + 640 + 0 = 1440
  eq('SEA tonnage_total = 1440 (Σ charge×reps)', val('tonnage_total'), '1440');
  eq('SEA nb_series = 3', val('nb_series'), '3');
  eq('SEA rpe_moyen = 7.7 ((8+8+7)/3)', val('rpe_moyen'), '7.7');
  eq('SEA exercices listés', val('exercices'), 'Développé couché,Dips');
  eq('SEA muscles listés', val('muscles'), 'Pectoraux,Triceps');
  // tonnage par exo : dc = 1440, dip = 0
  const exoRows = ind.filter(x => x.cle === 'tonnage_exo');
  eq('SEA 2 lignes tonnage_exo', exoRows.length, 2);
  truthy('SEA tonnage_exo dc = 1440', exoRows.some(r => r.valeur === '1440'));
  // data vide → erreur
  ({ writes } = await runSave('handleSaveSeance', [], {}));
  eq('SEA data vide → aucune écriture', writes.length, 0);

  /* ===================== 3) OBJECTIF (écrasement voulu) ================== */
  console.log('=== 3) handleSaveObjectif : résolution + écrasement 1 ligne/athlète ===');
  // pas d'objectif existant → insert + maj athletes.strategie
  ({ writes } = await runSave('handleSaveObjectif', { athlete_id: 'A1', objectif: 'Prise de masse' }, { objectif: [] }));
  eq('OBJ nouveau → insert objectif', (findW(writes, 'objectif', 'insert') || {}).payload, { athlete_id: 'A1', objectif: 'Prise de masse' });
  truthy('OBJ maj athletes.strategie', !!writes.find(w => w.table === 'athletes' && w.op === 'update'));
  // objectif existant → UPDATE (écrasement), pas d'insert
  ({ writes } = await runSave('handleSaveObjectif', { athlete_id: 'A1', objectif: 'Sèche' }, { objectif: [{ id: 9 }] }));
  truthy('OBJ existant → update (écrasement voulu)', !!findW(writes, 'objectif', 'update'));
  truthy('OBJ existant → PAS d’insert', !findW(writes, 'objectif', 'insert'));
  // fallback strategie si objectif absent
  ({ writes } = await runSave('handleSaveObjectif', { athlete_id: 'A1', strategie: 'Force' }, { objectif: [] }));
  eq('OBJ fallback body.strategie', (findW(writes, 'objectif', 'insert') || {}).payload.objectif, 'Force');

  /* ===================== 4) POIDS ======================================= */
  console.log('=== 4) handleSavePoids : type + date + valeur manquante ===');
  ({ writes } = await runSave('handleSavePoids', { athlete_id: 'A1', poids: '72.5', date: '20/08/2026', athlete_nom: 'Zoé' }, {}));
  p = (findW(writes, 'poids_historique', 'insert') || {}).payload || {};
  eq('POIDS valeur numérique', p.poids, 72.5);
  eq('POIDS date ISO', p.date, '2026-08-20');
  eq('POIDS athlete_nom', p.athlete_nom, 'Zoé');
  ({ writes } = await runSave('handleSavePoids', { athlete_id: 'A1', poids: 80 }, {}));
  p = (findW(writes, 'poids_historique', 'insert') || {}).payload || {};
  eq('POIDS date absente → aujourd’hui', p.date, TODAY);
  // manque poids (undefined) → erreur, aucune écriture
  ({ writes } = await runSave('handleSavePoids', { athlete_id: 'A1' }, {}));
  eq('POIDS sans poids → aucune écriture', writes.length, 0);
  // ⚠️ CONTRAT ACTUEL VERROUILLÉ (documenté §rapport) : poids '' → Number('')=0 stocké
  ({ writes } = await runSave('handleSavePoids', { athlete_id: 'A1', poids: '' }, {}));
  p = (findW(writes, 'poids_historique', 'insert') || {}).payload || {};
  eq('POIDS vide → 0 (contrat actuel, backend ne garde pas le vide)', p.poids, 0);

  /* ===================== Bilan ========================================== */
  console.log('-'.repeat(78));
  console.log('#3 saisie (bien-être/séance/objectif/poids) : ' + ok + ' OK / ' + ko + ' échec(s).');
  if (ko === 0) console.log('✅ Mapping, types, dates, écrasement et valeurs manquantes verrouillés sur les vrais handlers.');
  else { console.log('❌ Échecs : ' + fails.join(' | ')); process.exit(1); }
})();
