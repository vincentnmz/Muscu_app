/* FRÉQUENCE PAR MUSCLE (Analyses ▸ Tendances) — correctif validé le 13/11/2026.
 * Avant : période figée (« 4 dernières semaines terminées » dès que < 7 jours écoulés, donc toujours sur Semaine),
 * jours en muscle secondaire comptés comme des jours entiers, diviseur arrondi, Année divisée depuis le 1er janvier. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const APP = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const TS = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8');
function extract(SRC, name) {
  const m = SRC.match(new RegExp('function\\s+' + name + '\\s*\\(')); if (!m) throw new Error('fn introuvable : ' + name);
  const eol = SRC.indexOf('\n', m.index), i = SRC[eol - 1] === '{' ? eol - 1 : SRC.indexOf('{', m.index); let d = 0, j = i;
  for (; j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return SRC.slice(m.index, j);
}
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };

// ── Serveur : ppm = séries en muscle principal seulement ──
const B = {}; vm.createContext(B);
vm.runInContext(stripTypeScriptTypes(TS.match(/const _MUSCLE_ALIAS[^=]*= \{[^}]*\}/)[0] + ';\n' + ['fmtYMD', 'parseFR', 'normDate', 'normMuscle', '_addSeriesMuscle', 'buildDailyMuscu'].map(n => extract(TS, n)).join('\n')) + '\nthis.b = buildDailyMuscu;', B);
const dm = B.b([{ date: '2026-11-10', exercice: 'Rowing', muscle: 'Dos', charge: 50, reps: 10 }, { date: '2026-11-10', exercice: 'Rowing', muscle: 'Dos', charge: 50, reps: 10 }],
  { rowing: 'Biceps' });
eq(dm['2026-11-10'].ppm.Dos === 2 && !dm['2026-11-10'].ppm.Biceps, 'ppm : Dos 2 séries, Biceps (secondaire) absent', dm['2026-11-10'].ppm);
eq(dm['2026-11-10'].spm.Biceps === 1, 'spm inchangé (½ par série secondaire, pour le volume)', dm['2026-11-10'].spm);

// ── Front : calcul ──
const F = {}; vm.createContext(F);
vm.runInContext(['_dateISOtoLocal', '_ymdLocal', '_freqMuscleCalc'].map(n => extract(APP, n)).join('\n') + '\nthis.c = _freqMuscleCalc;', F);
const J = (ppm, spm) => ({ ppm, spm: spm || ppm });
const daily = {
  '2026-10-01': J({ Dos: 3 }), '2026-10-20': J({ Pectoraux: 4 }, { Pectoraux: 4, Triceps: 2 }),
  '2026-11-03': J({ Dos: 4 }, { Dos: 4, Biceps: 2 }), '2026-11-05': J({ Pectoraux: 4 }, { Pectoraux: 4, Triceps: 2 }),
  '2026-11-10': J({ Dos: 4 }, { Dos: 4, Biceps: 2 }), '2026-11-12': J({ Quadriceps: 5 }),
};
// Semaine en cours (lun 10 → ven 13/11) : 5 jours → nombre de séances, pas « 4 dernières semaines »
let r = F.c(daily, '2026-11-09', '2026-11-16', '2026-11-13');
eq(r && !r.parSemaine && r.jours === 5, 'Semaine en cours : suit la semaine (5 jours), mode « nombre de séances »', r);
eq(r.rows.map(x => x.m + x.n).join() === 'Dos1,Quadriceps1', 'Semaine : seulement les séances de la semaine, muscles principaux', r.rows);
eq(!r.rows.some(x => x.m === 'Biceps'), 'Biceps (secondaire du rowing) non compté');
// Semaine passée : 7 jours → ×/sem
r = F.c(daily, '2026-11-02', '2026-11-09', '2026-11-13');
eq(r.parSemaine && r.rows.find(x => x.m === 'Dos').f === 1 && r.rows.find(x => x.m === 'Pectoraux').f === 1, 'Semaine passée : 1×/sem Dos et Pecs', r.rows);
// Mois en cours le 13/11 : 13 jours, diviseur non arrondi (13/7), pas 2
r = F.c(daily, '2026-11-01', '2026-12-01', '2026-11-13');
const dos = r.rows.find(x => x.m === 'Dos');
eq(r.parSemaine && r.jours === 13 && Math.abs(dos.f - 2 / (13 / 7)) < 1e-9, 'Mois en cours : 2 séances / (13/7) sem., non arrondi', { j: r.jours, f: dos.f });
// Le 10 du mois : 9 jours → 3 séances ≠ « 3×/sem »
r = F.c({ '2026-11-03': J({ Dos: 1 }), '2026-11-05': J({ Dos: 1 }), '2026-11-08': J({ Dos: 1 }), '2026-10-01': J({ Dos: 1 }) }, '2026-11-01', '2026-12-01', '2026-11-09');
eq(Math.abs(r.rows[0].f - 3 / (9 / 7)) < 1e-9, 'le 9 du mois : 3 séances en 9 jours = 2,3×/sem (avant : 3)', r.rows[0].f);
// Année en cours, 1re séance le 01/10 : diviseur depuis le 01/10, pas le 1er janvier
r = F.c(daily, '2026-01-01', '2027-01-01', '2026-11-13');
eq(r.depuis1re && r.debutISO === '2026-10-01' && r.jours === 44, 'Année : comptée depuis la 1re séance (44 jours)', r);
eq(Math.abs(r.rows.find(x => x.m === 'Dos').f - 3 / (44 / 7)) < 1e-9, 'Année : Dos 3 séances / (44/7) sem.');
// Ancien serveur (sans ppm) : jour compté seulement si ≥ 1 série pleine
r = F.c({ '2026-11-02': { spm: { Dos: 2, Biceps: 0.5 } }, '2026-11-03': { spm: { Pectoraux: 2, Triceps: 1 } } }, '2026-11-02', '2026-11-09', '2026-11-13');
eq(r.rows.map(x => x.m).sort().join() === 'Dos,Pectoraux,Triceps', 'ancien format : ½ série secondaire ignorée', r.rows);
eq(F.c({}, '2026-11-01', '2026-12-01', '2026-11-13') === null, 'aucune donnée : rien');
eq(F.c(daily, '2026-12-01', '2027-01-01', '2026-11-13') === null, 'période future : rien');
eq(/var fr = Math\.round\(x\.f \* 10\) \/ 10;[^\n]*\n\s*C = fr >= 2/.test(APP), 'couleur sur la valeur affichée (0,98 → « 1×/sem » orange, pas rouge)');
eq(!/4 dernières semaines terminées/.test(extract(APP, '_maFreqMuscleBloc')), 'plus de bascule vers « 4 dernières semaines »');

console.log(`frequence-muscle : ${ok} OK / ${ko} KO`);
process.exit(ko ? 1 : 0);
