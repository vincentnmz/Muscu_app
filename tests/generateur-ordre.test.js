/* =============================================================================
 * Générateur v2 — ORDRE et VARIÉTÉ des exercices (porteur 09/11, cas Full Body 3 j
 * zones fessiers + jambes : jambes coupées par le haut du corps, mêmes Squat / RDL /
 * Hip thrust à chaque séance, écarté avant développé…).
 * Vérifie sur TOUTES les combinaisons (organisation × jours × durée × niveau × zones) :
 *   - une région (bas / haut / mollets-abdos) n'est jamais coupée par une autre ;
 *   - dans un même muscle : polyarticulaire avant isolation ;
 *   - zone prioritaire en tête (sauf bras : jamais un curl avant les tirages) ;
 *   - zones prioritaires : exercices différents d'une séance à l'autre (Full Body).
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const start = SRC.indexOf('var _G2_BLOCKS'), end = SRC.indexOf('// ── Modal onboarding (3 étapes) ──');
if (start < 0 || end <= start) throw new Error('bloc moteur v2 introuvable');
const sb = { showToast: function () {} };
vm.createContext(sb);
vm.runInContext(SRC.slice(start, end) + '\nthis.G=_genProgramme2;this.B=_G2_BLOCKS;this.Z=_zpAppliquer;this.J=_G2_JLOGIC;', sb);

let ok = 0, ko = 0, fails = [];
function check(label, cond) { if (cond) ok++; else { ko++; if (fails.length < 15) fails.push(label); } }

// Catalogue minimal (muscle principal = bloc ; secondaire des polyarticulaires comme le catalogue réel).
const MUS = { pecs: 'Pectoraux', dos: 'Dos', epaules: 'Epaule', biceps: 'Biceps', triceps: 'Triceps', quad: 'Quadriceps', ischios: 'Ischio', fessiers: 'Fessier', mollets: 'Mollets', abdos: 'Abdominaux' };
const SEC = { pecs: 'Triceps', dos: 'Biceps', quad: 'Fessier', ischios: 'Fessier', fessiers: 'Ischio' };
const cat = [], info = {};
for (const k in sb.B) sb.B[k].slots.forEach(function (sl) { sl.exos.forEach(function (x) {
  if (info[x]) return; info[x] = { bk: k, type: sl.type };
  cat.push({ exercice: x, muscle: MUS[k], muscle_secondaire: sl.type === 'poly' ? (SEC[k] || null) : null }); }); });
const REG = { quad: 'bas', ischios: 'bas', fessiers: 'bas', pecs: 'haut', dos: 'haut', epaules: 'haut', triceps: 'haut', biceps: 'haut', mollets: 'fin', abdos: 'fin' };
function cibles(niv) {
  const g = { debutant: [6, 12], intermediaire: [10, 16], avance: [12, 20] }[niv], p = { debutant: [6, 12], intermediaire: [8, 14], avance: [10, 18] }[niv], o = {};
  ['Pectoraux', 'Dos', 'Quadriceps', 'Ischio', 'Fessier'].forEach(function (m) { o[m] = { min: g[0], opt: g[1] }; });
  ['Epaule', 'Biceps', 'Triceps', 'Mollets', 'Trapèze'].forEach(function (m) { o[m] = { min: p[0], opt: p[1] }; });
  o.Abdominaux = { min: 6, opt: 12 }; return o;
}
function seances(L) { const s = {}; L.forEach(function (l) { (s[l.seance_id] = s[l.seance_id] || []).push(l); }); return s; }
function gen(niv, org, j, t, zones) { return sb.G('masse', org, j, t, niv, { targets: sb.Z(cibles(niv), zones), cat: cat }); }

// 1) Cas réel : Full Body 3 j, 60 min, intermédiaire, zones fessiers + jambes.
const C = seances(gen('intermediaire', 'fb', 3, 60, ['fessiers', 'jambes']));
['Full Body A', 'Full Body B', 'Full Body C'].forEach(function (nm) {
  const r = C[nm].map(function (l) { return REG[info[l.exercice].bk]; });
  check(nm + ' : les 3 premiers exercices sont du bas du corps (zones prioritaires d\'abord)', r.slice(0, 3).every(function (x) { return x === 'bas'; }));
});
const exA = C['Full Body A'].map(function (l) { return l.exercice; }).join('|'), exB = C['Full Body B'].map(function (l) { return l.exercice; }).join('|'), exC = C['Full Body C'].map(function (l) { return l.exercice; }).join('|');
check('Full Body : quadriceps différent à chaque séance', new Set(['Full Body A', 'Full Body B', 'Full Body C'].map(function (nm) { return C[nm].filter(function (l) { return info[l.exercice].bk === 'quad'; }).map(function (l) { return l.exercice; }).join(); })).size === 3);
check('Full Body : fessiers différents à chaque séance', new Set(['Full Body A', 'Full Body B', 'Full Body C'].map(function (nm) { return C[nm].filter(function (l) { return info[l.exercice].bk === 'fessiers'; }).map(function (l) { return l.exercice; }).join(); })).size === 3);
check('Full Body : les 3 séances ne sont pas identiques', exA !== exB && exB !== exC);
check('Full Body A commence par le Squat', C['Full Body A'][0].exercice === 'Squat');

// 2) Toutes les combinaisons.
const ZS = [[], ['fessiers'], ['jambes'], ['pectoraux'], ['dos'], ['epaules'], ['bras'], ['abdos'], ['fessiers', 'jambes'], ['pectoraux', 'bras'], ['dos', 'epaules']];
const combos = [];
['intermediaire', 'avance'].forEach(function (niv) { ['fb', 'ul', 'ppl', 'split', 'custom'].forEach(function (org) { sb.J[org].forEach(function (j) { [45, 60, 75, 90].forEach(function (t) { ZS.forEach(function (z) { combos.push([niv, org, j, t, z]); }); }); }); }); });
[['fb', 2], ['fb', 3], ['ppl', 3], ['ul', 4], ['split', 5]].forEach(function (p) { ZS.forEach(function (z) { combos.push(['debutant', p[0], p[1], 75, z]); }); });
let nReg = 0, nIso = 0, nBras = 0, nDbl = 0;
combos.forEach(function (c) {
  const S = seances(gen(c[0], c[1], c[2], c[3], c[4])), ctx = c.slice(0, 4).join(' ') + ' [' + c[4].join('+') + ']';
  Object.keys(S).forEach(function (nm) {
    const ls = S[nm], regs = ls.map(function (l) { return REG[info[l.exercice].bk]; });
    const seq = regs.filter(function (r, i) { return i === 0 || r !== regs[i - 1]; });
    if (new Set(seq).size !== seq.length) { nReg++; check('régions groupées : ' + ctx + ' ' + nm, false); }
    for (let i = 0; i < ls.length; i++) for (let k = i + 1; k < ls.length; k++) {
      const a = info[ls[i].exercice], b = info[ls[k].exercice];
      if (a.bk === b.bk && a.type === 'iso' && b.type === 'poly') { nIso++; check('poly avant iso : ' + ctx + ' ' + nm + ' ' + ls[i].exercice, false); }
      if ((a.bk === 'biceps' || a.bk === 'triceps') && (b.bk === 'dos' || b.bk === 'pecs')) { nBras++; check('bras après dos/pecs : ' + ctx + ' ' + nm, false); }
    }
    const names = ls.map(function (l) { return l.exercice; });
    if (new Set(names).size !== names.length) { nDbl++; check('pas de doublon : ' + ctx + ' ' + nm, false); }
  });
});
check('combinaisons testées (' + combos.length + ') : régions jamais coupées', nReg === 0);
check('combinaisons : jamais d\'isolation avant le polyarticulaire du même muscle', nIso === 0);
check('combinaisons : jamais de bras avant dos / pectoraux', nBras === 0);
check('combinaisons : jamais le même exercice deux fois dans une séance', nDbl === 0);

console.log((ko === 0 ? '✓' : '✗') + ' generateur-ordre : ' + ok + ' OK / ' + ko + ' KO');
if (ko) { console.log('Échecs:\n  ' + fails.join('\n  ')); process.exit(1); }
