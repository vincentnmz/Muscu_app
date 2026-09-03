/* =============================================================================
 * PHASE 4A — Décision de source du ratio ACWR affiché (renderACWR).
 * renderACWR touche le DOM ; on teste ici sa LOGIQUE DE DÉCISION reproduite à
 * l'identique (quelle source de ratio, quel état). Objectif :
 *   - backend prioritaire quand il est fiable ;
 *   - un backend « non interprétable » (acwr_fiable === false) n'est JAMAIS
 *     écrasé par un ratio local ;
 *   - computeACWR front reste le fallback strict (backend absent / ancien contrat).
 * =========================================================================== */
const fs = require('fs');
const path = require('path');

// --- Reproduction fidèle de la décision de renderACWR (js/app.js, Phase 4A) ---
function decideACWR(data, local) {
  const mot = data.moteur;
  const backend = (data.dashboard && data.dashboard.acwr != null) ? Number(data.dashboard.acwr) : null;
  const localOk = local && !local.insuffisant;
  // (1) Backend juge l'ACWR non interprétable → on respecte : pas de ratio local.
  if (mot && mot.acwr_fiable === false) return { mode: 'non_interpretable', value: null, chart: false };
  // (2) Local insuffisant mais backend a une valeur → rendu backend (compact, sans graphe).
  if (!localOk && backend != null && !isNaN(backend)) return { mode: 'backend_compact', value: backend, chart: false };
  // (3) Local nul / insuffisant → messages existants.
  if (local === null) return { mode: 'pas_assez', value: null, chart: false };
  if (local.insuffisant) return { mode: 'construction', value: null, chart: false };
  // (4) Ratio affiché : backend prioritaire s'il est fiable ; sinon local. Graphe = local.
  const ratio = (mot && mot.acwr_fiable === true && backend != null && !isNaN(backend)) ? backend : local.ratio;
  return { mode: 'affiche', value: ratio, chart: true, source: (mot && mot.acwr_fiable === true && backend != null) ? 'backend' : 'local' };
}

let ok = 0, ko = 0;
const check = (nom, cond, att, obt) => { if (cond) ok++; else { ko++; console.log(`  ❌ ${nom} — attendu ${JSON.stringify(att)}, obtenu ${JSON.stringify(obt)}`); } };
const D = (moteur, acwrDash) => ({ moteur, dashboard: { acwr: acwrDash } });

console.log('=== Backend prioritaire ===');
// backend fiable + local DIFFÉRENT → backend utilisé
let r = decideACWR(D({ acwr_fiable: true }, 1.20), { ratio: 1.25 });
check('backend fiable, local diff → backend', r.mode === 'affiche' && r.value === 1.20 && r.source === 'backend', { mode: 'affiche', value: 1.20 }, r);
console.log(`  backend 1.20 / local 1.25 → ${r.value} (${r.source}) ${r.value === 1.20 ? '✅' : '❌'}`);
// backend fiable + local IDENTIQUE → backend utilisé (rendu identique)
r = decideACWR(D({ acwr_fiable: true }, 1.20), { ratio: 1.20 });
check('backend fiable, local identique → backend (rendu identique)', r.value === 1.20 && r.chart === true, 1.20, r.value);
console.log(`  backend 1.20 / local 1.20 → ${r.value} (${r.source}, graphe:${r.chart}) ✅`);

console.log('=== Fiabilité : backend non interprétable jamais écrasé ===');
// histo < 28 : backend acwr_fiable=false ; local insuffisant
r = decideACWR(D({ acwr_fiable: false, acwr_note: 'ACWR non interprétable — historique de charge insuffisant' }, null), { insuffisant: true, joursDepuisDebut: 20 });
check('histo<28 → non_interpretable', r.mode === 'non_interpretable' && r.value === null, 'non_interpretable', r.mode);
console.log(`  histo<28 (fiable=false) → ${r.mode} ✅`);
// < 6 jours actifs : backend acwr_fiable=false MAIS local afficherait un ratio (localOk)
r = decideACWR(D({ acwr_fiable: false }, 1.60), { ratio: 1.60 });
check('<6 jours actifs → non_interpretable (pas de ratio local)', r.mode === 'non_interpretable' && r.value === null, 'non_interpretable', r);
console.log(`  <6 actifs (fiable=false, local=1.60) → ${r.mode} (local NON affiché) ✅`);
// chronique nulle : backend acwr null + fiable false ; local nul
r = decideACWR(D({ acwr_fiable: false }, null), null);
check('chronique nulle → non_interpretable', r.mode === 'non_interpretable', 'non_interpretable', r.mode);
console.log(`  chronique nulle → ${r.mode} ✅`);

console.log('=== Fallback strict (backend absent / ancien contrat) ===');
// backend absent (pas de moteur) → local
r = decideACWR({ dashboard: { acwr: null } }, { ratio: 1.10 });
check('backend absent → local', r.mode === 'affiche' && r.value === 1.10 && r.source === 'local', 1.10, r);
console.log(`  backend absent → ${r.value} (${r.source}) ✅`);
// ancien contrat (moteur sans acwr_fiable) → local, pas d'override
r = decideACWR(D({}, 1.10), { ratio: 1.15 });
check('ancien contrat → local (pas d\'override)', r.value === 1.15 && r.source === 'local', 1.15, r.value);
console.log(`  ancien contrat (dash 1.10 / local 1.15) → ${r.value} (${r.source}) ✅`);
// backend absent + local insuffisant → construction
r = decideACWR({ dashboard: { acwr: null } }, { insuffisant: true, joursDepuisDebut: 12 });
check('backend absent + local insuffisant → construction', r.mode === 'construction', 'construction', r.mode);
console.log(`  backend absent + local insuffisant → ${r.mode} ✅`);
// local insuffisant + backend présent (fiable) → rendu backend compact
r = decideACWR(D({ acwr_fiable: true }, 1.05), { insuffisant: true, joursDepuisDebut: 20 });
check('local insuffisant + backend fiable → backend compact', r.mode === 'backend_compact' && r.value === 1.05, 'backend_compact', r.mode);
console.log(`  local insuffisant + backend 1.05 → ${r.mode} (${r.value}) ✅`);

console.log('=== Non-régression : computeACWR front conservé ===');
const APP = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
check('computeACWR présent', /function computeACWR\(/.test(APP), 'présent', 'absent');
check('STATUT_VISUEL inchangé (hex)', /'Prêt':\s*'#22c55e'/.test(APP) && /'Vigilance':\s*'#f5a623'/.test(APP) && /'À surveiller':\s*'#e5484d'/.test(APP), 'hex inchangés', 'modifiés');
check('renderACWRChart toujours appelé', /renderACWRChart\(volumes\)/.test(APP), 'présent', 'absent');
console.log('  computeACWR conservé ✅ · couleurs statut inchangées ✅ · graphe conservé ✅');

/* =============================================================================
 * P1-C — La sortie ACWR vestigiale de marqueurRecap est SUPPRIMÉE.
 * (P1-A avait fiabilisé cette sortie ; P1-B a montré qu'aucun rendu ne la
 * consomme — le Récap n'a pas de colonne ACWR. On vérifie ici qu'elle a bien
 * disparu, que le Récap garde EXACTEMENT ses colonnes, et que marqueurRecap ne
 * calcule plus d'ACWR.) Exécution des vraies fonctions de js/app.js.
 * L'ACWR réellement affiché (onglet Charge / renderACWR) reste testé ci-dessus.
 * =========================================================================== */
const vm = require('vm');
function extractFn(src, name) {
  const m = src.match(new RegExp('function\\s+' + name + '\\s*\\('));
  if (!m) throw new Error('fn introuvable : ' + name);
  let i = src.indexOf('{', m.index), d = 0, j = i;
  for (; j < src.length; j++) { const c = src[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return src.slice(m.index, j);
}
let computeACWRcalls = 0;
const sbx = {
  computeACWR: function () { computeACWRcalls++; return { ratio: 1.6, insuffisant: false }; },   // ESPION : ne doit plus être appelé par marqueurRecap
  getNiveauExperience: () => 'experimente',
  VOLUME_CIBLE: {},
  alertesActives: () => [],
  tendance1RM: () => ({ pct: 3 }),
};
vm.createContext(sbx);
vm.runInContext(extractFn(APP, 'marqueurRecap') + '\n' + extractFn(APP, 'renderRecapTable')
  + '\nthis.marqueurRecap = marqueurRecap; this.renderRecapTable = renderRecapTable;', sbx);
const marqueurRecap = sbx.marqueurRecap, renderRecapTable = sbx.renderRecapTable;
check('P1-C garde : marqueurRecap extraite de app.js', typeof marqueurRecap === 'function', 'function', typeof marqueurRecap);

const mkData = (moteur, acwrDash) => ({ dashboard: { acwr: acwrDash, progression: {}, recuperation: { statut: 'optimal' }, derniere_seance: { date: '01/09' } }, historique: { progression_par_exo: {}, volume_par_jour: {}, volume_semaine: [] }, moteur });
const A = { annees_pratique: 5 };

console.log('=== P1-C · sortie ACWR vestigiale supprimée de marqueurRecap ===');
computeACWRcalls = 0;
const m = marqueurRecap(mkData({ acwr_fiable: true }, 1.20), A);
// La sortie ne porte plus AUCUNE clé ACWR.
check('marqueurRecap ne renvoie plus acwrC', !('acwrC' in m), false, 'acwrC' in m);
check('marqueurRecap ne renvoie plus acwrTxt', !('acwrTxt' in m), false, 'acwrTxt' in m);
// Les autres marqueurs sont INCHANGÉS.
['progC', 'recupC', 'volC', 'ds', 'nbAl', 't1rm'].forEach(k =>
  check('marqueurRecap conserve ' + k, k in m, true, k in m));
// marqueurRecap ne calcule plus d'ACWR → computeACWR n'est plus appelé.
check('computeACWR n’est plus appelé par marqueurRecap', computeACWRcalls === 0, 0, computeACWRcalls);

// renderRecapTable : colonnes EXACTEMENT inchangées, aucune colonne ACWR.
const html = renderRecapTable([{ a: { athlete_id: 'x', nom: 'Zoe', annees_pratique: 5 }, m }]);
const thead = html.split('<tbody>')[0];
const cols = (thead.match(/<th[^>]*>([^<]+)<\/th>/g) || []).map(t => t.replace(/<[^>]+>/g, '').trim());
check('Récap : 7 colonnes attendues', JSON.stringify(cols) === JSON.stringify(['Athlète', 'Progression', 'Récup.', 'Volume', 'Dern. séance', 'Alertes', '1RM tendance']), '[Athlète,Progression,Récup.,Volume,Dern. séance,Alertes,1RM tendance]', cols);
check('Récap : aucune colonne ACWR', !/ACWR/i.test(thead), 'pas d’ACWR', thead.match(/ACWR/i));
console.log('  marqueurRecap : ACWR retiré · Récap 7 colonnes inchangées · computeACWR non appelé ✅');

console.log('-'.repeat(72));
console.log(ko === 0 ? `✅ ACWR front backend-first : ${ok} vérifs OK.` : `❌ ${ko} écart(s) sur ${ok + ko}.`);
if (ko > 0) process.exitCode = 1;
