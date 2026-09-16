/* =============================================================================
 * P0 — « Lecture Novalyz » (buildSyntheseMuscu) : exécute la VRAIE fonction de
 * production extraite d'index.ts (types TS retirés) sur des cas déterministes.
 * La fonction est PURE (ne lit que ses arguments) → extraction directe.
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');

const SRC = path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts');
const JS = stripTypeScriptTypes(fs.readFileSync(SRC, 'utf8'));

function extractFn(name) {
  const m = JS.match(new RegExp('function\\s+' + name + '\\s*\\('));
  if (!m) throw new Error('fn introuvable : ' + name);
  let i = JS.indexOf('{', m.index), d = 0, j = i;
  for (; j < JS.length; j++) { const c = JS[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return JS.slice(m.index, j);
}
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext([
  extractFn('fmtYMD'), extractFn('minus'),
  extractFn('buildSyntheseMuscu'), extractFn('buildSyntheseCardio'), extractFn('buildSyntheseCroise'),
  'this.buildSyntheseMuscu = buildSyntheseMuscu; this.buildSyntheseCardio = buildSyntheseCardio; this.buildSyntheseCroise = buildSyntheseCroise;'
].join('\n'), sandbox);
const buildSyntheseMuscu = sandbox.buildSyntheseMuscu;
const buildSyntheseCardio = sandbox.buildSyntheseCardio;
const buildSyntheseCroise = sandbox.buildSyntheseCroise;
const cmp28 = (t28) => ({ j28_vs_j28prec: { tonnage: { j28: t28 } } });
const NOW = new Date();
const daysAgoISO = n => new Date(NOW.getTime() - n * 86400000).toISOString().slice(0, 10);

// nCur/nPrev = nb de séances sur 28 j courants / précédents (défaut = base solide).
const cmp = (tonEvol, rpeDiff, nCur = 6, nPrev = 6) => ({ j28_vs_j28prec: { tonnage: { evol_pct: tonEvol }, rpe: { diff: rpeDiff }, seances: { j28: nCur, j28_prec: nPrev } } });
const reg = (cur, prev) => ({ seances_semaine: cur, seances_prevues: prev });

let ok = 0, ko = 0, fails = [];
function check(label, cond) { if (cond) { ok++; } else { ko++; fails.push(label); console.log('  ❌ ' + label); } }

// A — progression saine, objectif prise de masse
let a = buildSyntheseMuscu('Prise de masse', cmp(10, 0), { recup: 'Bon' }, reg(3, 3));
check('A: constat positif présent', a.constats.some(c => c.ton === 'positif'));
check('A: reco info (continue)', a.reco && a.reco.priorite === 'info');
check('A: mentionne la prise de masse', a.constats.some(c => /prise de masse/i.test(c.texte)));
check('A: confiance bonne (compare + prévu)', a.confiance === 'bonne');

// B — effort sous contrainte + récup faible → reco haute priorité
let b = buildSyntheseMuscu('Sèche', cmp(1, 0.9), { recup: 'Faible' }, reg(3, 4));
check('B: constat attention présent', b.constats.some(c => c.ton === 'attention'));
check('B: reco priorité haute', b.reco && b.reco.priorite === 'haute');

// C — régularité insuffisante → reco moyenne
let c = buildSyntheseMuscu('Maintien', cmp(2, 0), { recup: 'Bon' }, reg(1, 4));
check('C: reco priorité moyenne', c.reco && c.reco.priorite === 'moyenne');
check('C: constat régularité', c.constats.some(x => /régularité/i.test(x.texte)));

// E — bonne progression MAIS état en vigilance → reco alignée (pas « augmente »)
let e = buildSyntheseMuscu('Prise de masse', cmp(10, 0), { recup: 'Bon', disponibilite: { niveau: 'Vigilance' } }, reg(3, 3));
check('E: reco moyenne (pas info) si Vigilance', e.reco && e.reco.priorite === 'moyenne');
check('E: reco s\'aligne sur l\'état (récup/vigilance/sans augmenter)', /récup|vigilance|sans l'augmenter/i.test(e.reco.texte));
check('E: reco ne pousse pas la « surcharge progressive »', !/surcharge progressive/i.test(e.reco.texte));
check('E: constat attention état présent', e.constats.some(x => x.ton === 'attention'));

// D — pas assez de données (aucune séance) → confiance faible, reco info
let d = buildSyntheseMuscu('', cmp(null, null, 0, 0), null, null);
check('D: confiance faible sans données', d.confiance === 'faible');
check('D: max 3 constats', d.constats.length <= 3);
check('D: reco toujours présente', !!d.reco);

// L — évolution calculée MAIS base trop courte (< 3 séances préc.) → pas de fausse
// progression, constat « pas assez de recul », confiance moyenne (fiabilité).
let l = buildSyntheseMuscu('Prise de masse', cmp(500, 0, 6, 1), { recup: 'Bon' }, reg(3, 3));
check('L: aucune fausse progression de volume', !l.constats.some(c => c.ton === 'positif' && /volume progresse/i.test(c.texte)));
check('L: constat « pas assez de recul »', l.constats.some(c => /recul/i.test(c.texte)));
check('L: confiance moyenne (base non fiable)', l.confiance === 'moyenne');

// M — respect du programme (exécution vs cible) intégré à la synthèse
let m1 = buildSyntheseMuscu('Prise de masse', cmp(8, 0), { recup: 'Bon' }, reg(3, 3), { nCible: 4, nEval: 4, nOk: 4 });
check('M: respect programme = constat positif', m1.constats.some(c => c.ton === 'positif' && /cible/i.test(c.texte)));
let m2 = buildSyntheseMuscu('Prise de masse', cmp(8, 0), { recup: 'Bon' }, reg(3, 3), { nCible: 4, nEval: 4, nOk: 1 });
check('M: respect programme faible = constat attention', m2.constats.some(c => c.ton === 'attention' && /cible/i.test(c.texte)));

// N — contexte DÉLOAD : une baisse de volume n'est PAS une régression (attendue)
let n1 = buildSyntheseMuscu('Prise de masse', cmp(-12, 0), { recup: 'Bon', contexte_tag: 'deload' }, reg(3, 3));
check('N: déload → baisse de volume en neutre', n1.constats.some(c => c.ton === 'neutre' && /déload/i.test(c.texte)));
check('N: déload → pas d\'attention « volume a baissé »', !n1.constats.some(c => c.ton === 'attention' && /volume a baissé/i.test(c.texte)));

// O — contexte INTENSIFICATION : hausse de RPE attendue (pas de « tu forces plus »)
let o1 = buildSyntheseMuscu('Prise de masse', cmp(1, 0.9), { recup: 'Bon', contexte_tag: 'intensification' }, reg(3, 3));
check('O: intensification → pas de « tu forces plus »', !o1.constats.some(c => /tu forces plus/i.test(c.texte)));
check('O: intensification → reco pas haute priorité', !(o1.reco && o1.reco.priorite === 'haute'));

// ── Cardio ──────────────────────────────────────────────────────────────────
// F — aucun cardio → constat neutre + reco info
let f = buildSyntheseCardio({ history: [] }, null, NOW);
check('F: reco info si pas de cardio', f.reco && f.reco.priorite === 'info');
check('F: confiance faible', f.confiance === 'faible');

// G — hausse rapide de charge cardio (28j vs 28j préc.) → attention + reco moyenne
let g = buildSyntheseCardio({ history: [
  { date: daysAgoISO(3), rpe: 8, duree: 60, distance: 12, fc_moy: 150 },
  { date: daysAgoISO(10), rpe: 8, duree: 60, distance: 12, fc_moy: 150 },
  { date: daysAgoISO(17), rpe: 8, duree: 50, distance: 10, fc_moy: 150 },
  // base de comparaison RÉELLE (≥ 2 sorties) sur la période précédente → % fiable
  { date: daysAgoISO(40), rpe: 5, duree: 30, distance: 5, fc_moy: 150 },
  { date: daysAgoISO(48), rpe: 5, duree: 30, distance: 5, fc_moy: 150 },
] }, { recup: 'Bon' }, NOW);
check('G: constat attention (charge)', g.constats.some(c => c.ton === 'attention'));
check('G: reco moyenne', g.reco && g.reco.priorite === 'moyenne');

// H — état vigilance → reco cardio facile / récup (jamais « pousse »)
let h = buildSyntheseCardio({ history: [ { date: daysAgoISO(2), rpe: 7, duree: 45, distance: 9, fc_moy: 150 } ] }, { recup: 'Bon', disponibilite: { niveau: 'Vigilance' } }, NOW);
check('H: reco s\'aligne sur l\'état (récup/facile)', /récup|facile/i.test(h.reco.texte));

// ── Croisé ──────────────────────────────────────────────────────────────────
// I — rien des deux côtés → reco info, confiance faible
let ci = buildSyntheseCroise(cmp28(0), { history: [] }, null, NOW);
check('I: reco info si aucune donnée', ci.reco && ci.reco.priorite === 'info');
check('I: confiance faible', ci.confiance === 'faible');

// J — quasi 100% muscu → constat + reco « ajoute du cardio »
let cj = buildSyntheseCroise(cmp28(50000), { history: [] }, { recup: 'Bon' }, NOW);
check('J: constat déséquilibre muscu', cj.constats.some(c => /musculation/i.test(c.texte)));
check('J: reco propose du cardio', /cardio/i.test(cj.reco.texte));

// K — équilibré + état vigilance → reco « semaine plus légère / repos »
let ck = buildSyntheseCroise(cmp28(20000), { history: [
  { date: daysAgoISO(3), rpe: 8, duree: 60 }, { date: daysAgoISO(10), rpe: 8, duree: 60 },
] }, { recup: 'Bon', disponibilite: { niveau: 'Vigilance' } }, NOW);
check('K: reco s\'aligne sur l\'état (repos/légère)', /légère|repos|récup/i.test(ck.reco.texte));

console.log('-'.repeat(78));
console.log('P0 — buildSynthese (muscu + cardio + croisé) : ' + ok + ' vérifs OK / ' + ko + ' échec(s).');
if (ko === 0) console.log('✅ Lecture Novalyz (synthèse muscu) conforme aux attendus.');
else { console.log('❌ Échecs : ' + fails.join(' | ')); process.exit(1); }
