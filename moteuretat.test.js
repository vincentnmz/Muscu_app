/* Harnais de test du moteur central (Phase 2).
 * Reproduit À L'IDENTIQUE evaluerEtatAthlete (backend index.ts) pour vérifier :
 *  - décision Nathan : récup faible ISOLÉE → orange (rouge seulement si signal concordant) ;
 *  - garde-fou ACWR reprise : chronique insuffisante → ACWR non interprétable, pas d'alerte ;
 *  - cohérence accueil ↔ fiche (même fonction, mêmes signaux).
 */

// ---------- Moteur central (copie fidèle de index.ts) ----------
function evaluerEtatAthlete(s) {
  const NIV = ['Prêt', 'Vigilance', 'À surveiller'];
  const STA = ['vert', 'orange', 'rouge'];
  const ctx = s.ctxEtat || 'saison_normale';
  const reposPrevu = ctx === 'deload' || ctx === 'retour_vacances' || ctx === 'retour_blessure';
  const acwrOk = s.acwr != null && s.acwrFiable !== false;
  const acwrForConf = acwrOk ? s.acwr : null;
  let confiance;
  if (s.q.wellnessN === 0 && !s.q.hasCharge) confiance = 'non_interpretable';
  else if (s.q.jours < 7 || s.q.wellnessN === 0) confiance = 'faible';
  else if (s.q.jours < 21 || s.q.wellnessN < 3 || acwrForConf == null) confiance = 'moyenne';
  else confiance = 'haute';
  let surchargeN = 0;
  if (acwrOk) {
    surchargeN = s.acwr > 1.5 ? 2 : s.acwr > 1.3 ? 1 : 0;
    if (ctx === 'deload') surchargeN = Math.max(0, surchargeN - 1);
    if (ctx === 'retour_vacances') surchargeN = Math.min(2, surchargeN + 1);
  }
  const doul = s.douleur ?? 0, fat = s.fatigue ?? 0, som = s.sommeil, courb = s.courbatures ?? 0;
  const chargeHaute = surchargeN >= 1;
  const sommeilBas = som != null && som <= 2;
  const fatigueHaute = fat >= 4;
  const douleurGene = doul >= 2, douleurForte = doul >= 3;
  const alertes = [];
  if (s.seances7 === 0 && s.injStatut !== 'indispo' && !reposPrevu) alertes.push('absence:h');
  if (surchargeN >= 2) alertes.push('surcharge:h');
  else if (surchargeN === 1) alertes.push('charge:m');
  else if (acwrOk && s.acwr < 0.8 && s.seances7 > 0 && !reposPrevu) alertes.push('sous_charge:m');
  if (douleurForte) alertes.push('douleur:h'); else if (douleurGene) alertes.push('douleur:m');
  if (fatigueHaute) alertes.push('fatigue:m');
  if (sommeilBas) alertes.push('sommeil:m');
  const rbPts = surchargeN + (douleurForte ? 2 : douleurGene ? 1 : 0) + (fatigueHaute ? 1 : 0) + (courb >= 4 ? 1 : 0);
  let risqueBlessureN = rbPts >= 3 ? 2 : rbPts >= 1 ? 1 : 0;
  if (ctx === 'retour_blessure') risqueBlessureN = Math.min(2, risqueBlessureN + 1);
  const recArr = [];
  if (som != null) recArr.push(som / 5);
  if (s.fatigue != null) recArr.push((6 - fat) / 5);
  if (s.courbatures != null) recArr.push((6 - courb) / 5);
  const recScore = recArr.length ? (recArr.reduce((a, b) => a + b, 0) / recArr.length) * 100 : null;
  const recFaible = recScore != null && recScore < 45;
  const signalConcordant = chargeHaute || douleurGene;
  const recFaibleConcordante = recFaible && signalConcordant;
  let niveau;
  if (s.injStatut === 'indispo') niveau = 2;
  else {
    const haute = alertes.some(a => a.endsWith(':h'));
    const combo = fatigueHaute && sommeilBas && chargeHaute;
    const bad = haute || risqueBlessureN === 2 || recFaibleConcordante || combo;
    const mid = alertes.length > 0 || risqueBlessureN === 1 || recFaible || (recScore != null && recScore < 60) || s.injStatut === 'retour_progressif';
    niveau = bad ? 2 : mid ? 1 : 0;
  }
  if (ctx === 'retour_blessure' && niveau === 0) niveau = 1;
  if (confiance === 'non_interpretable') niveau = 0;
  return { niveau, statut: STA[niveau], dispo: NIV[niveau], confiance, acwrOk, recScore: recScore == null ? null : Math.round(recScore), alertes };
}

function acwrFromW(w) {
  let c7 = 0, c28 = 0, s7 = 0;
  for (let o = 27; o >= 0; o--) {
    if (![0, 2, 4, 6].includes(o % 7)) continue;
    const mult = w[Math.floor(o / 7)] ?? 1; if (mult <= 0) continue;
    const v = 520 * mult; c28 += v; if (o < 7) { c7 += v; s7++; }
  }
  const chronic = c28 / 4;
  return { acwr: chronic > 0 ? Math.round(c7 / chronic * 100) / 100 : null, seances7: s7 };
}

// histoDays = jours depuis la 1re charge ; acwrFiable = histo>=28 && !(reprise<28j)
const CASES = [
  { nom: 'Lucas (surcharge)', w: [2, 1, 1, 1], fat: 3, dou: 0, som: 4, histo: 60 },
  { nom: 'Enzo (douleur)', w: [1, 1, 1, 1], fat: 3, dou: 3, som: 4, histo: 60 },
  { nom: 'Nathan (sommeil/récup)', w: [1, 1, 1, 1], fat: 3, dou: 0, som: 1.5, histo: 60, attendu: 'orange' },
  { nom: 'Noah (retour progr.)', w: [0.6, 0.6, 0.5, 0], fat: 2, dou: 1, som: 4, inj: 'retour_progressif', histo: 60 },
  { nom: 'Nouvel athlète', w: [0, 0, 0, 0], fat: null, dou: null, som: null, noData: true, histo: 0 },
  { nom: 'Deload (ACWR haut)', w: [2, 1, 1, 1], fat: 2, dou: 0, som: 4, ctx: 'deload', histo: 60 },
  { nom: 'Retour vacances (chronique OK)', w: [0.8, 0.8, 0.8, 0.8], fat: 2, dou: 0, som: 4, ctx: 'retour_vacances', histo: 60, reprise: 40 },
  { nom: 'Retour vacances (reprise 5 j)', w: [1.2, 0, 0, 0], fat: 2, dou: 0, som: 4, ctx: 'retour_vacances', histo: 60, reprise: 5, attendu: 'ACWR non interp.' },
  { nom: 'Retour blessure', w: [1, 1, 1, 1], fat: 2, dou: 1, som: 4, ctx: 'retour_blessure', histo: 60 },
  { nom: 'Données incomplètes', w: [1, 1, 1, 1], fat: null, dou: null, som: null, histo: 60 },
  { nom: 'Absent 7 j', w: [0, 1, 1, 1], fat: 2, dou: 0, som: 4, histo: 60 },
  { nom: 'ACWR insuffisant (< 28 j)', w: [1.5, 0, 0, 0], fat: 2, dou: 0, som: 4, histo: 12, attendu: 'ACWR non interp.' },
  { nom: 'Récup faible + surcharge', w: [2, 1, 1, 1], fat: 4, dou: 0, som: 1.5, histo: 60, attendu: 'rouge' },
];

function run() {
  const pad = (s, n) => (String(s) + ' '.repeat(n)).slice(0, n);
  console.log(pad('CAS', 32), pad('statut', 9), pad('ACWR', 6), pad('récup', 7), pad('confiance', 17), 'attendu');
  console.log('-'.repeat(95));
  let ko = 0;
  for (const c of CASES) {
    const { acwr, seances7 } = acwrFromW(c.w);
    const wellnessN = (c.dou == null && c.fat == null && c.som == null) ? 0 : 3;
    const hasCharge = c.w.some(x => x > 0);
    const acwrFiable = c.histo >= 28 && !(c.ctx === 'retour_vacances' && c.reprise != null && c.reprise < 28);
    const r = evaluerEtatAthlete({
      acwr, acwrFiable, seances7, douleur: c.dou, fatigue: c.fat, sommeil: c.som, courbatures: null,
      injStatut: c.inj || null, ctxEtat: c.ctx || 'saison_normale',
      q: { jours: c.histo, wellnessN, hasCharge },
    });
    const acwrTxt = r.acwrOk ? 'oui' : 'NON';
    let okAttendu = '';
    if (c.attendu) {
      if (c.attendu === 'ACWR non interp.') okAttendu = r.acwrOk ? '❌' : '✅';
      else okAttendu = (r.statut === c.attendu) ? '✅' : '❌';
      if (okAttendu === '❌') ko++;
    }
    console.log(pad(c.nom, 32), pad(r.statut, 9), pad(acwrTxt, 6), pad(r.recScore == null ? '—' : r.recScore, 7), pad(r.confiance, 17), (c.attendu || '') + ' ' + okAttendu);
  }
  console.log('-'.repeat(95));
  console.log(ko === 0 ? '✅ Tous les attendus vérifiés.' : `❌ ${ko} attendu(s) en échec.`);
}
run();
