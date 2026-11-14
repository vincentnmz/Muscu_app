// Contrôle de COHÉRENCE inter-écrans (14/11/2026, audit charge ↔ récupération, décision porteur) :
// pour EXACTEMENT les mêmes données d'athlète, Aujourd'hui, Analyses (muscu + Croisé), Forme et la fiche Coach ne doivent
// pas produire de diagnostics contradictoires. Vérité de référence = le moteur (`data.moteur`, `data.dashboard`).
// Chaque règle renvoie un message si le texte affiché contredit le moteur.
'use strict';
const lignes = (t) => String(t || '').split('\n').map((l) => l.trim()).filter(Boolean);

const NUM = /^\d+([,.]\d+)?$/;
// ACWR affiché avec une valeur ? (« ACWR 1,16 … » sur une ligne, tuile « 1,16 » puis « ACWR », ou « ACWR » puis « 1,16 »)
function acwrAffiche(L) {
  for (let i = 0; i < L.length; i++) {
    if (!/^ACWR\b/i.test(L[i])) continue;
    if (/\d/.test(L[i])) return L[i];
    if (i > 0 && NUM.test(L[i - 1])) return L[i - 1] + ' ' + L[i];
    if (i + 1 < L.length && NUM.test(L[i + 1])) return L[i] + ' ' + L[i + 1] + (L[i + 2] ? ' · ' + L[i + 2] : '');
  }
  return null;
}
// Verdict de zone accolé à l'ACWR (ligne de l'ACWR ou les 2 suivantes) : « zone optimale / de risque / charge élevée / sous-charge ».
function zoneAcwr(L) {
  const Z = /zone optimale|zone de risque|charge élevée|sous-charge/i;
  for (let i = 0; i < L.length; i++) {
    if (!/^ACWR\b/i.test(L[i]) && !(NUM.test(L[i]) && /^ACWR$/i.test(L[i + 1] || ''))) continue;
    for (let k = i; k <= i + 2 && k < L.length; k++) if (Z.test(L[k])) return L.slice(i, k + 1).join(' · ');
  }
  return L.find((l) => /zone optimale|zone de risque/i.test(l)) || null;
}

function verifier(texte, data) {
  const m = (data && data.moteur) || {}, cr = m.charge_ressenti || {}, L = lignes(texte), err = [];
  const al = (m.alertes || []).map((a) => a.type);
  const niv = m.disponibilite && m.disponibilite.niveau;
  // R1 (A) — « tu encaisses bien » / « encaissée » / « bonne assimilation » : seulement si le moteur a pu évaluer le
  //          ressenti et qu'il n'est pas dégradé (même règle que la reco du moteur).
  const enc = L.find((l) => /encaisses bien|bien encaissée|· encaissée|bonne assimilation/i.test(l));
  if (enc && !(cr.evaluable === true && cr.degrade !== true)) err.push('R1 « encaisse bien » sans ressenti évaluable : ' + enc);
  // R2 (B) — jamais de zone ACWR qui juge la charge (« zone optimale / de risque ») : la charge, c'est le moteur.
  const zone = zoneAcwr(L);
  if (zone) err.push('R2 zone ACWR affichée (contredit potentiellement le moteur) : ' + zone);
  // R3 (B/C) — ACWR montré seulement si le moteur le juge fiable.
  const a = acwrAffiche(L);
  if (a && m.acwr_fiable !== true) err.push('R3 ACWR affiché alors que acwr_fiable ≠ true : ' + a);
  // R4 (B) — charge « Habituelle » interdite si le moteur dit charge en hausse / élevée.
  const hab = L.find((l) => /^Habituelle$/.test(l));
  if (hab && m.surcharge && m.surcharge !== 'Faible') err.push('R4 charge « Habituelle » alors que moteur.surcharge = ' + m.surcharge);
  // R5 (D) — « bon moment pour pousser » seulement si prêt, sans absence / sous-charge / douleur / contexte particulier.
  const pou = L.find((l) => /bon moment pour pousser/i.test(l));
  const bloque = niv !== 'Prêt' || al.some((t) => t === 'absence' || t === 'sous_charge' || t === 'douleur') || m.contexte_tag;
  if (pou && bloque) err.push('R5 « bon moment pour pousser » alors que ' + [niv !== 'Prêt' ? 'disponibilité ' + niv : null, al.filter((t) => ['absence', 'sous_charge', 'douleur'].includes(t)).join('+') || null, m.contexte_tag || null].filter(Boolean).join(', ') + ' : ' + pou);
  // R6 (E, 14/11) — pic de charge non interprétable (surcharge ≠ Faible ET ressenti non évalué ou dégradé) :
  //          aucune proposition d'AUGMENTATION (séries, RPE 9-10). Maintien / allègement / récup restent permis.
  const pic = m.surcharge && m.surcharge !== 'Faible' && !(cr.evaluable === true && cr.degrade !== true);
  const aug = pic ? L.find((l) => /\+\d+ séries? de |jusqu'à RPE 9-10|ajoute 1 série|il manque environ|à pousser \(charge ou \+1 rep\)|Prochaine fois : vise/i.test(l)) : null;
  if (aug) err.push('R6 augmentation proposée pendant un pic de charge non interprétable : ' + aug);
  // R7 (14/11, décision porteur) — douleur signalée au questionnaire (alerte « douleur » du moteur) : la synthèse
  //          « Douleurs & blessures » ne dit jamais « Aucune blessure active · OK ».
  const okBl = al.includes('douleur') ? L.find((l, i) => /^Aucune (douleur ni )?blessure/i.test(l) && /^OK$/.test(L[i + 1] || '')) : null;
  if (okBl) err.push('R7 « ' + okBl + ' · OK » alors qu\'une douleur est signalée au questionnaire');
  // R8a (H, 14/11) — douleur FORTE (alerte douleur sévérité haute) : aucune fuite de progression nulle part.
  const dForte = (m.alertes || []).some((x) => x && x.type === 'douleur' && x.severite === 'haute');
  const fuite = dForte ? L.find((l) => /\+\d+ séries? de |RPE 9-10|à pousser \(charge|Prochaine fois : vise|aller à l'échec/i.test(l) && !/pas besoin|sans aller à l'échec|ni d'aller à l'échec/i.test(l)) : null;
  if (fuite) err.push('R8a progression proposée pendant une douleur forte : ' + fuite);
  return err;
}
module.exports = { verifier, acwrAffiche, zoneAcwr };
