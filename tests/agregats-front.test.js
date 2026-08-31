/* =============================================================================
 * PHASE FIABILITÉ — Tests de VALEUR des calculs d'AFFICHAGE front (js/app.js).
 *
 * Standard de traçabilité étendu à la couche présentation : données connues →
 * valeur exacte, sur le VRAI code extrait de js/app.js.
 * Couvre : calc1RM (e1RM Epley), tendance1RM (tendance e1RM cockpit E),
 *          calculerRecords (carte Records).
 * (Le moteur Novalyz, computeACWR front et le score du Bilan sont déjà couverts
 *  par calc.test.js.)
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

function extractFn(name) {
  const m = SRC.match(new RegExp('function\\s+' + name + '\\s*\\('));
  if (!m) throw new Error('fn introuvable: ' + name);
  let i = SRC.indexOf('{', m.index), d = 0, j = i;
  for (; j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return SRC.slice(m.index, j);
}

const FN = ['calc1RM', 'parseChatDate', 'tendance1RM', 'calculerRecords'];
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(FN.map(extractFn).join('\n') + '\n' + FN.map(n => `this.${n}=${n};`).join(''), sandbox);
const { calc1RM, tendance1RM, calculerRecords } = sandbox;

let ok = 0, ko = 0;
const check = (n, cond, att, obt) => { if (cond) ok++; else { ko++; console.log('  ❌ ' + n + ' — attendu ' + att + ', obtenu ' + obt); } };
const eq = (n, got, exp) => check(n, got === exp, JSON.stringify(exp), JSON.stringify(got));

// ── calc1RM — Epley : charge × (1 + reps/30), arrondi 0,1 ─────────────────────
eq('calc1RM(100,5) = 116.7', calc1RM(100, 5), 116.7);   // 100×1.16667
eq('calc1RM(100,1) = 103.3', calc1RM(100, 1), 103.3);
eq('calc1RM(60,10) = 80', calc1RM(60, 10), 80);          // 60×1.3333
eq('calc1RM(charge 0) = null', calc1RM(0, 5), null);
eq('calc1RM(reps 0) = null', calc1RM(100, 0), null);

// ── tendance1RM — variation moyenne d'e1RM (Epley), chronologique ────────────
eq('tendance1RM 1 exo +10% (100→110, reps 5)',
  tendance1RM({ Squat: [{ charge: 100, reps: 5, date: '01/08/2026' }, { charge: 110, reps: 5, date: '15/08/2026' }] }).pct, 10);
eq('tendance1RM moyenne 2 exos (+10% et 0%) = 5%',
  tendance1RM({
    Squat: [{ charge: 100, reps: 5, date: '01/08/2026' }, { charge: 110, reps: 5, date: '15/08/2026' }],
    Bench: [{ charge: 80, reps: 5, date: '01/08/2026' }, { charge: 80, reps: 5, date: '15/08/2026' }],
  }).pct, 5);
eq('tendance1RM exo à 1 seul point → ignoré → null',
  tendance1RM({ Squat: [{ charge: 100, reps: 5, date: '01/08/2026' }] }).pct, null);
eq('tendance1RM prog vide → null', tendance1RM({}).pct, null);
// ordre non chronologique en entrée → recalcul correct (tri interne par date)
eq('tendance1RM tri interne : points désordonnés → +10%',
  tendance1RM({ Squat: [{ charge: 110, reps: 5, date: '15/08/2026' }, { charge: 100, reps: 5, date: '01/08/2026' }] }).pct, 10);

// ── calculerRecords — meilleure charge par exo (charge>0), triée charge desc ──
const recs = calculerRecords({ progression_par_exo: {
  Squat: [{ charge: 100, reps: 5, date: '01/08/2026' }, { charge: 120, reps: 3, date: '08/08/2026' }, { charge: 120, reps: 5, date: '15/08/2026' }],
  Bench: [{ charge: 90, reps: 5, date: '10/08/2026' }],
  Gainage: [{ charge: 0, reps: 60, date: '10/08/2026' }],   // charge nulle → ignorée
} });
eq('calculerRecords : 2 exercices (Gainage charge 0 exclu)', recs.length, 2);
eq('record[0] = Squat (charge la plus haute)', recs[0].exo, 'Squat');
eq('record Squat charge = 120', recs[0].charge, 120);
eq('record Squat reps = 5 (départage à charge égale : plus de reps)', recs[0].reps, 5);
eq('record[1] = Bench', recs[1].exo, 'Bench');
check('Gainage (charge 0) absent des records', !recs.some(r => r.exo === 'Gainage'), 'absent', 'PRÉSENT');
eq('calculerRecords sans données → []', calculerRecords({}).length, 0);

// Correctif anomalie : SOURCE PRIORITAIRE = records all-time (global.records),
// pas les 8 derniers points. Ici le PR all-time (180) dépasse le max des points (120).
const allTime = { Squat: { charge: 180, reps: 3, date: '02/01/2025' }, Bench: { charge: 100, reps: 5, date: '03/01/2025' }, Gainage: { charge: 0, reps: 90, date: '04/01/2025' } };
const recsAllTime = calculerRecords({ progression_par_exo: { Squat: [{ charge: 120, reps: 5, date: '15/08/2026' }] } }, allTime);
eq('all-time prioritaire : Squat = 180 (PR réel, pas 120)', recsAllTime[0].charge, 180);
eq('all-time : 2 records (Gainage charge 0 exclu)', recsAllTime.length, 2);
eq('all-time trié charge desc : [0] Squat, [1] Bench', recsAllTime[1].exo, 'Bench');
// Repli conservé si all-time absent (hors-ligne / ancien payload)
eq('repli progression_par_exo si all-time absent → 120',
  calculerRecords({ progression_par_exo: { Squat: [{ charge: 120, reps: 5, date: '15/08/2026' }] } }, null)[0].charge, 120);
eq('repli si all-time vide {} → progression', calculerRecords({ progression_par_exo: { Squat: [{ charge: 120, reps: 5, date: '15/08/2026' }] } }, {})[0].charge, 120);

console.log('-'.repeat(66));
console.log(ko === 0
  ? `✅ Calculs d'affichage front — ${ok} vérifs de VALEUR (calc1RM · tendance1RM · calculerRecords).`
  : `❌ ${ko} écart(s) sur ${ok + ko}.`);
if (ko > 0) process.exitCode = 1;
