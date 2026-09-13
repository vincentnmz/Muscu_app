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
vm.runInContext(extractFn('buildSyntheseMuscu') + '\nthis.buildSyntheseMuscu = buildSyntheseMuscu;', sandbox);
const buildSyntheseMuscu = sandbox.buildSyntheseMuscu;

const cmp = (tonEvol, rpeDiff) => ({ j28_vs_j28prec: { tonnage: { evol_pct: tonEvol }, rpe: { diff: rpeDiff } } });
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

// D — pas assez de données (aucune comparaison) → confiance faible, reco info
let d = buildSyntheseMuscu('', cmp(null, null), null, null);
check('D: confiance faible sans données', d.confiance === 'faible');
check('D: max 3 constats', d.constats.length <= 3);
check('D: reco toujours présente', !!d.reco);

console.log('-'.repeat(78));
console.log('P0 — buildSyntheseMuscu : ' + ok + ' vérifs OK / ' + ko + ' échec(s).');
if (ko === 0) console.log('✅ Lecture Novalyz (synthèse muscu) conforme aux attendus.');
else { console.log('❌ Échecs : ' + fails.join(' | ')); process.exit(1); }
