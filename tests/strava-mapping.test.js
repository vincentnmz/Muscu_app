/* =============================================================================
 * INTÉGRATION STRAVA — Étape 1 : value-tests du mapping pur + champs max.
 *
 * Exécute le VRAI code de production de supabase/functions/handler/index.ts
 * (types TS retirés) : `mapStravaActivite` (conversions d'unités Strava → cardio)
 * et `_buildCardioRows` (désormais avec vitesse_max / puissance_max).
 * Valeurs attendues écrites à la main (non circulaire). Aucune modif de prod ici.
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');

const JS = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
function extractFn(name) {
  const m = JS.match(new RegExp('function\\s+' + name + '\\s*\\('));
  if (!m) throw new Error('fn introuvable : ' + name);
  let i = JS.indexOf('{', m.index), d = 0, j = i;
  for (; j < JS.length; j++) { const c = JS[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return JS.slice(m.index, j);
}
const SRC_MAP = extractFn('mapStravaActivite');
const SRC_ROWS = extractFn('_buildCardioRows');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(SRC_MAP + '\n' + SRC_ROWS + '\nthis.mapStravaActivite = mapStravaActivite; this._buildCardioRows = _buildCardioRows;', sandbox);
const { mapStravaActivite, _buildCardioRows } = sandbox;

let ok = 0, ko = 0; const fails = [];
const eq = (n, got, exp) => { const p = JSON.stringify(got) === JSON.stringify(exp); if (p) ok++; else { ko++; fails.push(n); console.log('  ❌ ' + n + ' — attendu ' + JSON.stringify(exp) + ', obtenu ' + JSON.stringify(got)); } };
const truthy = (n, c) => { c ? ok++ : (ko++, fails.push(n), console.log('  ❌ ' + n)); };
// helper : récupère la valeur d'une clé dans les lignes indicateurs produites
const rowVal = (rows, cle) => { const r = rows.find(x => x.cle === cle); return r ? r.valeur : undefined; };
const rowUnit = (rows, cle) => { const r = rows.find(x => x.cle === cle); return r ? r.unite : undefined; };

/* ===================== GARDE ANTI-REPRODUCTION =========================== */
truthy('garde: mapStravaActivite fait bien la conversion m/s→km/h (* 3.6)', SRC_MAP.indexOf('3.6') !== -1);
truthy('garde: mapStravaActivite convertit s→min (/ 60)', SRC_MAP.indexOf('/ 60') !== -1);
truthy('garde: _buildCardioRows émet vitesse_max (champ ajouté en prod)', SRC_ROWS.indexOf("'vitesse_max'") !== -1);
truthy('garde: _buildCardioRows émet puissance_max (champ ajouté en prod)', SRC_ROWS.indexOf("'puissance_max'") !== -1);

/* ===================== mapStravaActivite — conversions ==================== */
console.log('=== mapStravaActivite : conversions d’unités Strava → cardio ===');
const full = {
  id: 12345, type: 'Ride', sport_type: 'Ride',
  distance: 40000, moving_time: 3600, elapsed_time: 3800,
  average_speed: 11.111, max_speed: 16.667,
  average_watts: 185.4, max_watts: 642, average_cadence: 88.2,
  average_heartrate: 148.6, has_heartrate: true, calories: 720,
  start_date_local: '2026-08-20T09:00:00Z',
};
const m = mapStravaActivite(full);
eq('type_cardio = velo', m.type_cardio, 'velo');
eq('strava_id conservé', m.strava_id, '12345');
eq('date = 2026-08-20 (start_date_local tronquée)', m.date, '2026-08-20');
eq('duree = 60 min (3600 s / 60)', m.duree, 60);
eq('distance = 40 km (40000 m / 1000)', m.distance, 40);
eq('vitesse_moy = 40.0 km/h (11.111 m/s × 3.6)', m.vitesse_moy, 40);
eq('vitesse_max = 60.0 km/h (16.667 m/s × 3.6)', m.vitesse_max, 60);
eq('puissance_moy = 185 W (arrondi 185.4)', m.puissance_moy, 185);
eq('puissance_max = 642 W', m.puissance_max, 642);
eq('cadence = 88 rpm (arrondi 88.2)', m.cadence, 88);
eq('fc_moy = 149 bpm (arrondi 148.6)', m.fc_moy, 149);
eq('calories = 720 kcal', m.calories, 720);

/* ===================== filtrage type d'activité ========================== */
console.log('=== filtrage : vélo uniquement ===');
eq('Run → null', mapStravaActivite({ id: 1, type: 'Run', sport_type: 'Run' }), null);
eq('Swim → null', mapStravaActivite({ id: 1, type: 'Swim', sport_type: 'Swim' }), null);
eq('null → null', mapStravaActivite(null), null);
truthy('VirtualRide → mappé (velo)', mapStravaActivite({ id: 2, sport_type: 'VirtualRide', start_date_local: '2026-08-01T00:00:00Z' }).type_cardio === 'velo');
truthy('GravelRide → mappé (velo)', mapStravaActivite({ id: 3, sport_type: 'GravelRide', start_date_local: '2026-08-01T00:00:00Z' }).type_cardio === 'velo');
truthy('MountainBikeRide → mappé (velo)', mapStravaActivite({ id: 4, sport_type: 'MountainBikeRide', start_date_local: '2026-08-01T00:00:00Z' }).type_cardio === 'velo');

/* ===================== absence de puissance / calories =================== */
console.log('=== données manquantes : pas de valeur inventée ===');
const noPow = mapStravaActivite({ id: 5, type: 'Ride', distance: 20000, moving_time: 1800, average_speed: 11.111, start_date_local: '2026-08-02T00:00:00Z' });
eq('sans puissance → puissance_moy null', noPow.puissance_moy, null);
eq('sans puissance → puissance_max null', noPow.puissance_max, null);
eq('sans cadence → cadence null', noPow.cadence, null);
eq('sans FC → fc_moy null', noPow.fc_moy, null);
eq('sans calories (résumé) → calories null', noPow.calories, null);
eq('distance quand même mappée = 20 km', noPow.distance, 20);

/* ===================== chaîne map → _buildCardioRows ===================== */
console.log('=== chaîne mapStravaActivite → _buildCardioRows (lignes indicateurs) ===');
const rows = _buildCardioRows(m, 'athX', 'cardio_strava_12345', m.date);
eq('row type_cardio = velo', rowVal(rows, 'type_cardio'), 'velo');
eq('row duree = 60 (min)', rowVal(rows, 'duree'), '60'); eq('unité duree', rowUnit(rows, 'duree'), 'min');
eq('row distance = 40 (km)', rowVal(rows, 'distance'), '40'); eq('unité distance', rowUnit(rows, 'distance'), 'km');
eq('row vitesse_moy = 40 (km/h)', rowVal(rows, 'vitesse_moy'), '40');
eq('row vitesse_max = 60 (km/h) [NOUVEAU champ]', rowVal(rows, 'vitesse_max'), '60'); eq('unité vitesse_max', rowUnit(rows, 'vitesse_max'), 'km/h');
eq('row puissance_moy = 185 (W)', rowVal(rows, 'puissance_moy'), '185');
eq('row puissance_max = 642 (W) [NOUVEAU champ]', rowVal(rows, 'puissance_max'), '642'); eq('unité puissance_max', rowUnit(rows, 'puissance_max'), 'W');
eq('row cadence = 88 (rpm)', rowVal(rows, 'cadence'), '88');
eq('row fc_moy = 149 (bpm)', rowVal(rows, 'fc_moy'), '149');
eq('row calories = 720 (kcal)', rowVal(rows, 'calories'), '720');

/* ===================== non-régression _buildCardioRows =================== */
console.log('=== non-régression : saisie manuelle sans max → aucune ligne max ===');
const manual = { type_cardio: 'velo', duree: 45, distance: 20, vitesse_moy: 26.7, puissance_moy: 180, rpe: 6 };
const rowsM = _buildCardioRows(manual, 'athX', 'cardio_123', '2026-08-20');
truthy('sans vitesse_max fourni → aucune ligne vitesse_max', rowVal(rowsM, 'vitesse_max') === undefined);
truthy('sans puissance_max fourni → aucune ligne puissance_max', rowVal(rowsM, 'puissance_max') === undefined);
truthy('charge_interne toujours calculée (duree×rpe = 270)', rowVal(rowsM, 'charge_interne') === '270');
// max = 0 → non stocké (comportement addNum : n===0 ignoré)
const zeroMax = _buildCardioRows({ type_cardio: 'velo', duree: 30, puissance_max: 0, vitesse_max: 0 }, 'a', 's', '2026-08-20');
truthy('puissance_max = 0 → non stockée (0 ignoré)', rowVal(zeroMax, 'puissance_max') === undefined);

/* ===================== Bilan ============================================= */
console.log('-'.repeat(78));
console.log('Strava mapping (Étape 1) : ' + ok + ' OK / ' + ko + ' échec(s).');
if (ko === 0) console.log('✅ mapStravaActivite (conversions) + champs max de _buildCardioRows verrouillés sur le vrai code.');
else { console.log('❌ Échecs : ' + fails.join(' | ')); process.exit(1); }
