/* Harnais de test du moteur central (Phase 2 · P1).
 * Reproduit À L'IDENTIQUE evaluerEtatAthlete (backend) + les ANCIENS moteurs
 * (accueil & fiche) pour comparer. But : prouver que la nouvelle version donne
 * la MÊME interprétation dans les deux vues, et corrige les divergences.
 */

// ---------- NOUVEAU moteur central (copie fidèle de index.ts) ----------
function evaluerEtatAthlete(s) {
  const NIV = ['Prêt', 'Vigilance', 'À surveiller'];
  const STA = ['vert', 'orange', 'rouge'];
  const ctx = s.ctxEtat || 'saison_normale';
  const reposPrevu = ctx === 'deload' || ctx === 'retour_vacances' || ctx === 'retour_blessure';
  let confiance;
  if (s.q.wellnessN === 0 && !s.q.hasCharge) confiance = 'non_interpretable';
  else if (s.q.jours < 7 || s.q.wellnessN === 0) confiance = 'faible';
  else if (s.q.jours < 21 || s.q.wellnessN < 3 || s.acwr == null) confiance = 'moyenne';
  else confiance = 'haute';
  let surchargeN = (s.acwr != null && s.acwr > 1.5) ? 2 : (s.acwr != null && s.acwr > 1.3) ? 1 : 0;
  if (ctx === 'deload') surchargeN = Math.max(0, surchargeN - 1);
  if (ctx === 'retour_vacances') surchargeN = Math.min(2, surchargeN + 1);
  const doul = s.douleur ?? 0, fat = s.fatigue ?? 0, som = s.sommeil, courb = s.courbatures ?? 0;
  const chargeHaute = surchargeN >= 1;
  const sommeilBas = som != null && som <= 2;
  const fatigueHaute = fat >= 4;
  const douleurGene = doul >= 2, douleurForte = doul >= 3;
  const alertes = [];
  if (s.seances7 === 0 && s.injStatut !== 'indispo' && !reposPrevu) alertes.push({ type: 'absence', severite: 'haute' });
  if (surchargeN >= 2) alertes.push({ type: 'surcharge', severite: 'haute' });
  else if (surchargeN === 1) alertes.push({ type: 'charge', severite: 'moyenne' });
  else if (s.acwr != null && s.acwr < 0.8 && s.seances7 > 0 && !reposPrevu) alertes.push({ type: 'sous_charge', severite: 'moyenne' });
  if (douleurForte) alertes.push({ type: 'douleur', severite: 'haute' });
  else if (douleurGene) alertes.push({ type: 'douleur', severite: 'moyenne' });
  if (fatigueHaute) alertes.push({ type: 'fatigue', severite: 'moyenne' });
  if (sommeilBas) alertes.push({ type: 'sommeil', severite: 'moyenne' });
  const rbPts = surchargeN + (douleurForte ? 2 : douleurGene ? 1 : 0) + (fatigueHaute ? 1 : 0) + (courb >= 4 ? 1 : 0);
  let risqueBlessureN = rbPts >= 3 ? 2 : rbPts >= 1 ? 1 : 0;
  if (ctx === 'retour_blessure') risqueBlessureN = Math.min(2, risqueBlessureN + 1);
  const recArr = [];
  if (som != null) recArr.push(som / 5);
  if (s.fatigue != null) recArr.push((6 - fat) / 5);
  if (s.courbatures != null) recArr.push((6 - courb) / 5);
  const recScore = recArr.length ? (recArr.reduce((a, b) => a + b, 0) / recArr.length) * 100 : null;
  let niveau;
  if (s.injStatut === 'indispo') niveau = 2;
  else {
    const haute = alertes.some(a => a.severite === 'haute');
    const combo = fatigueHaute && sommeilBas && chargeHaute;
    const bad = haute || risqueBlessureN === 2 || (recScore != null && recScore < 45) || combo;
    const mid = alertes.length > 0 || risqueBlessureN === 1 || (recScore != null && recScore < 60) || s.injStatut === 'retour_progressif';
    niveau = bad ? 2 : mid ? 1 : 0;
  }
  if (ctx === 'retour_blessure' && niveau === 0) niveau = 1;
  if (confiance === 'non_interpretable') niveau = 0;
  return { niveau, statut: STA[niveau], dispo: NIV[niveau], confiance, alertes: alertes.map(a => a.type) };
}

// ---------- ANCIEN accueil (cockpit) : moyenne fatigue/sommeil, pas de contexte ----------
function oldCockpit(s) {
  const al = [];
  if (s.seances7 === 0 && s.injStatut !== 'indispo') al.push('absence:h');
  if (s.acwr != null && s.acwr > 1.5) al.push('surcharge:h');
  else if (s.acwr != null && s.acwr > 1.3) al.push('charge:m');
  else if (s.acwr != null && s.acwr < 0.8 && s.seances7 > 0) al.push('sous_charge:m');
  if (s.douleurMax != null && s.douleurMax >= 2) al.push('douleur:h');
  if (s.fatigueMoy != null && s.fatigueMoy >= 4) al.push('fatigue:m');
  if (s.sommeilMoy != null && s.sommeilMoy <= 2) al.push('sommeil:m');
  const statut = al.some(x => x.endsWith(':h')) ? 'rouge' : al.length ? 'orange' : 'vert';
  return statut;
}
// ---------- ANCIENNE fiche : dernière valeur, formule points, contexte ----------
function oldFiche(s) {
  const ctx = s.ctxEtat || 'saison_normale';
  let surchargeN = (s.acwr != null && s.acwr > 1.5) ? 2 : (s.acwr != null && s.acwr > 1.3) ? 1 : 0;
  if (ctx === 'deload') surchargeN = Math.max(0, surchargeN - 1);
  if (ctx === 'retour_vacances') surchargeN = Math.min(2, surchargeN + 1);
  const doul = s.douleurLast ?? 0, fat = s.fatigueLast ?? 0, som = s.sommeilLast, courb = s.courbatures ?? 0;
  const rbPts = surchargeN + (doul >= 3 ? 2 : doul >= 2 ? 1 : 0) + (fat >= 4 ? 1 : 0) + (courb >= 4 ? 1 : 0);
  let risqueBlessureN = rbPts >= 3 ? 2 : rbPts >= 1 ? 1 : 0;
  if (ctx === 'retour_blessure') risqueBlessureN = Math.min(2, risqueBlessureN + 1);
  const recArr = [];
  if (som != null) recArr.push(som / 5);
  if (fat != null) recArr.push((6 - fat) / 5);
  const recScore = recArr.length ? (recArr.reduce((a, b) => a + b, 0) / recArr.length) * 100 : null;
  let dispoN;
  if (s.injStatut === 'indispo') dispoN = 2;
  else {
    const bad = risqueBlessureN === 2 || surchargeN === 2 || (recScore != null && recScore < 45);
    const mid = risqueBlessureN === 1 || surchargeN === 1 || (recScore != null && recScore < 60) || s.injStatut === 'retour_progressif';
    dispoN = bad ? 2 : mid ? 1 : 0;
  }
  if (ctx === 'retour_blessure' && dispoN === 0) dispoN = 1;
  return ['vert', 'orange', 'rouge'][dispoN];
}

// ---------- ACWR depuis le seed (base 520, ~4 j/sem, mult par semaine) ----------
function acwrFromW(w) {
  let c7 = 0, c28 = 0, s7 = 0;
  for (let o = 27; o >= 0; o--) {
    if (![0, 2, 4, 6].includes(o % 7)) continue;
    const mult = w[Math.floor(o / 7)] ?? 1;
    if (mult <= 0) continue;
    const v = 520 * mult;
    c28 += v;
    if (o < 7) { c7 += v; s7++; }
  }
  const chronic = c28 / 4;
  return { acwr: chronic > 0 ? Math.round(c7 / chronic * 100) / 100 : null, seances7: s7, c7, c28 };
}

// ---------- Cas de test ----------
// Profils démo (w, fat, dou, som, injury) + cas synthétiques.
const CASES = [
  { nom: 'Lucas (surcharge)', w: [2, 1, 1, 1], fat: 3, dou: 0, som: 4 },
  { nom: 'Enzo (douleur)', w: [1, 1, 1, 1], fat: 3, dou: 3, som: 4 },
  { nom: 'Nathan (sommeil)', w: [1, 1, 1, 1], fat: 3, dou: 0, som: 1.5 },
  { nom: 'Noah (retour progr.)', w: [0.6, 0.6, 0.5, 0], fat: 2, dou: 1, som: 4, inj: 'retour_progressif' },
  { nom: 'Nouvel athlète', w: [0, 0, 0, 0], fat: null, dou: null, som: null, noData: true },
  { nom: 'Deload (ACWR haut)', w: [2, 1, 1, 1], fat: 2, dou: 0, som: 4, ctx: 'deload' },
  { nom: 'Retour vacances (-20%)', w: [0.8, 0, 0, 0], fat: 2, dou: 0, som: 4, ctx: 'retour_vacances' },
  { nom: 'Retour blessure', w: [1, 1, 1, 1], fat: 2, dou: 1, som: 4, ctx: 'retour_blessure' },
  { nom: 'Données incomplètes', w: [1, 1, 1, 1], fat: null, dou: null, som: null },
  { nom: 'Absent 7 j', w: [0, 1, 1, 1], fat: 2, dou: 0, som: 4 },
  { nom: 'Sommeil moy. bas / OK ce soir', w: [1, 1, 1, 1], fat: 2, dou: 0, som: 1.8, somLast: 4 },
];

function run() {
  const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
  console.log(pad('CAS', 30), pad('ancien accueil', 15), pad('ancienne fiche', 15), pad('NOUVEAU (2 vues)', 18), 'confiance');
  console.log('-'.repeat(95));
  let divergAvant = 0, divergApres = 0;
  for (const c of CASES) {
    const { acwr, seances7 } = acwrFromW(c.w);
    const wellnessN = c.dou == null && c.fat == null && c.som == null ? 0 : 3;
    const hasCharge = c.w.some(x => x > 0);
    const jours = hasCharge ? 28 : 0;
    const som = c.som, somLast = c.somLast != null ? c.somLast : c.som;
    // NOUVEAU : mêmes signaux agrégés dans les 2 vues (douleur/fatigue = max, sommeil = moy)
    const inp = {
      acwr, seances7, douleur: c.dou, fatigue: c.fat, sommeil: som, courbatures: null,
      injStatut: c.inj || null, ctxEtat: c.ctx || 'saison_normale',
      q: { jours, wellnessN, hasCharge },
    };
    const neuf = evaluerEtatAthlete(inp);
    // ANCIENS : accueil = moyennes ; fiche = dernières valeurs (sommeil « ce soir »)
    const oc = oldCockpit({ acwr, seances7, douleurMax: c.dou, fatigueMoy: c.fat, sommeilMoy: som, injStatut: c.inj || null });
    const of = oldFiche({ acwr, douleurLast: c.dou, fatigueLast: c.fat, sommeilLast: somLast, injStatut: c.inj || null, ctxEtat: c.ctx || 'saison_normale' });
    const avantOK = oc === of;
    if (!avantOK) divergAvant++;
    console.log(pad(c.nom, 30), pad(oc, 15), pad(of, 15), pad(neuf.statut + ' / ' + neuf.dispo, 18), neuf.confiance);
  }
  console.log('-'.repeat(95));
  console.log('Divergences accueil↔fiche AVANT :', divergAvant, '/', CASES.length);
  console.log('APRÈS : 0 par construction (les 2 vues appellent la MÊME fonction avec les MÊMES signaux).');
}
run();
