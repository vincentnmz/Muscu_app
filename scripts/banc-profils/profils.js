// Banc de profils — 8 profils FICTIFS et déterministes (aucune donnée réelle). Date figée : jeudi 12/11/2026 18:00 (Paris).
// Chaque profil = un cas qu'un audit a déjà fait remonter, ou un parcours type. Ajouter un profil = ajouter un cas ici,
// puis `node scripts/banc-profils/run.mjs --maj <id>` après avoir relu les phrases produites.
const NOW = Date.UTC(2026, 10, 12, 17, 0, 0);
const J = (n) => new Date(NOW - n * 864e5).toISOString().slice(0, 10);   // n jours avant aujourd'hui (0 = aujourd'hui)

const A = { // programme Full body A / B (fourchettes explicites) — noms EXACTS du catalogue (règle de gêne par exercice)
  A: [['Squat', 'Quadriceps', 6, 10], ['Développé couché barre', 'Pectoraux', 6, 10], ['Rowing barre', 'Dos', 8, 12]],
  B: [['RDL barre', 'Ischio', 8, 12], ['Développé militaire aux haltères', 'Epaule', 8, 12], ['Tirage vertical prise large', 'Dos', 8, 12]],
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
      if (g === 'A') seance(st, d, 'Full body A', [['Squat', 'Quadriceps', trois(k < 2 ? 100 : 105, k < 2 ? 8 : (k % 4 === 0 ? 10 : 9), 7.5)], ['Développé couché barre', 'Pectoraux', trois(70 + Math.floor(k / 4) * 2.5, 8, 7.5)], ['Rowing barre', 'Dos', trois(60, 10, 7.5)]]);
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
  // 5 quater (H, 14/11). Douleur FORTE épaule 4/5 avec récupération NORMALE : zone (épaule, pecs, dos) en garde-fou ;
  //          hors zone (jambes) → maintien, pas de « +N séries / RPE 9-10 » (H1 · H2 · H6).
  douleur_forte_recup_ok() {
    const st = base('14'); athlete(st, { annees: 5 }); programme(st);
    [27, 24, 20, 17, 13, 10, 6, 3].forEach((d, k) => seance(st, d, 'Full body ' + (k % 2 ? 'B' : 'A'), A[k % 2 ? 'B' : 'A'].map(([e, m], i) => [e, m, trois(60 + i * 10, 9, 8)])));
    for (let d = 1; d < 27; d += 3) bienEtre(st, d, {});
    bienEtre(st, 0, { douleur: 4, zone_douloureuse: 'Épaule' });
    return st;
  },
  // 5 quinquies (H3, 14/11). Douleur MODÉRÉE épaule 3/5 : progression existante hors zone, cibles alignées sur le plan (D2).
  douleur_moderee() {
    const st = base('15'); athlete(st, { annees: 5 }); programme(st);
    [27, 24, 20, 17, 13, 10, 6, 3].forEach((d, k) => seance(st, d, 'Full body ' + (k % 2 ? 'B' : 'A'), A[k % 2 ? 'B' : 'A'].map(([e, m], i) => [e, m, trois(60 + i * 10, 9, 8)])));
    for (let d = 1; d < 27; d += 3) bienEtre(st, d, {});
    bienEtre(st, 0, { douleur: 3, zone_douloureuse: 'Épaule' });
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
  // 5 ter. Gêne au POIGNET (option B, 14/11) : couché, développé militaire et curls en pause (règle par exercice).
  gene_poignet() {
    const st = base('10'); athlete(st, { annees: 5 }); programme(st);
    [27, 24, 20, 17, 13, 10, 6, 3].forEach((d, k) => seance(st, d, 'Full body ' + (k % 2 ? 'B' : 'A'), A[k % 2 ? 'B' : 'A'].map(([e, m], i) => [e, m, trois(60 + i * 10, 9, 8)])));
    for (let d = 1; d < 27; d += 3) bienEtre(st, d, {});
    bienEtre(st, 0, { douleur: 4, zone_douloureuse: 'poignet' });
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
  // 9. Charge en forte hausse (7 derniers jours) + seulement 2 questionnaires récents : ressenti NON évaluable (audit 14/11 A/B).
  charge_hausse_sans_ressenti() {
    const st = base('11'); athlete(st, { annees: 4 }); programme(st);
    [45, 42, 38, 35, 31, 28, 24, 21, 17, 14, 10].forEach((d, k) => seance(st, d, 'Full body ' + (k % 2 ? 'B' : 'A'), A[k % 2 ? 'B' : 'A'].map(([e, m], i) => [e, m, trois(50 + i * 10, 8, 7)])));
    const lourd = (c, r, rpe) => [[c, r, rpe], [c, r, rpe], [c, r, rpe], [c, r, rpe + 0.5], [c, r - 1, rpe + 1], [c, r - 1, rpe + 1]];
    [6, 5, 3, 2, 0].forEach((d, k) => seance(st, d, 'Full body ' + (k % 2 ? 'B' : 'A'), A[k % 2 ? 'B' : 'A'].map(([e, m], i) => [e, m, lourd(60 + i * 10, 8, 8)])));
    for (let d = 9; d < 45; d += 3) bienEtre(st, d, {});
    [4, 1].forEach((d) => bienEtre(st, d, { sommeil: 5, fatigue_musculaire: 1, stress: 1 }));
    return st;
  },
  // 9 bis. Pic de charge la semaine dernière, plan de cette semaine PAS encore fait, ressenti non évalué (E, 14/11) :
  //        les actions « + séries / à pousser » passent en pause (maintien / allègement restent).
  pic_plan_a_faire() {
    const st = base('13'); athlete(st, { annees: 4 }); programme(st);
    [45, 42, 38, 35, 31, 28, 24, 21, 17, 14].forEach((d, k) => seance(st, d, 'Full body ' + (k % 2 ? 'B' : 'A'), A[k % 2 ? 'B' : 'A'].map(([e, m], i) => [e, m, trois(50 + i * 10, 8, 7)])));
    const lourd = (c, r, rpe) => [[c, r, rpe], [c, r, rpe], [c, r, rpe], [c, r, rpe + 0.5], [c, r - 1, rpe + 1], [c, r - 1, rpe + 1]];
    [7, 6, 5, 4, 2].forEach((d, k) => seance(st, d, 'Full body ' + (k % 2 ? 'B' : 'A'), A[k % 2 ? 'B' : 'A'].map(([e, m], i) => [e, m, lourd(60 + i * 10, 8, 8)])));
    for (let d = 9; d < 45; d += 3) bienEtre(st, d, {});
    [1].forEach((d) => bienEtre(st, d, { sommeil: 5, fatigue_musculaire: 1, stress: 1 }));
    return st;
  },
  // 10. Reprise : 6 semaines régulières puis 10 jours sans séance ; questionnaire récent bon (audit 14/11 D).
  reprise_apres_pause() {
    const st = base('12'); athlete(st, { annees: 4 }); programme(st);
    [52, 49, 45, 42, 38, 35, 31, 28, 24, 21, 17, 14, 10].forEach((d, k) => seance(st, d, 'Full body ' + (k % 2 ? 'B' : 'A'), A[k % 2 ? 'B' : 'A'].map(([e, m], i) => [e, m, trois(60 + i * 10, 9, 8)])));
    for (let d = 1; d < 50; d += 3) bienEtre(st, d, {});
    return st;
  },
  // 11. Deux séances le même jour (20/11, nouveauté « 2e séance du jour ») : lundi A ; aujourd'hui (jeudi) A le matin
  //     puis B le soir. Attendu : 3 séances / 2 jours cette semaine, B pas re-proposée, chiffres identiques partout.
  deux_seances_jour() {
    const st = base('14'); athlete(st, { annees: 3 }); programme(st);
    [24, 21, 17, 14, 10, 7, 3].forEach((d, k) => seance(st, d, 'Full body ' + (k % 2 ? 'B' : 'A'), A[k % 2 ? 'B' : 'A'].map(([e, m], i) => [e, m, trois(50 + i * 10, 8 + (k > 4 ? 1 : 0), 7.5)])));
    seance(st, 0, 'Full body A', A.A.map(([e, m], i) => [e, m, trois(50 + i * 10, 10, 7.5)]));   // matin
    seance(st, 0, 'Full body B', A.B.map(([e, m], i) => [e, m, trois(55 + i * 5, 10, 7.5)]));    // 2e séance du jour (soir)
    [24, 17, 10, 3, 0].forEach((d) => bienEtre(st, d, {}));
    return st;
  },
  // 11 bis (21/11). Même exercice (Squat) dans 2 séances le même jour : le point de la courbe Évolution = la journée,
  //     le tableau « Dernières séances » doit montrer les séries des DEUX séances (avant : une seule) ; « dernière fois » et cible = la séance du soir (60 × 6), pas un mélange.
  meme_exo_deux_seances() {
    const st = base('24'); athlete(st, { annees: 3 }); programme(st); st._evolution = ['Squat'];
    [10, 7, 3].forEach((d, k) => seance(st, d, 'Full body ' + (k % 2 ? 'B' : 'A'), A[k % 2 ? 'B' : 'A'].map(([e, m], i) => [e, m, trois(50 + i * 10, 9, 7.5)])));
    seance(st, 0, 'Full body A', A.A.map(([e, m], i) => [e, m, trois(50 + i * 10, 10, 7.5)]));
    seance(st, 0, 'Jambes soir', [['Squat', 'Quadriceps', [[60, 6, 8], [60, 6, 8.5]]]]);   // charges différentes : la dernière séance (soir) fait référence (21/11)
    [10, 3, 0].forEach((d) => bienEtre(st, d, {}));
    return st;
  },
  // 11 ter (21/11). PASSAGE D'ANNÉE : « aujourd'hui » = jeudi 7 janvier 2027, séances du 14/12/2026 au 06/01/2027
  //     (dont le 31/12 et le 1er janvier). Semaine, régularité, périodes, records, dates sans année : rien ne doit casser.
  passage_annee() {
    const st = base('25'); athlete(st, { annees: 3 }); programme(st); st._evolution = ['Squat'];
    [24, 21, 17, 14, 10, 7, 6, 3, 1].forEach((d, k) => seance(st, d, 'Full body ' + (k % 2 ? 'B' : 'A'), A[k % 2 ? 'B' : 'A'].map(([e, m], i) => [e, m, trois(50 + i * 10 + (k > 5 ? 2.5 : 0), 8 + (k > 3 ? 1 : 0), 7.5)])));
    [24, 17, 10, 6, 3, 1].forEach((d) => bienEtre(st, d, {}));
    // Décalage : dates calculées depuis le 12/11/2026, ramenées au 07/01/2027 (+56 jours).
    const dec = (iso) => new Date(Date.parse(iso + 'T12:00:00Z') + 56 * 864e5).toISOString().slice(0, 10);
    st.performances.forEach((r) => { r.date = dec(r.date); }); st.bien_etre.forEach((r) => { r.date = dec(r.date); });
    st._now = Date.UTC(2027, 0, 7, 17, 0, 0);
    return st;
  },
  // 12. Séances LIBRES (06/11 + création de séance 20/11) : mercredi, une libre rattachée à « Full body B » (elle la remplace) ;
  //     la semaine dernière, une libre « en plus ». Attendu : B cochée cette semaine, la libre en plus ne remplace rien.
  seance_libre() {
    const st = base('15'); athlete(st, { annees: 3 }); programme(st);
    [24, 21, 17, 14, 10, 7, 3].forEach((d, k) => seance(st, d, 'Full body ' + (k % 2 ? 'B' : 'A'), A[k % 2 ? 'B' : 'A'].map(([e, m], i) => [e, m, trois(50 + i * 10, 9, 7.5)])));
    seance(st, 1, 'Libre', [['RDL barre', 'Ischio', trois(60, 10, 7.5)], ['Tirage vertical prise large', 'Dos', trois(55, 10, 7.5)], ['Curl barre', 'Biceps', trois(25, 12, 8)]]);
    seance(st, 8, 'Libre', [['Curl barre', 'Biceps', trois(22.5, 12, 8)], ['Extension poulie corde', 'Triceps', trois(20, 12, 8)]]);
    st.indicateurs.push({ id: st._id++, athlete_id: st._aid, date: J(1), seance_id: 'Libre', cle: 'rattache', valeur: 'Full body B', unite: 'a', source: 'app' });
    st.indicateurs.push({ id: st._id++, athlete_id: st._aid, date: J(8), seance_id: 'Libre', cle: 'rattache', valeur: '__plus__', unite: 'a', source: 'app' });
    [24, 17, 10, 3, 1].forEach((d) => bienEtre(st, d, {}));
    return st;
  },
  // ── Point 2 (20/11) : recos dans les cas limites ──
  // 13. Une seule séance, faite hier : le minimum de données. Aucune phrase ne doit parler de tendance, de plateau ou de normale.
  premiere_seance() {
    const st = base('16'); athlete(st, { annees: 1, created_at: '2026-11-09' }); programme(st);
    seance(st, 1, 'Full body A', A.A.map(([e, m], i) => [e, m, trois(40 + i * 10, 10, 7)]));
    bienEtre(st, 1, {});
    return st;
  },
  // 14. Exercice remplacé : 3 semaines de « Développé couché barre », puis le programme passe au « Développé couché haltère »
  //     (1re fois cette semaine). La reco ne doit pas pousser l'ancien exercice ni dire « bloqué » sur le nouveau.
  exo_remplace() {
    const st = base('17'); athlete(st, { annees: 3 }); programme(st);
    st.programme.filter((l) => l.exercice === 'Développé couché barre').forEach((l) => { l.exercice = 'Développé couché haltère'; });
    [21, 17, 14, 10, 7].forEach((d, k) => seance(st, d, 'Full body ' + (k % 2 ? 'B' : 'A'), A[k % 2 ? 'B' : 'A'].map(([e, m], i) => [e, m, trois(60, 8, 8)])));
    seance(st, 3, 'Full body B', A.B.map(([e, m]) => [e, m, trois(60, 9, 8)]));
    seance(st, 0, 'Full body A', [['Squat', 'Quadriceps', trois(60, 9, 8)], ['Développé couché haltère', 'Pectoraux', trois(26, 10, 8)], ['Rowing barre', 'Dos', trois(60, 9, 8)]]);
    [21, 14, 7, 3, 0].forEach((d) => bienEtre(st, d, {}));
    return st;
  },
  // 15. Séries très inégales : échauffement léger compté comme série (40 × 12, RPE 5), série lourde (80 × 6, RPE 9),
  //     puis séries allégées (70 × 8, 70 × 7). La cible part de la série LOURDE, pas de l'échauffement.
  series_inegales() {
    const st = base('18'); athlete(st, { annees: 4 }); programme(st);
    const pyr = (lo, hi, rh) => [[lo, 12, 5], [hi, rh, 9], [hi - 10, 8, 8.5], [hi - 10, 7, 9]];
    [22, 19, 15, 12, 8, 5, 1].forEach((d, k) => seance(st, d, 'Full body ' + (k % 2 ? 'B' : 'A'), A[k % 2 ? 'B' : 'A'].map(([e, m], i) => [e, m, pyr(40 + i * 5, 80 + i * 5 + (k > 3 ? 2.5 : 0), 6)])));
    [21, 14, 7, 0].forEach((d) => bienEtre(st, d, {}));
    return st;
  },
  // 16. RPE jamais renseigné : aucune phrase ne doit citer un RPE ni conclure sur l'effort.
  sans_rpe() {
    const st = base('19'); athlete(st, { annees: 2 }); programme(st);
    [21, 18, 14, 11, 7, 4, 0].forEach((d, k) => seance(st, d, 'Full body ' + (k % 2 ? 'B' : 'A'), A[k % 2 ? 'B' : 'A'].map(([e, m], i) => [e, m, [[50 + i * 10, 8 + Math.floor(k / 2), null], [50 + i * 10, 8 + Math.floor(k / 2), null], [50 + i * 10, 7 + Math.floor(k / 2), null]]])));
    return st;
  },
  // 17. Poids du corps (charge 0) : tractions, dips, pompes. Pas de « 0 kg », pas de petit pas en kg ni de « +2,5 kg ».
  poids_du_corps() {
    const st = base('20'); athlete(st, { annees: 2 });
    [['Traction', 'Dos', 6, 10], ['Dips pectoraux', 'Pectoraux', 8, 12], ['Pompe', 'Pectoraux', 10, 20]].forEach(([exo, , mi, ma]) => st.programme.push({ id: st._id++, athlete_id: st._aid, seance_id: 'PDC', groupe_id: 'P', exercice: exo, series_prevues: 3, reps_mini: mi, reps_maxi: ma, reps_max: ma, repos_sec: 120, type: 'muscu' }));
    [21, 17, 14, 10, 7, 3, 0].forEach((d, k) => seance(st, d, 'PDC', [['Traction', 'Dos', [[0, 5 + (k > 3 ? 1 : 0), 9], [0, 5, 9.5], [0, 4, 10]]], ['Dips pectoraux', 'Pectoraux', trois(0, 10 + Math.floor(k / 2), 8)], ['Pompe', 'Pectoraux', trois(0, 20, 7)]]));
    [21, 14, 7, 0].forEach((d) => bienEtre(st, d, {}));
    return st;
  },
};
// Équipe coach (14/11) : un coach fictif + 5 athlètes tirés des profils ci-dessus (mêmes données, reliés au coach).
const EQUIPE = ['intermediaire_plateau', 'douleur_vigilance', 'sous_fourchette', 'coach_sans_propositions', 'gene_poignet', 'charge_hausse_sans_ressenti', 'reprise_apres_pause', 'douleur_forte_recup_ok', 'douleur_moderee'];
function equipe() {
  const st = { athletes: [], performances: [], indicateurs: [], bien_etre: [], programme: [], exercices: [], volume_obti: [], planning: [], coachs: [{ coach_id: 'C1', login: '0808', nom: 'Coach Banc', sport: 'muscu' }] };
  let id = 1;
  for (const nom of EQUIPE) {
    const p = PROFILS[nom]();
    for (const t of Object.keys(st)) {
      if (t === 'coachs' || !Array.isArray(p[t])) continue;
      for (const r of p[t]) st[t].push(Object.assign({}, r, t === 'athletes' ? { coach_id: 'C1', nom: 'Athlète ' + nom, prefs: Object.assign({}, r.prefs, nom === 'intermediaire_plateau' ? { novalyz_athlete: true } : {}) } : {}, r.id != null && t !== 'athletes' ? { id: id++ } : {}));   // plateau : propositions autorisées par le coach
    }
  }
  return { store: st, coachId: 'C1', athleteIds: st.athletes.map((a) => String(a.id)) };
}
module.exports = { NOW, PROFILS, EQUIPE, equipe };
