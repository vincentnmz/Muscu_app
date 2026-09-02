/* =============================================================================
 * P0-B — Test d'EXÉCUTION de la chaîne ACWR centrale (production).
 *
 * OBJECTIF : n'exécuter PLUS une copie de la formule ACWR, mais les VRAIES
 * fonctions de production extraites de supabase/functions/handler/index.ts :
 *   calculerChargeSport → calculerACWR → fiabiliteACWR → interpreterACWR
 * (types TS retirés, Node ≥ 22 ; fonctions pures, aucun accès Supabase/Deno).
 *
 * Les valeurs attendues sont établies À LA MAIN à partir des règles/constantes
 * réelles (CORE_SEUILS.acwr, CORE_FIABILITE, CORE_CONTEXTES) — non circulaire.
 *
 * Oracle SECONDAIRE : reproduction historique CONSERVÉE (préfixe _repro) comme
 * détecteur de divergence uniquement. Toute divergence prod↔reproduction = STOP
 * (signalée, aucune correction automatique). index.ts n'est PAS modifié.
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');

const SRC_PATH = path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts');
const JS = stripTypeScriptTypes(fs.readFileSync(SRC_PATH, 'utf8'));

function extractFn(name) {
  const m = JS.match(new RegExp('function\\s+' + name + '\\s*\\('));
  if (!m) throw new Error('fn de production introuvable : ' + name);
  let i = JS.indexOf('{', m.index), d = 0, j = i;
  for (; j < JS.length; j++) { const c = JS[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return JS.slice(m.index, j);
}
function extractObj(name) {
  const m = JS.match(new RegExp('const\\s+' + name + '\\s*=\\s*'));
  if (!m) throw new Error('const introuvable : ' + name);
  const i = JS.indexOf('{', m.index); let d = 0, j = i;
  for (; j < JS.length; j++) { const c = JS[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return 'const ' + name + ' = ' + JS.slice(i, j) + ';';
}

// Sources extraites (servent aussi au garde anti-reproduction).
const SRC = {
  calculerACWR: extractFn('calculerACWR'),
  fiabiliteACWR: extractFn('fiabiliteACWR'),
  interpreterACWR: extractFn('interpreterACWR'),
  calculerChargeSport: extractFn('calculerChargeSport'),
};

const bundle = [
  extractObj('CORE_SEUILS'),
  extractObj('CORE_FIABILITE'),
  extractObj('CORE_CONTEXTES'),
  extractFn('fmtYMD'),
  extractFn('minus'),
  extractFn('parseFR'),
  extractFn('normDate'),
  extractFn('_joursDepuis'),
  SRC.calculerChargeSport,
  SRC.calculerACWR,
  SRC.fiabiliteACWR,
  SRC.interpreterACWR,
].join('\n\n');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(bundle + '\n' + ['calculerACWR', 'fiabiliteACWR', 'interpreterACWR', 'calculerChargeSport', 'fmtYMD', 'minus']
  .map(n => `this.${n}=${n};`).join(''), sandbox);
const { calculerACWR, fiabiliteACWR, interpreterACWR, calculerChargeSport, fmtYMD, minus } = sandbox;

// Horloge déterministe UTC. dayKey(o) = date ISO à o jours avant NOW (via minus prod).
const NOW = new Date('2026-08-20T00:00:00Z');
const dayKey = (o) => fmtYMD(minus(NOW, o));

let ok = 0, ko = 0; const fails = [];
const check = (n, cond, exp, got) => { if (cond) ok++; else { ko++; fails.push(n); console.log('  ❌ ' + n + ' — attendu ' + JSON.stringify(exp) + ', obtenu ' + JSON.stringify(got)); } };
const eq = (n, got, exp) => check(n, got === exp, exp, got);

/* ===================== GARDE ANTI-REPRODUCTION ===========================
 * Prouve que ce sont les vrais corps de prod qui tournent, pas des copies. */
eq('garde: calculerACWR contient « joursActifs28++ » (corps prod)', SRC.calculerACWR.indexOf('joursActifs28++') !== -1, true);
eq('garde: interpreterACWR référence CORE_SEUILS.acwr', SRC.interpreterACWR.indexOf('CORE_SEUILS.acwr') !== -1, true);
eq('garde: fiabiliteACWR référence CORE_FIABILITE', SRC.fiabiliteACWR.indexOf('CORE_FIABILITE') !== -1, true);
eq('garde: fiabiliteACWR gère acwrRepriseJours', SRC.fiabiliteACWR.indexOf('acwrRepriseJours') !== -1, true);
eq("garde: calculerChargeSport filtre 'charge_interne'", SRC.calculerChargeSport.indexOf("'charge_interne'") !== -1, true);
['calculerACWR', 'fiabiliteACWR', 'interpreterACWR', 'calculerChargeSport'].forEach(f =>
  eq('garde: ' + f + ' est bien une fonction extraite', typeof sandbox[f], 'function'));

/* ===================== A. calculerACWR — VALEURS EXACTES ==================
 * ratio = round(aigue / (somme28/4) * 100)/100 ; aigue = Σ jours 0..6 ;
 * somme28 = Σ jours 0..27 (jours incl. les 7 aigus) ; chronique = somme28/4. */
const mapConst = (v, from, to) => { const m = {}; for (let o = from; o <= to; o++) m[dayKey(o)] = v; return m; };

// A1 nominal : 100/jour sur 28 j → ACWR 1.0
{ const r = calculerACWR(mapConst(100, 0, 27), NOW);
  eq('A1 aigue = 700', r.aigue, 700); eq('A1 chronique = 700', r.chronique, 700);
  eq('A1 ratio = 1.0', r.ratio, 1); eq('A1 joursActifs28 = 28', r.joursActifs28, 28); }

// A2 surcharge : 300 aigu / 100 chronique → ACWR 2.0
{ const m = Object.assign(mapConst(300, 0, 6), mapConst(100, 7, 27));
  const r = calculerACWR(m, NOW);
  eq('A2 aigue = 2100', r.aigue, 2100); eq('A2 chronique = 1050', r.chronique, 1050);
  eq('A2 ratio = 2.0', r.ratio, 2); eq('A2 joursActifs28 = 28', r.joursActifs28, 28); }

// A3 sous-charge : 30 aigu / 70 chronique → ACWR 0.5
{ const m = Object.assign(mapConst(30, 0, 6), mapConst(70, 7, 27));
  const r = calculerACWR(m, NOW);
  eq('A3 aigue = 210', r.aigue, 210); eq('A3 chronique = 420', r.chronique, 420); eq('A3 ratio = 0.5', r.ratio, 0.5); }

// A4 ratio pile 1.30 : 13 aigu / 9 chronique
{ const m = Object.assign(mapConst(13, 0, 6), mapConst(9, 7, 27));
  const r = calculerACWR(m, NOW);
  eq('A4 aigue = 91', r.aigue, 91); eq('A4 chronique = 70', r.chronique, 70); eq('A4 ratio = 1.30', r.ratio, 1.3); }

/* ===================== B. FENÊTRES 7 / 28 j (bornes) =====================
 * Test critique < vs <= : jour o=6 (dernier aigu), o=7 (hors aigu, dans chron.),
 * o=27 (dernier chronique), o=28 (hors 28 j → ignoré). */
{ const m = { [dayKey(6)]: 100, [dayKey(7)]: 100, [dayKey(27)]: 100, [dayKey(28)]: 100 };
  const r = calculerACWR(m, NOW);
  eq('B o=6 compte dans aiguë (aigue = 100)', r.aigue, 100);
  eq('B o=7 hors aiguë mais dans 28 j ; o=27 dans 28 j ; o=28 exclu (somme28 = 300)', r.chronique * 4, 300);
  eq('B chronique = 75', r.chronique, 75);
  eq('B ratio = 1.33 (100/75)', r.ratio, 1.33);
  eq('B joursActifs28 = 3 (o=6,7,27 ; o=28 exclu)', r.joursActifs28, 3); }

/* ===================== C. Données insuffisantes (calculerACWR) ===========*/
{ const r = calculerACWR({}, NOW);
  eq('C1 map vide → ratio null', r.ratio, null); eq('C1 aigue 0', r.aigue, 0);
  eq('C1 chronique 0', r.chronique, 0); eq('C1 joursActifs28 0', r.joursActifs28, 0); }
{ const r = calculerACWR({ [dayKey(0)]: 100 }, NOW);   // 1 seul jour
  eq('C2 1 jour → aigue 100', r.aigue, 100); eq('C2 chronique 25', r.chronique, 25);
  eq('C2 ratio 4.0 (calculerACWR ne juge pas la fiabilité)', r.ratio, 4);
  eq('C2 joursActifs28 = 1', r.joursActifs28, 1); }

/* ===================== D. fiabiliteACWR (production) ======================
 * (premiere, ctxObj, now, joursActifs28) → bool. Seuils réels : histoMin=28,
 * joursActifsMin=6, retour_vacances.acwrRepriseJours=28. */
eq('D1 histo≥28 & jActifs≥6 & sans ctx → true', fiabiliteACWR(dayKey(40), null, NOW, 10), true);
eq('D2 histo=20 (<28) → false', fiabiliteACWR(dayKey(20), null, NOW, 10), false);
eq('D3 jActifs=5 (<6) → false', fiabiliteACWR(dayKey(40), null, NOW, 5), false);
eq('D4 frontière histo=28 (=histoMin) → true', fiabiliteACWR(dayKey(28), null, NOW, 6), true);
eq('D5 frontière histo=27 (<histoMin) → false', fiabiliteACWR(dayKey(27), null, NOW, 6), false);
eq('D6 frontière jActifs=6 (=min) → true', fiabiliteACWR(dayKey(40), null, NOW, 6), true);
eq('D7 retour_vacances reprise 5 j (<28) → false', fiabiliteACWR(dayKey(40), { etat: 'retour_vacances', date_debut: dayKey(5) }, NOW, 10), false);
eq('D8 retour_vacances reprise 40 j (≥28) → true', fiabiliteACWR(dayKey(40), { etat: 'retour_vacances', date_debut: dayKey(40) }, NOW, 10), true);
eq('D9 retour_blessure n’invalide pas l’ACWR → true', fiabiliteACWR(dayKey(40), { etat: 'retour_blessure' }, NOW, 10), true);
eq('D10 premiere null → false', fiabiliteACWR(null, null, NOW, 10), false);

/* ===================== E. interpreterACWR (production) ====================
 * Seuils réels : bas=0.8, optMax=1.3, haut=1.5 (comparaisons STRICTES). */
eq('E1 ratio null → non_interpretable', interpreterACWR(null, true), 'non_interpretable');
eq('E2 fiable=false → non_interpretable', interpreterACWR(1.0, false), 'non_interpretable');
eq('E3 0.5 → sous_charge', interpreterACWR(0.5, true), 'sous_charge');
eq('E4 0.79 (<bas) → sous_charge', interpreterACWR(0.79, true), 'sous_charge');
eq('E5 0.80 (=bas) → normal', interpreterACWR(0.80, true), 'normal');
eq('E6 0.81 → normal', interpreterACWR(0.81, true), 'normal');
eq('E7 1.00 → normal', interpreterACWR(1.0, true), 'normal');
eq('E8 1.29 → normal', interpreterACWR(1.29, true), 'normal');
eq('E9 1.30 (=optMax) → normal', interpreterACWR(1.30, true), 'normal');
eq('E10 1.31 (>optMax) → vigilance', interpreterACWR(1.31, true), 'vigilance');
eq('E11 1.49 → vigilance', interpreterACWR(1.49, true), 'vigilance');
eq('E12 1.50 (=haut) → vigilance', interpreterACWR(1.50, true), 'vigilance');
eq('E13 1.51 (>haut) → eleve', interpreterACWR(1.51, true), 'eleve');
eq('E14 2.00 → eleve', interpreterACWR(2.0, true), 'eleve');

/* ===================== F. CHAÎNE COMPLÈTE (prod) =========================
 * rows → calculerChargeSport(sport) → calculerACWR → fiabiliteACWR → interpreterACWR.
 * Équivalence muscu↔foot (même série physique) vérifiée. */
function rowsFoot(spec) { const r = []; for (const [o, v] of spec) r.push({ cle: 'charge_interne', date: dayKey(o), valeur: String(v) }); return r; }
function rowsMuscu(spec) { const r = []; for (const [o, v] of spec) r.push({ date: dayKey(o), charge: v / 10, reps: 10 }); return r; } // tonnage = charge×reps = v
function chaine(sport, rows, ctx) {
  const cs = calculerChargeSport(sport, rows);
  const a = calculerACWR(cs.chargeParJour, NOW);
  const fi = fiabiliteACWR(cs.premiere, ctx || null, NOW, a.joursActifs28);
  return { ratio: a.ratio, premiere: cs.premiere, fiable: fi, categorie: interpreterACWR(a.ratio, fi) };
}
const specNominal = []; for (let o = 0; o <= 28; o++) specNominal.push([o, 100]);          // 100/j, 29 j (premiere = o28)
const specSurcharge = []; for (let o = 0; o <= 6; o++) specSurcharge.push([o, 300]); for (let o = 7; o <= 28; o++) specSurcharge.push([o, 100]);
const specInsuffisant = []; for (let o = 0; o <= 27; o++) specInsuffisant.push([o, 100]);   // premiere = o27 → histo 27 < 28

{ const F = chaine('foot', rowsFoot(specNominal)), M = chaine('muscu', rowsMuscu(specNominal));
  eq('F1 nominal → ratio 1.0', F.ratio, 1); eq('F1 nominal → fiable', F.fiable, true); eq('F1 nominal → normal', F.categorie, 'normal');
  eq('F1 premiere = J-28', F.premiere, dayKey(28));
  eq('F1 muscu ≡ foot (ratio)', M.ratio, F.ratio); eq('F1 muscu ≡ foot (catégorie)', M.categorie, F.categorie); }
{ const F = chaine('foot', rowsFoot(specSurcharge));
  eq('F2 surcharge → ratio 2.0', F.ratio, 2); eq('F2 surcharge → fiable', F.fiable, true); eq('F2 surcharge → eleve', F.categorie, 'eleve'); }
{ const F = chaine('foot', rowsFoot(specInsuffisant));
  eq('F3 fenêtre pleine mais 1re charge à J-27 → ratio calculé 1.0', F.ratio, 1);
  eq('F3 → non fiable (histo < 28 j)', F.fiable, false);
  eq('F3 → non_interpretable', F.categorie, 'non_interpretable'); }
{ const F = chaine('foot', rowsFoot(specNominal), { etat: 'retour_vacances', date_debut: dayKey(5) });
  eq('F4 reprise vacances 5 j → non fiable', F.fiable, false); eq('F4 → non_interpretable', F.categorie, 'non_interpretable'); }

/* ===================== ORACLE SECONDAIRE (reproduction) ==================
 * Copies historiques — SERVENT UNIQUEMENT à détecter une divergence. */
const DAY = 86400000;
const _iso = (d) => d.toISOString().slice(0, 10);
const _joursDepuisRepro = (s, now = NOW) => { if (!s) return null; const dt = new Date(s + 'T00:00:00Z'); return isNaN(dt) ? null : Math.floor((now - dt) / DAY); };
function _reproCharge(sport, rows) { const c = {}; let p = null; const add = (d, v) => { if (!d || !(v > 0)) return; c[d] = (c[d] || 0) + v; if (!p || d < p) p = d; }; if (sport === 'muscu') for (const r of rows) add(r.date, (Number(r.charge) || 0) * (Number(r.reps) || 0)); else if (sport === 'foot') for (const r of rows) { if (r.cle === 'charge_interne') add(r.date, Number(r.valeur) || 0); } else for (const r of rows) add(r.date, Number(r.charge) || 0); return { chargeParJour: c, premiere: p }; }
function _reproACWR(c, now = NOW) { let a = 0, s28 = 0, ja = 0; for (let d = 0; d < 28; d++) { const v = c[_iso(new Date(now.getTime() - d * DAY))] || 0; s28 += v; if (v > 0) ja++; if (d < 7) a += v; } const ch = s28 / 4; return { ratio: ch > 0 ? Math.round(a / ch * 100) / 100 : null, joursActifs28: ja }; }
function _reproFiab(p, ctx, now, ja) { const h = _joursDepuisRepro(p, now); if (h == null || h < 28) return false; if (ja < 6) return false; if (ctx && ctx.etat === 'retour_vacances') { const rd = _joursDepuisRepro(ctx.date_debut, now); if (rd != null && rd >= 0 && rd < 28) return false; } return true; }
function _reproInterp(r, f) { if (!f || r == null) return 'non_interpretable'; if (r > 1.5) return 'eleve'; if (r > 1.3) return 'vigilance'; if (r < 0.8) return 'sous_charge'; return 'normal'; }
function _reproChaine(sport, rows, ctx) { const cs = _reproCharge(sport, rows); const a = _reproACWR(cs.chargeParJour); const f = _reproFiab(cs.premiere, ctx || null, NOW, a.joursActifs28); return { ratio: a.ratio, fiable: f, categorie: _reproInterp(a.ratio, f) }; }

let divergences = 0;
const scen = [
  ['nominal', 'foot', rowsFoot(specNominal), null], ['surcharge', 'foot', rowsFoot(specSurcharge), null],
  ['insuffisant', 'foot', rowsFoot(specInsuffisant), null], ['reprise', 'foot', rowsFoot(specNominal), { etat: 'retour_vacances', date_debut: dayKey(5) }],
  ['nominal-muscu', 'muscu', rowsMuscu(specNominal), null],
];
for (const [nom, sport, rows, ctx] of scen) {
  const prod = chaine(sport, rows, ctx), rep = _reproChaine(sport, rows, ctx);
  const same = prod.ratio === rep.ratio && prod.fiable === rep.fiable && prod.categorie === rep.categorie;
  if (!same) { divergences++; console.log('  🔴 DIVERGENCE prod↔reproduction « ' + nom + ' »'); console.log('     prod :', JSON.stringify(prod)); console.log('     repro:', JSON.stringify(rep)); }
}
eq('oracle secondaire : aucune divergence prod↔reproduction', divergences, 0);

// ── Bilan ────────────────────────────────────────────────────────────────
console.log('-'.repeat(78));
console.log('P0-B — chaîne ACWR exécutée depuis index.ts : ' + ok + ' vérifs OK / ' + ko + ' échec(s).');
if (ko === 0) console.log('✅ calculerChargeSport → calculerACWR → fiabiliteACWR → interpreterACWR (production) exécutés et conformes.');
else { console.log('❌ Échecs : ' + fails.join(' | ')); process.exit(1); }
