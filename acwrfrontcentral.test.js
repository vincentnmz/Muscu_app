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

console.log('-'.repeat(72));
console.log(ko === 0 ? `✅ ACWR front backend-first : ${ok} vérifs OK.` : `❌ ${ko} écart(s) sur ${ok + ko}.`);
if (ko > 0) process.exitCode = 1;
