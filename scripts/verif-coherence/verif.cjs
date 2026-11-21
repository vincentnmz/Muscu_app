/* =============================================================================
 * VÉRIFICATEUR DE COHÉRENCE (18/11/2026, demande porteur : « le calcul doit être fiable à 100 % »).
 *
 * Principe : chaque chiffre que l'app affiche est RECALCULÉ ici directement depuis les données brutes
 * (séries, questionnaires, programme), avec un code écrit À PART du moteur (rien n'est importé d'index.ts
 * ni d'app.js). Puis on compare :
 *   A. données servies par getAppData  ↔ recalcul indépendant (records, séances, tonnage, volume…) ;
 *   B. texte affiché à l'écran         ↔ recalcul, et la même mesure d'un écran à l'autre.
 * Un écart = un bug à corriger (ou une règle à écrire ici si l'écart est voulu, avec sa raison).
 *
 * Utilisation : verifier({ store, appdata, ecrans, now }) → [{ code, gravite, message }]
 *   store   : base (tables) telle que lue en prod (performances, exercices, bien_etre, athletes…)
 *   appdata : réponse de getAppData pour l'athlète (session athlète)
 *   ecrans  : texte relevé à l'écran (optionnel) — sections « ######## NOM »
 * Ligne de commande : node scripts/verif-coherence/verif.cjs <db.json> <appdata.json> [ecrans.txt] [AAAA-MM-JJ]
 * ========================================================================== */
'use strict';

// ── Outils indépendants ─────────────────────────────────────────────────────
const ymd = (d) => d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
const iso = (x) => { const s = String(x || ''); let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[1] + '-' + m[2] + '-' + m[3]; m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; };
const fr = (i) => i ? i.slice(8, 10) + '/' + i.slice(5, 7) + '/' + i.slice(0, 4) : '';
const plusJ = (i, n) => { const d = new Date(i + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
const lundiDe = (i) => { const d = new Date(i + 'T12:00:00Z'); const off = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - off); return ymd(d); };
const num = (x) => { const n = Number(String(x == null ? '' : x).replace(',', '.')); return isNaN(n) ? 0 : n; };
const cle = (m) => String(m || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/s$/, '');
const eqNum = (a, b, tol) => Math.abs(num(a) - num(b)) <= (tol == null ? 1e-9 : tol);

function recalculer(store, appdata, now, aidForce) {
  const aid = String(aidForce || (store.athletes && store.athletes[0] && store.athletes[0].id) || '');
  const ath = (store.athletes || []).find((a) => String(a.id) === aid) || {};
  const P = (store.performances || []).filter((r) => !aid || String(r.athlete_id) === aid).map((r) => ({ ...r, d: iso(r.date) })).filter((r) => r.d && r.d <= now);
  const R = { now, aid };
  // Records : meilleure série à vie (charge, puis reps), datée de la PREMIÈRE fois où elle a été atteinte.
  R.records = {};
  for (const r of P.slice().sort((a, b) => a.d.localeCompare(b.d))) {
    const c = num(r.charge), n = num(r.reps), x = R.records[r.exercice];
    if (!x || c > x.charge || (c === x.charge && n > x.reps)) R.records[r.exercice] = { charge: c, reps: n, date: r.d };
  }
  // Séances = date + nom de séance (décision porteur 20/11 : 2 séances le même jour = 2 ; avant : jours distincts).
  const cleS = (r) => r.d + '|' + String(r.seance_id == null ? '' : r.seance_id);
  const jours = (a, b) => new Set(P.filter((r) => r.d >= a && r.d <= b).map(cleS)).size;
  R.lundi = lundiDe(now);
  R.seancesSemaine = jours(R.lundi, now);
  R.seancesJ7 = jours(plusJ(now, -6), now);
  // Tonnage (t, 1 décimale) : 7 derniers jours et les 7 d'avant.
  const ton = (a, b) => P.filter((r) => r.d >= a && r.d <= b).reduce((s, r) => s + num(r.charge) * num(r.reps), 0);
  R.tonJ7 = Math.round(ton(plusJ(now, -6), now) / 100) / 10;
  R.tonJ7prec = Math.round(ton(plusJ(now, -13), plusJ(now, -7)) / 100) / 10;
  { const a = ton(plusJ(now, -6), now), b = ton(plusJ(now, -13), plusJ(now, -7)); R.tonEvol = b > 0 ? Math.round((a - b) / b * 100) : null; }
  // Volume par muscle (séries ; muscle secondaire = 0,5) sur la fenêtre du réglage « semaine ».
  R.semaineType = ((appdata && appdata.semaine_type) || (ath.prefs && ath.prefs.semaine_type)) === 'glissant' ? 'glissant' : 'calendaire';
  // RPE moyen des séries sur 7 jours ; tonnage brut (kg) pour l'évolution.
  const p7 = P.filter((r) => r.d >= plusJ(now, -6) && num(r.rpe) > 0);
  R.rpe7 = p7.length ? Math.round(p7.reduce((x, r) => x + num(r.rpe), 0) / p7.length * 10) / 10 : null;
  const debVol = R.semaineType === 'glissant' ? plusJ(now, -6) : R.lundi;
  const sec = {}; (store.exercices || []).forEach((e) => { if (e && e.exercice && e.muscle_secondaire) sec[String(e.exercice).trim().toLowerCase()] = e.muscle_secondaire; });
  // Pas de l'appareil (catalogue, plus petit incrément) : sert au contrôle du « petit pas » (≈ −5 % sur la grille).
  R.pas = {}; (store.exercices || []).forEach((e) => { const n = e && e.increment_kg != null ? String(e.increment_kg).replace(/,/g, '.').match(/[0-9]+(\.[0-9]+)?/g) : null; if (e && e.exercice && n) R.pas[String(e.exercice).trim()] = Math.min(...n.map(Number)); });
  R.volume = {};
  for (const r of P.filter((x) => x.d >= debVol && x.d <= now)) {
    if (r.muscle && cle(r.muscle) !== 'corps entier') R.volume[cle(r.muscle)] = (R.volume[cle(r.muscle)] || 0) + 1;
    const s = sec[String(r.exercice || '').trim().toLowerCase()];
    if (s && cle(s) !== cle(r.muscle)) R.volume[cle(s)] = (R.volume[cle(s)] || 0) + 0.5;
  }
  R.seancesFaites = R.semaineType === 'glissant' ? R.seancesJ7 : R.seancesSemaine;
  // Totaux à vie.
  R.totalSeries = P.length; R.totalReps = P.reduce((s, r) => s + num(r.reps), 0);
  R.tonTotal = Math.round(P.reduce((s, r) => s + num(r.charge) * num(r.reps), 0));
  R.nbSeances = new Set(P.map(cleS)).size;
  // Par exercice et par jour : meilleure série (charge, puis reps) et nombre de séries.
  // Par exercice et par jour. 21/11 : 2 séances le même jour avec l'exercice → la DERNIÈRE (plus grand id) fait référence
  // (meilleure série, séries, « dernière fois ») ; « jour » garde toutes les séries de la journée.
  R.parExoJour = {};
  for (const r of P) { const k = r.exercice + '|' + r.d, x = R.parExoJour[k] || (R.parExoJour[k] = { best: null, n: 0, series: [], jour: [] }); x.jour.push(r); }
  Object.values(R.parExoJour).forEach((x) => {
    const der = x.jour.reduce((a, r) => (num(r.id) >= num(a.id) ? r : a), x.jour[0]), sid = String(der.seance_id == null ? '' : der.seance_id);
    x.series = x.jour.filter((r) => String(r.seance_id == null ? '' : r.seance_id) === sid); x.n = x.series.length;
    x.series.forEach((r) => { if (!x.best || num(r.charge) > num(x.best.charge) || (num(r.charge) === num(x.best.charge) && num(r.reps) > num(x.best.reps))) x.best = r; });
  });
  // « Ta normale » du bien-être (règle validée 31/10, même définition que la règle charge + ressenti du moteur) :
  // « maintenant » = les 3 dernières saisies des 7 derniers jours ; normale = les AUTRES saisies des 5 semaines (≥ 7).
  // Écart retenu : ≥ 1 point (fatigue / stress / courbatures au-dessus, sommeil en dessous).
  const BE = (store.bien_etre || []).filter((b) => !aid || String(b.athlete_id) === aid).map((b) => ({ ...b, d: iso(b.date) })).filter((b) => b.d && b.d <= now && b.d >= plusJ(now, -34)).sort((a, b) => b.d.localeCompare(a.d));
  const DIMS = { sommeil: ['sommeil', false], fatigue: ['fatigue_musculaire', true], stress: ['stress', true], courbatures: ['courbatures', true] };
  R.normale = {};
  for (const [k, [col, inv]] of Object.entries(DIMS)) {
    const val = (b) => (b[col] == null || b[col] === '' || isNaN(Number(b[col]))) ? null : Number(b[col]);
    const rec = BE.filter((b) => b.d >= plusJ(now, -6) && val(b) != null).slice(0, 3), recD = new Set(rec.map((b) => b.d));
    const base = BE.filter((b) => !recD.has(b.d) && val(b) != null);
    const moy = (a) => a.reduce((x, b) => x + val(b), 0) / a.length;
    const x = { n: rec.length, nBase: base.length, rec: rec.length ? moy(rec) : null, base: base.length >= 7 ? moy(base) : null };
    x.etat = (x.base == null || x.n < 3) ? 'nd' : (inv ? (x.rec - x.base >= 1 ? 'haut' : 'ok') : (x.base - x.rec >= 1 ? 'bas' : 'ok'));
    R.normale[k] = x;
  }
  // Montre (indicateurs « sante_<date> », la dernière valeur saisie d'un jour l'emporte).
  const SA = {};
  (store.indicateurs || []).filter((r) => (!aid || String(r.athlete_id) === aid) && /^sante_/.test(String(r.seance_id || ''))).slice().sort((a, b) => num(a.id) - num(b.id))
    .forEach((r) => { const d = iso(r.date), v = Number(r.valeur); if (!d || isNaN(v)) return; (SA[d] = SA[d] || {})[r.cle] = v; });
  const jSA = Object.keys(SA).filter((d) => d <= now);
  // Sommeil réel : nuits ≥ 3 h ; « 7 j » = J-6 → J ; normale = J-34 → J-7, dès 14 nuits.
  const nuits = jSA.filter((d) => SA[d].sommeil_min >= 180);
  const moyS = (a) => a.reduce((x, d) => x + SA[d].sommeil_min, 0) / a.length;
  const s7 = nuits.filter((d) => d >= plusJ(now, -6)), sB = nuits.filter((d) => d < plusJ(now, -6) && d >= plusJ(now, -34));
  R.sommeil = s7.length ? { moy: moyS(s7), n: s7.length, base: sB.length >= 14 ? moyS(sB) : null, nBase: sB.length } : null;
  // FC au repos : récente = J-2 → J (≥ 2 mesures) ; normale = J-30 → J-3 (≥ 14 mesures) ; hausse ≥ 5 bpm.
  const fcJ = jSA.filter((d) => SA[d].fc_repos > 0), moyF = (a) => a.length ? a.reduce((x, d) => x + SA[d].fc_repos, 0) / a.length : null;
  const fR = fcJ.filter((d) => d >= plusJ(now, -2)), fB = fcJ.filter((d) => d < plusJ(now, -2) && d >= plusJ(now, -30));
  R.fc = { recente: moyF(fR), normale: moyF(fB), mesures: fR.length, mesuresBase: fB.length };
  R.fc.evaluable = fR.length >= 2 && fB.length >= 14; R.fc.degrade = R.fc.evaluable && R.fc.recente - R.fc.normale >= 5;
  // Pas de la semaine (lundi → aujourd'hui) : la journée synchronisée avant 21 h (heure de Paris) est incomplète, hors moyenne.
  let partiel = null;
  const sync = (store.indicateurs || []).filter((r) => (!aid || String(r.athlete_id) === aid) && r.cle === 'montre_sync').map((r) => String(r.valeur)).sort().pop();
  if (sync) { const t = new Date(sync); if (!isNaN(t)) { const h = Number(t.toLocaleString('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hour12: false })), dP = t.toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' }); if (h < 21) partiel = dP; } }
  if (SA[now] && SA[now].pas != null && (!sync || new Date(sync).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' }) === now)) partiel = now;
  const pasSem = jSA.filter((d) => d >= R.lundi && SA[d].pas != null && d !== partiel);
  R.pasMoySemaine = pasSem.length ? Math.round(pasSem.reduce((x, d) => x + SA[d].pas, 0) / pasSem.length) : null;
  R.pasPartiel = partiel;
  // Charge & fraîcheur (modèle fitness-fatigue, EWMA 7 j / 42 j ; forme de fond ≥ moyenne réelle des 28 derniers jours
  // dès 28 j d'historique). Source : note de séance × durée (sRPE) dès 28 j d'historique sRPE et 8 jours actifs sur 42,
  // sinon le tonnage (Σ charge × reps du jour). ACWR = 7 derniers jours ÷ (28 derniers jours ÷ 4), toujours sur le tonnage.
  const tonJour = {}; P.forEach((r) => { tonJour[r.d] = (tonJour[r.d] || 0) + num(r.charge) * num(r.reps); });
  const IND = (store.indicateurs || []).filter((r) => !aid || String(r.athlete_id) === aid);
  const dur = {}; IND.filter((r) => r.cle === 'duree_muscu').forEach((r) => { dur[iso(r.date) + '|' + (r.seance_id || '')] = num(r.valeur); });
  const srpe = {}; IND.filter((r) => r.cle === 'rpe_muscu' && r.valeur != null && r.valeur !== '').forEach((r) => { const k = iso(r.date) + '|' + (r.seance_id || ''), du = dur[k]; if (du > 0 && iso(r.date) <= now) srpe[iso(r.date)] = (srpe[iso(r.date)] || 0) + num(r.valeur) * du; });
  const ecart = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5);
  const ff = (cpj) => {
    const ks = Object.keys(cpj).filter((k) => cpj[k] > 0 && k <= now).sort(); if (!ks.length) return null;
    const LA = 2 / 8, LC = 2 / 43, span = Math.max(0, ecart(ks[0], now));
    let a = cpj[ks[0]], c = cpj[ks[0]], act42 = 0;
    for (let d = span; d >= 0; d--) { const v = cpj[plusJ(now, -d)] || 0; if (d < 42 && v > 0) act42++; if (d === span) continue; a = v * LA + (1 - LA) * a; c = v * LC + (1 - LC) * c; }
    if (span >= 28) { let s28 = 0; for (let d = 0; d < 28; d++) s28 += cpj[plusJ(now, -d)] || 0; if (s28 / 28 > c) c = s28 / 28; }
    return { ctl: Math.round(c), atl: Math.round(a), tsbPct: c > 0 ? Math.round((c - a) / c * 100) : null, act42, span };
  };
  const fS = ff(srpe), fT = ff(tonJour);
  R.ff = (fS && fS.span >= 28 && fS.act42 >= 8) ? { ...fS, source: 'srpe' } : (fT ? { ...fT, source: 'tonnage' } : null);
  let ai = 0, s28 = 0; for (let d = 0; d < 28; d++) { const v = tonJour[plusJ(now, -d)] || 0; s28 += v; if (d < 7) ai += v; }
  R.acwr = s28 > 0 ? Math.round(ai / (s28 / 4) * 100) / 100 : null;
  // Effort à charge égale (règle du moteur) : par exercice, 4 dernières séances (la dernière ≤ 10 j) ; charge du jour = la
  // plus haute, RPE = celui de la PREMIÈRE série à cette charge (ordre des séries) ; moyenne des 2 dernières contre les 2
  // d'avant : RPE +1 ou plus avec une charge qui n'a pas monté de plus de 2,5 % (0 kg → lest = hausse).
  R.rpeHausse = {};
  const parExoJ = {};
  P.slice().sort((a, b) => a.d.localeCompare(b.d) || num(a.serie) - num(b.serie) || num(a.id) - num(b.id)).forEach((r) => {
    if (!(num(r.rpe) > 0)) return; const m = (parExoJ[r.exercice] = parExoJ[r.exercice] || {}), ch = num(r.charge);
    if (!m[r.d] || ch > m[r.d].charge) m[r.d] = { charge: ch, rpe: num(r.rpe) };
  });
  Object.entries(parExoJ).forEach(([exo, m]) => {
    const ds = Object.keys(m).sort(); if (ds.length < 4 || ds[ds.length - 1] < plusJ(now, -10)) return;
    const l = ds.slice(-4).map((d) => m[d]), av = (l[0].rpe + l[1].rpe) / 2, ap = (l[2].rpe + l[3].rpe) / 2, cA = (l[0].charge + l[1].charge) / 2, cP = (l[2].charge + l[3].charge) / 2;
    const pct = cA > 0 ? (cP - cA) / cA * 100 : (cP > 0 ? 100 : 0);
    if (ap - av >= 1 && pct <= 2.5) R.rpeHausse[exo] = { charge: Math.round(cP * 10) / 10, avant: av, apres: ap };
  });
  // Volume et fréquence d'un muscle sur les 4 semaines TERMINÉES (avant lundi), divisés par les semaines réellement
  // couvertes (1re séance → lundi, max 4) ; muscle secondaire = 0,5 série et compte comme un jour travaillé.
  R.vol4 = (muscle) => {
    const k = cle(muscle), fin = R.lundi, deb = plusJ(fin, -28);
    const jours = [...new Set(P.map((r) => r.d))].filter((d) => d < fin).sort(); const prem = jours[0] || null;
    let s = 0, j = 0;
    jours.filter((d) => d >= deb).forEach((d) => { let v = 0; P.filter((r) => r.d === d).forEach((r) => { if (r.muscle && cle(r.muscle) === k && cle(r.muscle) !== 'corps entier') v += 1; const sm = sec[String(r.exercice || '').trim().toLowerCase()]; if (sm && cle(sm) === k && cle(sm) !== cle(r.muscle)) v += 0.5; }); if (v > 0) { s += v; j++; } });
    const debEff = prem && prem > deb ? prem : deb, sem = prem ? Math.min(4, Math.max(0, ecart(debEff, fin) / 7)) : 0, div = Math.max(1, sem);
    return { parSem: Math.round(s / div * 10) / 10, freq: Math.round(j / div * 10) / 10, recul: sem };
  };
  R.muscles = [...new Set(P.map((r) => r.muscle).filter(Boolean))];
  R.P = P;
  R.muscleDe = (exo) => { const r = P.find((x) => x.exercice === exo && x.muscle); return r ? r.muscle : null; };
  // Journal des décisions : statut de chaque action enregistrée, recalculé sur les séances de SA semaine (lundi → dimanche).
  const pauses = [];
  (store.pauses || []).filter((r) => !aid || String(r.athlete_id) === aid).forEach((r) => { const d = iso(r.debut), f = iso(r.fin) || d; if (d) pauses.push({ debut: d, fin: f }); });
  { let cur = null; (store.indicateurs || []).filter((r) => (!aid || String(r.athlete_id) === aid) && r.cle === 'pause').slice().sort((a, b) => iso(a.date).localeCompare(iso(b.date)) || num(a.id) - num(b.id)).forEach((r) => {
    if (String(r.valeur) === 'fin') { const d = iso(r.date); if (cur && d && d < cur.fin) cur.fin = d; cur = null; return; }
    const d = iso(r.valeur), f = iso(r.unite); if (d && f) { cur = { debut: d, fin: f }; pauses.push(cur); } }); }
  R.journal = (dec) => {
    const L0 = iso(dec.semaine), L1 = plusJ(L0, 7), c = dec.critere || {}, type = dec.type_action, dans = (d) => d >= L0 && d < L1;
    let tente = false, fait = false, tot = 0, sets = [];
    if (type === 'series') { const k = cle(dec.muscle || dec.cle); P.filter((r) => dans(r.d)).forEach((r) => { if (r.muscle && cle(r.muscle) === k && cle(r.muscle) !== 'corps entier') tot += 1; const sm = sec[String(r.exercice || '').trim().toLowerCase()]; if (sm && cle(sm) === k && cle(sm) !== cle(r.muscle)) tot += 0.5; }); tente = tot > 0; fait = tot >= num(c.min); }
    else if (type === 'reprise') { tente = fait = P.some((r) => dans(r.d)); }
    else {
      if (!(num(c.charge) > 0)) return { statut: 'non_evaluable' };
      sets = P.filter((r) => dans(r.d) && r.exercice === dec.exercice); tente = sets.length > 0;
      if (type === 'charge') fait = sets.some((x) => num(x.charge) <= num(c.charge) + 0.01 && num(x.charge) >= (c.alt != null ? num(c.alt) : num(c.charge)) - 2.5 && num(x.reps) >= num(c.reps));
      else if (type === 'cible') fait = sets.some((x) => num(x.charge) >= num(c.charge) && num(x.reps) >= num(c.reps));
      else if (type === 'rpe') fait = sets.some((x) => num(x.charge) >= num(c.charge) && num(x.rpe) > 0 && num(x.rpe) <= 8);
    }
    if (!tente && !fait) {   // semaine de vacances ou de blessure (≥ 3 jours) : pas jugée
      const bl = (store.blessures || []).filter((b) => (!aid || String(b.athlete_id) === aid) && b.statut !== 'gueri' && b.date).map((b) => ({ debut: iso(b.date), fin: now }));
      (store.contexte_athlete || []).filter((x) => (!aid || String(x.athlete_id) === aid) && x.etat === 'retour_blessure' && !x.clos && (!x.date_fin || iso(x.date_fin) >= now)).forEach((x) => bl.push({ debut: iso(x.date_debut) || now, fin: iso(x.date_fin) || now }));
      let jp = 0, jb = 0; for (let k = 0; k < 7; k++) { const dk = plusJ(L0, k), inn = (p) => p.debut <= dk && dk <= p.fin; if (pauses.some(inn)) jp++; else if (bl.some(inn)) jb++; }
      if (jp >= 3 || jb + jp >= 3) return { statut: 'non_evaluable', jp, jb };
    }
    const best = sets.slice().sort((x, y) => num(y.charge) - num(x.charge) || num(y.reps) - num(x.reps))[0];
    return { statut: fait ? 'atteint' : (tente ? 'pas_atteint' : 'pas_tente'), tente, tot, best };
  };
  R.decisions = (store.decisions || []).filter((d) => !aid || String(d.athlete_id) === aid);
  // Cardio : séances = indicateurs « cardio_* » regroupés par séance ; micro-sorties (< 5 min et < 0,3 km) hors comptes.
  // Charge interne = RPE × durée (marche = 0 ; sans RPE : estimé par la FC moyenne, sinon 5).
  const CX = {};
  IND.filter((r) => /^cardio_/.test(String(r.seance_id || ''))).forEach((r) => { const k = r.seance_id, d = iso(r.date); const o = CX[k] || (CX[k] = { d, type: 'autre' }); if (d && d < o.d) o.d = d; if (r.cle === 'type_cardio') o.type = String(r.valeur || 'autre'); else { const v = Number(r.valeur); if (!isNaN(v)) o[r.cle] = v; } });
  R.cardio = Object.values(CX).filter((o) => o.d && o.d <= now);
  R.cxCharge = (o) => { if (/^marche/i.test(o.type)) return 0; const du = num(o.duree); if (du <= 0) return 0; let rp = num(o.rpe); if (rp <= 0) { const fc = num(o.fc_moy != null ? o.fc_moy : o.fc); rp = fc >= 165 ? 9 : fc >= 150 ? 8 : fc >= 138 ? 7 : fc >= 125 ? 6 : fc >= 110 ? 5 : fc > 0 ? 4 : 5; } return rp * du; };
  R.cxMicro = (o) => num(o.duree) < 5 && num(o.distance) < 0.3;
  // Séances par exercice (récent → ancien) : séries brutes du jour, meilleure série (charge, puis reps).
  R.sessions = {};
  const triS = (a) => a.slice().sort((x, y) => num(x.serie) - num(y.serie) || num(x.id) - num(y.id));
  Object.values(R.parExoJour).forEach((x) => { const e = x.series[0].exercice; (R.sessions[e] = R.sessions[e] || []).push({ d: x.series[0].d, best: x.best, series: triS(x.series), jour: triS(x.jour) }); });
  Object.values(R.sessions).forEach((a) => a.sort((x, y) => y.d.localeCompare(x.d)));
  // Fourchette de reps : programme ; une catégorie (moyen / gros 6-12, petit 8-20) ne remplace que la fourchette par défaut 8-12.
  const cats = (store.athletes && store.athletes[0] && store.athletes[0].prefs && store.athletes[0].prefs.exo_categories) || (appdata && appdata.exo_categories) || {};
  const CAT = { gros: [6, 12], moyen: [6, 12], petit: [8, 20] };
  R.prog = (store.programme || []).filter((l) => (!aid || String(l.athlete_id) === aid) && l.type !== 'cardio');
  // sid (optionnel) : la ligne de CETTE séance (un exercice peut avoir 8-12 dans une séance et 10-12 dans une autre).
  R.fourchette = (exo, sid) => {
    const ls = (store.programme || []).filter((l) => (!aid || String(l.athlete_id) === aid) && String(l.exercice || '').trim() === String(exo).trim() && l.type !== 'cardio');
    const pl = (sid != null && ls.find((l) => String(l.seance_id) === String(sid))) || ls[0];
    const a = pl && pl.reps_mini != null && pl.reps_mini !== '' ? Number(pl.reps_mini) : null, b = pl && pl.reps_max != null && pl.reps_max !== '' ? Number(pl.reps_max) : null;
    const c = CAT[cats[String(exo).trim()] || cats[exo] || ''];
    return (c && ((a == null && b == null) || (a === 8 && b === 12))) ? { rmin: c[0], rmax: c[1] } : { rmin: a, rmax: b };
  };
  return R;
}
const hm = (m) => { m = Math.round(m); return Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0'); };
const f1 = (v) => String(Math.round(v * 10) / 10).replace('.', ',');

// ── A. Données servies ↔ recalcul ───────────────────────────────────────────
function verifierDonnees(R, ad, out) {
  const E = (code, message) => out.push({ code, gravite: 'erreur', message });
  const g = (ad && ad.global) || {};
  for (const [exo, x] of Object.entries(R.records)) {
    const s = (g.records_par_exo || {})[exo];
    if (!s) { E('records.absent', exo + ' : record absent des données (attendu ' + x.charge + ' × ' + x.reps + ')'); continue; }
    if (!eqNum(s.charge, x.charge) || !eqNum(s.reps, x.reps)) E('records.valeur', exo + ' : record servi ' + s.charge + ' × ' + s.reps + ', recalculé ' + x.charge + ' × ' + x.reps);
    else if (iso(s.date) !== x.date) E('records.date', exo + ' : record daté du ' + s.date + ', atteint la 1re fois le ' + fr(x.date));
  }
  const reg = (ad && ad.dashboard && ad.dashboard.regularite) || {};
  if (reg.seances_semaine != null && num(reg.seances_semaine) !== R.seancesSemaine) E('seances.semaine', 'séances depuis lundi : servi ' + reg.seances_semaine + ', recalculé ' + R.seancesSemaine);
  if (reg.seances_j7 != null && num(reg.seances_j7) !== R.seancesJ7) E('seances.j7', 'séances sur 7 jours : servi ' + reg.seances_j7 + ', recalculé ' + R.seancesJ7);
  const t = (ad && ad.dashboard && ad.dashboard.tonnage) || {};
  if (t.j7 != null && !eqNum(t.j7, R.tonJ7, 0.05)) E('tonnage.j7', 'tonnage 7 jours : servi ' + t.j7 + ' t, recalculé ' + R.tonJ7 + ' t');
  if (t.j7_prec != null && !eqNum(t.j7_prec, R.tonJ7prec, 0.05)) E('tonnage.j7_prec', 'tonnage des 7 jours d\'avant : servi ' + t.j7_prec + ' t, recalculé ' + R.tonJ7prec + ' t');
  for (const v of ((ad && ad.volume_obti) || [])) {
    const attendu = R.volume[cle(v.muscle)] || 0;
    if (!eqNum(v.series_semaine, attendu, 0.01)) E('volume.muscle', v.muscle + ' : ' + v.series_semaine + ' séries servies, ' + attendu + ' recalculées (' + (R.semaineType === 'glissant' ? '7 derniers jours' : 'depuis lundi') + ')');
  }
  if (g.total_series != null && num(g.total_series) !== R.totalSeries) E('global.series', 'séries à vie : servi ' + g.total_series + ', recalculé ' + R.totalSeries);
  if (g.total_reps != null && num(g.total_reps) !== R.totalReps) E('global.reps', 'répétitions à vie : servi ' + g.total_reps + ', recalculé ' + R.totalReps);
  if (g.tonnage_total_kg != null && Math.abs(num(g.tonnage_total_kg) - R.tonTotal) > 1) E('global.tonnage', 'tonnage à vie : servi ' + g.tonnage_total_kg + ' kg, recalculé ' + R.tonTotal + ' kg');
  if (g.nb_seances != null && num(g.nb_seances) !== R.nbSeances) E('global.seances', 'séances à vie : servi ' + g.nb_seances + ', recalculé ' + R.nbSeances);
  const prog = (ad && ad.historique && ad.historique.progression_par_exo) || {};
  for (const [exo, pts] of Object.entries(prog)) {
    for (const p of (pts || [])) {
      const x = R.parExoJour[exo + '|' + iso(p.date)];
      if (!x) { E('progression.jour', exo + ' le ' + p.date + ' : aucune série brute ce jour-là'); continue; }
      if (!eqNum(p.charge, x.best.charge) || !eqNum(p.reps, x.best.reps)) E('progression.meilleure', exo + ' le ' + p.date + ' : meilleure série servie ' + p.charge + ' × ' + p.reps + ', recalculée ' + num(x.best.charge) + ' × ' + num(x.best.reps));
      if (Array.isArray(p.series) && p.series.length !== x.n) E('progression.series', exo + ' le ' + p.date + ' : ' + p.series.length + ' séries servies, ' + x.n + ' en base');
    }
  }
  // Moteur (règle charge + ressenti) ↔ « ta normale » recalculée : mêmes raisons fatigue / sommeil.
  const cr = (ad && ad.moteur && ad.moteur.charge_ressenti) || null;
  if (cr && Array.isArray(cr.raisons)) {
    const fat = R.normale.fatigue.etat === 'haut', som = R.normale.sommeil.etat === 'bas';
    if (cr.raisons.includes('fatigue') !== fat) E('ressenti.fatigue', 'moteur : fatigue ' + (cr.raisons.includes('fatigue') ? 'en hausse' : 'normale') + ', recalcul : ' + (fat ? 'au-dessus de la normale' : 'pas au-dessus') + ' (' + (R.normale.fatigue.rec == null ? '—' : f1(R.normale.fatigue.rec)) + ' contre ' + (R.normale.fatigue.base == null ? '—' : f1(R.normale.fatigue.base)) + ')');
    if (cr.raisons.includes('sommeil') !== som) E('ressenti.sommeil', 'moteur : sommeil ' + (cr.raisons.includes('sommeil') ? 'en baisse' : 'normal') + ', recalcul : ' + (som ? 'sous la normale' : 'pas sous la normale'));
  }
  // Fraîcheur et ACWR du moteur = recalcul.
  const cf = ad && ad.moteur && ad.moteur.charge_fatigue;
  if (cf && R.ff) {
    if (cf.source !== R.ff.source) E('fraicheur.source', 'source de la fraîcheur : servie « ' + cf.source + ' », recalculée « ' + R.ff.source + ' »');
    else if (num(cf.ctl) !== R.ff.ctl || num(cf.atl) !== R.ff.atl || cf.tsbPct !== R.ff.tsbPct) E('fraicheur.valeurs', 'fraîcheur : servi forme ' + cf.ctl + ' / fatigue ' + cf.atl + ' / ' + cf.tsbPct + ' %, recalculé ' + R.ff.ctl + ' / ' + R.ff.atl + ' / ' + R.ff.tsbPct + ' %');
  }
  const acw = ad && ad.dashboard && ad.dashboard.acwr;
  if (acw != null && R.acwr != null && Math.abs(num(acw) - R.acwr) > 0.005) E('acwr', 'ACWR servi ' + acw + ', recalculé ' + R.acwr);
  // Effort à charge égale : mêmes exercices et mêmes chiffres que le moteur.
  if (cr && Array.isArray(cr.rpe_details)) {
    const srv = {}; cr.rpe_details.forEach((x) => { srv[x.exo] = x; });
    const tous = new Set([...Object.keys(srv), ...Object.keys(R.rpeHausse)]);
    tous.forEach((exo) => { const a = srv[exo], b = R.rpeHausse[exo];
      if (!a || !b) E('rpe.hausse', exo + ' : effort en hausse ' + (a ? 'signalé par le moteur (RPE ' + a.rpeAvant + ' → ' + a.rpeApres + ')' : 'absent du moteur') + ', recalcul : ' + (b ? 'RPE ' + b.avant + ' → ' + b.apres + ' à ' + b.charge + ' kg' : 'pas de hausse'));
      else if (a.rpeAvant !== b.avant || a.rpeApres !== b.apres || Math.abs(num(a.charge) - b.charge) > 0.05) E('rpe.hausse', exo + ' : moteur RPE ' + a.rpeAvant + ' → ' + a.rpeApres + ' à ' + a.charge + ' kg, recalcul ' + b.avant + ' → ' + b.apres + ' à ' + b.charge + ' kg'); });
  }
  // FC au repos du moteur = recalcul.
  const fc = cr && cr.fc_repos;
  if (fc) {
    const r1 = (v) => v == null ? null : Math.round(v * 10) / 10;
    if (fc.mesures !== R.fc.mesures || fc.mesuresBase !== R.fc.mesuresBase || r1(fc.recente) !== r1(R.fc.recente) || r1(fc.normale) !== r1(R.fc.normale) || !!fc.evaluable !== R.fc.evaluable || !!fc.degrade !== R.fc.degrade)
      E('fc.moteur', 'FC au repos : servi ' + fc.recente + ' (' + fc.mesures + ' mesures) / normale ' + fc.normale + ' (' + fc.mesuresBase + '), recalculé ' + r1(R.fc.recente) + ' (' + R.fc.mesures + ') / ' + r1(R.fc.normale) + ' (' + R.fc.mesuresBase + ')');
  }
  // Récompenses : l'objectif de points se compte par semaine CALENDAIRE (règle des points, voulue) → séances depuis lundi.
  const ob = (((ad && ad.recompenses && ad.recompenses.semaine && ad.recompenses.semaine.lignes) || []).filter((l) => l && l.k === 'objectif')[0]);
  if (ob && ob.fait != null && num(ob.fait) !== R.seancesSemaine) E('objectif.compte', 'objectif de points ' + ob.fait + '/' + ob.cible + ', recalculé ' + R.seancesSemaine + ' séance(s) depuis lundi');
}

// ── B. Texte affiché ↔ recalcul / entre écrans ──────────────────────────────
function sections(txt) {
  const S = {}; let cur = null;
  String(txt || '').split('\n').forEach((l) => { const m = l.match(/^######## (.+)$/) || l.match(/^== (.+) ==$/); if (m) { cur = m[1].trim(); S[cur] = []; } else if (cur) S[cur].push(l); });   // relevés d'audit (######## …) ou banc de profils (== … ==)
  return S;
}
function verifierTexte(R, ad, txt, out) {
  if (!txt) return;
  const E = (code, message) => out.push({ code, gravite: 'erreur', message });
  const S = sections(txt);
  // B1. Nombres décimaux au format français (virgule) : « 12.5 kg », « 4.5 / 9 » interdits.
  Object.entries(S).forEach(([nom, L]) => L.forEach((l) => {
    const m = l.match(/(^|[\s(])(\d+\.\d+)(?=\s?(kg|km\/h|km\b|t\b|×|\/|%|séries|bpm|h\b|min\b)|\s*$)/);
    if (m && !/^\d{1,2}\.\d{2}$/.test(m[2]) && !/v\d|version/i.test(l)) E('format.decimal', nom + ' : « ' + l.trim().slice(0, 80) + ' » (point au lieu de virgule)');
  }));
  // B0. Texte cassé : valeur absente ou date brute affichée (« undefined », « NaN », « Invalid Date », « Sun Nov … »).
  Object.entries(S).forEach(([nom, L]) => L.forEach((l) => { const m = l.match(/\b(undefined|NaN|Invalid Date|null kg)\b|\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|N\b)/); if (m) E('texte.casse', nom + ' : « ' + l.trim().slice(0, 90) + ' »'); }));
  // B2. Force estimée : la tuile et la 1re ligne du tableau (même séance) donnent le même chiffre.
  Object.entries(S).filter(([n]) => /^ÉVOLUTION ▸ /.test(n)).forEach(([nom, L]) => {
    const iT = L.findIndex((l) => l.trim() === 'FORCE ESTIMÉE'), iH = L.findIndex((l) => l.trim() === 'FORCE EST.');
    if (iT > 0 && iH > 0 && L[iH + 3] != null) {
      const tuile = (L[iT - 1].match(/([\d,]+)\s*kg/) || [])[1], tab = (L[iH + 3].match(/([\d,]+)\s*kg/) || [])[1];
      if (tuile && tab && tuile !== tab) E('force.tuile_tableau', nom.replace('ÉVOLUTION ▸ ', '') + ' : force estimée ' + tuile + ' kg en haut, ' + tab + ' kg dans le tableau');
    }
  });
  // B3. Records affichés = recalcul (charge et date de 1re fois).
  Object.entries(S).forEach(([nom, L]) => {
    for (let i = 0; i < L.length; i++) {
      if (L[i].trim() !== 'RECORDS PERSONNELS') continue;
      for (let j = i + 1; j + 2 < L.length; j += 3) {
        const exo = L[j].trim(), c = (L[j + 1].match(/^([\d,]+) kg$/) || [])[1], d = (L[j + 2].match(/^(\d{2}\/\d{2}\/\d{4})$/) || [])[1];
        if (!c || !d) break;
        const x = R.records[exo];
        if (x && (num(c) !== x.charge || iso(d) !== x.date)) E('records.ecran', nom + ' : record ' + exo + ' affiché ' + c + ' kg le ' + d + ', recalculé ' + x.charge + ' kg le ' + fr(x.date));
      }
    }
  });
  // B5. « Ta normale » affichée (Aujourd'hui, fiche) = recalcul : moyennes, état, compteurs.
  const LBL = { Sommeil: 'sommeil', Fatigue: 'fatigue', Stress: 'stress', Courbatures: 'courbatures' };
  Object.entries(S).forEach(([nom, L]) => L.forEach((l, i) => {
    const m = l.trim().match(/^(Sommeil|Fatigue|Stress|Courbatures)\b(?! réel)/); if (!m) return;
    const sub = String(L[i + 1] || '').trim(), x = R.normale[LBL[m[1]]];
    let k = sub.match(/^(\d+) dernières saisies ([\d,]+) · (dans|au-dessus de|sous) (ta|sa) normale \(([\d,]+)\)/);
    if (k) {
      const etat = k[3] === 'dans' ? 'ok' : (k[3] === 'sous' ? 'bas' : 'haut');
      if (x.etat === 'nd' || +k[1] !== x.n || k[2] !== f1(x.rec) || k[5] !== f1(x.base) || etat !== x.etat) E('normale.ecran', nom + ' · ' + m[1] + ' : « ' + sub + ' », recalculé ' + x.n + ' saisies ' + (x.rec == null ? '—' : f1(x.rec)) + ', normale ' + (x.base == null ? '—' : f1(x.base)) + ' (' + x.etat + ')');
      return;
    }
    k = sub.match(/normale arrive dans (\d+) questionnaires? \(il en faut 10 sur 5 semaines, (?:tu en as|il y en a) (\d+)\)/);
    if (k) { const tot = x.n + x.nBase; if (x.etat !== 'nd' || x.base != null || +k[2] !== tot || +k[1] !== Math.max(1, 10 - tot)) E('normale.compteur', nom + ' · ' + m[1] + ' : « ' + sub + ' », recalculé ' + tot + ' questionnaires (normale ' + (x.base == null ? 'non calculable' : f1(x.base)) + ')'); return; }
    k = sub.match(/^(\d+) saisies? cette semaine \(([\d,]+)\) · comparaison/);
    if (k && (x.base == null || x.n >= 3 || +k[1] !== x.n || k[2] !== f1(x.rec))) E('normale.recentes', nom + ' · ' + m[1] + ' : « ' + sub + ' », recalculé ' + x.n + ' saisie(s) ' + (x.rec == null ? '—' : f1(x.rec)));
  }));
  // B6. Montre : sommeil réel 7 j, sa normale ; moyenne des pas de la semaine.
  Object.entries(S).forEach(([nom, L]) => L.forEach((l, i) => {
    let m = l.trim().match(/^Sommeil réel (\d+ h \d{2}) \/ nuit \(7 j, (\d+) nuits?\)/);
    if (m) {
      if (!R.sommeil || m[1] !== hm(R.sommeil.moy) || +m[2] !== R.sommeil.n) E('montre.sommeil', nom + ' : « ' + l.trim() + ' », recalculé ' + (R.sommeil ? hm(R.sommeil.moy) + ' sur ' + R.sommeil.n + ' nuits' : 'aucune nuit'));
      const k = String(L[i + 1] || '').match(/\((\d+ h \d{2}), (\d+) nuits\)/);
      if (k && R.sommeil && (R.sommeil.base == null || k[1] !== hm(R.sommeil.base) || +k[2] !== R.sommeil.nBase)) E('montre.sommeil_normale', nom + ' : normale « ' + k[1] + ', ' + k[2] + ' nuits », recalculée ' + (R.sommeil.base == null ? 'non calculable' : hm(R.sommeil.base)) + ' sur ' + R.sommeil.nBase + ' nuits');
    }
    m = l.trim().match(/^moy\. (\d[\d\s\u202f\u00a0]*)( \(hors journée en cours de synchro\))?$/);
    if (m && /AUJOURD/.test(nom)) { const v = +m[1].replace(/\D/g, ''); if (R.pasMoySemaine == null || Math.abs(v - R.pasMoySemaine) > 1) E('montre.pas', nom + ' : pas « moy. ' + v + ' », recalculé ' + R.pasMoySemaine + (R.pasPartiel ? ' (hors ' + fr(R.pasPartiel) + ', journée incomplète)' : '')); }
  }));
  // B7. Phrases du classement des exercices ↔ séries brutes (record, progrès, sous la fourchette, bloqué).
  const EXOS = Object.keys(R.sessions).sort((a, b) => b.length - a.length);
  const kgN = (x) => num(String(x).replace(/\s*kg$/, ''));
  const exoDe = (t) => EXOS.find((e) => t.indexOf(e) === 0);
  const ctrl = (code, ou, phrase, ok, attendu) => { if (!ok) E(code, ou + ' : « ' + phrase + ' » — ' + attendu); };
  const seriesTop = (S0, c, r) => S0.series.filter((x) => num(x.charge) === c && num(x.reps) >= r);
  const record = (exo, c, r, quand) => {   // séance « quand » (ou la dernière) : bat-elle toutes les séances d'avant ?
    const P = R.sessions[exo] || []; const i = quand ? P.findIndex((p) => p.d === quand) : 0; if (i < 0) return 'aucune séance ce jour-là';
    const S0 = P[i]; if (num(S0.best.charge) !== c || num(S0.best.reps) !== r) return 'meilleure série du jour ' + num(S0.best.charge) + ' × ' + num(S0.best.reps);
    let bc = 0, br = 0; P.slice(i + 1).forEach((p) => { const cc = num(p.best.charge), rr = num(p.best.reps); if (cc > bc) { bc = cc; br = rr; } else if (cc === bc && rr > br) br = rr; });
    return (P.length > i + 1 && (c > bc || (c === bc && r > br))) ? null : 'ne bat pas le meilleur d\'avant (' + bc + ' × ' + br + ')';
  };
  const sous = (exo, c, r, rpe, rmin, rmax) => {
    const P = R.sessions[exo] || []; if (!P.length) return 'aucune séance';
    const S0 = P[0], f = R.fourchette(exo), ser = S0.series.filter((x) => num(x.reps) > 0), rp = Math.max(...ser.map((x) => num(x.rpe)));
    if (num(S0.best.charge) !== c || num(S0.best.reps) !== r) return 'dernière séance : meilleure série ' + num(S0.best.charge) + ' × ' + num(S0.best.reps);
    if (rpe != null && rp !== rpe) return 'RPE max de la séance ' + rp;
    if (rmin != null && (f.rmin !== rmin || f.rmax !== rmax)) return 'fourchette ' + f.rmin + '-' + f.rmax;
    return ser.filter((x) => num(x.reps) < f.rmin).length * 2 > ser.length ? null : 'la majorité des séries n\'est pas sous ' + f.rmin + ' reps';
  };
  const bloque = (exo, c, r, n) => {
    const P = R.sessions[exo] || []; if (P.length < n) return 'seulement ' + P.length + ' séances';
    const W = P.slice(0, n); if (W.some((p) => num(p.best.charge) !== c)) return 'les ' + n + ' dernières séances ne sont pas toutes à ' + c + ' kg';
    const M = Math.max(...W.map((p) => num(p.best.reps))); if (M !== r) return 'meilleur nombre de reps sur ces séances : ' + M;
    return num(W[n - 1].best.reps) === r ? null : 'la plus ancienne des ' + n + ' séances n\'atteint pas ' + r + ' reps (le plateau est plus court)';
  };
  const progres = (exo, txt) => {   // txt = « a → b reps » | « C0 × R0 → C1 × R1 » | « N séries à R reps au lieu de M » | « même niveau à RPE x au lieu de y »
    const P = R.sessions[exo] || []; if (P.length < 2) return 'moins de 2 séances';
    const A = P[0], B = P[1], cA = num(A.best.charge), rA = num(A.best.reps), cB = num(B.best.charge), rB = num(B.best.reps);
    let m = txt.match(/^(\d+) → (\d+) reps/); if (m) return (cA === cB && rB === +m[1] && rA === +m[2]) ? null : 'séances : ' + cB + ' × ' + rB + ' puis ' + cA + ' × ' + rA;
    m = txt.match(/^([\d,]+) × (\d+) → ([\d,]+) × (\d+)/); if (m) return (cB === kgN(m[1]) && rB === +m[2] && cA === kgN(m[3]) && rA === +m[4]) ? null : 'séances : ' + cB + ' × ' + rB + ' puis ' + cA + ' × ' + rA;
    m = txt.match(/^(\d+) séries à (\d+) reps au lieu de (\d+)/); if (m) { const tA = seriesTop(A, cA, +m[2]).length, tB = seriesTop(B, cA, +m[2]).length; return (cA === cB && rA === rB && rA === +m[2] && tA === +m[1] && tB === +m[3]) ? null : tA + ' séries au top au lieu de ' + tB + ' (séances ' + cB + ' × ' + rB + ' puis ' + cA + ' × ' + rA + ')'; }
    m = txt.match(/^même niveau à RPE ([\d,]+) au lieu de ([\d,]+)/); if (m) { const tA = seriesTop(A, cA, rA), tB = seriesTop(B, cA, rA), n = Math.min(tA.length, tB.length); const mo = (t) => { const v = t.slice(0, n).map((x) => num(x.rpe)).filter((x) => x > 0); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null; }; return (cA === cB && rA === rB && f1(mo(tA)) === m[1] && f1(mo(tB)) === m[2]) ? null : 'RPE sur les ' + n + ' premières séries au top : ' + mo(tA) + ' au lieu de ' + mo(tB); }
    return null;   // forme non reconnue : non contrôlée
  };
  Object.entries(S).forEach(([nom, L]) => {
    const exoSec = (nom.match(/^ÉVOLUTION ▸ (.+)$/) || [])[1];
    L.forEach((l0) => {
      const l = l0.trim(); let m;
      if (exoSec) {
        if ((m = l.match(/^Record : ([\d,]+) kg × (\d+) le (\d{2}\/\d{2}\/\d{4})$/))) ctrl('classement.record', nom, l, !record(exoSec, kgN(m[1]), +m[2], iso(m[3])), record(exoSec, kgN(m[1]), +m[2], iso(m[3])));
        if ((m = l.match(/^Sous ta fourchette (\d+)-(\d+) : ([\d,]+) kg × (\d+) à RPE ([\d,]+)$/))) { const x = sous(exoSec, kgN(m[3]), +m[4], num(m[5]), +m[1], +m[2]); ctrl('classement.sous', nom, l, !x, x); }
        if ((m = l.match(/^Bloqué à ([\d,]+) kg × (\d+) depuis (\d+) séances$/))) { const x = bloque(exoSec, kgN(m[1]), +m[2], +m[3]); ctrl('classement.bloque', nom, l, !x, x); }
        if ((m = l.match(/^En progrès : (.+)$/)) && !/,/.test(m[1].replace(/\d,\d/g, ''))) { const x = progres(exoSec, m[1]); ctrl('classement.progres', nom, l, !x, x); }
        return;
      }
      if ((m = l.match(/^Records? (?::|—) (.+?)(?: \([^)]*\))?$/))) m[1].split(/ · |, (?=[A-ZÉÈÀ])/).forEach((it) => { it = it.replace(/ \+\d+( autres?)?$/, ''); const e = exoDe(it.trim()); const k = e && it.trim().slice(e.length).match(/^ ([\d,]+)(?: kg)? × (\d+)$/); if (k) { const x = record(e, kgN(k[1]), +k[2]); ctrl('classement.record', nom, e + ' ' + it.trim().slice(e.length), !x, x); } });
      if ((m = l.match(/^Progresse (?::|—) (.+?)(?: \((?:charge|reps)[^)]*\))?$/))) m[1].split(/ · |, (?=[A-ZÉÈÀ])/).forEach((it) => { it = it.replace(/ \+\d+( autres?)?$/, '').replace(/(\d)→(\d)/g, '$1 → $2'); const e = exoDe(it.trim()); if (e) { const x = progres(e, it.trim().slice(e.length).trim()); ctrl('classement.progres', nom, it.trim(), !x, x); } });
      if ((m = l.match(/^Sous ta fourchette : (.+) \(RPE ([\d,]+)\)$/))) { const e = exoDe(m[1]); const k = e && m[1].slice(e.length).match(/^ ([\d,]+) × (\d+)$/); if (k) { const x = sous(e, kgN(k[1]), +k[2], num(m[2]), null, null); ctrl('classement.sous', nom, l, !x, x); } }
      if ((m = l.match(/^Bloqué : (.+) ([\d,]+) × (\d+) depuis (\d+) séances$/))) { const e = exoDe(m[1]); if (e) { const x = bloque(e, kgN(m[2]), +m[3], +m[4]); ctrl('classement.bloque', nom, l, !x, x); } }
    });
  });
  // B8. Carte « Charge & fraîcheur » : %, forme de fond, fatigue récente, ACWR, unité annoncée.
  Object.entries(S).forEach(([nom, L]) => L.forEach((l) => {
    const t = l.trim(); let m;
    if (!R.ff) return;
    if ((m = t.match(/^([−-]?\d+)\s?% de fraîcheur$/)) && +m[1].replace('−', '-') !== R.ff.tsbPct) E('fraicheur.ecran', nom + ' : « ' + t + ' », recalculé ' + R.ff.tsbPct + ' %');
    if ((m = t.match(/^Forme de fond ([\d\s\u202f\u00a0]+)$/)) && +m[1].replace(/\D/g, '') !== R.ff.ctl) E('fraicheur.ecran', nom + ' : « ' + t + ' », recalculé ' + R.ff.ctl);
    if ((m = t.match(/^Fatigue récente ([\d\s\u202f\u00a0]+)$/)) && +m[1].replace(/\D/g, '') !== R.ff.atl) E('fraicheur.ecran', nom + ' : « ' + t + ' », recalculé ' + R.ff.atl);
    if ((m = t.match(/^ACWR ([\d,]+)/)) && R.acwr != null && Math.abs(num(m[1]) - R.acwr) > 0.005) E('acwr.ecran', nom + ' : « ' + t + ' », recalculé ' + R.acwr);
    if (/^En unités de charge \(/.test(t)) { const dit = /pondéré par l.effort|RPE × durée|note de séance × durée/.test(t) ? (/tonnage/.test(t) && /pondéré/.test(t) ? 'tonnage pondéré' : 'srpe') : (/tonnage/.test(t) ? 'tonnage' : '?'); if ((R.ff.source === 'tonnage' && dit !== 'tonnage') || (R.ff.source === 'srpe' && dit !== 'srpe')) E('fraicheur.unite', nom + ' : « ' + t.slice(0, 70) + '… » alors que la source est ' + (R.ff.source === 'srpe' ? 'note de séance × durée' : 'le tonnage brut (charge × reps, sans effort)')); }
  }));
  // B9. « Ce que Novalyz vise la prochaine fois » : point de départ = meilleure série de la dernière séance, et la raison
  // donnée doit être VRAIE dans les séries brutes (RPE, fourchette, séances d'échec, haut de fourchette).
  Object.entries(S).filter(([n]) => /^ÉVOLUTION ▸ /.test(n)).forEach(([nom, L]) => {
    const exo = nom.replace('ÉVOLUTION ▸ ', ''), P = R.sessions[exo] || [];
    const i = L.findIndex((l) => l.trim() === 'Ce que Novalyz vise la prochaine fois'); if (i < 0 || !P.length) return;
    const h = String(L[i + 1] || '').trim().match(/^([\d,]+) × (\d+) →$/), c = String(L[i + 2] || '').trim().match(/^([\d,]+) kg × (\d+)$/), why = String(L[i + 3] || '').trim();
    if (!h || !c) return;
    const S0 = P[0], C = kgN(h[1]), Rp = +h[2], C2 = kgN(c[1]), R2 = +c[2], f = R.fourchette(exo);
    // 20/11 : séries de TRAVAIL (échauffement = charge > 0 et < 60 % de la plus lourde, écarté comme dans l'app).
    const ser0 = S0.series.filter((x) => num(x.reps) > 0), mxC = Math.max(0, ...ser0.map((x) => num(x.charge)));
    const serT = mxC > 0 ? ser0.filter((x) => !(num(x.charge) > 0 && num(x.charge) < 0.6 * mxC)) : ser0;
    const ser = serT.length ? serT : ser0, rpes = ser.map((x) => num(x.rpe)).filter((x) => x > 0);
    const err = (t) => E('cible.raison', nom + ' : « ' + why.slice(0, 90) + ' » — ' + t);
    if (num(S0.best.charge) !== C || num(S0.best.reps) !== Rp) E('cible.depart', nom + ' : départ « ' + h[1] + ' × ' + h[2] + ' », meilleure série de la dernière séance ' + num(S0.best.charge) + ' × ' + num(S0.best.reps));
    let m;
    if ((m = why.match(/^RPE ([\d,]+)(?:-([\d,]+))? sur toutes tes séries la dernière fois/))) { const lo = num(m[1]), hi = m[2] ? num(m[2]) : num(m[1]), rs = ser.map((x) => num(x.rpe)); if (Math.min(...rs) !== lo || Math.max(...rs) !== hi) err('RPE des séries : ' + rs.join(', ') + ' (pas « ' + (m[2] ? lo + '-' + hi : lo) + ' sur toutes »)'); if (C2 !== C || R2 !== Rp) err('« garde charge et reps » mais cible ' + C2 + ' × ' + R2); }
    if ((m = why.match(/^Échec \(RPE 10\) (\d+) séances de suite/))) { const W = P.slice(0, +m[1]); if (W.length < +m[1] || W.some((p) => Math.max(...p.series.map((x) => num(x.rpe))) < 10)) err('pas ' + m[1] + ' séances de suite avec une série à RPE 10'); if (C2 !== C) err('« garde ta charge » mais cible ' + C2 + ' kg'); }
    if ((m = why.match(/^\+1 rep sur les séries sous (\d+) reps/))) { if (f.rmax != null && +m[1] !== f.rmax) err('haut de fourchette ' + f.rmax + ', pas ' + m[1]); if (C2 !== C || R2 < Rp || R2 > Rp + 1) err('cible ' + C2 + ' × ' + R2 + ' pour « +1 rep »'); }
    // 20/11 : série la plus lourde DANS la fourchette → elle reste ; la phrase cite les séries sous le minimum et leur cible.
    if ((m = why.match(/^Sous ta fourchette (\d+)-(\d+) sur (\d+) séries? sur (\d+) \(RPE ([\d,]+)\) : (?:celles-ci passent|celle-ci passe) à ([\d,]+) kg × (\d+)/))) {
      const sous = ser.filter((x) => num(x.reps) < +m[1]);
      if (f.rmin !== +m[1] || f.rmax !== +m[2]) err('fourchette ' + f.rmin + '-' + f.rmax);
      if (sous.length !== +m[3] || ser.length !== +m[4]) err(sous.length + ' série(s) sous ' + m[1] + ' reps sur ' + ser.length + ', pas ' + m[3] + ' sur ' + m[4]);
      if (Math.max(...rpes) !== num(m[5])) err('RPE max ' + Math.max(...rpes));
      if (!sous.length || !(kgN(m[6]) < Math.min(...sous.map((x) => num(x.charge)))) || +m[7] !== f.rmin) err('séries sous la fourchette → ' + m[6] + ' kg × ' + m[7] + ' : attendu une charge plus basse pour ' + f.rmin + ' reps');
      if (C2 !== C || R2 !== Rp) err('« ta série la plus lourde reste telle quelle » mais cible ' + C2 + ' × ' + R2);
    } else if ((m = why.match(/^Sous ta fourchette (\d+)-(\d+) \(RPE ([\d,]+)\)/))) { if (f.rmin !== +m[1] || f.rmax !== +m[2]) err('fourchette ' + f.rmin + '-' + f.rmax); if (Math.max(...rpes) !== num(m[3])) err('RPE max ' + Math.max(...rpes)); if (!(C2 < C) || R2 !== f.rmin) err('cible ' + C2 + ' × ' + R2 + ' : attendu une charge plus basse pour ' + f.rmin + ' reps'); }
    if ((m = why.match(/^Haut de fourchette atteint → \+([\d,]+) kg/))) { if (f.rmax != null && Rp < f.rmax) err('meilleure série à ' + Rp + ' reps, haut de fourchette ' + f.rmax); if (Math.abs(C2 - C - kgN(m[1])) > 1e-9) err('cible ' + C2 + ' kg, attendu ' + C + ' + ' + m[1]); }
    if (/^Charge en hausse et ressenti en baisse : pas de progression aujourd'hui/.test(why)) { if (C2 !== C || R2 !== Rp) err('« mêmes charges » mais cible ' + C2 + ' × ' + R2); const cr2 = ad && ad.moteur && ad.moteur.charge_ressenti; if (cr2 && !cr2.degrade) err('le moteur ne signale pas de ressenti en baisse'); }
  });
  // B9b (20/11). Petit pas « sous la fourchette » = multiple du pas de l'appareil juste sous −5 %, le même sur tous les écrans
  // (avant : 77,5 dans « au choix » et 75 sur la carte ; 6,75 kg hors grille depuis 8 kg).
  const petit = (c, p) => Math.round(Math.floor(c * 0.95 / p + 1e-9) * p * 1000) / 1000;
  Object.entries(S).forEach(([nom, L]) => L.forEach((l) => {
    const m = l.match(/^(.+?) : ([\d,]+) kg × \d+ à RPE [\d,]+ — au choix.*?petit pas en dessous \(([\d,]+) kg\)/); if (!m) return;
    const exo = m[1].trim(), p = R.pas[exo]; if (!(p > 0)) return;
    const att = petit(kgN(m[2]), p); if (Math.abs(kgN(m[3]) - att) > 1e-9) E('cible.petit_pas', nom + ' : ' + exo + ' ' + m[2] + ' kg → petit pas « ' + m[3] + ' kg », attendu ' + String(att).replace('.', ',') + ' kg (≈ −5 %, pas de ' + String(p).replace('.', ',') + ' kg)');
  }));
  // B11 (20/11, point 3). ÉCRAN DE SAISIE (carte « exercice en cours ») : dernière fois = séries brutes (date, charge × reps,
  // RPE, repos), résumé « N séries, RPE moyen », fourchette, séries prévues, et cibles cohérentes avec le message affiché.
  Object.entries(S).filter(([n]) => /^SAISIE ▸ /.test(n)).forEach(([nom, L]) => {
    // L'exercice réellement affiché = la ligne au-dessus de « muscle · x-y reps » (un clic dans un superset ouvre le 1er du groupe).
    const sid = nom.split(' ▸ ')[1], iF = L.findIndex((l) => /· \d+-\d+ reps|· null-null reps/.test(l));
    const exo = (iF > 0 ? L[iF - 1] : nom.split(' ▸ ').slice(2).join(' ▸ ')).trim(), P = R.sessions[exo] || [], f = R.fourchette(exo, sid);
    const err = (code, t) => E(code, nom + ' : ' + t);
    const mF = L.join('\n').match(/· (\d+)-(\d+) reps/); if (mF && f.rmin != null && (+mF[1] !== f.rmin || +mF[2] !== f.rmax)) err('saisie.fourchette', 'fourchette affichée ' + mF[1] + '-' + mF[2] + ', programme ' + f.rmin + '-' + f.rmax);
    const pl = R.prog.find((l) => String(l.exercice || '').trim() === exo && String(l.seance_id) === String(sid)) || R.prog.filter((l) => String(l.exercice || '').trim() === exo)[0], mP = L.join('\n').match(/TES SÉRIES · \d+\/(\d+) PRÉVUES/);
    if (mP && pl && pl.series_prevues != null && +mP[1] !== num(pl.series_prevues)) err('saisie.prevues', mP[1] + ' séries prévues affichées, programme ' + num(pl.series_prevues));
    if (!P.length) return;   // 1re fois : rien à comparer
    const S0 = P[0], dd = S0.d.slice(8, 10) + '/' + S0.d.slice(5, 7);
    const hd = L.find((l) => /\tCIBLE\t/.test(l)); if (hd && !hd.includes(dd)) err('saisie.date', 'colonne « ' + hd.trim().split('\t')[0] + ' », dernière séance de l\'exercice le ' + dd);
    // Lignes S1… : « Sk\tC×R » puis « RPE x · repos » puis « \tC×R\tétat » (cible).
    const lignes = []; for (let i = 0; i < L.length; i++) { const m = L[i].match(/^S(\d+)\t(PDC|[\d,]+)×(\d+)\s*$/); if (!m) continue; const t = (L[i + 2] || '').match(/^\t?(PDC|[\d,]+)×(\d+)/); lignes.push({ k: +m[1], c: m[2] === 'PDC' ? 0 : kgN(m[2]), r: +m[3], rpe: ((L[i + 1] || '').match(/RPE ([\d,]+)/) || [])[1], tc: t ? (t[1] === 'PDC' ? 0 : kgN(t[1])) : null, tr: t ? +t[2] : null }); }
    const ser = S0.series.filter((x) => num(x.reps) > 0);
    lignes.forEach((x) => { const b = ser.find((y) => num(y.serie) === x.k) || ser[x.k - 1]; if (!b) { err('saisie.derniere', 'S' + x.k + ' affichée, pas de série ' + x.k + ' le ' + dd); return; }
      if (num(b.charge) !== x.c || num(b.reps) !== x.r) err('saisie.derniere', 'S' + x.k + ' « ' + x.c + ' × ' + x.r + ' », séance du ' + dd + ' : ' + num(b.charge) + ' × ' + num(b.reps));
      if (x.rpe != null && num(b.rpe) > 0 && num(x.rpe) !== num(b.rpe)) err('saisie.derniere', 'S' + x.k + ' RPE ' + x.rpe + ', séance : ' + num(b.rpe)); });
    const mR = L.join('\n').match(/Dernière fois \([^)]*\) : (\d+) séries?[^.]*?RPE moyen ([\d,]+)/);
    if (mR) { const rs = ser.map((y) => num(y.rpe)).filter((v) => v > 0), moy = rs.length ? Math.round(rs.reduce((a, v) => a + v, 0) / rs.length * 10) / 10 : null;
      if (+mR[1] !== ser.length) err('saisie.resume', mR[1] + ' séries, séance du ' + dd + ' : ' + ser.length); if (moy != null && num(mR[2]) !== moy) err('saisie.resume', 'RPE moyen ' + mR[2] + ', recalculé ' + String(moy).replace('.', ',')); }
    // Message ↔ cibles.
    const msg = (L.find((l) => /la dernière fois|sous ta fourchette|Haut de fourchette|\+1 rep sur les séries/i.test(l)) || '');
    const T = lignes.filter((x) => x.tc != null);
    if (/garde charge et reps/.test(msg)) T.forEach((x) => { if (x.tc !== x.c || x.tr !== x.r) err('saisie.cible', '« garde charge et reps » mais S' + x.k + ' : ' + x.c + ' × ' + x.r + ' → ' + x.tc + ' × ' + x.tr); });
    if (/^\+1 rep sur les séries sous/.test(msg)) T.forEach((x) => { if (x.tc !== x.c || x.tr < x.r || x.tr > x.r + 1) err('saisie.cible', '« +1 rep » mais S' + x.k + ' : ' + x.c + ' × ' + x.r + ' → ' + x.tc + ' × ' + x.tr); });
    if (/^Sous ta fourchette|^Proposition : la dernière fois tu étais sous ta fourchette/i.test(msg) && f.rmin) T.forEach((x) => { const sous = x.r < f.rmin;
      if (sous && !(x.tc < x.c && x.tr === f.rmin) && x.tc !== 0) err('saisie.cible', 'S' + x.k + ' sous la fourchette (' + x.r + ' reps) → ' + x.tc + ' × ' + x.tr + ' : attendu une charge plus basse pour ' + f.rmin + ' reps');
      if (!sous && (x.tc !== x.c || x.tr !== x.r)) err('saisie.cible', 'S' + x.k + ' dans la fourchette (' + x.r + ' reps) mais cible ' + x.tc + ' × ' + x.tr); });
  });
  // B10. « Pourquoi ça bloque » / levier : repos et effort cités = séries brutes.
  Object.entries(S).filter(([n]) => /^ÉVOLUTION ▸ /.test(n)).forEach(([nom, L]) => {
    const exo = nom.replace('ÉVOLUTION ▸ ', ''), P = R.sessions[exo] || []; if (!P.length) return;
    const S0 = P[0], c0 = num(S0.best.charge), trav = S0.series.filter((x) => num(x.charge) === c0 && num(x.repos) > 0);
    const repMoy = trav.length ? trav.reduce((a, x) => a + num(x.repos), 0) / trav.length : null;
    const rtx = (n) => { n = Math.round(n); const m = Math.floor(n / 60), r = n % 60; return m ? m + ' min' + (r ? ' ' + String(r).padStart(2, '0') : '') : r + ' s'; };
    L.forEach((l0) => { const l = l0.trim(); let m;
      if ((m = l.match(/^✓ Repos : (.+), stable — pas en cause$/)) && repMoy != null && m[1] !== rtx(repMoy)) E('levier.repos', nom + ' : « ' + l + ' », repos moyen des séries de travail ' + rtx(repMoy));
      if ((m = l.match(/tu prends ([^,]+), essaie ([^)]+)\)/)) && repMoy != null) { const r15 = Math.round(repMoy / 15) * 15; if (m[1] !== rtx(r15) || m[2] !== rtx(r15 + 30)) E('levier.repos', nom + ' : « tu prends ' + m[1] + ', essaie ' + m[2] + ' », repos réel ' + rtx(repMoy)); }
      if ((m = l.match(/Effort en hausse à ([\d,]+) kg : RPE ([\d,]+) → ([\d,]+)(?![\d,])/)))   // « ✗ … » (constats) et « Pourquoi : … »
         { const b = R.rpeHausse[exo]; if (!b || f1(b.avant) !== m[2] || f1(b.apres) !== m[3] || Math.abs(b.charge - kgN(m[1])) > 0.05) E('levier.effort', nom + ' : « ' + l + ' », recalcul ' + (b ? 'RPE ' + f1(b.avant) + ' → ' + f1(b.apres) + ' à ' + b.charge + ' kg' : 'pas de hausse à charge égale')); }
    });
  });
  // B11. Mêmes contrôles hors des pages Évolution : l'exercice est cité sur la ligne précédente (Aujourd'hui, Résumé, fiche coach).
  Object.entries(S).filter(([n]) => !/^ÉVOLUTION ▸ /.test(n)).forEach(([nom, L]) => {
    let cur = null;
    L.forEach((l0) => { const l = l0.trim(); let m;
      { const pq = l.match(/^Pourquoi \(([^)]+)\)/); if (pq && EXOS.includes(pq[1].trim())) cur = pq[1].trim(); else if (!/^(Pourquoi|Levier)/.test(l)) { let best = null, pos = 1e9; EXOS.forEach((x) => { const i = l.indexOf(x); if (i >= 0 && (i < pos || (i === pos && x.length > best.length))) { pos = i; best = x; } }); if (best) cur = best; } }
      if ((m = l.match(/^(.+) bloqué à ([\d,]+) kg × (\d+) depuis (\d+) séances$/))) { const ex = exoDe(m[1]); if (ex) { const x = bloque(ex, kgN(m[2]), +m[3], +m[4]); ctrl('classement.bloque', nom, l, !x, x); } }
      if (!cur || !/^(Pourquoi|Levier)|Effort en hausse à/.test(l)) return;
      if ((m = l.match(/Effort en hausse à ([\d,]+) kg : RPE ([\d,]+) → ([\d,]+)(?![\d,])/))) { const b = R.rpeHausse[cur]; if (!b || f1(b.avant) !== m[2] || f1(b.apres) !== m[3] || Math.abs(b.charge - kgN(m[1])) > 0.05) E('levier.effort', nom + ' · ' + cur + ' : « ' + m[0] + ' », recalcul ' + (b ? 'RPE ' + f1(b.avant) + ' → ' + f1(b.apres) + ' à ' + b.charge + ' kg' : 'pas de hausse à charge égale')); }
      if ((m = l.match(/tu prends ([^,]+), essaie ([^)]+)\)/))) { const P = R.sessions[cur] || []; if (P.length) { const c0 = num(P[0].best.charge), tr = P[0].series.filter((x) => num(x.charge) === c0 && num(x.repos) > 0); if (tr.length) { const r15 = Math.round(tr.reduce((a, x) => a + num(x.repos), 0) / tr.length / 15) * 15, rtx = (n) => { const mm = Math.floor(n / 60), r = n % 60; return mm ? mm + ' min' + (r ? ' ' + String(r).padStart(2, '0') : '') : r + ' s'; }; if (m[1] !== rtx(r15) || m[2] !== rtx(r15 + 30)) E('levier.repos', nom + ' · ' + cur + ' : « tu prends ' + m[1] + ', essaie ' + m[2] + ' », repos réel ' + rtx(r15)); } } }
    });
  });
  // B12. Volume / fréquence du muscle cités dans « Pourquoi ça bloque » et les leviers (4 semaines terminées).
  const ctlVol = (nom, exo, l) => {
    const mu = R.muscleDe(exo); if (!mu) return; const V = R.vol4(mu); let m;
    if ((m = l.match(/Volume [^:]+ : ([\d,]+) séries\/sem/))) { if (num(m[1]) !== V.parSem) E('levier.volume', nom + ' · ' + exo + ' : « ' + m[0] + ' », recalculé ' + f1(V.parSem) + ' séries/sem (' + mu + ')'); }
    if ((m = l.match(/Fréquence [^:]+ : ([\d,]+)×\/sem/)) || (m = l.match(/Travaillé ([\d,]+)×\/sem/))) { if (num(m[1]) !== V.freq) E('levier.frequence', nom + ' · ' + exo + ' : « ' + m[0] + ' », recalculé ' + f1(V.freq) + '×/sem (' + mu + ')'); }
    if ((m = l.match(/\(([\d,]+) → (\d+) séries\/sem\)/))) { if (num(m[1]) !== V.parSem) E('levier.volume', nom + ' · ' + exo + ' : « ' + m[0] + ' », recalculé ' + f1(V.parSem) + ' séries/sem'); }
    if ((m = l.match(/\(([\d,]+)×\/sem aujourd'hui\)/))) { if (num(m[1]) !== V.freq) E('levier.frequence', nom + ' · ' + exo + ' : « ' + m[0] + ' », recalculé ' + f1(V.freq) + '×/sem'); }
  };
  Object.entries(S).forEach(([nom, L]) => {
    const exoSec = (nom.match(/^ÉVOLUTION ▸ (.+)$/) || [])[1]; let cur = exoSec || null;
    L.forEach((l0) => { const l = l0.trim();
      if (!exoSec) {
        const pq = l.match(/^Pourquoi \(([^)]+)\)/); if (pq && EXOS.includes(pq[1].trim())) cur = pq[1].trim();   // « Pourquoi (Squat) : … »
        else if (!/^(Pourquoi|Levier|[✓✗])/.test(l)) { let best = null, pos = 1e9; EXOS.forEach((x) => { const i = l.indexOf(x); if (i >= 0 && (i < pos || (i === pos && x.length > best.length))) { pos = i; best = x; } }); if (best) cur = best; }   // 1er exercice cité de la ligne
      }
      if (cur && /(Volume [^:]+ : [\d,]+ séries\/sem|Fréquence [^:]+ : [\d,]+×\/sem|Travaillé [\d,]+×\/sem|séries\/sem\)|×\/sem aujourd'hui\))/.test(l)) ctlVol(nom, cur, l); });
  });
  // B13. Journal des décisions : statut affiché, « Réalisé : … », « N / M tentée(s) » = recalcul.
  const STAT = { 'Atteint': 'atteint', 'Pas atteint': 'pas_atteint', 'Pas tenté': 'pas_tente', 'Non évaluable': 'non_evaluable' };
  Object.entries(S).forEach(([nom, L]) => {
    let sem = null, entete = null, vus = [];
    const clore = () => { if (entete && vus.length) { const t = vus.filter((x) => x.tente).length; if (t !== entete[0] || vus.length !== entete[1]) E('journal.compte', nom + ' · semaine du ' + fr(sem).slice(0, 5) + ' : « ' + entete[0] + ' / ' + entete[1] + ' tentée » , recalculé ' + t + ' / ' + vus.length); } vus = []; entete = null; };
    L.forEach((l0, i) => { const l = l0.trim(); let m;
      if ((m = l.match(/^Semaine du (\d{2})\/(\d{2})$/))) { clore(); const an = R.lundi.slice(0, 4); let d = an + '-' + m[2] + '-' + m[1]; if (d > R.lundi) d = (+an - 1) + '-' + m[2] + '-' + m[1]; sem = d; return; }
      if (sem && (m = l.match(/^(\d+) \/ (\d+) tentées?$/))) { entete = [+m[1], +m[2]]; return; }
      if (!sem) return;
      m = l.match(/^(Atteint|Pas atteint|Pas tenté|Non évaluable)(.+)$/); if (!m) return;
      const dec = R.decisions.find((d) => iso(d.semaine) === sem && String(d.titre).trim().replace(/ cette semaine$/, '') === m[2].trim().replace(/ cette semaine$/, '')); if (!dec) { E('journal.inconnu', nom + ' : « ' + m[2].trim() + ' » (semaine du ' + fr(sem).slice(0, 5) + ') absent du journal enregistré'); return; }
      const J = R.journal(dec); vus.push(J);
      if (STAT[m[1]] !== J.statut) E('journal.statut', nom + ' · ' + m[2].trim() + ' : « ' + m[1] + ' », recalculé « ' + Object.keys(STAT).find((k) => STAT[k] === J.statut) + ' »');
      const det = String(L[i + 1] || ''); let k;
      if ((k = det.match(/Réalisé : ([\d,]+) séries? \(objectif (\d+)\)/)) && num(k[1]) !== J.tot) E('journal.realise', nom + ' · ' + m[2].trim() + ' : « ' + k[0] + ' », recalculé ' + f1(J.tot) + ' séries');
      if ((k = det.match(/Réalisé : ([\d,]+) kg × (\d+)(?: \(RPE ([\d,]+)\))?\./)) && (!J.best || num(k[1]) !== num(J.best.charge) || +k[2] !== num(J.best.reps) || (k[3] && num(k[3]) !== num(J.best.rpe)))) E('journal.realise', nom + ' · ' + m[2].trim() + ' : « ' + k[0] + ' », recalculé ' + (J.best ? num(J.best.charge) + ' × ' + num(J.best.reps) + ' (RPE ' + num(J.best.rpe) + ')' : 'aucune série'));
      if ((k = det.match(/Semaine de vacances \((\d+) jours en pause\)/)) && J.jp !== +k[1]) E('journal.pause', nom + ' · ' + m[2].trim() + ' : « ' + k[0] + ' », recalculé ' + J.jp + ' jours');
    });
    clore();
  });
  // B14. Plan de la semaine : actions affichées = actions enregistrées au journal (même semaine), compte « N / M fait »,
  // « Semaine dernière : … », « Rien à changer : muscle X séries/sem ».
  const decSem = R.decisions.filter((d) => iso(d.semaine) === R.lundi), decPrec = R.decisions.filter((d) => iso(d.semaine) === plusJ(R.lundi, -7));
  const normT = (t) => String(t || '').replace(/ · .*$/, '').replace(/ cette semaine$/, '').replace(/^★ /, '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/s\b/g, '');
  Object.entries(S).forEach(([nom, L]) => {
    const i0 = L.findIndex((l) => /^TON PLAN DE LA SEMAINE$/.test(l.trim())); if (i0 < 0) return;
    const cpt = String(L[i0 + 1] || '').trim().match(/^(\d+) \/ (\d+)( fait)?$/);
    const actifs = [], pause = [], MARK = /^(\d+|⏸|✓)$/, STOP = (l) => /^(Semaine dernière|Rien à changer|Ce sont des propositions|Voir le détail)/.test(l) || (l.length > 3 && l === l.toUpperCase() && /[A-ZÉ]/.test(l));
    let parMarques = false; for (let i = i0 + 2; i < L.length; i++) { const l = L[i].trim(); if (STOP(l)) break; if (/^\d+$/.test(l)) { parMarques = true; break; } }   // Résumé : « 1 / ⏸ / ✓ » puis titre puis raison ; Aujourd'hui : titres à la suite
    for (let i = i0 + 2; i < L.length; i++) { const l = L[i].trim(); if (STOP(l)) break; if (MARK.test(l)) continue;
      if (/^⚠/.test(l)) continue;   // note de gêne, pas une action
      const prev = String(L[i - 1] || '').trim(); if (parMarques && !MARK.test(prev)) continue;
      (prev === '⏸' ? pause : actifs).push(l); }
    const tous = actifs.concat(pause);
    if (decSem.length) tous.forEach((t) => { if (!decSem.some((d) => normT(d.titre) === normT(t))) E('plan.journal', nom + ' : action affichée « ' + t.slice(0, 70) + ' » absente du journal enregistré pour cette semaine (le journal jugera autre chose)'); });
    if (decSem.length) decSem.forEach((d) => { if (tous.length && !tous.some((t) => normT(t) === normT(d.titre))) E('plan.journal', nom + ' : action enregistrée « ' + String(d.titre).slice(0, 70) + ' » n\'est plus affichée dans le plan'); });
    if (cpt) { const faits = actifs.map((t) => decSem.find((d) => normT(d.titre) === normT(t))).filter(Boolean).filter((d) => { const L1 = R.lundi; return R.journal({ ...d, semaine: L1 }).statut === 'atteint'; }).length;
      if (+cpt[2] !== actifs.length) E('plan.compte', nom + ' : « ' + cpt[0] + ' » mais ' + actifs.length + ' action(s) active(s) affichée(s)');
      else if (actifs.every((t) => decSem.some((d) => normT(d.titre) === normT(t))) && +cpt[1] !== faits) E('plan.compte', nom + ' : « ' + cpt[0] + ' », recalculé ' + faits + ' faite(s) sur ' + actifs.length); }
    L.forEach((l0) => { const l = l0.trim(); let m;
      if ((m = l.match(/^(\d+) actions? proposées? · (\d+) tentées? · (\d+) objectifs? atteints?\.?$/)) && decPrec.length) { const J = decPrec.map((d) => R.journal(d)); const t = J.filter((x) => x.tente).length, at = J.filter((x) => x.statut === 'atteint').length; if (+m[1] !== decPrec.length || +m[2] !== t || +m[3] !== at) E('plan.semaine_derniere', nom + ' : « ' + l + ' », recalculé ' + decPrec.length + ' proposées · ' + t + ' tentée(s) · ' + at + ' atteint(s)'); }
      if ((m = l.match(/^Rien à changer : (.+?) séries\/sem/))) m[1].split(' · ').forEach((it) => { const k = it.match(/^(.+) ([\d,]+)$/); if (!k) return; const mu = R.muscles.find((x) => cle(x) === cle(k[1])); if (mu) { const V = R.vol4(mu); if (num(k[2]) !== V.parSem) E('plan.rien_a_changer', nom + ' : « ' + it + ' séries/sem », recalculé ' + f1(V.parSem)); } });
    });
  });
  // B15. Cardio : résumé « N sorties ces 4 semaines (X km) », tuiles « Sorties / Distance 4 sem. », « Charge 7 j »,
  // lignes d'historique (date, distance, durée, vitesse).
  if (R.cardio && R.cardio.length) {
    const now = R.now, c28 = plusJ(now, -27), c7 = plusJ(now, -6);
    const s28 = R.cardio.filter((o) => o.d >= c28 && !R.cxMicro(o)), n28 = s28.length, km28 = Math.round(s28.reduce((a, o) => a + num(o.distance), 0) * 10) / 10;
    const ua7 = Math.round(R.cardio.filter((o) => o.d >= c7).reduce((a, o) => a + R.cxCharge(o), 0));
    const hms = (m) => { m = Math.round(m || 0); const h = Math.floor(m / 60); return h ? h + 'h' + String(m % 60).padStart(2, '0') : m + ' min'; };
    const MOIS = { JANV: '01', 'FÉVR': '02', MARS: '03', AVR: '04', MAI: '05', JUIN: '06', JUIL: '07', 'AOÛT': '08', SEPT: '09', OCT: '10', NOV: '11', 'DÉC': '12' };
    Object.entries(S).forEach(([nom, L]) => {
      L.forEach((l0, i) => { const l = l0.trim(); let m;
        if ((m = l.match(/^(\d+) sorties? cardio ces 4 semaines(?: \(([\d,]+) km au total\))?\.$/))) { if (+m[1] !== n28 || (m[2] && num(m[2]) !== km28)) E('cardio.resume', nom + ' : « ' + l + ' », recalculé ' + n28 + ' sortie(s), ' + f1(km28) + ' km (28 jours, micro-sorties exclues)'); }
        const v = String(L[i + 1] || '').trim();
        if (l === 'SORTIES 4 SEM.' && v && +v !== n28) E('cardio.tuile', nom + ' : sorties 4 sem. ' + v + ', recalculé ' + n28);
        if (l === 'DISTANCE 4 SEM.' && v && Math.abs(num(v.replace(/\s*km$/, '')) - km28) > 0.05) E('cardio.tuile', nom + ' : distance 4 sem. ' + v + ', recalculé ' + f1(km28) + ' km');
        if (l === 'CHARGE 7 J' && /UA$/.test(v) && Math.abs(num(v.replace(/\D/g, '')) - ua7) > 1) E('cardio.tuile', nom + ' : charge 7 j ' + v + ', recalculé ' + ua7 + ' UA');
        // Historique : « 13 » / « NOV » / sport / « 1,7 km · 1h10 · 1,5 km/h »
        if (/^\d{1,2}$/.test(l) && MOIS[String(L[i + 1] || '').trim()] && /CARDIO/.test(nom)) {
          const mo = MOIS[String(L[i + 1]).trim()], an = (mo > now.slice(5, 7) ? +now.slice(0, 4) - 1 : +now.slice(0, 4)), d = an + '-' + mo + '-' + l.padStart(2, '0');
          const det = String(L[i + 3] || '').trim(); if (!/km|h\d|min/.test(det)) return;
          const cand = R.cardio.filter((o) => o.d === d), fmt = (o) => [num(o.distance) ? f1(num(o.distance)) + ' km' : null, num(o.duree) ? hms(o.duree) : null, num(o.vitesse_moy) ? f1(num(o.vitesse_moy)) + ' km/h' : null].filter(Boolean).join(' · ');
          if (!cand.some((o) => fmt(o) === det)) E('cardio.historique', nom + ' : ' + l + ' ' + String(L[i + 1]).trim() + ' « ' + det + ' », séances ce jour-là : ' + (cand.map(fmt).join(' | ') || 'aucune'));
        }
      });
    });
  }
  // B16. Plan : « Séance « X » » ne renvoie jamais vers une séance déjà faite cette semaine ; « Tenté <jour> : C kg × R à
  // RPE x » = meilleure série de l'exercice cette semaine, ce jour-là (retour porteur 19/11).
  {
    const faitesSem = new Set(R.P.filter((r) => r.d >= R.lundi && r.d <= R.now).map((r) => String(r.seance_id || '').trim().toLowerCase()));
    const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    Object.entries(S).forEach(([nom, L]) => { let cur = null;
      L.forEach((l0) => { const l = l0.trim(); let m;
        const t = l.match(/^(.+?) : (garde|proposé|vise|\d+ séries)/); if (t) cur = t[1].replace(/^★ /, '').trim();
        if ((m = l.match(/Séance « ([^»]+) »\.?$/)) && faitesSem.has(m[1].trim().toLowerCase())) E('plan.seance_faite', nom + ' : renvoie vers « ' + m[1] + ' », déjà faite cette semaine');
        if ((m = l.match(/^Tenté (\w+) : ([\d,]+) kg × (\d+)(?: à RPE ([\d,]+))?/)) && cur) {
          const P2 = (R.sessions[cur] || []).filter((p) => p.d >= R.lundi); let b = null, bd = null;
          P2.forEach((p) => p.series.forEach((x) => { const dc = b ? num(x.charge) - num(b.charge) : 1, dr = b ? num(x.reps) - num(b.reps) : 0, de = b ? num(x.rpe) - num(b.rpe) : 0; if (!b || dc > 0 || (dc === 0 && (dr > 0 || (dr === 0 && de > 0)))) { b = x; bd = p.d; } }));   // à égalité : la plus dure
          if (!b || num(b.charge) !== kgN(m[2]) || num(b.reps) !== +m[3] || (m[4] && num(b.rpe) !== num(m[4])) || JOURS[new Date(bd + 'T12:00:00Z').getUTCDay()] !== m[1]) E('plan.tente', nom + ' · ' + cur + ' : « ' + m[0] + ' », recalculé ' + (b ? JOURS[new Date(bd + 'T12:00:00Z').getUTCDay()] + ' ' + num(b.charge) + ' × ' + num(b.reps) + ' RPE ' + num(b.rpe) : 'pas fait cette semaine'));
        }
      });
    });
  }
  // B4. Même compte de séances « cette semaine » partout (régularité, entraînement, volume, objectif).
  const vus = [];
  Object.entries(S).forEach(([nom, L]) => L.forEach((l) => {
    let m = l.match(/^(\d+) \/ (\d+) séances cette semaine/); if (m) vus.push([nom + ' · Régularité', +m[1]]);
    m = l.match(/^\d+% (\d+)\/(\d+) cette semaine/); if (m) vus.push([nom + ' · Mon programme', +m[1]]);
    m = l.match(/SÉRIES CETTE SEMAINE \((\d+)\/(\d+) SÉANCES\)/); if (m) vus.push([nom + ' · Volume par muscle', +m[1]]);
    // Objectif de points : calendaire. Libellé « Objectif semaine » = même fenêtre que le réglage ; en semaine glissante il
    // doit être écrit « Objectif lun → dim » (sinon deux chiffres « cette semaine » se contredisent).
    m = l.match(/^Objectif semaine (\d+)\/(\d+)/); if (m) { if (R.semaineType === 'glissant') E('objectif.libelle', nom + ' : « Objectif semaine ' + m[1] + '/' + m[2] + ' » compté lundi → dimanche, alors que « cette semaine » = 7 derniers jours ailleurs'); else vus.push([nom + ' · Objectif semaine', +m[1]]); }
    m = l.match(/^Objectif lun → dim (\d+)\/(\d+)/); if (m && +m[1] !== R.seancesSemaine) E('objectif.ecran', nom + ' : objectif lun → dim ' + m[1] + ', recalculé ' + R.seancesSemaine);
  }));
  const diff = vus.filter((v) => v[1] !== R.seancesFaites);
  if (diff.length) E('seances.ecrans', 'séances « cette semaine » : ' + vus.map((v) => v[0] + ' = ' + v[1]).join(' · ') + ' — recalculé ' + R.seancesFaites + ' (' + (R.semaineType === 'glissant' ? '7 derniers jours' : 'depuis lundi') + ')');
}

// ── C. Vue coach ▸ Équipe : chaque ligne d'athlète = recalcul sur SES séries (RPE 7 j, tonnage 7 j et son évolution) ──
function verifierCoach(store, ecrans, now, out) {
  const S = sections(ecrans);
  // Fiche coach d'un athlète (Aperçu, Analyses, Forme) : mêmes règles que les écrans de l'athlète, sur SES données.
  const parAth = {};
  Object.entries(S).forEach(([n, L]) => { const m = n.match(/^FICHE (.+?) ▸ /); if (m) (parAth[m[1].trim()] = parAth[m[1].trim()] || []).push('######## ' + n + '\n' + L.join('\n')); });
  Object.entries(parAth).forEach(([nomA, blocs]) => {
    const a = (store.athletes || []).find((x) => String(x.nom || '').trim() === nomA); if (!a) return;
    const R = recalculer(store, null, now, String(a.id)), o = [];
    verifierTexte(R, {}, blocs.join('\n'), o);
    o.forEach((x) => out.push({ ...x, message: 'Fiche coach · ' + x.message }));
  });
  const L = S['COACH equipe']; if (!L) return;
  const noms = {}; (store.athletes || []).forEach((a) => { if (a && a.nom) noms[String(a.nom).trim()] = String(a.id); });
  for (let i = 0; i < L.length; i++) {
    const aid = noms[L[i].trim()]; if (!aid) continue;
    let j = i + 1; const bloc = []; while (j < L.length && L[j].trim() !== 'PLAN') bloc.push(L[j++].trim());
    const R = recalculer(store, null, now, aid), nom = 'Équipe · ' + L[i].trim();
    const iR = bloc.indexOf('RPE 7 J'), iT = bloc.indexOf('TONNAGE');
    if (iR > 0) { const v = bloc[iR - 1]; if ((v === '—') !== (R.rpe7 == null) || (v !== '—' && v !== f1(R.rpe7))) out.push({ code: 'coach.rpe7', gravite: 'erreur', message: nom + ' : RPE 7 j « ' + v + ' », recalculé ' + (R.rpe7 == null ? '—' : f1(R.rpe7)) }); }
    if (iT > 0) {
      const t = bloc.slice(iR + 1, iT).join(' ');
      const m = t.match(/^([\d,]+) t(?: · ([+−-])(\d+) %)?/);
      if (m) {
        if (num(m[1]) !== R.tonJ7) out.push({ code: 'coach.tonnage', gravite: 'erreur', message: nom + ' : tonnage « ' + m[1] + ' t », recalculé ' + f1(R.tonJ7) + ' t' });
        const ev = m[2] ? (m[2] === '+' ? 1 : -1) * +m[3] : null;
        if (ev !== null && ev !== R.tonEvol) out.push({ code: 'coach.tonnage_evol', gravite: 'erreur', message: nom + ' : évolution « ' + m[2] + m[3] + ' % », recalculée ' + R.tonEvol + ' %' });
        const k = t.match(/vs 7 j d'avant \(([\d,]+) t\)/); if (k && num(k[1]) !== R.tonJ7prec) out.push({ code: 'coach.tonnage_prec', gravite: 'erreur', message: nom + ' : « vs 7 j d\'avant (' + k[1] + ' t) », recalculé ' + f1(R.tonJ7prec) + ' t' });
        if (m[2] && !k) out.push({ code: 'coach.tonnage_ref', gravite: 'erreur', message: nom + ' : évolution du tonnage sans sa référence' });
      } else if (R.tonJ7 > 0) out.push({ code: 'coach.tonnage', gravite: 'erreur', message: nom + ' : tonnage absent, recalculé ' + f1(R.tonJ7) + ' t' });
    }
  }
}

// ── D. Mail récapitulatif (bilan de la période) : chiffres recalculés sur la période [début, fin[ ──
// Mail (HTML) : aucun texte cassé, nombres décimaux à la française.
function verifierMailHtml(html, out) {
  const t = String(html || '').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  let m; const re = /\b(undefined|NaN|Invalid Date)\b|\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|N\b)|(?<![\d.])\d+\.\d+(?= ?(kg|t\b|séries|h\b|%))/g;
  while ((m = re.exec(t))) out.push({ code: 'mail.texte', gravite: 'erreur', message: 'Mail : « …' + t.slice(Math.max(0, m.index - 40), m.index + 40).trim() + '… »' });
}
function verifierBilan(store, b, aid, out) {
  const E = (code, message) => out.push({ code, gravite: 'erreur', message: 'Mail ' + b.per + ' : ' + message });
  const d0 = b.bornes.debut, d1 = b.bornes.fin, jours = Math.round((new Date(d1 + 'T12:00:00Z') - new Date(d0 + 'T12:00:00Z')) / 864e5);
  const fin1 = plusJ(d1, -1), R = recalculer(store, null, fin1, aid);   // état à la fin de la période
  const P = (store.performances || []).filter((r) => !aid || String(r.athlete_id) === String(aid)).map((r) => ({ ...r, d: iso(r.date) }));
  const dansP = P.filter((r) => r.d >= d0 && r.d < d1), dPrec = plusJ(d0, -jours);
  const cleS2 = (r) => r.d + '|' + String(r.seance_id == null ? '' : r.seance_id);   // 20/11 : séances (date + nom)
  const seances = new Set(dansP.map(cleS2)).size, seancesPrec = new Set(P.filter((r) => r.d >= dPrec && r.d < d0).map(cleS2)).size;
  if (b.seances !== seances) E('mail.seances', b.seances + ' séance(s), recalculé ' + seances);
  if (b.seancesPrec != null && b.seancesPrec !== seancesPrec && b.per === 'semaine') E('mail.seances_prec', 'période précédente ' + b.seancesPrec + ', recalculé ' + seancesPrec);
  const ton = Math.round(dansP.reduce((x, r) => x + num(r.charge) * num(r.reps), 0)); if (Math.abs(num(b.tonnage) - ton) > 1) E('mail.tonnage', b.tonnage + ' kg, recalculé ' + ton);
  if (b.series !== dansP.length) E('mail.series', b.series + ' séries, recalculé ' + dansP.length);
  const reps = dansP.reduce((x, r) => x + num(r.reps), 0); if (b.reps !== reps) E('mail.reps', b.reps + ' reps, recalculé ' + reps);
  const rr = dansP.filter((r) => num(r.rpe) > 0), rpe = rr.length ? Math.round(rr.reduce((x, r) => x + num(r.rpe), 0) / rr.length * 10) / 10 : null; if (b.rpe != null && b.rpe !== rpe) E('mail.rpe', 'RPE ' + b.rpe + ', recalculé ' + rpe);
  // Jours de vacances dans la période.
  let jp = 0; const pz = []; (store.pauses || []).filter((r) => !aid || String(r.athlete_id) === String(aid)).forEach((r) => pz.push({ debut: iso(r.debut), fin: iso(r.fin) || iso(r.debut) }));
  { let cur = null; (store.indicateurs || []).filter((r) => (!aid || String(r.athlete_id) === String(aid)) && r.cle === 'pause').slice().sort((a, c) => iso(a.date).localeCompare(iso(c.date)) || num(a.id) - num(c.id)).forEach((r) => { if (String(r.valeur) === 'fin') { const d = iso(r.date); if (cur && d && d < cur.fin) cur.fin = d; cur = null; return; } const d = iso(r.valeur), f = iso(r.unite); if (d && f) { cur = { debut: d, fin: f }; pz.push(cur); } }); }
  for (let k = 0; k < jours; k++) { const dk = plusJ(d0, k); if (pz.some((p) => p.debut <= dk && dk <= p.fin)) jp++; }
  if (b.pauseJours != null && b.pauseJours !== jp) E('mail.pause', b.pauseJours + ' jour(s) de vacances, recalculé ' + jp);
  // Volume moyen par semaine sur la période (secondaire 0,5) et équilibres.
  const sec = {}; (store.exercices || []).forEach((e) => { if (e && e.exercice && e.muscle_secondaire) sec[String(e.exercice).trim().toLowerCase()] = e.muscle_secondaire; });
  const vol = {}; dansP.forEach((r) => { if (r.muscle && cle(r.muscle) !== 'corps entier') vol[cle(r.muscle)] = (vol[cle(r.muscle)] || 0) + 1; const sm = sec[String(r.exercice || '').trim().toLowerCase()]; if (sm && cle(sm) !== cle(r.muscle)) vol[cle(sm)] = (vol[cle(sm)] || 0) + 0.5; });
  (b.volume || []).forEach((v) => { const att = Math.round((vol[cle(v.muscle)] || 0) / (jours / 7) * 10) / 10; if (Math.abs(num(v.parSem) - att) > 0.051) E('mail.volume', v.muscle + ' ' + v.parSem + ' séries/sem, recalculé ' + att); });
  (b.balance || []).forEach((x) => { const a = vol[cle(x.a)] || 0, c = vol[cle(x.b)] || 0; if (a + c > 0) { const pa = Math.round(a / (a + c) * 100); if (Math.abs(pa - x.pa) > 1) E('mail.balance', x.a + '/' + x.b + ' ' + x.pa + '/' + x.pb + ', recalculé ' + pa + '/' + (100 - pa)); } });
  // Records de la période : chaque record cité bat bien tout ce qui précède, à sa date.
  (b.records || []).forEach((x) => { const S0 = (R.sessions[x.exo] || []); const i = S0.findIndex((p) => p.d === iso(x.date)); if (i < 0) { E('mail.record', x.exo + ' ' + x.c + ' × ' + x.r + ' le ' + fr(iso(x.date)) + ' : aucune séance ce jour-là'); return; }
    const ok = S0[i].series.some((sr) => num(sr.charge) === num(x.c) && num(sr.reps) === num(x.r)); let bc = -1, br = -1; S0.slice(i + 1).forEach((p) => p.series.forEach((sr) => { const c = num(sr.charge), rr2 = num(sr.reps); if (c > bc) { bc = c; br = rr2; } else if (c === bc && rr2 > br) br = rr2; }));
    if (!ok || !(S0.length > i + 1) || !(num(x.c) > bc || (num(x.c) === bc && num(x.r) > br))) E('mail.record', x.exo + ' ' + x.c + ' × ' + x.r + ' le ' + fr(iso(x.date)) + ' : ' + (!ok ? 'série absente ce jour-là' : 'ne bat pas le meilleur d\'avant (' + bc + ' × ' + br + ')')); });
  // Classement à la fin de la période (bloqué / sous la fourchette) = séries brutes jusqu'à cette date.
  const L = b.lecture || {};
  (L.bloque || []).forEach((x) => { const P2 = R.sessions[x.exo] || [], n = num(x.n); const W = P2.slice(0, n); const bad = P2.length < n ? 'seulement ' + P2.length + ' séances' : (W.some((p) => num(p.best.charge) !== num(x.c)) ? 'les ' + n + ' dernières séances ne sont pas toutes à ' + x.c + ' kg' : (Math.max(...W.map((p) => num(p.best.reps))) !== num(x.r) ? 'meilleur nombre de reps ' + Math.max(...W.map((p) => num(p.best.reps))) : (num(W[n - 1].best.reps) !== num(x.r) ? 'plateau plus court' : null))); if (bad) E('mail.bloque', x.exo + ' ' + x.c + ' × ' + x.r + ' depuis ' + n + ' séances (au ' + fr(fin1).slice(0, 5) + ') : ' + bad); });
  (L.sous || []).forEach((x) => { const P2 = R.sessions[x.exo] || []; if (!P2.length) return; const S0 = P2[0], ser = S0.series.filter((sr) => num(sr.reps) > 0), rp = Math.max(...ser.map((sr) => num(sr.rpe))); if (num(S0.best.charge) !== num(x.c) || num(S0.best.reps) !== num(x.r) || rp !== num(x.rpe) || !(ser.filter((sr) => num(sr.reps) < num(x.rmin)).length * 2 > ser.length)) E('mail.sous', x.exo + ' ' + x.c + ' × ' + x.r + ' (RPE ' + x.rpe + ') : dernière séance ' + num(S0.best.charge) + ' × ' + num(S0.best.reps) + ' (RPE ' + rp + ')'); });
}

// ── E. Contexte envoyé à l'IA : chaque chiffre = recalcul (l'IA ne doit recevoir que des faits justes) ──
function verifierIA(store, txt, now, aid, out) {
  const E = (code, message) => out.push({ code, gravite: 'erreur', message: 'Contexte IA : ' + message });
  const R = recalculer(store, null, now, aid), L = String(txt || '').split('\n');
  const BE = (store.bien_etre || []).filter((b) => !aid || String(b.athlete_id) === String(aid)).map((b) => ({ ...b, d: iso(b.date) })).filter((b) => b.d && b.d <= now).sort((a, b) => b.d.localeCompare(a.d));
  const P = (store.performances || []).filter((r) => !aid || String(r.athlete_id) === String(aid)).map((r) => ({ ...r, d: iso(r.date) })).filter((r) => r.d && r.d <= now);
  const exos = Object.keys(R.sessions).sort((a, b) => b.length - a.length), exoDe = (t) => exos.find((e) => t.indexOf(e) === 0);
  L.forEach((l) => { let m;
    if (/(?<![\d/.])\d+\.\d+(?!\.\d)/.test(l.replace(/https?:\S+/g, '')) && !/\d{4}-\d{2}-\d{2}/.test(l)) E('ia.format', '« ' + l.slice(0, 90) + ' » (point décimal)');
    if ((m = l.match(/^- Dernier questionnaire \((?:[^()]|\([^()]*\))*\) : (.+?) \(sommeil :/))) { const b = BE[0]; if (!b) { E('ia.questionnaire', 'questionnaire cité, aucun en base'); return; }
      const col = { sommeil: 'sommeil', fatigue: 'fatigue_musculaire', stress: 'stress', courbatures: 'courbatures', douleur: 'douleur' };
      m[1].split(', ').forEach((it) => { const k = it.match(/^(\w+) (\d+)\/5$/); if (k && col[k[1]] && num(b[col[k[1]]]) !== +k[2]) E('ia.questionnaire', k[1] + ' ' + k[2] + '/5, dernière saisie ' + b[col[k[1]]] + '/5 (' + fr(b.d) + ')'); }); }
    if ((m = l.match(/^- Dernière séance muscu : .* · (\d+) séries(?: · RPE moyen ([\d,]+))?\.$/))) { const d = P.map((r) => r.d).sort().pop(), S0 = P.filter((r) => r.d === d), rr = S0.filter((r) => num(r.rpe) > 0), rp = rr.length ? Math.round(rr.reduce((x, r) => x + num(r.rpe), 0) / rr.length * 10) / 10 : null;
      if (+m[1] !== S0.length) E('ia.seance', m[1] + ' séries, recalculé ' + S0.length + ' (' + fr(d) + ')'); if (m[2] && num(m[2]) !== rp) E('ia.seance', 'RPE moyen ' + m[2] + ', recalculé ' + f1(rp)); }
    if ((m = l.match(/^- Régularité : objectif (\d+) séances\/semaine ; (\d+|—) faites cette semaine \(depuis lundi\)/)) && m[2] !== '—' && +m[2] !== R.seancesSemaine) E('ia.regularite', m[2] + ' séances depuis lundi, recalculé ' + R.seancesSemaine);
    if ((m = l.match(/^- Records récents : (.+)\.$/))) m[1].split(' ; ').forEach((it) => { const e = exoDe(it); const k = e && it.slice(e.length).match(/^ ([\d,]+) kg × (\d+)/); if (k) { const P2 = R.sessions[e] || []; const i = P2.findIndex((p) => num(p.best.charge) === num(k[1]) && num(p.best.reps) === +k[2]); let ok = i >= 0 && P2.length > i + 1; if (ok) { let bc = -1, br = -1; P2.slice(i + 1).forEach((p) => { const c = num(p.best.charge), r = num(p.best.reps); if (c > bc) { bc = c; br = r; } else if (c === bc && r > br) br = r; }); ok = num(k[1]) > bc || (num(k[1]) === bc && +k[2] > br); } if (!ok) E('ia.record', it + ' : pas un record dans les séries'); } });
    if ((m = l.match(/^- Bloqués \([^)]*\) : (.+)\.$/))) m[1].split(' ; ').forEach((it) => { const k = it.match(/^(.+) à ([\d,]+) kg × (\d+) depuis (\d+) séances$/); if (!k) return; const P2 = R.sessions[k[1].trim()] || [], n = +k[4], W = P2.slice(0, n); if (P2.length < n || W.some((p) => num(p.best.charge) !== num(k[2])) || Math.max(...W.map((p) => num(p.best.reps))) !== +k[3]) E('ia.bloque', it + ' : pas conforme aux ' + n + ' dernières séances'); });
    if ((m = l.match(/^- Sous la fourchette de reps : (.+)\.$/))) m[1].split(/\), (?=[A-ZÉ])/).forEach((it) => { const k = it.match(/^(.+?) \(fourchette (\d+)-(\d+) reps ; dernière fois ([\d,]+) kg × (\d+) à RPE ([\d,]+)/); if (!k) return; const P2 = R.sessions[k[1].trim()] || []; if (!P2.length) return; const S0 = P2[0], f = R.fourchette(k[1].trim()); if (num(S0.best.charge) !== num(k[4]) || num(S0.best.reps) !== +k[5] || f.rmin !== +k[2] || f.rmax !== +k[3]) E('ia.sous', it.slice(0, 80) + ' : dernière séance ' + num(S0.best.charge) + ' × ' + num(S0.best.reps) + ', fourchette ' + f.rmin + '-' + f.rmax); });
    if ((m = l.match(/^- Volume de la semaine en cours, (depuis lundi|sur les 7 derniers jours) \(séries faites \/ minimum hebdo\) : (.+)\.$/))) {
      if ((m[1] === 'depuis lundi') !== (R.semaineType === 'calendaire')) E('ia.volume', 'fenêtre « ' + m[1] + ' » alors que le réglage est ' + R.semaineType);
      m[2].split(', ').forEach((it) => { const k = it.match(/^(.+) ([\d,]+)\/(\d+)$/); if (k && Math.abs(num(k[2]) - (R.volume[cle(k[1])] || 0)) > 0.01) E('ia.volume', k[1] + ' ' + k[2] + ' séries, recalculé ' + f1(R.volume[cle(k[1])] || 0)); }); }
    if ((m = l.match(/^- Poids : ([\d,]+) kg/))) { const ph = (store.poids_historique || []).filter((x) => !aid || String(x.athlete_id) === String(aid)).sort((a, b) => iso(b.date).localeCompare(iso(a.date)))[0]; if (ph && num(ph.poids) !== num(m[1])) E('ia.poids', m[1] + ' kg, dernière pesée ' + ph.poids + ' kg (' + fr(iso(ph.date)) + ')'); }
  });
}

// ── B12 (21/11, point 3). Analyses ▸ Tendances : chiffres affichés à côté des graphiques, recalculés sur les séries brutes.
// Régularité (séances par semaine lun → dim sur 12 semaines, 2 le même jour = 2 ; série, semaines à l'objectif, moyenne),
// tonnage par tranche de 7 jours, exercices en progrès, fréquence par muscle (jours en muscle principal / semaines mesurées),
// répartition d'intensité (séries < 6 / 6-12 / > 12 reps). Période lue sur l'écran (« novembre 2026 » = Mois, « 2026 » = Année).
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
function verifierTendances(R, S, out) {
  const E = (code, message) => out.push({ code, gravite: 'erreur', message });
  const fx = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
  Object.entries(S).filter(([n]) => /^ANALYSES ▸ tendances$/i.test(n)).forEach(([nom, L]) => {
    const P = R.P.filter((r) => num(r.reps) > 0), cleS = (r) => r.d + '|' + String(r.seance_id == null ? '' : r.seance_id);
    // Régularité.
    const iO = L.findIndex((l) => /^obj\. \d+$/.test(l) || /^objectif (?:\d+\/sem|non défini)/.test(l));
    if (iO >= 0) {
      const obj = num((L.find((l) => /^objectif \d+\/sem/.test(l)) || '').replace(/^objectif (\d+).*/, '$1'));
      const lun = lundiDe(R.now), deb = plusJ(lun, -77), cnt = Array(12).fill(0);
      [...new Set(P.map(cleS))].forEach((k) => { const d = k.slice(0, 10); if (d >= deb && d <= R.now) cnt[Math.floor(Math.round((new Date(d + 'T12:00:00Z') - new Date(deb + 'T12:00:00Z')) / 864e5) / 7)]++; });
      const aff = L.slice(iO + 1).filter((l) => /^\d+$/.test(l)).slice(0, 12).map(Number);
      const iObj = L.findIndex((l) => /^obj\. \d+$/.test(l)), barres = iObj >= 0 ? L.slice(iObj + 1, iObj + 13).map(Number) : aff;
      if (barres.length === 12 && barres.join(' ') !== cnt.join(' ')) E('tendances.regularite', nom + ' : barres ' + barres.join(' ') + ', séances par semaine ' + cnt.join(' '));
      const prem = P.map((r) => r.d).sort()[0]; let nW = 12; if (prem) { const w0 = Math.floor(Math.round((new Date(prem + 'T12:00:00Z') - new Date(deb + 'T12:00:00Z')) / 864e5) / 7); if (w0 > 0) nW = 12 - w0; }
      const ok = (c) => obj > 0 ? c >= obj : c > 0, fen = cnt.slice(12 - nW);
      let st = 0; for (let i = 11; i >= 0; i--) { if (ok(cnt[i])) st++; else if (i === 11) continue; else break; }
      const at = fen.filter(ok).length, moy = Math.round(fen.reduce((a, c) => a + c, 0) / Math.max(1, nW) * 10) / 10, J = L.join('\n');
      const mS = J.match(/🔥 (\d+)\nSÉRIE À L'OBJECTIF/i), mA = J.match(/(\d+)\/(\d+)\nSEM\. À L'OBJECTIF/i), mM = J.match(/([\d,]+)\nSÉANCES\/SEM\. MOY\./i);
      if (mS && +mS[1] !== st) E('tendances.regularite', nom + ' : série à l\'objectif ' + mS[1] + ', recalculée ' + st);
      if (mA && (+mA[1] !== at || +mA[2] !== nW)) E('tendances.regularite', nom + ' : ' + mA[1] + '/' + mA[2] + ' semaines à l\'objectif, recalculé ' + at + '/' + nW);
      if (mM && num(mM[1]) !== moy) E('tendances.regularite', nom + ' : ' + mM[1] + ' séances/sem., recalculé ' + fx(moy));
    }
    // Période des graphiques.
    const lp = L.find((l) => new RegExp('^(' + MOIS.join('|') + ') \\d{4}$').test(l)) || L.find((l) => /^\d{4}$/.test(l) && +l > 2000);
    if (!lp) return;
    let d0, d1, tranches = [];
    if (/^\d{4}$/.test(lp)) { d0 = lp + '-01-01'; d1 = (+lp + 1) + '-01-01'; for (let m = 1; m <= 12; m++) tranches.push([lp + '-' + String(m).padStart(2, '0') + '-01', m === 12 ? d1 : lp + '-' + String(m + 1).padStart(2, '0') + '-01']); }
    else { const [mo, an] = lp.split(' '), m = MOIS.indexOf(mo) + 1; d0 = an + '-' + String(m).padStart(2, '0') + '-01'; d1 = m === 12 ? (+an + 1) + '-01-01' : an + '-' + String(m + 1).padStart(2, '0') + '-01'; for (let c = d0; c < d1;) { const dow = (new Date(c + 'T12:00:00Z').getUTCDay() + 6) % 7, e = plusJ(c, 7 - dow) < d1 ? plusJ(c, 7 - dow) : d1; tranches.push([c, e]); c = e; } }   // 21/11 : semaines lun → dim coupées au mois
    const dans = (r) => r.d >= d0 && r.d < d1, PP = P.filter(dans);
    const bloc = (deb, fin) => { const i = L.findIndex((l) => l === deb); if (i < 0) return null; const j = L.findIndex((l, k) => k > i && fin.test(l)); return L.slice(i + 1, j < 0 ? L.length : j); };
    // Tonnage : valeurs des points (tranches non vides) en tonnes.
    const bT = bloc('TONNAGE SOULEVÉ', /^EXERCICES EN PROGRÈS$/);
    if (bT) { const iu = bT.indexOf('t'), id = bT.findIndex((l, k) => k > iu && /^\d{1,2}\/\d{1,2}$/.test(l));
      if (iu >= 0 && id > iu) { const aff = bT.slice(iu + 1, id).map((l) => num(l.replace(/ t$/, ''))), att = tranches.map(([a, b]) => Math.round(PP.filter((r) => r.d >= a && r.d < b).reduce((x, r) => x + num(r.charge) * num(r.reps), 0) / 100) / 10).filter((v) => v > 0);
        if (aff.length && aff.join(' ') !== att.join(' ')) E('tendances.tonnage', nom + ' : points ' + aff.map(fx).join(' · ') + ' t, recalculé ' + att.map(fx).join(' · ') + ' t'); } }
    // Exercices en progrès : M = (exercice, jour) faits sur la période ; N entre les progrès simples (charge / reps à charge égale) et M.
    const mP = L.join('\n').match(/Sur la période : (\d+) progrès sur (\d+) exercices réalisés/);
    if (mP) { let m = 0, n = 0; Object.values(R.sessions).forEach((a) => a.forEach((x, i) => { if (x.d < d0 || x.d >= d1) return; m++; const q = a[i + 1]; if (q && (num(x.best.charge) > num(q.best.charge) || (num(x.best.charge) === num(q.best.charge) && num(x.best.reps) > num(q.best.reps)))) n++; }));
      if (+mP[2] !== m) E('tendances.progres', nom + ' : ' + mP[2] + ' exercices réalisés, recalculé ' + m);
      if (+mP[1] < n || +mP[1] > +mP[2]) E('tendances.progres', nom + ' : ' + mP[1] + ' progrès, au moins ' + n + ' recalculés (charge ou reps à charge égale)'); }
    // Fréquence par muscle.
    const bF = bloc('FRÉQUENCE PAR MUSCLE', /^RÉPARTITION D'INTENSITÉ$|^Jours où le muscle|^Moins de 7 jours/);
    if (bF) { const jt = [...new Set(P.map((r) => r.d))].sort(), lend = plusJ(R.now, 1), s0 = jt[0] && jt[0] > d0 ? jt[0] : d0, e0 = d1 < lend ? d1 : lend;
      const jd = Math.round((new Date(e0 + 'T12:00:00Z') - new Date(s0 + 'T12:00:00Z')) / 864e5), parM = {};
      P.filter((r) => r.d >= s0 && r.d < e0 && r.muscle).forEach((r) => { (parM[cle(r.muscle)] = parM[cle(r.muscle)] || new Set()).add(r.d); });
      for (let i = 0; i + 1 < bF.length; i++) { const m = bF[i + 1].match(/^([\d,]+)×\/sem$|^(\d+) séances?$/); if (!m) continue; const n = parM[cle(bF[i])] ? parM[cle(bF[i])].size : 0;
        const att = m[1] != null ? fx(n / (jd / 7)) : String(n), vu = m[1] != null ? m[1] : m[2];
        if (vu !== att) E('tendances.frequence', nom + ' : ' + bF[i] + ' ' + bF[i + 1] + ', recalculé ' + att + (m[1] != null ? '×/sem (' + n + ' jours sur ' + jd + ')' : ' séances')); } }
    // Répartition d'intensité.
    const J = L.join('\n'), mI = J.match(/RÉPARTITION D'INTENSITÉ\n\?\n(\d+) séries\nLourd <6 reps · (\d+)%\nMoyen 6-12 · (\d+)%\nLéger >12 · (\d+)%/);
    if (mI) { const lo = PP.filter((r) => num(r.reps) < 6).length, mi = PP.filter((r) => num(r.reps) >= 6 && num(r.reps) <= 12).length, tot = PP.length, hi = tot - lo - mi;
      const pL = tot ? Math.round(lo / tot * 100) : 0, pM = tot ? Math.round(mi / tot * 100) : 0;
      if (+mI[1] !== tot || +mI[2] !== pL || +mI[3] !== pM || +mI[4] !== 100 - pL - pM) E('tendances.intensite', nom + ' : ' + mI[1] + ' séries ' + mI[2] + '/' + mI[3] + '/' + mI[4] + ' %, recalculé ' + tot + ' séries ' + pL + '/' + pM + '/' + (100 - pL - pM) + ' % (' + lo + '/' + mi + '/' + hi + ')'); }
  });
}
// ── B13 (21/11, point 3). Évolution ▸ Par exercice (vue Charge + reps) : chiffres autour de la courbe, recalculés sur les séries brutes.
// « N séances suivies » (à vie), étiquettes charge × reps des points de la période (meilleure série du jour), meilleure série,
// écart 1er → dernier point (« = identique », « +2,5 kg · −1 rep »), record charge (à vie), tableau « Dernières séances » (toutes les séries).
const MOISC = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
function periodeEcran(L, now) {
  // Semaine : « 9 – 15 nov. » ou « 26 oct. – 1 nov. » (année = celle de « now », décembre → janvier géré).
  const ls = L.find((l) => /^\d{1,2}(?: \S+)? – \d{1,2} \S+$/.test(l) && MOISC.includes(l.split(' ').pop()));
  if (ls && now) { const m = ls.match(/^(\d{1,2})(?: (\S+))? – (\d{1,2}) (\S+)$/), m2 = MOISC.indexOf(m[4]) + 1, m1 = m[2] ? MOISC.indexOf(m[2]) + 1 : m2;
    let an2 = +now.slice(0, 4); if (m2 > +now.slice(5, 7) + 1) an2--; const an1 = m1 > m2 ? an2 - 1 : an2;
    const d0 = an1 + '-' + String(m1).padStart(2, '0') + '-' + m[1].padStart(2, '0'); return [d0, plusJ(d0, 7)]; }
  const lp = L.find((l) => new RegExp('^(' + MOIS.join('|') + ') \\d{4}$').test(l)) || L.find((l) => /^\d{4}$/.test(l) && +l > 2000);
  if (!lp) return null;
  if (/^\d{4}$/.test(lp)) return [lp + '-01-01', (+lp + 1) + '-01-01'];
  const [mo, an] = lp.split(' '), m = MOIS.indexOf(mo) + 1;
  return [an + '-' + String(m).padStart(2, '0') + '-01', m === 12 ? (+an + 1) + '-01-01' : an + '-' + String(m + 1).padStart(2, '0') + '-01'];
}
function verifierEvolution(R, S, out) {
  const E = (code, message) => out.push({ code, gravite: 'erreur', message });
  const kg = (v) => String(Math.round(num(v) * 100) / 100).replace('.', ','), cr = (x) => kg(x.charge) + '×' + num(x.reps);
  Object.entries(S).filter(([n]) => /^ÉVOLUTION ▸ /.test(n)).forEach(([nom, L]) => {
    const exo = nom.replace('ÉVOLUTION ▸ ', '').trim(), A = R.sessions[exo]; if (!A || !A.length) return;
    const iE = L.findIndex((l) => l.trim() === exo); if (iE < 0) return;
    const mN = (L[iE + 1] || '').match(/(\d+) séances? suivies?$/);
    if (mN && +mN[1] !== A.length) E('evolution.suivies', nom + ' : ' + mN[1] + ' séances suivies, recalculé ' + A.length);
    const per = periodeEcran(L); if (!per) return;
    const pts = A.filter((x) => x.d >= per[0] && x.d < per[1]).slice().reverse(), n = pts.length; if (!n) return;
    const J = L.join('\n');
    if (!/\nCharge \+ Reps\n/.test(J)) return;   // autre vue (force, volume, par série) : pas contrôlée ici
    // Étiquettes de la courbe (≤ 7 points : toutes affichées).
    const iK = L.findIndex((l, k) => k > iE && l === 'kg'), iD = L.findIndex((l, k) => k > iK && /^\d{2}\/\d{2}\/\d{4}$/.test(l));
    if (n <= 7 && iK > 0 && iD > iK) { const aff = L.slice(iK + 1, iD), att = pts.map((x) => cr(x.best));
      if (aff.join(' ') !== att.join(' ')) E('evolution.courbe', nom + ' : étiquettes ' + aff.join(' · ') + ', recalculé ' + att.join(' · ')); }
    const best = pts.reduce((a, b) => (num(b.best.charge) > num(a.best.charge) || (num(b.best.charge) === num(a.best.charge) && num(b.best.reps) > num(a.best.reps))) ? b : a, pts[0]).best;
    const mB = J.match(/\n(\S+)\nMEILLEURE SÉRIE/); if (mB && mB[1] !== cr(best)) E('evolution.meilleure', nom + ' : meilleure série ' + mB[1] + ', recalculé ' + cr(best));
    const mP = J.match(/\n([^\n]+)\nSUR LA PÉRIODE/);
    if (mP) { let att = '—'; if (n >= 2) { const dc = Math.round((num(pts[n - 1].best.charge) - num(pts[0].best.charge)) * 10) / 10, dr = num(pts[n - 1].best.reps) - num(pts[0].best.reps), p = [];
        if (dc) p.push((dc > 0 ? '+' : '−') + String(Math.abs(dc)).replace('.', ',') + ' kg'); if (dr) p.push((dr > 0 ? '+' : '−') + Math.abs(dr) + ' rep' + (Math.abs(dr) > 1 ? 's' : '')); att = p.length ? p.join(' · ') : '= identique'; }
      if (mP[1].trim() !== att) E('evolution.periode', nom + ' : « ' + mP[1].trim() + ' » sur la période, recalculé « ' + att + ' »'); }
    const mR = J.match(/\n([\d,]+) kg\nRECORD CHARGE/), rec = R.records[exo]; if (mR && rec && num(mR[1]) !== rec.charge) E('evolution.record', nom + ' : record charge ' + mR[1] + ' kg, recalculé ' + kg(rec.charge) + ' kg');
    // Tableau : 6 dernières séances de la période, toutes les séries (reps > 0) dans l'ordre.
    const iT = L.findIndex((l) => l.trim() === 'FORCE EST.');
    if (iT > 0) { const rows = []; for (let k = iT + 1; k + 1 < L.length; k += 3) { if (!/^\d{2}\/\d{2}\/\d{4}$/.test(L[k])) break; rows.push({ d: iso(L[k]), s: L[k + 1] }); }
      const att = pts.slice().reverse().slice(0, 6);
      if (rows.length !== att.length) E('evolution.tableau', nom + ' : ' + rows.length + ' lignes dans « Dernières séances », ' + att.length + ' séances sur la période');
      rows.forEach((r, k) => { const x = att[k]; if (!x) return; const ser = x.jour.filter((y) => num(y.reps) > 0).map(cr).join(' · ');
        const tri = (t) => t.split(' · ').sort().join(' · ');   // 2 séances le même jour : ordre des séries libre, contenu identique
        if (r.d !== x.d || tri(r.s) !== tri(ser)) E('evolution.tableau', nom + ' : ligne ' + fr(r.d) + ' « ' + r.s + ' », recalculé ' + fr(x.d) + ' « ' + ser + ' »'); }); }
  });
}
// ── B14 (21/11, point 3). Forme ▸ courbe du poids (vue « Tout », 30 dernières pesées, une par jour) : poids affiché = dernière pesée,
// évolution = dernière − première (« = stable », « ▲ +2 kg », « ▼ −1 kg »).
function verifierPoids(store, aid, S, out) {
  const E = (code, message) => out.push({ code, gravite: 'erreur', message });
  const vu = {}, pz = (store.poids_historique || []).filter((r) => !aid || String(r.athlete_id) === String(aid)).map((r) => ({ d: iso(r.date), v: num(r.poids != null ? r.poids : r.valeur) }))
    .filter((r) => r.d && r.v > 0).sort((a, b) => b.d.localeCompare(a.d)).slice(0, 30).filter((r) => (vu[r.d] ? false : (vu[r.d] = 1)));
  Object.entries(S).filter(([n]) => /^(ÉTAT|Forme)$/.test(n)).forEach(([nom, L]) => {
    const i = L.findIndex((l, k) => l === '1M' && L[k + 1] === '3M' && L[k + 2] === 'Tout'); if (i < 2 || !pz.length) return;
    const iKg = L.lastIndexOf('kg', i); if (iKg < 1) return;
    const act = L[iKg - 1], evo = iKg + 1 < i ? L[iKg + 1] : '';
    if (act !== '—' && num(act) !== pz[0].v) E('poids.actuel', nom + ' : poids affiché ' + act + ' kg, dernière pesée ' + String(pz[0].v).replace('.', ',') + ' kg le ' + fr(pz[0].d));
    if (pz.length >= 2) { const df = Math.round((pz[0].v - pz[pz.length - 1].v) * 10) / 10, att = df === 0 ? '= stable' : (df > 0 ? '▲ +' : '▼ −') + String(Math.abs(df)).replace('.', ',') + ' kg';
      if (!evo.startsWith(att)) E('poids.evolution', nom + ' : « ' + evo + ' », recalculé « ' + att + ' » (' + fr(pz[pz.length - 1].d) + ' → ' + fr(pz[0].d) + ')'); }
    const pts = L.slice(i + 3).filter((l) => /^\d{2}\/\d{2}$/.test(l)); const dbl = pts.find((d, k) => pts.indexOf(d) !== k);
    if (dbl) E('poids.doublon', nom + ' : la date ' + dbl + ' apparaît 2 fois sous la courbe (une pesée par jour attendue)');
  });
}
// ── B17 (21/11, point 3). Cardio ▸ Tendances, « Volume par sport » sur la période affichée : par sport, temps, sorties, km
// (micro-sorties < 5 min et < 0,3 km exclues, comme le Résumé). Comparé sport par sport (temps + nombre de sorties).
function verifierCardioTendances(R, S, out) {
  const E = (code, message) => out.push({ code, gravite: 'erreur', message });
  // Lecture cardio : « charge cardio a fortement augmenté (+N % sur 4 semaines) » = charge J-27 → J vs J-55 → J-28 (micro-sorties exclues).
  { let a = 0, b = 0, nb = 0; (R.cardio || []).filter((o) => !R.cxMicro(o)).forEach((o) => { if (o.d >= plusJ(R.now, -27)) a += R.cxCharge(o); else if (o.d >= plusJ(R.now, -55)) { b += R.cxCharge(o); nb++; } });
    const ev = (b > 0 && nb >= 2) ? Math.round((a - b) / b * 100) : null;
    Object.entries(S).forEach(([nom, L]) => L.forEach((l) => { const m = l.match(/charge cardio a fortement augmenté \(\+(\d+)% sur 4 semaines\)/); if (m && (ev == null || +m[1] !== ev)) E('cardio.evolution', nom + ' : +' + m[1] + ' % sur 4 semaines, recalculé ' + (ev == null ? 'non calculable' : (ev >= 0 ? '+' : '') + ev + ' %')); })); }
  const hms = (m) => { m = Math.round(m || 0); const h = Math.floor(m / 60); return h ? h + 'h' + String(m % 60).padStart(2, '0') : m + ' min'; };
  Object.entries(S).filter(([n]) => /^CARDIO ▸ tendances$/i.test(n)).forEach(([nom, L]) => {
    const per = periodeEcran(L), i0 = L.indexOf('VOLUME PAR SPORT'); if (!per || i0 < 0) return;
    const by = {}; (R.cardio || []).filter((o) => o.d >= per[0] && o.d < per[1] && !R.cxMicro(o)).forEach((o) => { const b = by[o.type] || (by[o.type] = { n: 0, du: 0, km: 0 }); b.n++; b.du += num(o.duree); b.km += num(o.distance); });
    const att = Object.values(by).map((b) => hms(b.du) + ' · ' + b.n + ' sortie' + (b.n > 1 ? 's' : '')).sort();
    const aff = []; for (let k = i0 + 2; k + 1 < L.length; k += 2) { const m = L[k + 1].match(/^(\S+(?: min)?) · (\d+) sorties?/); if (!m) break; aff.push(m[1] + ' · ' + m[2] + ' sortie' + (+m[2] > 1 ? 's' : '')); }
    if (aff.slice().sort().join(' | ') !== att.join(' | ')) E('cardio.volume_sport', nom + ' : ' + (aff.join(' | ') || 'rien') + ', recalculé ' + (att.join(' | ') || 'rien') + ' (micro-sorties exclues)');
  });
}
// ── B18 (21/11). Analyses ▸ Résumé, zone « détail » (période du sélecteur) : tuiles (tonnage moyen / séance, séances, séries,
// répétitions, RPE moyen des séries, records battus = meilleur précédent dépassé, 1re fois exclue), volume musculaire
// (séries par muscle, secondaire = ½), balance agoniste / antagoniste (% de séries).
// ── B19 (21/11). Analyses ▸ Historique : « N exos · N séries · X t » de chaque séance (date + nom).
function verifierResume(R, store, S, out) {
  const E = (code, message) => out.push({ code, gravite: 'erreur', message });
  const fx = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
  const sec = {}; (store.exercices || []).forEach((e) => { if (e && e.exercice && e.muscle_secondaire) sec[String(e.exercice).trim().toLowerCase()] = e.muscle_secondaire; });
  const cleS = (r) => r.d + '|' + String(r.seance_id == null ? '' : r.seance_id);
  Object.entries(S).filter(([n]) => /^(ANALYSES ▸ resume|Analyses ▸ Résumé \(muscu\))$/i.test(n)).forEach(([nom, L]) => {
    const iK = L.findIndex((l) => l === 'TONNAGE MOYEN'); if (iK < 0) return;
    const per = periodeEcran(L.slice(0, iK), R.now); if (!per) return;
    const PP = R.P.filter((r) => r.d >= per[0] && r.d < per[1]);
    const nS = new Set(PP.map(cleS)).size, ton = PP.reduce((a, r) => a + num(r.charge) * num(r.reps), 0), rp = PP.filter((r) => num(r.rpe) > 0);
    // Records battus : par exercice, meilleur du jour (charge > 0) contre le meilleur des jours précédents.
    const jours = {}; R.P.forEach((r) => { const c = num(r.charge); if (c <= 0) return; const k = r.exercice + '|' + r.d, x = jours[k]; if (!x || c > x.c || (c === x.c && num(r.reps) > x.r)) jours[k] = { e: r.exercice, d: r.d, c, r: num(r.reps) }; });
    const best = {}, recEx = new Set(); Object.values(jours).sort((a, b) => a.d.localeCompare(b.d)).forEach((x) => { const b = best[x.e]; if (b && (x.c > b.c || (x.c === b.c && x.r > b.r)) && x.d >= per[0] && x.d < per[1]) recEx.add(x.e); if (!b || x.c > b.c || (x.c === b.c && x.r > b.r)) best[x.e] = x; });
    const att = { 'TONNAGE MOYEN': nS ? fx(ton / nS / 1000) + 't / séance' : '—', 'SÉANCES': String(nS), 'SÉRIES TOTALES': String(PP.length), 'RÉPÉTITIONS': String(PP.reduce((a, r) => a + num(r.reps), 0)),
      'RPE MOYEN DES SÉRIES': rp.length ? fx(rp.reduce((a, r) => a + num(r.rpe), 0) / rp.length) + '/10' : '—/10', 'RECORDS BATTUS': String(recEx.size) };
    Object.keys(att).forEach((k) => { const i = L.indexOf(k, iK); if (i < 0) return; const v = L[i + 1]; if (v !== att[k]) E('resume.periode', nom + ' : ' + k.toLowerCase() + ' « ' + v + ' », recalculé « ' + att[k] + ' » (' + fr(per[0]) + ' → ' + fr(plusJ(per[1], -1)) + ')'); });
    // Volume musculaire.
    const spmB = {}; PP.forEach((r) => { if (r.muscle && cle(r.muscle) !== 'corps entier') spmB[r.muscle] = (spmB[r.muscle] || 0) + 1; const sm = sec[String(r.exercice || '').trim().toLowerCase()]; if (sm && cle(sm) !== cle(r.muscle)) spmB[sm] = (spmB[sm] || 0) + 0.5; });
    const spm = {}; PP.forEach((r) => { if (r.muscle && cle(r.muscle) !== 'corps entier') spm[cle(r.muscle)] = (spm[cle(r.muscle)] || 0) + 1; const sm = sec[String(r.exercice || '').trim().toLowerCase()]; if (sm && cle(sm) !== cle(r.muscle)) spm[cle(sm)] = (spm[cle(sm)] || 0) + 0.5; });
    const iV = L.indexOf('VOLUME MUSCULAIRE', iK), iB = L.indexOf('BALANCE MUSCULAIRE', iK);
    if (iV > 0) for (let k = iV + 1; k + 1 < (iB > 0 ? iB : L.length); k++) { const m = L[k + 1].match(/^([\d,]+) séries? · /) || L[k + 1].match(/^(0) série$/); if (!m) continue;
      const v = spm[cle(L[k].replace(/ \(hors programme\)$/, ''))] || 0; if (num(m[1]) !== Math.round(v * 10) / 10) E('resume.volume', nom + ' : ' + L[k] + ' ' + m[1] + ' séries, recalculé ' + fx(v)); }
    // Balance.
    if (iB > 0) { const nrm = (x) => String(x).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, ''), sumK = (keys, ex) => Object.keys(spmB).reduce((t, m) => t + ((keys.some((k) => nrm(m).includes(k)) && !(ex || []).some((e) => nrm(m).includes(e))) ? spmB[m] : 0), 0);
      [['Pectoraux', ['pector'], null, ['dos', 'dorsa'], 'Dos'], ['Quadriceps', ['quadri'], null, ['ischio'], 'Ischios'], ['Biceps', ['biceps'], ['femor'], ['triceps'], 'Triceps']].forEach(([la, ka, xa, kb, lb]) => {
        const i = L.indexOf(L.slice(iB).find((l) => new RegExp('^' + la + ' \\d+%$').test(l)) || '§', iB); if (i < 0) return;
        const va = sumK(ka, xa), vb = sumK(kb), pct = va + vb > 0 ? Math.round(va / (va + vb) * 100) : null, aff = +L[i].match(/(\d+)%$/)[1], affB = +((L[i + 1] || '').match(/^(\d+)% /) || [])[1];
        if (pct == null || aff !== pct || affB !== 100 - pct) E('resume.balance', nom + ' : ' + la + ' ' + aff + '% / ' + affB + '% ' + lb + ', recalculé ' + pct + '% / ' + (100 - pct) + '%'); }); }
  });
  Object.entries(S).filter(([n]) => /^ANALYSES ▸ historique$/i.test(n)).forEach(([nom, L]) => {
    const MO = { JANV: '01', 'FÉVR': '02', MARS: '03', AVR: '04', MAI: '05', JUIN: '06', JUIL: '07', 'AOÛT': '08', SEPT: '09', OCT: '10', NOV: '11', 'DÉC': '12' };
    for (let k = 0; k + 2 < L.length; k++) { if (!/^\d{1,2}$/.test(L[k]) || !MO[L[k + 1]]) continue;
      const mo = MO[L[k + 1]], an = mo > R.now.slice(5, 7) ? +R.now.slice(0, 4) - 1 : +R.now.slice(0, 4), d = an + '-' + mo + '-' + L[k].padStart(2, '0'), sid = L[k + 2];
      const det = L.slice(k + 3, k + 6).find((l) => /^\d+ exos · \d+ séries · [\d,]+ t$/.test(l)); if (!det) continue;
      const rs = R.P.filter((r) => r.d === d && String(r.seance_id || 'Séance') === sid), att = new Set(rs.map((r) => r.exercice)).size + ' exos · ' + rs.length + ' séries · ' + fx(rs.reduce((a, r) => a + num(r.charge) * num(r.reps), 0) / 1000) + ' t';
      if (det !== att) E('historique.seance', nom + ' : ' + L[k] + ' ' + L[k + 1] + ' « ' + sid + ' » ' + det + ', recalculé ' + att); }
  });
}
// ── B20 (21/11). « Ta force estimée · 6 semaines » (Résumé) : par exercice, séances des 42 derniers jours (≥ 4, dernière ≤ 21 j),
// force du jour = meilleure série en charge × (1 + (reps + reps en réserve) / 30), réserve = 10 − RPE bornée 0-4 (0 sans RPE) ;
// % = moyenne des 2 dernières contre les 2 premières. Contrôle « sur N séances » et le %.
function verifierForce6(R, S, out) {
  const E = (code, message) => out.push({ code, gravite: 'erreur', message });
  const fS = (x) => { const c = num(x.charge), r = num(x.reps), rpe = num(x.rpe); return (c > 0 && r > 0) ? c * (1 + (r + (rpe > 0 ? Math.max(0, Math.min(4, 10 - rpe)) : 0)) / 30) : 0; };
  const pctTxt = (p) => { const a = Math.abs(p); return (p > 0 ? '+' : p < 0 ? '−' : '') + (a >= 10 ? String(Math.round(a)) : String(Math.round(a * 10) / 10).replace('.', ',')) + ' %'; };
  Object.entries(S).forEach(([nom, L]) => { const i0 = L.findIndex((l) => /^TA FORCE ESTIMÉE · 6 SEMAINES$/i.test(l)); if (i0 < 0) return;
    for (let k = i0 + 1; k + 2 < L.length; k++) { const mN = L[k + 1].match(/^sur (\d+) séances/); if (!mN || !/ %$/.test(L[k + 2])) continue;
      const exo = L[k].replace(/ \([+−][\d,]+ % sans le RPE\)$/, '').trim(), A = (R.sessions[exo] || []).filter((x) => x.d > plusJ(R.now, -42) && x.d <= R.now).slice().reverse();
      if (A.length < 4 || A[A.length - 1].d <= plusJ(R.now, -21)) { E('force6.exercice', nom + ' : ' + exo + ' listé (' + A.length + ' séances sur 42 j, dernière le ' + (A.length ? fr(A[A.length - 1].d) : '—') + ')'); continue; }
      const v = A.map((x) => Math.max(0, ...x.series.map(fS))), m = (a) => (a[0] + a[1]) / 2, p = Math.round((m(v.slice(-2)) - m(v)) / m(v) * 1000) / 10;
      if (+mN[1] !== A.length) E('force6.seances', nom + ' : ' + exo + ' sur ' + mN[1] + ' séances, recalculé ' + A.length);
      if (L[k + 2] !== pctTxt(p)) E('force6.pct', nom + ' : ' + exo + ' ' + L[k + 2] + ', recalculé ' + pctTxt(p)); } });
}
// ── B21 (21/11). Évolution ▸ Par exercice, vues Force estimée / Volume / Par série : étiquettes des points de la période
// (force du jour = meilleure série avec la réserve 10 − RPE, arrondie ; volume = Σ charge × reps de toutes les séries ;
// par série = charge du dernier point de chaque série S1…Sn), et l'écart affiché en haut (« 70 +50 kg », « 11 = 0 »).
function verifierEvolutionVues(R, S, out) {
  const E = (code, message) => out.push({ code, gravite: 'erreur', message });
  const f1v = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
  const fS = (x) => { const c = num(x.charge), r = num(x.reps), rpe = num(x.rpe); return (c > 0 && r > 0) ? c * (1 + (r + (rpe > 0 ? Math.max(0, Math.min(4, 10 - rpe)) : 0)) / 30) : 0; };
  Object.entries(S).filter(([n]) => /^ÉVOLUTION-(1rm|vol|srv) ▸ /.test(n)).forEach(([nom, L]) => {
    const [, vue, exo] = nom.match(/^ÉVOLUTION-(\w+) ▸ (.+)$/), per = periodeEcran(L, R.now); if (!per) return;
    const pts = (R.sessions[exo.trim()] || []).filter((x) => x.d >= per[0] && x.d < per[1]).slice().reverse(), n = pts.length; if (n < 2 || n > 7) return;
    const iK = L.indexOf('kg'), iD = L.findIndex((l, k) => k > iK && /^\d{2}\/\d{2}\/\d{4}$/.test(l)); if (iK < 0 || iD < iK) return;
    const aff = L.slice(iK + 1, iD);
    if (vue === 'srv') { const ser = pts.map((p) => { const m = {}; p.series.forEach((x, k) => { m[num(x.serie) || k + 1] = num(x.charge); }); return m; });
      const maxS = Math.min(6, Math.max(...ser.map((m) => Math.max(0, ...Object.keys(m).map(Number))))), att = [];
      for (let s = 1; s <= maxS; s++) { for (let i = n - 1; i >= 0; i--) if (ser[i][s] != null) { att.push(f1v(ser[i][s])); break; } }
      if (aff.join(' ') !== att.join(' ')) E('evolution.vue', nom + ' : ' + aff.join(' · ') + ', recalculé ' + att.join(' · ') + ' (dernière charge de S1…S' + maxS + ')');
      return; }
    const val = pts.map((p) => vue === '1rm' ? Math.round(Math.max(0, ...p.series.map(fS))) : p.series.reduce((a, x) => a + num(x.charge) * num(x.reps), 0));
    const att = val.map((v, i) => f1v(v) + (i === n - 1 ? ' kg' : ''));
    if (aff.join(' ') !== att.join(' ')) E('evolution.vue', nom + ' : points ' + aff.join(' · ') + ', recalculé ' + att.join(' · '));
    const d = Math.round((val[n - 1] - val[0]) * 10) / 10, top = f1v(val[n - 1]) + ' ' + (d === 0 ? '= 0' : (d > 0 ? '+' : '−') + f1v(Math.abs(d)) + ' kg');
    const iT = L.findIndex((l) => /^(Force estimée|Volume \(toutes séries\)) \(kg\)$/.test(l)); if (iT >= 0 && L[iT + 1] !== top) E('evolution.vue', nom + ' : en-tête « ' + L[iT + 1] + ' », recalculé « ' + top + ' »');
  });
}
// ── B22 (21/11). Évolution ▸ Par groupe (période affichée) : par muscle, séries/sem (principal 1, secondaire ½, divisé par les
// semaines couvertes : 1re séance → demain), « dont N indir. », fréquence = jours en muscle PRINCIPAL / semaines, tonnage (principal).
// ── B23 (21/11). Évolution ▸ Par séance : « X t · N séries » de chaque séance (date + nom), et pour chaque exercice
// « C kg × R · avant C kg × R » = meilleure série de la séance et de la fois précédente (jour antérieur).
function verifierEvolutionModes(R, store, S, out) {
  const E = (code, message) => out.push({ code, gravite: 'erreur', message });
  const f1v = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
  const sec = {}; (store.exercices || []).forEach((e) => { if (e && e.exercice && e.muscle_secondaire) sec[String(e.exercice).trim().toLowerCase()] = e.muscle_secondaire; });
  const S1 = S['ÉVOLUTION-MODE ▸ grp'];
  if (S1) { const per = periodeEcran(S1, R.now); if (per) {
    const prem = R.P.map((r) => r.d).sort()[0], a = prem && prem > per[0] ? prem : per[0], dem = plusJ(R.now, 1), b = per[1] < dem ? per[1] : dem;
    const nj = Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5), w = Math.max(1, nj / 7);
    const M = {}, g = (m) => M[cle(m)] || (M[cle(m)] = { d: 0, i: 0, t: 0, j: new Set() });
    R.P.filter((r) => r.d >= per[0] && r.d < per[1]).forEach((r) => { if (r.muscle) { const o = g(r.muscle); o.d++; o.t += num(r.charge) * num(r.reps); o.j.add(r.d); }
      const sm = sec[String(r.exercice || '').trim().toLowerCase()]; if (sm && cle(sm) !== cle(r.muscle)) g(sm).i += 0.5; });
    for (let k = 0; k + 1 < S1.length; k++) { const mh = S1[k].match(/^(.+) · (Sous-MEV|Suffisant|Optimal|Au-delà|Réduit.*)$/); if (!mh) continue; const o = M[cle(mh[1])]; if (!o) { E('evolution.groupe', 'Par groupe : ' + mh[1] + ' affiché, aucune série sur la période'); continue; }
      const bloc = S1.slice(k + 1, k + 6); const ls = bloc.find((l) => /^Séries /.test(l)) || '', lf = bloc.find((l) => /^Fréq\. /.test(l)) || '', lt = bloc.find((l) => /^Tonnage /.test(l));
      const ms = ls.match(/^Séries ([\d,]+)\/\d+\/sem(?: · dont ([\d,]+) indir\.)?/), mf = lf.match(/^Fréq\. ([\d,]+)×\/sem/);
      if (ms && num(ms[1]) !== Math.round((o.d + o.i) / w * 10) / 10) E('evolution.groupe', 'Par groupe : ' + mh[1] + ' ' + ls + ', recalculé ' + f1v((o.d + o.i) / w) + ' séries/sem (' + o.d + ' + ' + o.i + ' indir. sur ' + f1v(w) + ' sem.)');
      if (ms && ms[2] && num(ms[2]) !== Math.round(o.i / w * 10) / 10) E('evolution.groupe', 'Par groupe : ' + mh[1] + ' dont ' + ms[2] + ' indir., recalculé ' + f1v(o.i / w));
      if (mf && num(mf[1]) !== Math.round(o.j.size / w * 10) / 10) E('evolution.groupe', 'Par groupe : ' + mh[1] + ' ' + lf + ', recalculé ' + f1v(o.j.size / w) + '×/sem (' + o.j.size + ' jours en principal)');
      if (lt) { const mt = lt.match(/^Tonnage ([\d,]+) t$/); if (mt && num(mt[1]) !== Math.round(o.t / 100) / 10) E('evolution.groupe', 'Par groupe : ' + mh[1] + ' ' + lt + ', recalculé ' + f1v(o.t / 1000) + ' t'); } } } }
  const S2 = S['ÉVOLUTION-MODE ▸ sea'];
  if (S2) { const MO = { JANV: '01', 'FÉVR': '02', MARS: '03', AVR: '04', MAI: '05', JUIN: '06', JUIL: '07', 'AOÛT': '08', SEPT: '09', OCT: '10', NOV: '11', 'DÉC': '12' };
    const best = (rs) => rs.reduce((b, x) => (!b || num(x.charge) > b.c || (num(x.charge) === b.c && num(x.reps) > b.r)) ? { c: num(x.charge), r: num(x.reps) } : b, null);
    let cur = null;
    for (let k = 0; k < S2.length; k++) {
      if (/^\d{1,2}$/.test(S2[k]) && MO[S2[k + 1]]) { const mo = MO[S2[k + 1]], an = mo > R.now.slice(5, 7) ? +R.now.slice(0, 4) - 1 : +R.now.slice(0, 4); cur = { d: an + '-' + mo + '-' + S2[k].padStart(2, '0'), sid: S2[k + 2] };
        cur.rs = R.P.filter((r) => r.d === cur.d && String(r.seance_id || 'Séance') === cur.sid);
        const h = S2[k + 3] || '', mh = h.match(/^([\d,]+) t\b.* · (\d+) séries?/);
        if (mh && (num(mh[1]) !== Math.round(cur.rs.reduce((a, r) => a + num(r.charge) * num(r.reps), 0) / 100) / 10 || +mh[2] !== cur.rs.length)) E('evolution.seance', 'Par séance : ' + S2[k] + ' ' + S2[k + 1] + ' « ' + cur.sid + ' » ' + mh[1] + ' t · ' + mh[2] + ' séries, recalculé ' + f1v(cur.rs.reduce((a, r) => a + num(r.charge) * num(r.reps), 0) / 1000) + ' t · ' + cur.rs.length + ' séries');
        k += 3; continue; }
      if (!cur) continue;
      const m = S2[k].match(/^([\d,]+) kg × (\d+)(?: · avant ([\d,]+) kg × (\d+))?$/); if (!m) continue;
      const exo = S2[k - 1], b0 = best(cur.rs.filter((r) => r.exercice === exo)); if (!b0) continue;
      const prevD = R.P.filter((r) => r.exercice === exo && r.d < cur.d).map((r) => r.d).sort().pop(), b1 = prevD ? best(R.P.filter((r) => r.exercice === exo && r.d === prevD)) : null;
      if (num(m[1]) !== b0.c || +m[2] !== b0.r) E('evolution.seance', 'Par séance : ' + fr(cur.d) + ' ' + exo + ' ' + m[1] + ' kg × ' + m[2] + ', meilleure série ' + f1v(b0.c) + ' kg × ' + b0.r);
      if (m[3] != null && (!b1 || num(m[3]) !== b1.c || +m[4] !== b1.r)) E('evolution.seance', 'Par séance : ' + fr(cur.d) + ' ' + exo + ' « avant ' + m[3] + ' kg × ' + m[4] + ' », fois précédente ' + (b1 ? fr(prevD) + ' ' + f1v(b1.c) + ' kg × ' + b1.r : 'aucune'));
      if (m[3] == null && b1) E('evolution.seance', 'Par séance : ' + fr(cur.d) + ' ' + exo + ' sans « avant », fois précédente le ' + fr(prevD));
    } }
}
// ── B24 (21/11). Entraînement : « N séances » et « M exercices » du programme (lignes cardio à part), « N exos » de chaque séance,
// ✓ date (dernière fois cette semaine, fenêtre du réglage semaine) ou « ○ à faire », agenda du mois (jour marqué ⇔ séance ce jour-là).
function verifierEntrainement(R, store, S, out) {
  const E = (code, message) => out.push({ code, gravite: 'erreur', message });
  const L = S['ENTRAINEMENT']; if (!L) return;
  const prog = (store.programme || []).filter((l) => !R.aid || String(l.athlete_id) === R.aid), sids = [...new Set(prog.map((l) => l.seance_id).filter(Boolean))];
  const iP = L.indexOf('MON PROGRAMME');
  if (iP >= 0) { const m1 = (L[iP + 1] || '').match(/^(\d+) séances?$/); if (m1 && +m1[1] !== sids.length) E('entrainement.programme', 'Entraînement : ' + L[iP + 1] + ', programme : ' + sids.length + ' séances');
    const m2 = (L[iP + 2] || '').match(/ · (\d+) exercices?(?: · (\d+) cardio)?$/), nm = prog.filter((l) => l.type !== 'cardio').length, nc = prog.length - nm;
    if (m2 && (+m2[1] !== nm || +(m2[2] || 0) !== nc)) E('entrainement.programme', 'Entraînement : « ' + L[iP + 2] + ' », programme : ' + nm + ' exercices' + (nc ? ' + ' + nc + ' cardio' : '')); }
  const deb = R.semaineType === 'glissant' ? plusJ(R.now, -6) : R.lundi;
  sids.forEach((sid) => { const i = L.indexOf(sid, iP); if (i < 0) return; const d = L[i + 1] || '', tag = L[i + 2] || '';
    const lg = prog.filter((l) => l.seance_id === sid), nm = lg.filter((l) => l.type !== 'cardio').length, nc = lg.length - nm;
    const md = d.match(/(?:^|· )(\d+) exos?\b/), mc = d.match(/(\d+) cardio\b/);
    if ((md ? +md[1] : 0) !== nm || (mc ? +mc[1] : 0) !== nc) E('entrainement.seance', 'Entraînement : ' + sid + ' « ' + d.split(' · ').slice(0, 2).join(' · ') + ' », programme : ' + nm + ' exos' + (nc ? ' + ' + nc + ' cardio' : ''));
    const faits = R.P.filter((r) => String(r.seance_id) === sid && r.d >= deb && r.d <= R.now).map((r) => r.d).sort(), last = faits.pop();
    const mt = tag.match(/^✓ \S+ (\d{1,2})( · libre)?$/);
    if (last && (!mt || +mt[1] !== +last.slice(8, 10))) E('entrainement.coche', 'Entraînement : ' + sid + ' « ' + tag + ' », faite le ' + fr(last));
    if (!last && mt && !mt[2]) E('entrainement.coche', 'Entraînement : ' + sid + ' « ' + tag + ' », pas faite cette semaine'); });
  // Agenda.
  const iA = L.findIndex((l) => /^(Janvier|Février|Mars|Avril|Mai|Juin|Juillet|Août|Septembre|Octobre|Novembre|Décembre) \d{4}$/.test(l)); if (iA < 0) return;
  const [moN, an] = L[iA].split(' '), mo = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'].indexOf(moN.toLowerCase()) + 1;
  const iD = L.findIndex((l, k) => k > iA && l === 'D'); if (iD < 0) return;
  const jours = new Set(R.P.map((r) => r.d)); (R.cardio || []).forEach((o) => jours.add(o.d));
  let inMois = false;
  for (let k = iD + 1; k < L.length; k++) { if (!/^\d{1,2}$/.test(L[k])) continue; const n = +L[k]; if (n === 1) { if (inMois) break; inMois = true; } if (!inMois) continue;
    const d = an + '-' + String(mo).padStart(2, '0') + '-' + String(n).padStart(2, '0'); if (d > R.now) break;
    const lab = L[k + 1] && !/^\d{1,2}$/.test(L[k + 1]) ? L[k + 1] : null;
    if (lab && !jours.has(d)) E('entrainement.agenda', 'Agenda : ' + n + ' ' + moN + ' marqué « ' + lab + ' », aucune séance ce jour-là');
    if (!lab && R.P.some((r) => r.d === d)) E('entrainement.agenda', 'Agenda : ' + n + ' ' + moN + ' sans marque, séance muscu ce jour-là'); }
}
// ── B25 (21/11). « Tes saisies · N/100 » (Résumé) : base de comparaison (séances J-55 → J-28, max 3 → 25), profondeur (séances
// J-27 → J, cible 6 → 25), RPE renseigné (séries avec RPE / séries → 20), questionnaire du jour (jours remplis / séances → 15),
// fourchette de reps (lignes muscu du programme avec une fourchette, catégorie comprise → 15) ; total = somme.
function verifierSaisies(R, store, S, out) {
  const E = (code, message) => out.push({ code, gravite: 'erreur', message });
  const cleS = (r) => r.d + '|' + String(r.seance_id == null ? '' : r.seance_id);
  Object.entries(S).forEach(([nom, L]) => { const i0 = L.findIndex((l) => /^TES SAISIES · \d+\/100$/.test(l)); if (i0 < 0) return;
    const c0 = plusJ(R.now, -27), p0 = plusJ(R.now, -55), cur = R.P.filter((r) => r.d >= c0), prev = R.P.filter((r) => r.d >= p0 && r.d < c0);
    const nC = new Set(cur.map(cleS)).size, nP = new Set(prev.map(cleS)).size, rpeCov = cur.length ? Math.min(1, cur.filter((r) => num(r.rpe) > 0).length / cur.length) : 0;
    const be = new Set((store.bien_etre || []).filter((b) => !R.aid || String(b.athlete_id) === R.aid).map((b) => iso(b.date)).filter((d) => d >= c0 && d <= R.now)).size;
    const lg = R.prog, nF = lg.filter((l) => { const f = R.fourchette(l.exercice, l.seance_id); return num(f.rmin) > 0 && num(f.rmax) > 0; }).length;
    const g = { base: Math.round(Math.min(nP, 3) / 3 * 25), prof: Math.round(Math.min(nC, 6) / 6 * 25), rpe: Math.round(rpeCov * 20), be: Math.round((nC ? Math.min(1, be / nC) : 0) * 15), f: lg.length ? Math.round(nF / lg.length * 15) : 0 };
    const tot = g.base + g.prof + g.rpe + g.be + g.f, J = L.slice(i0).join('\n');
    if (+L[i0].match(/(\d+)\/100/)[1] !== tot) E('saisies.score', nom + ' : ' + L[i0] + ', recalculé ' + tot + '/100 (' + [g.base, g.prof, g.rpe, g.be, g.f].join(' + ') + ')');
    [[/Base de comparaison \((\d+) séances? avant\)\n(\d+)\/25/, nP, g.base], [/Profondeur \((\d+) séances?\)\n(\d+)\/25/, nC, g.prof], [/RPE renseigné \((\d+) %\)\n(\d+)\/20/, Math.round(rpeCov * 100), g.rpe],
     [/Questionnaire du jour \((\d+) jours? remplis? pour \d+ séances?\)\n(\d+)\/15/, be, g.be], [/Fourchette de reps définie \((\d+)\/\d+ exos\)\n(\d+)\/15/, nF, g.f]].forEach(([re, n, pts]) => {
      const m = J.match(re); if (m && (+m[1] !== n || +m[2] !== pts)) E('saisies.critere', nom + ' : « ' + m[0].replace('\n', ' → ') + ' », recalculé ' + n + ' → ' + pts + ' pts'); }); });
}
// ── B26 (21/11). Points (récompenses) : recalcul du barème sur les séries brutes — séance (date + nom) 10, RPE sur toutes ses
// séries 5, séance complète (séries ≥ prévues au programme pour ce nom) 5, questionnaire 3 par jour, record = charge max d'un
// exercice battue (1er passage exclu, 3 max par semaine) 20, objectif de la semaine (séances lun → dim ≥ objectif) 30.
// Contrôle : points gagnés, total et lignes de la semaine servis, et « N pts · +M cette semaine » à l'écran.
function verifierPoints(R, store, ad, S, out) {
  const E = (code, message) => out.push({ code, gravite: 'erreur', message });
  const rec = ad && ad.recompenses; if (!rec || rec.version !== 2) return;
  const B = { seance: 10, rpe: 5, questionnaire: 3, complete: 5, record: 20, recordMaxSem: 3, objectif: 30 };
  const prev = {}; (store.programme || []).filter((l) => (!R.aid || String(l.athlete_id) === R.aid) && l.type !== 'cardio' && l.seance_id).forEach((l) => { prev[String(l.seance_id)] = (prev[String(l.seance_id)] || 0) + num(l.series_prevues); });
  const ev = [], best = {}, recSem = {}, seSem = {}, jours = [...new Set(R.P.map((r) => r.d))].sort();
  jours.forEach((d) => { const rows = R.P.filter((r) => r.d === d), sem = lundiDe(d);
    [...new Set(rows.map((r) => String(r.seance_id || '')))].forEach((sid) => { const rs = rows.filter((r) => String(r.seance_id || '') === sid);
      seSem[sem] = (seSem[sem] || 0) + 1; ev.push({ d, k: 'seance', p: B.seance });
      if (rs.every((r) => num(r.rpe) > 0)) ev.push({ d, k: 'rpe', p: B.rpe });
      if (prev[sid] && rs.length >= prev[sid]) ev.push({ d, k: 'complete', p: B.complete }); });
    const mx = {}; rows.forEach((r) => { const c = num(r.charge); if (r.exercice && c > (mx[r.exercice] || 0)) mx[r.exercice] = c; });
    Object.keys(mx).forEach((e) => { if (best[e] != null && mx[e] > best[e] && (recSem[sem] || 0) < B.recordMaxSem) { recSem[sem] = (recSem[sem] || 0) + 1; ev.push({ d, k: 'record', p: B.record }); } best[e] = Math.max(best[e] || 0, mx[e]); }); });
  new Set((store.bien_etre || []).filter((b) => !R.aid || String(b.athlete_id) === R.aid).map((b) => iso(b.date)).filter(Boolean)).forEach((d) => ev.push({ d, k: 'questionnaire', p: B.questionnaire }));
  const objS = num(ad.dashboard && ad.dashboard.regularite && ad.dashboard.regularite.seances_prevues), obj = Math.max(1, Math.round(objS));
  if (objS > 0) Object.keys(seSem).forEach((sem) => { if (seSem[sem] >= obj) ev.push({ d: sem, k: 'objectif', p: B.objectif }); });
  const gagnes = ev.reduce((a, e) => a + e.p, 0), sem = ev.filter((e) => e.d >= R.lundi), tot = sem.reduce((a, e) => a + e.p, 0);
  if (num(rec.gagnes) !== gagnes) E('points.gagnes', 'Points gagnés servis ' + rec.gagnes + ', recalculés ' + gagnes);
  if (rec.semaine && num(rec.semaine.total) !== tot) E('points.semaine', 'Points de la semaine servis ' + rec.semaine.total + ', recalculés ' + tot);
  ((rec.semaine && rec.semaine.lignes) || []).forEach((l) => { const n = sem.filter((e) => e.k === l.k).length; if (num(l.n) !== n) E('points.ligne', 'Points de la semaine, « ' + l.k + ' » : ' + l.n + ', recalculé ' + n); });
  const solde = gagnes - num(rec.depenses), fmt = (n) => Number(n).toLocaleString('fr-FR').replace(/ | /g, ' ');
  Object.entries(S).forEach(([nom, L]) => L.forEach((l) => { const m = l.replace(/ | /g, ' ').match(/^([\d ]+) pts · ([+−-]?[\d ]+) cette semaine$/); if (!m) return;
    if (num(m[1].replace(/ /g, '')) !== solde || num(m[2].replace(/[ +]/g, '')) !== tot) E('points.ecran', nom + ' : « ' + l + ' », recalculé ' + fmt(solde) + ' pts · +' + fmt(tot) + ' cette semaine'); }));
}
function verifier({ store, appdata, ecrans, now, aid }) {
  const jour = now || ymd(new Date());
  const R = recalculer(store, appdata, jour, aid), out = [];
  if (appdata) verifierDonnees(R, appdata, out);
  if (appdata) verifierTexte(R, appdata, ecrans, out);
  if (ecrans) verifierTendances(R, sections(ecrans), out);
  if (ecrans) verifierEvolution(R, sections(ecrans), out);
  if (ecrans) verifierPoids(store, R.aid, sections(ecrans), out);
  if (ecrans) verifierCardioTendances(R, sections(ecrans), out);
  if (ecrans) verifierResume(R, store, sections(ecrans), out);
  if (ecrans) verifierForce6(R, sections(ecrans), out);
  if (ecrans) verifierEvolutionVues(R, sections(ecrans), out);
  if (ecrans) verifierEvolutionModes(R, store, sections(ecrans), out);
  if (ecrans) verifierEntrainement(R, store, sections(ecrans), out);
  if (ecrans) verifierSaisies(R, store, sections(ecrans), out);
  if (appdata) verifierPoints(R, store, appdata, sections(ecrans || ''), out);
  verifierCoach(store, ecrans, jour, out);
  return out;
}
module.exports = { verifier, recalculer, verifierBilan, verifierMailHtml, verifierIA };

if (require.main === module) {
  const fs = require('fs');
  const [db, ad, ec, j, aidCli] = process.argv.slice(2);
  const res = verifier({ store: JSON.parse(fs.readFileSync(db, 'utf8')), appdata: ad && ad !== '-' ? JSON.parse(fs.readFileSync(ad, 'utf8')) : null, ecrans: ec ? fs.readFileSync(ec, 'utf8') : '', now: j, aid: aidCli });
  if (!res.length) console.log('✓ aucun écart'); else res.forEach((x) => console.log('✗ [' + x.code + '] ' + x.message));
  process.exit(res.length ? 1 : 0);
}
