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

function recalculer(store, appdata, now) {
  const aid = String((store.athletes && store.athletes[0] && store.athletes[0].id) || '');
  const P = (store.performances || []).filter((r) => !aid || String(r.athlete_id) === aid).map((r) => ({ ...r, d: iso(r.date) })).filter((r) => r.d && r.d <= now);
  const R = {};
  // Records : meilleure série à vie (charge, puis reps), datée de la PREMIÈRE fois où elle a été atteinte.
  R.records = {};
  for (const r of P.slice().sort((a, b) => a.d.localeCompare(b.d))) {
    const c = num(r.charge), n = num(r.reps), x = R.records[r.exercice];
    if (!x || c > x.charge || (c === x.charge && n > x.reps)) R.records[r.exercice] = { charge: c, reps: n, date: r.d };
  }
  // Séances = jours distincts.
  const jours = (a, b) => new Set(P.filter((r) => r.d >= a && r.d <= b).map((r) => r.d)).size;
  R.lundi = lundiDe(now);
  R.seancesSemaine = jours(R.lundi, now);
  R.seancesJ7 = jours(plusJ(now, -6), now);
  // Tonnage (t, 1 décimale) : 7 derniers jours et les 7 d'avant.
  const ton = (a, b) => P.filter((r) => r.d >= a && r.d <= b).reduce((s, r) => s + num(r.charge) * num(r.reps), 0);
  R.tonJ7 = Math.round(ton(plusJ(now, -6), now) / 100) / 10;
  R.tonJ7prec = Math.round(ton(plusJ(now, -13), plusJ(now, -7)) / 100) / 10;
  // Volume par muscle (séries ; muscle secondaire = 0,5) sur la fenêtre du réglage « semaine ».
  R.semaineType = (appdata && appdata.semaine_type) === 'glissant' ? 'glissant' : 'calendaire';
  const debVol = R.semaineType === 'glissant' ? plusJ(now, -6) : R.lundi;
  const sec = {}; (store.exercices || []).forEach((e) => { if (e && e.exercice && e.muscle_secondaire) sec[String(e.exercice).trim().toLowerCase()] = e.muscle_secondaire; });
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
  R.nbSeances = new Set(P.map((r) => r.d)).size;
  // Par exercice et par jour : meilleure série (charge, puis reps) et nombre de séries.
  R.parExoJour = {};
  for (const r of P) {
    const k = r.exercice + '|' + r.d, x = R.parExoJour[k] || (R.parExoJour[k] = { best: null, n: 0, series: [] });
    x.n++; x.series.push(r);
    if (!x.best || num(r.charge) > num(x.best.charge) || (num(r.charge) === num(x.best.charge) && num(r.reps) > num(x.best.reps))) x.best = r;
  }
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
  // Séances par exercice (récent → ancien) : séries brutes du jour, meilleure série (charge, puis reps).
  R.sessions = {};
  Object.values(R.parExoJour).forEach((x) => { const e = x.series[0].exercice; (R.sessions[e] = R.sessions[e] || []).push({ d: x.series[0].d, best: x.best, series: x.series.slice().sort((a, b) => num(a.serie) - num(b.serie) || num(a.id) - num(b.id)) }); });
  Object.values(R.sessions).forEach((a) => a.sort((x, y) => y.d.localeCompare(x.d)));
  // Fourchette de reps : programme ; une catégorie (moyen / gros 6-12, petit 8-20) ne remplace que la fourchette par défaut 8-12.
  const cats = (store.athletes && store.athletes[0] && store.athletes[0].prefs && store.athletes[0].prefs.exo_categories) || (appdata && appdata.exo_categories) || {};
  const CAT = { gros: [6, 12], moyen: [6, 12], petit: [8, 20] };
  R.fourchette = (exo) => {
    const pl = (store.programme || []).filter((l) => (!aid || String(l.athlete_id) === aid) && String(l.exercice || '').trim() === String(exo).trim() && l.type !== 'cardio')[0];
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
    const m = l.match(/(^|[\s(])(\d+\.\d+)(?=\s?(kg|t\b|×|\/|%|séries|bpm|h\b|min\b)|\s*$)/);
    if (m && !/^\d{1,2}\.\d{2}$/.test(m[2]) && !/v\d|version/i.test(l)) E('format.decimal', nom + ' : « ' + l.trim().slice(0, 80) + ' » (point au lieu de virgule)');
  }));
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
      if ((m = l.match(/^Records? : (.+)$/))) m[1].split(/ · |, (?=[A-ZÉÈÀ])/).forEach((it) => { const e = exoDe(it.trim()); const k = e && it.trim().slice(e.length).match(/^ ([\d,]+)(?: kg)? × (\d+)$/); if (k) { const x = record(e, kgN(k[1]), +k[2]); ctrl('classement.record', nom, e + ' ' + it.trim().slice(e.length), !x, x); } });
      if ((m = l.match(/^Progresse : (.+)$/))) m[1].split(' · ').forEach((it) => { const e = exoDe(it.trim()); if (e) { const x = progres(e, it.trim().slice(e.length).trim()); ctrl('classement.progres', nom, it.trim(), !x, x); } });
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

function verifier({ store, appdata, ecrans, now }) {
  const jour = now || ymd(new Date());
  const R = recalculer(store, appdata, jour), out = [];
  verifierDonnees(R, appdata, out);
  verifierTexte(R, appdata, ecrans, out);
  return out;
}
module.exports = { verifier, recalculer };

if (require.main === module) {
  const fs = require('fs');
  const [db, ad, ec, j] = process.argv.slice(2);
  const res = verifier({ store: JSON.parse(fs.readFileSync(db, 'utf8')), appdata: JSON.parse(fs.readFileSync(ad, 'utf8')), ecrans: ec ? fs.readFileSync(ec, 'utf8') : '', now: j });
  if (!res.length) console.log('✓ aucun écart'); else res.forEach((x) => console.log('✗ [' + x.code + '] ' + x.message));
  process.exit(res.length ? 1 : 0);
}
