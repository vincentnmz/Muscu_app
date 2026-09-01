/* =============================================================================
 * PHASE FIABILITÉ PRÉPA — Tests de VALEUR des agrégats d'équipe (index.ts).
 *
 * données brutes connues → fonction pure → valeur exacte. Code réel extrait de
 * supabase/functions/handler/index.ts (types retirés, Node ≥ 22).
 * Fonctions : _aggSignaux · beScoreJoueur · progressionAthlete · chargeHebdoEquipe
 *             · agregerEquipe (+ SENS_TESTS). Le moteur de décision n'est pas testé ici.
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');

// On strippe TOUT le fichier d'abord → les fonctions n'ont plus d'annotations
// de type (donc plus d'accolades de type inline en signature) → extraction fiable.
const JS = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
function extractFn(name) {
  const m = JS.match(new RegExp('function\\s+' + name + '\\s*\\('));
  if (!m) throw new Error('fn introuvable: ' + name);
  let i = JS.indexOf('{', m.index), d = 0, j = i;
  for (; j < JS.length; j++) { const c = JS[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return JS.slice(m.index, j);
}
function extractConst(name) {
  const m = JS.match(new RegExp('const\\s+' + name + '\\s*=\\s*'));
  const i = JS.indexOf('{', m.index); let d = 0, j = i;
  for (; j < JS.length; j++) { const c = JS[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return 'const ' + name + ' = ' + JS.slice(i, j) + ';';
}

const FN = ['fmtYMD', 'minus', 'parseFR', 'fmtFR', 'normDate', 'getLundi',
  '_aggSignaux', 'beScoreJoueur', 'progressionAthlete', 'chargeHebdoEquipe', 'agregerEquipe'];
const jsCode = extractConst('SENS_TESTS') + '\n' + FN.map(extractFn).join('\n\n');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(jsCode + '\n' + FN.concat(['SENS_TESTS']).map(n => `this.${n}=${n};`).join(''), sandbox);
const { _aggSignaux, beScoreJoueur, progressionAthlete, chargeHebdoEquipe, agregerEquipe, SENS_TESTS } = sandbox;

let ok = 0, ko = 0;
const check = (n, cond, att, obt) => { if (cond) ok++; else { ko++; console.log('  ❌ ' + n + ' — attendu ' + att + ', obtenu ' + obt); } };
const eq = (n, got, exp) => check(n, got === exp, JSON.stringify(exp), JSON.stringify(got));

const NOW = new Date('2026-08-20T12:00:00Z');   // fenêtre 7 j : dIso ≥ 2026-08-13

// ── A. _aggSignaux — douleur=MAX, fatigue=MAX, sommeil=MOYENNE, fenêtre 7 j ──
const be = (date, d, f, s) => ({ date, douleur: d, fatigue_musculaire: f, sommeil: s });
const s0 = _aggSignaux([], NOW);
eq('aucun wellness → douleur null', s0.douleur, null);
eq('aucun wellness → fatigue null', s0.fatigue, null);
eq('aucun wellness → sommeil null', s0.sommeil, null);
eq('aucun wellness → wellnessN 0', s0.wellnessN, 0);
const s1 = _aggSignaux([be('2026-08-19', 2, 3, 4)], NOW);
eq('1 wellness → douleur 2', s1.douleur, 2);
eq('1 wellness → fatigue 3', s1.fatigue, 3);
eq('1 wellness → sommeil 4', s1.sommeil, 4);
eq('1 wellness → wellnessN 1', s1.wellnessN, 1);
const sN = _aggSignaux([be('2026-08-19', 2, 3, 4), be('2026-08-15', 3, 5, 2)], NOW);
eq('plusieurs → douleur = MAX (3)', sN.douleur, 3);
eq('plusieurs → fatigue = MAX (5)', sN.fatigue, 5);
eq('plusieurs → sommeil = MOYENNE ((4+2)/2 = 3)', sN.sommeil, 3);
eq('plusieurs → wellnessN 2', sN.wellnessN, 2);
const sHors = _aggSignaux([be('2026-08-19', 2, 3, 4), be('2026-08-15', 3, 5, 2), be('2026-08-10', 5, 5, 5)], NOW);
eq('donnée hors fenêtre (08-10) ignorée → douleur reste 3', sHors.douleur, 3);
eq('hors fenêtre ignorée → wellnessN reste 2', sHors.wellnessN, 2);
const sMiss = _aggSignaux([{ date: '2026-08-19', douleur: '', fatigue_musculaire: 2, sommeil: null }], NOW);
eq('valeurs manquantes : douleur "" ignorée → null', sMiss.douleur, null);
eq('valeurs manquantes : fatigue présente = 2', sMiss.fatigue, 2);
eq('valeurs manquantes : sommeil null ignoré → null', sMiss.sommeil, null);
eq('valeurs manquantes : wellnessN = 1', sMiss.wellnessN, 1);

// ── B. charge_equipe — Σ des charge7, pas de fuite entre joueurs ─────────────
const eqB = agregerEquipe([
  { charge7: 300, fatigue: null, beScore: null, progression: 'stable' },
  { charge7: 700, fatigue: null, beScore: null, progression: 'stable' },
  { charge7: 0, fatigue: null, beScore: null, progression: 'stable' },
]);
eq('charge_equipe = 1000 (300+700+0)', eqB.charge_equipe, 1000);

// ── C. fatigue_moyenne — moyenne, null si aucune, valeur absente exclue ──────
eq('fatigue_moyenne 2 joueurs (3 et 5) = 4', agregerEquipe([{ charge7: 0, fatigue: 3, beScore: null, progression: 's' }, { charge7: 0, fatigue: 5, beScore: null, progression: 's' }]).fatigue_moyenne, 4);
eq('fatigue_moyenne 1 joueur (4) = 4', agregerEquipe([{ charge7: 0, fatigue: 4, beScore: null, progression: 's' }]).fatigue_moyenne, 4);
eq('fatigue_moyenne aucun joueur → null', agregerEquipe([]).fatigue_moyenne, null);
eq('fatigue_moyenne : valeur manquante exclue (null + 4 → 4)', agregerEquipe([{ charge7: 0, fatigue: null, beScore: null, progression: 's' }, { charge7: 0, fatigue: 4, beScore: null, progression: 's' }]).fatigue_moyenne, 4);

// ── D. bienetre_moyen — chaîne wellness → beScore → moyenne équipe ───────────
const p1 = { sommeil: 4, fatigue: 2, douleur: 1 };   // beScore = moy(4, 6-2, 6-1) = moy(4,4,5) = 4.333
const p2 = { sommeil: 2, fatigue: 4, douleur: 3 };   // beScore = moy(2, 2, 3) = 2.333
eq('beScore joueur 1 ≈ 4.33', Math.round(beScoreJoueur(p1) * 100) / 100, 4.33);
eq('beScore joueur 2 ≈ 2.33', Math.round(beScoreJoueur(p2) * 100) / 100, 2.33);
eq('beScore dims manquantes (sommeil seul) = 4', beScoreJoueur({ sommeil: 4, fatigue: null, douleur: null }), 4);
eq('beScore aucune dim → null', beScoreJoueur({ sommeil: null, fatigue: null, douleur: null }), null);
eq('bienetre_moyen équipe = 3.3 (moy(4.333, 2.333))',
  agregerEquipe([{ charge7: 0, fatigue: null, beScore: beScoreJoueur(p1), progression: 's' }, { charge7: 0, fatigue: null, beScore: beScoreJoueur(p2), progression: 's' }]).bienetre_moyen, 3.3);

// ── E. chargeHebdoEquipe — semaine ISO, pas de fusion, pas de fuite joueur ───
const cr = (id, date, v) => ({ athlete_id: id, date, valeur: String(v) });
const hebdo = chargeHebdoEquipe([
  cr('A', '2026-08-17', 100), cr('A', '2026-08-19', 200), cr('B', '2026-08-18', 50), // sem. du 17/08 = 350
  cr('A', '2026-08-10', 400),                                                        // sem. du 10/08 = 400
  cr('C', '2026-08-17', 999),                                                        // C hors effectif → exclu
], new Set(['A', 'B']));
eq('chargeHebdo = 2 semaines', hebdo.length, 2);
eq('semaine ancienne (10/08) en premier = 400', hebdo[0].charge, 400);
eq('semaine récente (17/08) = 350 (A+B, pas C)', hebdo[1].charge, 350);
check('joueur C (hors effectif) exclu → aucune charge 999', !hebdo.some(w => w.charge === 999), 'exclu', 'PRÉSENT');
eq('total 2 semaines = 750', hebdo[0].charge + hebdo[1].charge, 750);
// > 8 semaines → 8 dernières
const rows9 = [];
for (let w = 0; w < 9; w++) rows9.push(cr('A', '2026-0' + (w < 4 ? '6' : (w < 8 ? '7' : '8')) + '-0' + ((w % 4) + 1), 10));
check('plus de 8 semaines → plafonné à 8', chargeHebdoEquipe(rows9, new Set(['A'])).length <= 8, '<=8', chargeHebdoEquipe(rows9, new Set(['A'])).length);

// ── F. progressionAthlete — sens par clé documenté ───────────────────────────
// vma: +1 (plus haut = mieux) ; sprint_30m: -1 (plus bas = mieux).
eq('progression (vma 10→14, sens +1)', progressionAthlete({ vma: [{ d: 1, v: 10 }, { d: 2, v: 14 }] }, SENS_TESTS), 'progression');
eq('regression (vma 14→10)', progressionAthlete({ vma: [{ d: 1, v: 14 }, { d: 2, v: 10 }] }, SENS_TESTS), 'regression');
eq('sprint plus rapide = progression (sprint_30m 4.0→3.5, sens −1)', progressionAthlete({ sprint_30m: [{ d: 1, v: 4.0 }, { d: 2, v: 3.5 }] }, SENS_TESTS), 'progression');
eq('stabilité (vma 10→10)', progressionAthlete({ vma: [{ d: 1, v: 10 }, { d: 2, v: 10 }] }, SENS_TESTS), 'stable');
eq('valeur précédente absente (1 point) → stable', progressionAthlete({ vma: [{ d: 1, v: 10 }] }, SENS_TESTS), 'stable');
eq('historique vide {} → stable', progressionAthlete({}, SENS_TESTS), 'stable');
eq('tset undefined → stable', progressionAthlete(undefined, SENS_TESTS), 'stable');
eq('signes opposés (1 up, 1 down) → stable', progressionAthlete({ vma: [{ d: 1, v: 10 }, { d: 2, v: 14 }], sprint_30m: [{ d: 1, v: 4 }, { d: 2, v: 4.5 }] }, SENS_TESTS), 'stable');
eq('clé inconnue → sens +1 par défaut (1→2 = progression)', progressionAthlete({ foo: [{ d: 1, v: 1 }, { d: 2, v: 2 }] }, SENS_TESTS), 'progression');

// ── Cohérence AVANT/APRÈS (non circulaire : ancienne formule reproduite) ─────
function ancienAgregat(items) {
  const moy = (arr) => arr && arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
  let chargeEquipe = 0, nbProg = 0, nbReg = 0; const fatigueArr = [], beArr = [];
  for (const it of items) {
    chargeEquipe += it.charge7;
    if (it.sig.fatigue != null) fatigueArr.push(it.sig.fatigue);
    const beComp = [];
    if (it.sig.sommeil != null) beComp.push(it.sig.sommeil);
    if (it.sig.fatigue != null) beComp.push(6 - it.sig.fatigue);
    if (it.sig.douleur != null) beComp.push(6 - it.sig.douleur);
    const be = beComp.length ? beComp.reduce((x, y) => x + y, 0) / beComp.length : null;
    if (be != null) beArr.push(be);
    if (it.progression === 'progression') nbProg++; else if (it.progression === 'regression') nbReg++;
  }
  return {
    charge_equipe: Math.round(chargeEquipe),
    fatigue_moyenne: fatigueArr.length ? Math.round((moy(fatigueArr) || 0) * 10) / 10 : null,
    bienetre_moyen: beArr.length ? Math.round((moy(beArr) || 0) * 10) / 10 : null,
    en_progression: nbProg, en_regression: nbReg,
  };
}
const rawItems = [
  { charge7: 300, sig: { sommeil: 4, fatigue: 2, douleur: 1 }, progression: 'progression' },
  { charge7: 700, sig: { sommeil: 2, fatigue: 4, douleur: 3 }, progression: 'regression' },
  { charge7: 0, sig: { sommeil: null, fatigue: null, douleur: null }, progression: 'stable' },
];
const nouveau = agregerEquipe(rawItems.map(it => ({ charge7: it.charge7, fatigue: it.sig.fatigue, beScore: beScoreJoueur(it.sig), progression: it.progression })));
const ancien = ancienAgregat(rawItems);
eq('cohérence charge_equipe avant/après', JSON.stringify(nouveau.charge_equipe), JSON.stringify(ancien.charge_equipe));
eq('cohérence fatigue_moyenne', JSON.stringify(nouveau.fatigue_moyenne), JSON.stringify(ancien.fatigue_moyenne));
eq('cohérence bienetre_moyen', JSON.stringify(nouveau.bienetre_moyen), JSON.stringify(ancien.bienetre_moyen));
eq('cohérence en_progression / en_regression', nouveau.en_progression + '/' + nouveau.en_regression, ancien.en_progression + '/' + ancien.en_regression);

console.log('-'.repeat(66));
console.log(ko === 0
  ? `✅ Agrégats prépa — ${ok} vérifs de VALEUR (_aggSignaux · beScore · progression · charge_hebdo · équipe · cohérence).`
  : `❌ ${ko} écart(s) sur ${ok + ko}.`);
if (ko > 0) process.exitCode = 1;
