/* =============================================================================
 * Bilan e-mail athlète (_bilanAthlete) — exécute la VRAIE fonction de production
 * extraite de index.ts (types retirés, Node ≥ 22, pure, aucun accès BDD/Deno).
 * Oracle établi À LA MAIN à partir des règles (fenêtres, Epley, moyennes).
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
const names = ['parseFR', 'fmtYMD', 'normDate', 'minus', '_bilanAthlete'];
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(names.map(extractFn).join('\n\n') + '\nthis.__b = _bilanAthlete;', ctx);
const bilan = ctx.__b;

let ko = 0;
const eq = (label, got, exp) => { const ok = JSON.stringify(got) === JSON.stringify(exp); if (!ok) { ko++; console.error(`✗ ${label} : attendu ${JSON.stringify(exp)}, obtenu ${JSON.stringify(got)}`); } };

const now = new Date('2026-10-11T12:00:00Z');
const perfs = [
  { date: '2026-10-06', exercice: 'Bench', muscle: 'Pecto', charge: 80, reps: 5, rpe: 8, seance_id: 'A' },
  { date: '2026-10-10', exercice: 'Bench', muscle: 'Pecto', charge: 85, reps: 5, rpe: 8, seance_id: 'A' },
  { date: '2026-10-10', exercice: 'Squat', muscle: 'Jambes', charge: 100, reps: 5, rpe: 7, seance_id: 'B' },
  // fenêtre précédente (>=2026-09-27 et <2026-10-04) → comparables
  { date: '2026-09-28', exercice: 'Bench', muscle: 'Pecto', charge: 78, reps: 5, rpe: 8, seance_id: 'A' },
];
const programme = [{ seance_id: 'A', series_prevues: 3 }, { seance_id: 'B', series_prevues: 3 }];
const bienEtre = [{ date: '2026-10-10', sommeil: 4, energie: 3, fatigue_musculaire: 2 }];
const sante = [
  { date: '2026-10-10', cle: 'pas', valeur: '8000' }, { date: '2026-10-06', cle: 'pas', valeur: '9000' },
  { date: '2026-10-10', cle: 'sommeil_min', valeur: '420' }, { date: '2026-10-10', cle: 'fc_repos', valeur: '60' },
];

const b = bilan(perfs, programme, bienEtre, sante, now, 'semaine');

eq('seancesFaites', b.seancesFaites, 2);
eq('seancesPrevues', b.seancesPrevues, 2);
eq('seriesFaites', b.seriesFaites, 3);
eq('seriesPrevues', b.seriesPrevues, 6);
eq('tonnageKg', b.tonnageKg, 1325);
eq('reps', b.reps, 15);
eq('rpeMoyen', b.rpeMoyen, 7.7);
eq('balance[0]', b.balance[0], { muscle: 'Pecto', pct: 62 });
// Progression Epley : Bench fenêtre = 85·(1+5/30)=99.17 ; préc = 78·(1+5/30)=91 → +9%.
eq('enProgres Bench', (b.enProgres[0] || {}), { exo: 'Bench', pct: 9 });
// Squat non présent dans la fenêtre précédente → non comparable → absent.
eq('enProgres count', b.enProgres.length, 1);
eq('montre.pas', b.montre.pas, 8500);
eq('montre.sommeilMin', b.montre.sommeilMin, 420);
eq('montre.fcRepos', b.montre.fcRepos, 60);
eq('ressenti.sommeil', b.ressenti.sommeil, 4);
eq('records[0]', b.records[0], { exo: 'Squat', charge: 100, reps: 5 });

if (ko) { console.error(`\n${ko} assertion(s) en échec`); process.exit(1); }
console.log('bilan-resume: OK');
