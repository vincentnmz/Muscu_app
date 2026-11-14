// Banc de profils — 8 profils FICTIFS et déterministes (aucune donnée réelle). Date figée : jeudi 12/11/2026 18:00 (Paris).
// Chaque profil = un cas qu'un audit a déjà fait remonter, ou un parcours type. Ajouter un profil = ajouter un cas ici,
// puis `node scripts/banc-profils/run.mjs --maj <id>` après avoir relu les phrases produites.
const NOW = Date.UTC(2026, 10, 12, 17, 0, 0);
const J = (n) => new Date(NOW - n * 864e5).toISOString().slice(0, 10);   // n jours avant aujourd'hui (0 = aujourd'hui)

const A = { // programme Full body A / B (fourchettes explicites)
  A: [['Squat', 'Quadriceps', 6, 10], ['Développé couché barre', 'Pectoraux', 6, 10], ['Rowing barre', 'Dos', 8, 12]],
  B: [['Soulevé de terre roumain', 'Ischio', 8, 12], ['Développé militaire haltères', 'Epaule', 8, 12], ['Tirage vertical', 'Dos', 8, 12]],
};
function base(id, extra) {
  return Object.assign({ athletes: [], performances: [], indicateurs: [], bien_etre: [], programme: [], exercices: [], volume_obti: [], planning: [], _id: 1, _aid: id }, extra || {});
}
function athlete(st, o) { st.athletes.push(Object.assign({ id: st._aid, login: '9' + st._aid, nom: 'Profil ' + st._aid, annees: 3, created_at: '2026-01-01', sexe: 'H', sport: 'muscu' }, o)); }
function programme(st) {
  ['A', 'B'].forEach((g) => A[g].forEach(([exo, , mi, ma]) => st.programme.push({ id: st._id++, athlete_id: st._aid, seance_id: 'Full body ' + g, groupe_id: g, exercice: exo, series_prevues: 3, reps_mini: mi, reps_maxi: ma, reps_max: ma, repos_sec: 120, type: 'muscu' })));
}
// séance : d = jours avant aujourd'hui ; exos = [[exo, muscle, [[charge, reps, rpe], ...]], ...]
function seance(st, d, nom, exos) {
  exos.forEach(([exo, mus, sets]) => sets.forEach(([c, r, rpe], i) => st.performances.push({ id: st._id++, athlete_id: st._aid, date: J(d), seance_id: nom, nom, exercice: exo, muscle: mus, serie: i + 1, charge: c, reps: r, rpe, repos: 120, volume: c * r })));
}
function bienEtre(st, d, o) { st.bien_etre.push(Object.assign({ id: st._id++, athlete_id: st._aid, date: J(d), seance_id: 'q' + d, sommeil: 4, energie: 4, fatigue_musculaire: 2, douleur: 1, stress: 2, motivation: 4 }, o)); }
function nuit(st, d, min) { st.indicateurs.push({ id: st._id++, athlete_id: st._aid, date: J(d), seance_id: 'sante_' + J(d), cle: 'sommeil_min', valeur: String(min), unite: 'min', source: 'montre' }); }
const trois = (c, r, rpe) => [[c, r, rpe], [c, r, rpe + 0.5], [c, r - 1, rpe + 1]];

const PROFILS = {
  // 1. Débutant régulier : 3 semaines, lundi + jeudi, +1 rep à chaque fois, questionnaire 2×/sem.
  debutant_regulier() {
    const st = base('1'); athlete(st, { annees: 0, created_at: '2026-10-15' }); programme(st);
    [[21, 'A', 0], [18, 'B', 0], [14, 'A', 1], [11, 'B', 1], [7, 'A', 2], [4, 'B', 2], [0, 'A', 3]].forEach(([d, g, k]) =>
      seance(st, d, 'Full body ' + g, A[g].map(([e, m], i) => [e, m, trois(40 + i * 10, 8 + k, 7.5)])));
    [21, 18, 14, 11, 7, 4, 0].forEach((d) => bienEtre(st, d, {}));
    return st;
  },
  // 2. Intermédiaire qui oscille (cas « John ») : squat 105 × 9-10 depuis 6 séances, couché qui monte vraiment.
  intermediaire_plateau() {
    const st = base('2'); athlete(st, { annees: 5 }); programme(st);
    const jours = [40, 38, 35, 33, 31, 28, 26, 24, 21, 19, 17, 14, 12, 10, 7, 5, 3, 1];
    jours.forEach((d, k) => {
      const g = k % 2 ? 'B' : 'A';
      if (g === 'A') seance(st, d, 'Full body A', [['Squat', 'Quadriceps', trois(k < 6 ? 100 : 105, k < 6 ? 8 : (k % 4 === 0 ? 10 : 9), 7.5)], ['Développé couché barre', 'Pectoraux', trois(70 + Math.floor(k / 4) * 2.5, 8, 7.5)], ['Rowing barre', 'Dos', trois(60, 10, 7.5)]]);
      else seance(st, d, 'Full body B', A.B.map(([e, m], i) => [e, m, trois(50 + i * 5, 10, 7.5)]));
    });
    for (let d = 0; d < 28; d += 2) bienEtre(st, d, {});
    return st;
  },
  // 3. Avancé avec une pause de 12 jours dans la période de comparaison.
  avance_pause() {
    const st = base('3'); athlete(st, { annees: 9 }); programme(st);
    [56, 53, 50, 47, 44, 41, 38, 26, 23, 19, 16, 12, 9, 5, 2].forEach((d, k) =>
      seance(st, d, 'Full body ' + (k % 2 ? 'B' : 'A'), A[k % 2 ? 'B' : 'A'].map(([e, m], i) => [e, m, trois(80 + i * 20 + (k > 7 ? 2.5 : 0), 8, 8)])));
    [2, 5, 9].forEach((d) => bienEtre(st, d, {}));
    return st;
  },
  // 4. Montre : 30 séances avec nuit mesurée, nuits courtes en épisodes → sommeil → performance affiché.
  montre_sommeil() {
    const st = base('4'); athlete(st, { annees: 5 }); programme(st);
    let k = 0;
    for (let d = 70; d >= 0; d--) {
      const courte = [66, 65, 58, 50, 49, 41, 33, 32, 24, 16, 8, 7].includes(d);
      nuit(st, d, courte ? 375 + (d % 3) * 10 : 450 + (d % 5) * 9);
      if ([0, 2, 4].includes((70 - d) % 7)) {
        const g = k % 2 ? 'B' : 'A';
        seance(st, d, 'Full body ' + g, A[g].map(([e, m], i) => [e, m, trois(60 + i * 10 + Math.floor(k / 6) * 2.5, 8 + (k % 3), 8)]));
        k++;
      }
    }
    for (let d = 0; d < 30; d += 3) bienEtre(st, d, {});
    return st;
  },
  // 5. Douleur et fatigue déclarées aujourd'hui → vigilance.
  douleur_vigilance() {
    const st = base('5'); athlete(st, { annees: 5 }); programme(st);
    [27, 24, 20, 17, 13, 10, 6, 3].forEach((d, k) => seance(st, d, 'Full body ' + (k % 2 ? 'B' : 'A'), A[k % 2 ? 'B' : 'A'].map(([e, m], i) => [e, m, trois(60 + i * 10, 9, 8)])));
    for (let d = 1; d < 27; d += 3) bienEtre(st, d, {});
    bienEtre(st, 0, { sommeil: 2, energie: 2, fatigue_musculaire: 4, douleur: 4, zone_douloureuse: 'Épaule', stress: 4 });
    return st;
  },
  // 5 bis. Gêne 3/5 sans zone reliée à un muscle (« Autre ») : rien en pause, ligne de prudence (14/11).
  douleur_autre() {
    const st = base('9'); athlete(st, { annees: 5 }); programme(st);
    [27, 24, 20, 17, 13, 10, 6, 3].forEach((d, k) => seance(st, d, 'Full body ' + (k % 2 ? 'B' : 'A'), A[k % 2 ? 'B' : 'A'].map(([e, m], i) => [e, m, trois(60 + i * 10, 9, 8)])));
    for (let d = 1; d < 27; d += 3) bienEtre(st, d, {});
    bienEtre(st, 0, { douleur: 3, zone_douloureuse: 'autre' });
    return st;
  },
  // 6. Nouveau compte : aucune séance, aucun questionnaire.
  nouveau_vide() {
    const st = base('6'); athlete(st, { annees: 1, created_at: '2026-11-12' }); return st;
  },
  // 7. Séries sous la fourchette à RPE 10 (saut de charge trop grand).
  sous_fourchette() {
    const st = base('7'); athlete(st, { annees: 5 }); programme(st);
    [24, 21, 17, 14, 10, 7, 3].forEach((d, k) => {
      const g = k % 2 ? 'B' : 'A';
      if (g === 'A') seance(st, d, 'Full body A', [['Squat', 'Quadriceps', trois(90, 8, 8)], ['Développé couché barre', 'Pectoraux', k >= 4 ? [[80, 4, 9.5], [80, 3, 10], [80, 2, 10]] : trois(70, 8, 8)], ['Rowing barre', 'Dos', trois(60, 10, 8)]]);
      else seance(st, d, 'Full body B', A.B.map(([e, m], i) => [e, m, trois(50 + i * 5, 10, 8)]));
    });
    for (let d = 0; d < 24; d += 4) bienEtre(st, d, {});
    return st;
  },
  // 8. Athlète suivi par un coach qui a coupé les propositions Novalyz.
  coach_sans_propositions() {
    const st = base('8', { coachs: [{ coach_id: 'C1', login: '0808', nom: 'Coach Banc' }] });
    athlete(st, { annees: 5, coach_id: 'C1', prefs: { novalyz_athlete: false } }); programme(st);
    [20, 17, 13, 10, 6, 3].forEach((d, k) => seance(st, d, 'Full body ' + (k % 2 ? 'B' : 'A'), A[k % 2 ? 'B' : 'A'].map(([e, m], i) => [e, m, trois(60 + i * 10, 8 + Math.floor(k / 2), 8)])));
    for (let d = 0; d < 20; d += 3) bienEtre(st, d, {});
    return st;
  },
};
module.exports = { NOW, PROFILS };
