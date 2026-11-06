/* Corrections audit 06/11 : exercice bloqué sans « +1 rep », volume sur les semaines réellement couvertes, kg au quart. */
const fs = require('fs'), path = require('path'), vm = require('vm');
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g).slice(0, 400) + ')' : '')); } };
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const pick = (n) => { const i = src.indexOf('function ' + n + '('); if (i < 0) throw new Error('absent ' + n); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } };
const sb = { Math, Number, String, Object, Array, JSON, Date, console, _musKey: (s) => String(s || '').toLowerCase().replace(/s$/, '') };
vm.createContext(sb);
vm.runInContext(['_progDecision', '_progWhy', '_refSerie', '_r025', '_cdFmtKg'].map(pick).join('\n'), sb);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'lecture-v3.js'), 'utf8'), sb);
const S = (c, r, rpe, k) => ({ serie: k, charge: c, reps: r, rpe, repos: 120 });
// 1 — Élévation latérale (cas réel 05/11) : 5×19@7, 7,5×10@9 ×2, bloqué 3 séances, série d'avant à ramener à 16.
const last = [S(5, 19, 7, 1), S(7.5, 10, 9, 2), S(7.5, 10, 9, 3)], prev = [S(5, 17, 8, 1), S(7.5, 10, 9, 2), S(7.5, 10, 9, 3)];
const base = { niveau: 'intermediaire', last, prev, rmin: 8, rmax: 20, pas: 2.5, reposRef: 120, bornes: { min: 60, max: 180 } };
const dB = sb._progDecision(Object.assign({ bloque: { n: 3, avant: { charge: 5, reps: 16 } } }, base));
eq(dB.mode === 'bloque', '1 : mode bloqué', dB.mode);
eq([1, 2, 3].map((k) => dB.cible(k).charge + 'x' + dB.cible(k).reps).join(' ') === '5x16 7.5x10 7.5x10', '1 : cibles 5×16 · 7,5×10 · 7,5×10', [1, 2, 3].map((k) => dB.cible(k)));
const w = sb._progWhy(dB, { rmin: 8, rmax: 20 }, 2.5);
eq(!/\+1 rep \(/.test(w) && /pas de \+1 rep forcé/.test(w) && /5 kg revient à ≈ 16 reps/.test(w), '1 : texte sans « +1 rep » et cohérent avec le levier', w);
// 2 — Même exercice NON bloqué : règle habituelle inchangée (+1 rep sur la série à RPE ≤ 8).
const dN = sb._progDecision(base);
eq(dN.mode === 'reps' && dN.cible(1).reps === 20 && dN.cible(2).reps === 10, '2 : non bloqué → +1 rep sur la série à RPE 7, séries à RPE 9 gardées', [dN.mode, dN.cible(1), dN.cible(2)]);
// 3 — Bloqué sans série d'avant : tout gardé.
const dC = sb._progDecision(Object.assign({ bloque: { n: 2, avant: null } }, base));
eq(dC.cible(1).reps === 19 && dC.cible(2).reps === 10, '3 : bloqué sans cause « avant » → mêmes reps', [dC.cible(1), dC.cible(2)]);
// 4 — Volume : compte de 5 jours → aucun recul (pas de « 4,5 séries/sem ») ; compte ancien → /4 ; compte de 3 semaines → /3.
const dm5 = { '2026-11-02': { spm: { Epaule: 9 } }, '2026-11-05': { spm: { Epaule: 9 } } };
const V5 = sb._lv3Volume({ historique: { daily_muscu: dm5 } }, 'Epaule', new Date('2026-11-02T00:00:00').getTime());
eq(V5.recul === 0, '4 : aucune séance avant lundi → recul 0 (pas de conclusion)', V5);
const dmA = {}; ['2026-09-01', '2026-10-06', '2026-10-13', '2026-10-20', '2026-10-27'].forEach((d) => { dmA[d] = { spm: { Epaule: 8 } }; });
const VA = sb._lv3Volume({ historique: { daily_muscu: dmA } }, 'Epaule', new Date('2026-11-02T00:00:00').getTime());
eq(VA.recul === 4 && VA.parSem === 8 && VA.freq === 1, '4 : historique long → 32 séries / 4 sem = 8', VA);
const dm3 = { '2026-10-12': { spm: { Epaule: 9 } }, '2026-10-19': { spm: { Epaule: 9 } }, '2026-10-26': { spm: { Epaule: 9 } } };
const V3 = sb._lv3Volume({ historique: { daily_muscu: dm3 } }, 'Epaule', new Date('2026-11-02T00:00:00').getTime());
eq(V3.recul === 3 && V3.parSem === 9, '4 : 3 semaines d\'historique → 27 / 3 = 9 (et non 6,75)', V3);
// 5 — kg : les quarts restent exacts.
eq(sb._cdFmtKg(1.25) === '1,25' && sb._cdFmtKg(7.5) === '7,5' && sb._cdFmtKg(80) === '80' && sb._cdFmtKg(83.333) === '83,3', '5 : 1,25 · 7,5 · 80 · 83,3', [sb._cdFmtKg(1.25), sb._cdFmtKg(83.333)]);

// 6 — Bloqué : jamais sur les 2 premières séances d'un exercice (débutant, compte neuf) ; 3 séances identiques → bloqué.
{
  const sb2 = { Math, Number, String, Object, Array, JSON, Date, console, LV3_BLOQUE_N: { debutant: 2, intermediaire: 3 },
    _lv3Niveau: () => 'debutant', _ctxAttendu: () => null, _exoFourchette: () => ({ rmin: 8, rmax: 12 }), _petitPas: () => 2.5,
    parseChatDate: (d) => { const [j, m, a] = String(d).split('/'); return new Date(+a, +m - 1, +j).getTime(); } };
  vm.createContext(sb2); vm.runInContext(['_lectureExos', '_progSecondaire', '_cdAvgRpe'].map(pick).join('\n'), sb2);
  const P = (d, c, r) => ({ date: d, charge: c, reps: r, series: [{ charge: c, reps: r, rpe: 9 }, { charge: c, reps: r, rpe: 9 }] });
  const now6 = new Date(2026, 10, 6, 14).getTime();
  const L2 = sb2._lectureExos({ historique: { progression_par_exo: { X: [P('05/11/2026', 60, 8), P('02/11/2026', 60, 8)] } } }, now6);
  eq(L2.bloque.length === 0, '6 : 2 séances identiques (compte neuf) → pas « bloqué »', L2);
  const L3 = sb2._lectureExos({ historique: { progression_par_exo: { X: [P('05/11/2026', 60, 8), P('02/11/2026', 60, 8), P('29/10/2026', 60, 8)] } } }, now6);
  eq(L3.bloque.length === 1, '6 : 3 séances identiques (débutant) → bloqué', L3);
}

// 7 — Séances libres rattachées (Ma semaine) : choix explicite, automatique ≥ 50 %, sinon « en plus ».
{
  const sb3 = { Math, Number, String, Object, Array, JSON, Date, console, _PROG_JOURS_LONG: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] };
  vm.createContext(sb3); vm.runInContext(['_rattNorm', '_rattExos', '_rattLundiIso', '_rattProgramme', '_rattAid', '_rattLocalAll', '_rattLocalGet', '_rattachements', '_faitesPeriode', '_sjIso', '_seanceDuJour', '_rattCandidats'].map(pick).join('\n'), sb3);
  const L = (sid, j, exos) => exos.map((e) => ({ seance_id: sid, jour: j, exercice: e }));
  const programme = [].concat(L('pec epaule', 1, ['A', 'B', 'C', 'D']), L('dos jambes', 2, ['E', 'F', 'G', 'H']), L('pec epaule 2', 4, ['A', 'B', 'I', 'J']), L('dos jambe 2', 5, ['E', 'K', 'L', 'M']));
  const S = (date, sid, ex, extra) => Object.assign({ date, seance_id: sid, exercices: ex.map((n) => ({ nom: n })) }, extra || {});
  const base = [S('2026-11-02', 'pec epaule', ['A', 'B', 'C', 'D'])];
  // 05/11 libre : A, B, E, F, X, Y → 2/6 avec pec epaule 2 (33 %) ; 06/11 libre : E, K, Z → 2/3 avec dos jambe 2 (67 %)
  const lib5 = S('2026-11-05', 'Libre', ['A', 'B', 'E', 'F', 'X', 'Y']), lib6 = S('2026-11-06', 'Libre', ['E', 'K', 'Z']);
  let R = sb3._rattachements({ programme, seances_detail: base.concat([lib5, lib6]) });
  eq(R['2026-11-05|Libre'].cible === '__plus__' && R['2026-11-06|Libre'].cible === 'dos jambe 2', '7 : auto — 33 % → en plus ; 67 % → dos jambe 2', R);
  R = sb3._rattachements({ programme, seances_detail: base.concat([S('2026-11-05', 'Libre', lib5.exercices.map((e) => e.nom), { rattache: 'pec epaule 2' }), lib6]) });
  eq(R['2026-11-05|Libre'].cible === 'pec epaule 2' && R['2026-11-05|Libre'].src === 'choix', '7 : choix explicite prioritaire', R);
  const F = sb3._faitesPeriode({ programme, seances_detail: base.concat([S('2026-11-05', 'Libre', lib5.exercices.map((e) => e.nom), { rattache: 'pec epaule 2' }), lib6]) }, '2026-11-02', '2026-11-08');
  eq(F.faites['pec epaule'] === 'prog' && F.faites['pec epaule 2'] === 'libre' && F.faites['dos jambe 2'] === 'libre' && !F.faites['dos jambes'] && F.plus.length === 0, '7 : lundi faite, jeudi + vendredi « en séance libre », mardi non faite', F);
  // une séance prévue n'est cochée qu'une fois : 2e libre identique → en plus
  R = sb3._rattachements({ programme, seances_detail: base.concat([lib6, S('2026-11-07', 'Libre', ['E', 'K', 'Z'])]) });
  eq(R['2026-11-07|Libre'].cible === '__plus__', '7 : séance prévue déjà cochée → la 2e libre compte en plus', R);
  const C = sb3._rattCandidats({ programme, seances_detail: base }, '2026-11-05', ['A', 'B', 'E', 'F', 'X', 'Y'], 'Libre');
  eq(C[0].sid === 'pec epaule 2' && C[0].memeJour && !C.some((c) => c.sid === 'pec epaule'), '7 : fin de séance jeudi → pec epaule 2 proposée (prévue ce jour), pec epaule (faite) absente', C);
}
console.log('-'.repeat(70)); console.log('audit 06/11 corrections : ' + ok + ' OK / ' + ko + ' KO'); if (ko) process.exitCode = 1;
