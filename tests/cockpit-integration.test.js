/* =============================================================================
 * PHASE 5A — ÉTAPE 8 : garde-fou d'intégration du cockpit muscu.
 * Vérifie le masquage RÉVERSIBLE des anciennes cartes strictement redondantes :
 *   OFF (COCKPIT_ON=false) → cockpit invisible, AUCUNE ancienne carte masquée ;
 *   ON  (COCKPIT_ON=true)  → cockpit A→F visible, SEUL le doublon intégral
 *                            (dash-kpis) masqué ; cartes porteuses d'info unique
 *                            (dash-recup, dash-etat) CONSERVÉES ;
 *   PROTECTION : le masquage ne supprime rien, ne touche ni Progression, ni Foot,
 *                ni Prépa, et ne modifie aucun calcul.
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

function extractFn(name) {
  const m = SRC.match(new RegExp('function\\s+' + name + '\\s*\\('));
  if (!m) throw new Error('fn introuvable: ' + name);
  let d = 0, j = SRC.indexOf('{', m.index);
  for (; j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return SRC.slice(m.index, j);
}
function extractDecl(name) {
  const m = SRC.match(new RegExp('(?:const|let|var)\\s+' + name + '\\s*=\\s*'));
  if (!m) throw new Error('decl introuvable: ' + name);
  let i = m.index + m[0].length; const open = SRC[i], close = open === '[' ? ']' : '}';
  let d = 0, j = i;
  for (; j < SRC.length; j++) { const c = SRC[j]; if (c === open) d++; else if (c === close) { d--; if (d === 0) { j++; break; } } }
  return SRC.slice(m.index, j) + ';';
}

const fnNames = ['_ckColRecup', '_ckColNiv3', '_ckConf', '_ckMini', 'renderCockpitEtat', '_ckT', '_ckKpi', 'renderCockpitCharge', '_ckWbColor', 'wqPositif', '_ckFormeQuestionnaire', 'renderCockpitBienEtre', '_ckKpiC', 'renderCockpitPerformance', 'renderCockpitHistorique', '_ckSpark', '_ckDir', '_ckWeeklyVolume', 'renderCockpitEvolution', 'renderCockpit', 'appliquerMasquageCockpit'];
const code = extractDecl('_CK_CTX') + '\n' + extractDecl('WQ_DIMS') + '\n' + extractDecl('WQ_ANSWERS') + '\n' + extractDecl('COCKPIT_DOUBLONS_IDS') + '\n' + fnNames.map(extractFn).join('\n');

let ok = 0, ko = 0;
const check = (n, c) => { if (c) ok++; else { ko++; console.log('  ❌ ' + n); } };

const dataMuscu = {
  sport: 'muscu',
  moteur: { disponibilite: { niveau: 'Vigilance' }, recup: 'Moyen', surcharge: 'Faible', risque_blessure: 'Modéré', confiance: 'haute', reco: 'Vigilance — surveiller.', acwr_fiable: true, acwr_categorie: 'normal' },
  dashboard: { acwr: 1.12, tonnage: { j7: 12.4, evol_pct: 8 }, regularite: { seances_j7: 4 }, streak: { semaines: 5 } },
  comparison: { j28_vs_j28prec: { tonnage: { j28: 46.2, evol_pct: 4 } } },
  recent: { j7: { seances: 4, rpe_moyen: 7.8 } },
  bien_etre: [{ sommeil: 2, energie: 3, fatigue: 4, douleur: 2, zone: 'Genou', ressenti: 3, note: 'x' }, { sommeil: 3, energie: 3, fatigue: 3, douleur: 1, ressenti: 4 }],
  historique: { progression_par_exo: { Squat: [{ charge: 100, reps: 5 }] }, volume_semaine: [{ muscle: 'Quadriceps', faites: 12 }], volume_par_jour: { '2026-08-10': 5000, '2026-08-24': 6000 } },
  global: { records_30j: 2, total_seances: 37, tonnage_total_kg: 128400, dernieres_seances: [{ date: '30/08', tonnage: 8200, exercices: ['Squat'] }] },
  poids: [{ date: '30/08', poids: 82 }, { date: '01/07', poids: 84 }],
};

// Rendu du conteneur cockpit (comme cockpit-ne-decide-pas)
function runCockpit(flag, data, prefix) {
  const store = {};
  const sandbox = {
    COCKPIT_ON: flag,
    escapeHtml: s => String(s == null ? '' : s),
    couleurStatut: l => ({ 'Prêt': '#22c55e', 'Vigilance': '#f5a623', 'À surveiller': '#e5484d' }[l] || '#22c55e'),
    tendance1RM: prog => ({ pct: (prog && Object.keys(prog).length) ? 5 : null }),
    document: { getElementById: id => store[id] || (store[id] = { innerHTML: '' }) },
  };
  vm.createContext(sandbox);
  vm.runInContext(code + '\nrenderCockpit(' + JSON.stringify(data) + ', ' + JSON.stringify(prefix) + ');', sandbox);
  return (store[prefix + '-cockpit'] || {}).innerHTML || '';
}

// Simulation du masquage : magasin d'anciennes cartes avec un style.display initial
function runMasquage(flag) {
  const mk = (disp) => ({ style: { display: disp } });
  const store = {
    'dash-kpis':       mk('grid'),  // doublon B+E
    'dash-recup-sec':  mk(''),      // récup (A) + monotonie/strain (B) → couvert
    'dash-recup-card': mk(''),
    'dash-etat-sec':   mk(''),      // 5 dims (C) + score/100 (C) → couvert
    'dash-etat-card':  mk(''),
    'cd-etat-sec':     mk(''),      // idem côté coach → couvert
    'cd-etat-card':    mk(''),
    'cd-recup':        mk(''),      // CONSERVÉ : action « en faire un conseil »
    'tab-historique': mk(''),       // onglet Progression → jamais touché
    'hist-progression-content': mk(''),
    'cd-progression-content': mk(''),
  };
  const sandbox = { COCKPIT_ON: flag, document: { getElementById: id => store[id] || null } };
  vm.createContext(sandbox);
  vm.runInContext(code + '\nappliquerMasquageCockpit();', sandbox);
  return store;
}

// ── 1) OFF : cockpit invisible + aucune carte masquée ────────────────────────
check('OFF → cockpit conteneur vide', runCockpit(false, dataMuscu, 'dash') === '');
const offMask = runMasquage(false);
check('OFF → dash-kpis NON masqué (grid conservé)', offMask['dash-kpis'].style.display === 'grid');
check('OFF → dash-recup NON masqué', offMask['dash-recup-card'].style.display === '');
check('OFF → dash-etat NON masqué', offMask['dash-etat-card'].style.display === '');
check('OFF → cd-etat NON masqué', offMask['cd-etat-card'].style.display === '');
check('OFF → cd-recup NON masqué', offMask['cd-recup'].style.display === '');
check('OFF → onglet Progression NON masqué', offMask['tab-historique'].style.display === '');

// ── 2) ON : cockpit A→F visible ──────────────────────────────────────────────
const htmlOn = runCockpit(true, dataMuscu, 'dash');
check('ON → cockpit non vide', htmlOn.length > 0);
check('ON → bloc A (État / disponibilité)', /Vigilance/.test(htmlOn));
check('ON → bloc B (Charge)', /Charge d.entraînement/.test(htmlOn));
check('ON → bloc C (Bien-être)', /🫀 Bien-être/.test(htmlOn));
check('ON → bloc D (Évolution)', /📈 Évolution/.test(htmlOn));
check('ON → bloc E (Performance)', /🏋️ Performance/.test(htmlOn));
check('ON → bloc F (Historique)', /📅 Historique/.test(htmlOn));

// ── 3) ON : doublons entièrement couverts masqués ; cd-recup (action) conservé ─
const onMask = runMasquage(true);
check('ON → dash-kpis MASQUÉ (doublon B+E)', onMask['dash-kpis'].style.display === 'none');
check('ON → dash-recup MASQUÉ (carte)', onMask['dash-recup-card'].style.display === 'none');
check('ON → dash-recup MASQUÉ (en-tête)', onMask['dash-recup-sec'].style.display === 'none');
check('ON → dash-etat MASQUÉ (carte)', onMask['dash-etat-card'].style.display === 'none');
check('ON → dash-etat MASQUÉ (en-tête)', onMask['dash-etat-sec'].style.display === 'none');
check('ON → cd-etat MASQUÉ (carte)', onMask['cd-etat-card'].style.display === 'none');
check('ON → cd-etat MASQUÉ (en-tête)', onMask['cd-etat-sec'].style.display === 'none');
check('ON → cd-recup CONSERVÉ (action « en faire un conseil »)', onMask['cd-recup'].style.display !== 'none');
check('ON → onglet Progression (tab-historique) CONSERVÉ', onMask['tab-historique'].style.display !== 'none');
check('ON → hist-progression-content CONSERVÉ', onMask['hist-progression-content'].style.display !== 'none');
check('ON → cd-progression-content CONSERVÉ', onMask['cd-progression-content'].style.display !== 'none');
// L'action coach « en faire un conseil » existe toujours dans le source (non déplacée)
check('action « en faire un conseil » toujours présente (repondreAlerte)', SRC.includes('repondreAlerte(') && SRC.includes('En faire un conseil'));

// ── 4) PROTECTION statique — le mécanisme ne supprime rien, périmètre borné ──
const idsSrc = extractDecl('COCKPIT_DOUBLONS_IDS');
// cd-recup (action conseil) et tous les périmètres protégés ne doivent JAMAIS être listés
for (const interdit of ['cd-recup', 'tab-historique', 'progression', 'foot', 'prepa', 'heatmap', 'radar', 'match', 'contexte', 'analyse', 'alertes', 'cardio', 'objectif', 'prepa-cockpit']) {
  check('liste masquage n\'inclut pas « ' + interdit + ' »', !idsSrc.includes(interdit));
}
// et inclut bien les cartes désormais couvertes (carte + en-tête)
for (const attendu of ['dash-kpis', 'dash-recup-sec', 'dash-recup-card', 'dash-etat-sec', 'dash-etat-card', 'cd-etat-sec', 'cd-etat-card']) {
  check('liste masquage inclut « ' + attendu + ' »', idsSrc.includes(attendu));
}
const bodyMask = extractFn('appliquerMasquageCockpit');
check('masquage : garde-fou OFF (if (!COCKPIT_ON) return)', /if\s*\(\s*!COCKPIT_ON\s*\)\s*return/.test(bodyMask));
check('masquage : agit UNIQUEMENT sur style.display', /style\.display\s*=\s*'none'/.test(bodyMask));
for (const destructif of ['removeChild', 'remove(', 'innerHTML', 'delete ', 'outerHTML', '.value']) {
  check('masquage : aucune opération destructive (' + destructif.trim() + ')', !bodyMask.includes(destructif));
}
// Aucune fonction métier / de calcul appelée par le masquage
for (const metier of ['computeACWR', 'calculerACWR', 'evaluerEtatAthlete', 'NovalyzEngine', 'CORE_SEUILS']) {
  check('masquage n\'appelle pas ' + metier, !bodyMask.includes(metier));
}
// Les fonctions détaillées de Progression existent toujours dans le source
for (const fn of ['function afficherProgressionExo(', 'function renderProg12Semaines(', 'function dessinerProgChartExo(', 'function afficherCoachProgressionExo(', 'function afficherCoachTendances(']) {
  check('Progression intacte : ' + fn.replace('function ', '').replace('(', ''), SRC.includes(fn));
}

console.log('-'.repeat(66));
console.log(ko === 0
  ? `✅ Intégration cockpit — ${ok} vérifs (OFF inchangé · ON masque les doublons couverts · cd-recup + Progression/Foot/Prépa intacts).`
  : `❌ ${ko} écart(s) sur ${ok + ko}.`);
if (ko > 0) process.exitCode = 1;
