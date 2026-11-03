/* Lecture Novalyz v3 (02/11/2026) — force estimée avec RPE, diagnostic, plan de la semaine (js/lecture-v3.js). */
const fs = require('fs'), path = require('path'), vm = require('vm');
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g).slice(0, 400) + ')' : '')); } };
const sb = { Date, Math, Object, String, Number, Array, JSON, console,
  _musKey: (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/s$/, ''),
  _cdFmtKg: (x) => String(Math.round(x * 10) / 10).replace('.', ','), _maE: (x) => String(x), _petitPas: () => 2.5,
  _exoFourchette: (n) => /curl/i.test(n) ? { rmin: 8, rmax: 20 } : { rmin: 6, rmax: 12 }, _ctxAttendu: () => null, exercicesData: [],
  _lectureExos: () => ({ sous: [{ exo: 'Smith incliné' }], bloque: [], recule: [], records: [], progresse: [] }), _tjCibles: () => [null] };
vm.createContext(sb); vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'lecture-v3.js'), 'utf8'), sb);
const S = (c, r, rpe) => ({ charge: c, reps: r, rpe });
// A — à charge/reps égales, un RPE plus bas = plus de force estimée ; reps en réserve plafonnées à 4.
eq(sb._lv3ForceSerie(S(80, 8, 7)) > sb._lv3ForceSerie(S(80, 8, 9)), 'A : 80×8 à RPE 7 > 80×8 à RPE 9');
eq(Math.abs(sb._lv3ForceSerie(S(80, 8, 3)) - 80 * (1 + 12 / 30)) < 1e-9, 'A : reps en réserve plafonnées à 4');
eq(Math.abs(sb._lv3ForceSerie({ charge: 80, reps: 8 }) - 80 * (1 + 8 / 30)) < 1e-9, 'A : sans RPE = formule classique');
// Données : Smith incliné 70×5@9 → 80×3@10 → 80×2@10 → 80×1@10 ; ischios à 4 séries/sem (min 6).
const now = new Date('2026-11-02T20:00:00').getTime(), fr = (iso) => iso.split('-').reverse().join('/');
const pt = (d, c, r, rpe, seance) => ({ date: fr(d), seance, charge: c, reps: r, series: [S(c, r, rpe), S(c, r, rpe)] });
const dm = {}; ['2026-10-06', '2026-10-13', '2026-10-20', '2026-10-27'].forEach((d) => { dm[d] = { series: 10, spm: { Ischio: 4, Pectoraux: 14 } }; });
['2026-10-05', '2026-10-15', '2026-10-22', '2026-10-29'].forEach((d) => { dm[d] = Object.assign(dm[d] || { series: 0, spm: {} }, { series: 10 }); });
const data = { historique: { progression_par_exo: {
    'Smith incliné': [pt('2026-10-29', 80, 1, 10, 'pec'), pt('2026-10-22', 80, 2, 10, 'pec'), pt('2026-10-15', 80, 3, 10, 'pec'), pt('2026-10-05', 70, 5, 9, 'pec')],
    'Leg curl': [pt('2026-10-27', 35, 8, 8, 'jambes'), pt('2026-10-20', 35, 8, 9, 'jambes'), pt('2026-10-13', 35, 8, 9, 'jambes'), pt('2026-10-06', 35, 8, 9, 'jambes')] },
  daily_muscu: dm },
  seances_detail: [{ exercices: [{ nom: 'Smith incliné', muscle: 'Pectoraux' }, { nom: 'Leg curl', muscle: 'Ischio' }] }],
  volume_obti: [{ muscle: 'Pectoraux', series_min: 8, series_opt: 14 }, { muscle: 'Ischio', series_min: 6, series_opt: 12 }],
  programme: [{ exercice: 'Smith incliné', seance_id: 'pec epaule 2' }, { exercice: 'Leg curl', seance_id: 'dos jambes' }] };
const F = sb._lv3Forces(data, now), fs1 = F.filter((x) => x.exo === 'Smith incliné')[0];
eq(fs1 && fs1.pct < 0, 'A : Smith incliné en baisse de force estimée', fs1);
const d = sb._lv3Diag(data, 'Smith incliné', 'sous', now);
eq(d && d.cause === 'charge' && /^65 kg/.test(d.levier), 'B : charge trop lourde → 65 kg pour 6 reps', d && d.levier);
eq(d && d.checks.some((c) => /Saut de <b>70 à 80 kg/.test(c.t)), 'B : saut de charge 70 → 80 kg détecté');
eq(d && d.checks.some((c) => c.s === 'ok' && /Volume pectoraux/.test(c.t)), 'B : volume pectoraux « pas en cause »');
const d2 = sb._lv3Diag(data, 'Leg curl', 'bloque', now);
eq(d2 && d2.cause === 'volume' && /\+2 séries/.test(d2.levier), 'B : ischios sous le minimum → +2 séries', d2 && d2.levier);
// C — plan calculé sur les données d'avant lundi ; action cochée quand la séance la réalise.
const P = sb._lv3Plan(data, now);
eq(P && P.actions[0].type === 'charge' && P.actions[0].charge === 65 && P.actions[0].seance === 'pec epaule 2', 'C : 1re action = Smith à 65 kg (séance « pec epaule 2 »)', P && P.actions);
eq(P && !P.actions[0].fait, 'C : pas encore faite');
data.historique.progression_par_exo['Smith incliné'].unshift(pt('2026-11-02', 65, 6, 8, 'pec'));
const P2 = sb._lv3Plan(data, now);
eq(P2 && P2.actions[0].fait === true && P2.actions[0].charge === 65, 'C : 65 kg × 6 fait lundi → cochée (plan inchangé)', P2 && P2.actions[0]);
// D — sommeil → performance en apprentissage.
data.sante_historique = [{ date: '2026-10-29', sommeil_min: 450 }];
const A = sb._lv3Apprentissage(data);
eq(A && A.n === 1 && A.seuil === 20, 'D : 1 séance avec nuit mesurée sur 20 requises', A);
console.log('-'.repeat(70)); console.log('lecture-v3 : ' + ok + ' OK / ' + ko + ' KO'); if (ko) process.exitCode = 1;
