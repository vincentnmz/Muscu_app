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
  return R;
}

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
