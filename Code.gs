[Resource from github at repo://vincentnmz/Muscu_app/sha/8db2a8cec93b224dd97629692b20c54dfdefb935/contents/Code.gs] // =============================================================================
// NOVALYZ — Code.gs
// Architecture 3 moteurs : GLOBAL_ENGINE | RECENT_ENGINE | COMPARISON_ENGINE
// =============================================================================

const SS = SpreadsheetApp.getActiveSpreadsheet();

// =============================================================================
// CONSTANTES GLOBALES
// =============================================================================

const WINDOWS = {
  ACUTE:   7,   // charge aiguë
  MID:    14,
  CHRONIC: 28,  // charge chronique
  LONG:   56
};

const ACWR_THRESHOLDS = {
  SOUS_CHARGE:   0.8,
  OPTIMAL_MAX:   1.3,
  SURCHARGE:     1.5
};

const RPE_THRESHOLDS = {
  MODERE: 7.5,
  ELEVE:  8.5
};

// =============================================================================
// ROUTING
// =============================================================================

function doGet(e) {
  const action = e.parameter.action;
  if (action === 'login')                return login(e);
  if (action === 'register')             return register(e);
  if (action === 'getAppData')           return getAppData(e);
  if (action === 'getLastPerf')          return getLastPerf(e);
  if (action === 'exercices')            return getExercices();
  if (action === 'debug')                return debug(e);
  if (action === 'debugCoach')           return debugCoach(e);
  if (action === 'loginCoach')           return loginCoach(e);
  if (action === 'getCoachAthletes')     return getCoachAthletes(e);
  if (action === 'getCoachAthleteDetail') return getCoachAthleteDetail(e);
  if (action === 'getCommentaires')      return getCommentaires(e);
  if (action === 'getCoachProgramme')    return getCoachProgramme(e);
  if (action === 'getSeancesDetail')     return getSeancesDetail(e);
  if (action === 'getAlertesTraitees')   return getAlertesTraitees(e);
  if (action === 'getBilanPDF')          return getBilanPDF(e);
  if (action === 'lierAthlete')          return lierAthlete(e);
  if (action === 'getSuiviEquipe')       return getSuiviEquipe(e);
  if (action === 'getSuiviJoueur')       return getSuiviJoueur(e);
  if (action === 'getTests')             return getTests(e);
  return json({ error: 'action inconnue' });
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  if (body.action === 'login')                 return loginPost(body);
  if (body.action === 'register')              return registerPost(body);
  if (body.action === 'registerCoach')         return registerCoach({ parameter: body });
  if (body.action === 'supprimerCompte')       return supprimerCompte(body);
  if (body.action === 'coachCreerAthlete')     return coachCreerAthlete(body);
  if (body.action === 'saveSportCoach')        return saveSportCoach(body);
  if (body.action === 'saveTest')              return saveTest(body);
  if (body.action === 'loginCoach')            return loginCoachPost(body);
  if (body.action === 'saveSeance')            return saveSeance(body.data);
  if (body.action === 'saveCommentaire')       return saveCommentaire(body);
  if (body.action === 'marquerCommentairesLus') return marquerCommentairesLus(body);
  if (body.action === 'supprimerCommentaire')  return supprimerCommentaire(body);
  if (body.action === 'saveObjectif')          return saveObjectif(body);
  if (body.action === 'savePoids')             return savePoids(body);
  if (body.action === 'saveNote')              return saveNote(body);
  if (body.action === 'saveProgrammeLigne')    return saveProgrammeLigne(body);
  if (body.action === 'supprimerProgrammeLigne') return supprimerProgrammeLigne(body);
  if (body.action === 'deleteCoach')             return deleteCoachPost(body);
  if (body.action === 'saveBienEtre')            return saveBienEtre(body);
  if (body.action === 'setPauseAthlete')         return setPauseAthlete(body);
  if (body.action === 'marquerAlerteTraitee')    return marquerAlerteTraiteePost(body);
  if (body.action === 'saveObjectifJoueur')      return saveObjectifJoueur(body);
  if (body.action === 'deleteObjectifJoueur')    return deleteObjectifJoueur(body);
  if (body.action === 'saveBlessure')            return saveBlessure(body);
  if (body.action === 'deleteBlessure')          return deleteBlessure(body);
  if (body.action === 'saveMatch')               return saveMatch(body);
  if (body.action === 'saveBilanAthlete')        return saveBilanAthlete(body);
  return json({ error: 'action inconnue' });
}

// =============================================================================
// ALERTES TRAITÉES (persistées par coach + semaine)
// =============================================================================
function _fmtSemaine(v) {
  // Google Sheets peut auto-convertir '2026-07-13' en Date → on reformate en yyyy-MM-dd
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v);
}
function getAlertesTraitees(e) {
  const coach_id = e.parameter.coach_id;
  const sheet = SS.getSheetByName('AlertesTraitees');
  if (!sheet) return json({ traitees: {} });
  const rows = sheet.getDataRange().getValues();
  const traitees = {};
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) !== String(coach_id)) continue;
    traitees[String(rows[i][1])] = _fmtSemaine(rows[i][2]); // cle -> semaine (yyyy-MM-dd)
  }
  return json({ traitees: traitees });
}
function marquerAlerteTraiteePost(body) {
  let sheet = SS.getSheetByName('AlertesTraitees');
  if (!sheet) { sheet = SS.insertSheet('AlertesTraitees'); sheet.appendRow(['coach_id', 'cle', 'semaine']); }
  const rows = sheet.getDataRange().getValues();
  let found = false;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(body.coach_id) && String(rows[i][1]) === String(body.cle)) {
      sheet.getRange(i + 1, 3).setValue(body.semaine || '');
      found = true; break;
    }
  }
  if (!found) sheet.appendRow([body.coach_id, body.cle, body.semaine || '']);
  return json({ success: true });
}

// =============================================================================
// MODE PAUSE / VACANCES (posé par l'athlète) — coupe les alertes d'absence
// =============================================================================
function _isoToDate(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]); d.setHours(0, 0, 0, 0); return d;
}
function _fmtJour(v) {
  // Sheets peut auto-convertir 'yyyy-MM-dd' en Date → on reformate proprement
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return v ? String(v) : '';
}
function lirePause(athlete_id) {
  const sheet = SS.getSheetByName('Pauses');
  if (!sheet) return null;
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(athlete_id)) {
      const debut = _fmtJour(rows[i][1]);
      const fin   = _fmtJour(rows[i][2]);
      return (debut || fin) ? { debut: debut, fin: fin } : null;
    }
  }
  return null;
}
function athleteEnPause(athlete_id, dateRef) {
  const p = lirePause(athlete_id);
  if (!p) return false;
  const ref = dateRef ? new Date(dateRef) : new Date(); ref.setHours(0, 0, 0, 0);
  const d = _isoToDate(p.debut), f = _isoToDate(p.fin);
  if (d && ref < d) return false;
  if (f && ref > f) return false;
  return !!(d || f);
}
function setPauseAthlete(body) {
  let sheet = SS.getSheetByName('Pauses');
  if (!sheet) { sheet = SS.insertSheet('Pauses'); sheet.appendRow(['athlete_id', 'debut', 'fin']); }
  const rows  = sheet.getDataRange().getValues();
  const debut = body.debut || '';
  const fin   = body.fin || '';
  let found = false;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(body.athlete_id)) {
      sheet.getRange(i + 1, 2).setValue(debut);
      sheet.getRange(i + 1, 3).setValue(fin);
      found = true; break;
    }
  }
  if (!found) sheet.appendRow([body.athlete_id, debut, fin]);
  try { CacheService.getScriptCache().remove('appdata_' + body.athlete_id); } catch (ex) {}
  return json({ success: true });
}

// =============================================================================
// POINT D'ENTRÉE PRINCIPAL — getAppData
// =============================================================================

// =============================================================================
// SPORT (Phase 2) — Option A : le sport est porté par le COACH ; l'athlète en
// hérite. Colonne `sport` en Coachs[4] (col. E ; D = password_hash).
// Défaut 'muscu' si absent → aucune casse.
// =============================================================================
function lireSportCoach(coach_id) {
  try {
    var rows = SS.getSheetByName('Coachs').getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(coach_id))
        return String(rows[i][4] || '').trim() || 'muscu';
    }
  } catch (ex) {}
  return 'muscu';
}
function lireSportAthlete(athlete_id) {
  try {
    var rows = SS.getSheetByName('Athletes').getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(athlete_id)) {
        var coachId = String(rows[i][8] || '');
        if (coachId) return lireSportCoach(coachId);            // a un coach → hérite de son sport
        return String(rows[i][10] || '').trim() || 'muscu';     // sinon → sport auto-déclaré (col K)
      }
    }
  } catch (ex) {}
  return 'muscu';
}

// Enregistre le sport du coach en col E (Phase 3 — sélecteur dans l'app).
function saveSportCoach(body) {
  var coach_id = String(body.coach_id || '');
  var sport = String(body.sport || 'muscu').trim() || 'muscu';
  if (!coach_id) return json({ success: false, error: 'coach_id manquant' });
  var sheet = SS.getSheetByName('Coachs');
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === coach_id) {
      sheet.getRange(i + 1, 5).setValue(sport);   // col E = sport
      // Athlètes de ce coach : sport hérité → on met à jour leur col K (lisibilité) + vide le cache.
      try {
        var shAth = SS.getSheetByName('Athletes');
        var ra = shAth.getDataRange().getValues();
        var cache = CacheService.getScriptCache();
        for (var k = 1; k < ra.length; k++) {
          if (String(ra[k][8]) === coach_id) {
            shAth.getRange(k + 1, 11).setValue(sport);   // col K = sport
            cache.remove('appdata_' + ra[k][0]);
          }
        }
      } catch (e) {}
      return json({ success: true, sport: sport });
    }
  }
  return json({ success: false, error: 'Coach introuvable' });
}

function getAppData(e) {
  const athlete_id = e.parameter.athlete_id;

  // nocache/fresh : forcer un recalcul (ex. après une modif manuelle du Sheet)
  const forceFresh = !!(e.parameter.nocache || e.parameter.fresh);
  const cache = CacheService.getScriptCache();
  const cacheKey = 'appdata_' + athlete_id;
  if (!forceFresh) {
    const cached = cache.get(cacheKey);
    if (cached) return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);
  }

  // Chargement des feuilles
  const rows     = SS.getSheetByName('Performances').getDataRange().getValues();
  const rowsProg = SS.getSheetByName('Programme').getDataRange().getValues();
  const rowsObj  = SS.getSheetByName('Objectif').getDataRange().getValues();
  const sheetVol = SS.getSheetByName('Volume obti');
  const rowsVol  = sheetVol ? sheetVol.getDataRange().getValues() : [];
  const rowsPoids = SS.getSheetByName('Poids_historique').getDataRange().getValues();
  const rowsExo  = SS.getSheetByName('Exercices').getDataRange().getValues();

  // Muscles secondaires
  const muscleSecMap = buildMuscleSecMap(rowsExo);

  const maintenant = new Date();

  // =========================================================================
  // APPEL DES TROIS MOTEURS
  // =========================================================================
  const globalData     = computeGlobal(rows, athlete_id, muscleSecMap, rowsVol);
  const recentData     = computeRecent(rows, athlete_id, maintenant);
  const comparisonData = computeComparison(rows, athlete_id, maintenant);

  // Données complémentaires
  let seancesPrevues = 0;
  for (let i = 1; i < rowsObj.length; i++) {
    if (rowsObj[i][0] == athlete_id) { seancesPrevues = Number(rowsObj[i][5]) || 0; break; }
  }

  const lundi     = getLundi(maintenant);
  const prochaine = getProchaineSeance(rows, athlete_id, rowsProg, lundi);
  const volumeSemaine = computeVolumeSemaine(rows, athlete_id, rowsVol, lundi, muscleSecMap);

  const poids = buildPoids(rowsPoids, athlete_id);
  const programme = buildProgramme(rowsProg, athlete_id);

  const result = {
    // ─── 3 moteurs ───────────────────────────────────────────────────────────
    global:     globalData,
    recent:     recentData,
    comparison: comparisonData,

    // ─── Dashboard synthétique (rétrocompatibilité + coach home) ─────────────
    dashboard: {
      derniere_seance:  recentData.derniere_seance,
      prochaine_seance: prochaine,
      regularite: {
        seances_j7:      recentData.j7.seances,
        seances_prevues: seancesPrevues,
        frequence_semaine: recentData.j7.frequence_semaine
      },
      tonnage: {
        j7:        recentData.j7.tonnage,
        j7_prec:   comparisonData.j7_vs_j7prec.tonnage.precedent,
        evol_pct:  comparisonData.j7_vs_j7prec.tonnage.evol_pct,
        tendance:  comparisonData.j7_vs_j7prec.tonnage.tendance
      },
      muscle_retard: globalData.muscle_retard,
      acwr:          recentData.acwr.valeur,
      progression: (function() {
        const details = comparisonData.j7_vs_j7prec.charge_details || [];
        return {
          en_progression: details.filter(d => d.up).length,
          en_baisse:      details.filter(d => d.down).length,
          details:        details
        };
      })(),
      records_mois: globalData.records_30j || 0
    },

    // ─── Historique (graphiques) ──────────────────────────────────────────────
    historique: {
      dates_seances:    buildDatesSeancesMap(rows, athlete_id),
      exercices:        globalData.exercices,
      progression_par_exo: globalData.progression_par_exo,
      volume_semaine:   volumeSemaine,
      volume_par_jour:  recentData.volume_par_jour
    },

    poids,
    programme,

    // ─── Bien-être (questionnaires récents pour le bloc « État du jour ») ─────
    bien_etre: buildBienEtre(athlete_id),

    // ─── Mode pause / vacances (posé par l'athlète) ──────────────────────────
    pause: lirePause(athlete_id),

    // ─── Sport actif (Phase 2) — hérité du coach, 'muscu' par défaut ─────────
    sport: lireSportAthlete(athlete_id)
  };

  const resultStr = JSON.stringify(result);
  try { cache.put(cacheKey, resultStr, 600); } catch (ex) {}
  return ContentService.createTextOutput(resultStr).setMimeType(ContentService.MimeType.JSON);
}

// =============================================================================
// GLOBAL_ENGINE
// Utilise 100 % de l'historique — ces valeurs ne repartent jamais à zéro.
// =============================================================================

function computeGlobal(rows, athlete_id, muscleSecMap, rowsVol) {
  const seancesSet    = new Set();
  let totalSeries = 0, totalReps = 0, tonnageTotal = 0;
  const progressionParExo  = {};
  const recordsParExo      = {};
  const seriesParMuscle    = {};
  const seriesParMuscle4sem = {};
  const exercicesSet       = new Set();
  const maintenant         = new Date();
  const quatreSemainesDebut = new Date(maintenant);
  quatreSemainesDebut.setDate(maintenant.getDate() - 28);
  const trentaJoursDebut = new Date(maintenant);
  trentaJoursDebut.setDate(maintenant.getDate() - 30);
  const recordsParExoRef   = {};  // charge max de référence pour détecter battu ce mois-ci
  let records30j = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[4]) !== String(athlete_id)) continue;
    const dateRow = parseDateFR(row[0]);
    if (!dateRow) continue;
    const dateStr  = formatDateFR(dateRow);
    const exo      = String(row[5]);
    const muscle   = String(row[6]);
    const seanceId = String(row[2]);
    const charge   = Number(row[9]) || 0;
    const reps     = Number(row[10]) || 0;
    const muscleSec = muscleSecMap[exo] || null;

    seancesSet.add(dateStr);
    totalSeries++;
    totalReps += reps;
    tonnageTotal += charge * reps;
    exercicesSet.add(exo);

    // Séries par muscle (tout temps)
    accMuscle(seriesParMuscle, muscle, 1);
    if (muscleSec) accMuscle(seriesParMuscle, muscleSec, 0.5);

    // Séries par muscle sur 4 semaines (pour muscle en retard)
    if (dateRow >= quatreSemainesDebut) {
      accMuscle(seriesParMuscle4sem, muscle, 1);
      if (muscleSec) accMuscle(seriesParMuscle4sem, muscleSec, 0.5);
    }

    // Meilleure perf par jour (pour graphique progression)
    if (!progressionParExo[exo]) progressionParExo[exo] = {};
    const ex = progressionParExo[exo][dateStr];
    if (!ex || charge > ex.charge || (charge === ex.charge && reps > ex.reps)) {
      progressionParExo[exo][dateStr] = { date: dateStr, seance: seanceId, charge, reps };
    }

    // Record all-time + comptage records 30j
    const estRecent = dateRow >= trentaJoursDebut;
    if (!estRecent) {
      // Avant la fenêtre 30j : sert de référence
      if (!recordsParExoRef[exo] || charge > recordsParExoRef[exo]) recordsParExoRef[exo] = charge;
    }
    if (!recordsParExo[exo] || charge > recordsParExo[exo].charge ||
        (charge === recordsParExo[exo].charge && reps > recordsParExo[exo].reps)) {
      recordsParExo[exo] = { charge, reps, date: dateStr };
      // Record battu dans la période 30j ?
      if (estRecent && recordsParExoRef[exo] && charge > recordsParExoRef[exo]) records30j++;
    }
  }

  // Progression : trier par date décroissante, garder 8 entrées
  const progressionFinale = {};
  Object.keys(progressionParExo).forEach(exo => {
    progressionFinale[exo] = Object.values(progressionParExo[exo])
      .sort((a, b) => parseDateFR(b.date) - parseDateFR(a.date))
      .slice(0, 8);
  });

  // Muscle en retard sur 4 semaines
  const muscleRetard = computeMuscleRetard(seriesParMuscle4sem, rowsVol);

  return {
    source:        'GLOBAL_ENGINE',
    total_seances: seancesSet.size,
    total_series:  totalSeries,
    total_reps:    totalReps,
    tonnage_total_kg: tonnageTotal,
    exercices:     [...exercicesSet].sort(),
    progression_par_exo: progressionFinale,
    records_par_exo:     recordsParExo,
    series_par_muscle:   seriesParMuscle,
    muscle_retard:       muscleRetard,
    records_30j:         records30j
  };
}

function accMuscle(map, muscle, val) {
  if (!map[muscle]) map[muscle] = 0;
  map[muscle] += val;
}

function computeMuscleRetard(seriesParMuscle4sem, rowsVol) {
  let muscleRetard = null, maxRetard = 0;
  for (let i = 1; i < rowsVol.length; i++) {
    const muscle      = String(rowsVol[i][0]);
    const seriesMin4  = Number(rowsVol[i][1]) * 4;
    const seriesOpt4  = Number(rowsVol[i][2]) * 4;
    const faites      = seriesParMuscle4sem[muscle] || 0;
    const retard      = seriesOpt4 - faites;
    if (retard > maxRetard && faites < seriesMin4) {
      maxRetard = retard;
      muscleRetard = {
        muscle,
        series_faites:   Math.round(faites * 10) / 10,
        series_min:      seriesMin4,
        series_optimale: seriesOpt4
      };
    }
  }
  return muscleRetard;
}

// =============================================================================
// RECENT_ENGINE
// =============================================================================

function computeRecent(rows, athlete_id, maintenant) {
  const j7Start  = dateMinusDays(maintenant, WINDOWS.ACUTE);
  const j14Start = dateMinusDays(maintenant, WINDOWS.MID);
  const j28Start = dateMinusDays(maintenant, WINDOWS.CHRONIC);

  const acc = {
    j7:  initWindowAcc(),
    j14: initWindowAcc(),
    j28: initWindowAcc()
  };

  const volumeParJour = {};
  let derniereDate = null, derniereSeanceId = null;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[4]) !== String(athlete_id)) continue;
    const dateRow = parseDateFR(row[0]);
    if (!dateRow) continue;
    const dateStr = formatDateFR(dateRow);
    const charge  = Number(row[9]) || 0;
    const reps    = Number(row[10]) || 0;
    const rpe     = Number(row[11]) || 0;
    const seanceId = String(row[2]);
    const tonnage = charge * reps;

    if (!derniereDate || dateRow > derniereDate) {
      derniereDate    = dateRow;
      derniereSeanceId = seanceId;
    }

    const dateKey = formatDateYMD(dateRow);
    if (!volumeParJour[dateKey]) volumeParJour[dateKey] = 0;
    volumeParJour[dateKey] += tonnage;

    if (dateRow >= j7Start)  fillWindowAcc(acc.j7,  dateStr, charge, reps, rpe, tonnage);
    if (dateRow >= j14Start) fillWindowAcc(acc.j14, dateStr, charge, reps, rpe, tonnage);
    if (dateRow >= j28Start) fillWindowAcc(acc.j28, dateStr, charge, reps, rpe, tonnage);
  }

  const j7  = finalizeWindow(acc.j7,  WINDOWS.ACUTE,   volumeParJour, maintenant);
  const j14 = finalizeWindow(acc.j14, WINDOWS.MID,     volumeParJour, maintenant);
  const j28 = finalizeWindow(acc.j28, WINDOWS.CHRONIC, volumeParJour, maintenant);

  const acwrVal = j28.tonnage_kg > 0
    ? Math.round(j7.tonnage_kg / (j28.tonnage_kg / 4) * 100) / 100
    : null;
  const acwrStatut = acwrVal === null          ? 'inconnu'
    : acwrVal < ACWR_THRESHOLDS.SOUS_CHARGE    ? 'sous_charge'
    : acwrVal <= ACWR_THRESHOLDS.OPTIMAL_MAX   ? 'optimal'
    : acwrVal <= ACWR_THRESHOLDS.SURCHARGE     ? 'surcharge'
    : 'danger';

  return {
    source:          'RECENT_ENGINE',
    derniere_seance: derniereDate ? buildDerniereSeance(rows, athlete_id, derniereDate, derniereSeanceId) : null,
    j7, j14, j28,
    acwr:            { valeur: acwrVal, statut: acwrStatut },
    volume_par_jour: volumeParJour
  };
}

function initWindowAcc() {
  return { dates: new Set(), series: 0, reps: 0, tonnage_kg: 0, rpe_total: 0, rpe_count: 0 };
}

function fillWindowAcc(w, dateStr, charge, reps, rpe, tonnage) {
  w.dates.add(dateStr);
  w.series++;
  w.reps    += reps;
  w.tonnage_kg += tonnage;
  if (rpe > 0) { w.rpe_total += rpe; w.rpe_count++; }
}

function finalizeWindow(w, nbJours, volumeParJour, maintenant) {
  const seances           = w.dates.size;
  const rpe_moyen         = w.rpe_count > 0 ? Math.round(w.rpe_total / w.rpe_count * 10) / 10 : null;
  const frequence_semaine = Math.round(seances / (nbJours / 7) * 10) / 10;
  const tonnage_t         = Math.round(w.tonnage_kg / 100) / 10;

  const loads = [];
  for (let d = 0; d < nbJours; d++) {
    const day = dateMinusDays(maintenant, nbJours - d - 1);
    const key = formatDateYMD(day);
    loads.push(volumeParJour[key] || 0);
  }
  const mean = loads.reduce((s, v) => s + v, 0) / loads.length;
  const std  = Math.sqrt(loads.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / loads.length);
  const monotonie = (std > 0 && seances > 0) ? Math.round(mean / std * 100) / 100 : null;
  const strain    = (monotonie !== null)       ? Math.round(mean * nbJours * monotonie) : null;

  return {
    seances,
    series:           w.series,
    reps:             w.reps,
    tonnage:          tonnage_t,
    tonnage_kg:       w.tonnage_kg,
    rpe_moyen,
    frequence_semaine,
    monotonie,
    strain
  };
}

function buildDerniereSeance(rows, athlete_id, derniereDate, derniereSeanceId) {
  const dateStr = Utilities.formatDate(derniereDate, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  const nbExos  = new Set();
  let nbSeries = 0, totalRpe = 0, countRpe = 0, tonnageKg = 0;
  const refStr  = formatDateFR(derniereDate);
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][4]) !== String(athlete_id)) continue;
    const d = parseDateFR(rows[i][0]);
    if (!d || formatDateFR(d) !== refStr) continue;
    nbExos.add(String(rows[i][5]));
    nbSeries++;
    if (rows[i][11]) { totalRpe += Number(rows[i][11]); countRpe++; }
    const charge = Number(rows[i][9]) || 0;
    const reps   = Number(rows[i][10]) || 0;
    tonnageKg += charge * reps;
  }
  return {
    seance_id:    derniereSeanceId,
    date:         dateStr,
    nb_exercices: nbExos.size,
    nb_series:    nbSeries,
    rpe_moyen:    countRpe > 0 ? (totalRpe / countRpe).toFixed(1) : 'N/A',
    tonnage_kg:   Math.round(tonnageKg),
    tonnage_t:    Math.round(tonnageKg / 100) / 10
  };
}

// =============================================================================
// COMPARISON_ENGINE
// =============================================================================

function computeComparison(rows, athlete_id, maintenant) {
  const j7Start  = dateMinusDays(maintenant, 7);
  const j14Start = dateMinusDays(maintenant, 14);
  const j28Start = dateMinusDays(maintenant, 28);
  const j56Start = dateMinusDays(maintenant, 56);

  const acc = {
    curr7:  initCompAcc(),
    prev7:  initCompAcc(),
    curr28: initCompAcc(),
    prev28: initCompAcc()
  };
  const chargeExo = {
    curr7: {}, prev7: {}, curr28: {}, prev28: {}
  };

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[4]) !== String(athlete_id)) continue;
    const dateRow = parseDateFR(row[0]);
    if (!dateRow) continue;
    const charge  = Number(row[9]) || 0;
    const reps    = Number(row[10]) || 0;
    const rpe     = Number(row[11]) || 0;
    const exo     = String(row[5]);
    const tonnage = charge * reps;
    const dateStr = formatDateFR(dateRow);

    if (dateRow >= j7Start) {
      fillCompAcc(acc.curr7, dateStr, tonnage, rpe);
      if (charge > 0) addExoCharge(chargeExo.curr7, exo, charge);
    } else if (dateRow >= j14Start) {
      fillCompAcc(acc.prev7, dateStr, tonnage, rpe);
      if (charge > 0) addExoCharge(chargeExo.prev7, exo, charge);
    }

    if (dateRow >= j28Start) {
      fillCompAcc(acc.curr28, dateStr, tonnage, rpe);
      if (charge > 0) addExoCharge(chargeExo.curr28, exo, charge);
    } else if (dateRow >= j56Start) {
      fillCompAcc(acc.prev28, dateStr, tonnage, rpe);
      if (charge > 0) addExoCharge(chargeExo.prev28, exo, charge);
    }
  }

  return {
    source:          'COMPARISON_ENGINE',
    j7_vs_j7prec:   buildComparison(acc.curr7,  acc.prev7,  chargeExo.curr7,  chargeExo.prev7),
    j28_vs_j28prec: buildComparison(acc.curr28, acc.prev28, chargeExo.curr28, chargeExo.prev28)
  };
}

function initCompAcc() {
  return { dates: new Set(), tonnage_kg: 0, rpe_total: 0, rpe_count: 0, series: 0 };
}

function fillCompAcc(acc, dateStr, tonnage, rpe) {
  acc.dates.add(dateStr);
  acc.tonnage_kg += tonnage;
  acc.series++;
  if (rpe > 0) { acc.rpe_total += rpe; acc.rpe_count++; }
}

function addExoCharge(map, exo, charge) {
  if (!map[exo]) map[exo] = { sum: 0, count: 0 };
  map[exo].sum += charge;
  map[exo].count++;
}

function buildComparison(curr, prev, chargeExoCurr, chargeExoPrev) {
  const seancesCurr  = curr.dates.size;
  const seancesPrev  = prev.dates.size;
  const tonCurr      = Math.round(curr.tonnage_kg / 100) / 10;
  const tonPrev      = Math.round(prev.tonnage_kg / 100) / 10;
  const rpeCurr      = curr.rpe_count > 0 ? Math.round(curr.rpe_total / curr.rpe_count * 10) / 10 : null;
  const rpePrev      = prev.rpe_count > 0 ? Math.round(prev.rpe_total / prev.rpe_count * 10) / 10 : null;

  const pctParExo = [];
  Object.keys(chargeExoCurr).forEach(exo => {
    if (chargeExoPrev[exo] && chargeExoPrev[exo].count > 0 && chargeExoCurr[exo].count > 0) {
      const avant = chargeExoPrev[exo].sum / chargeExoPrev[exo].count;
      const apres = chargeExoCurr[exo].sum / chargeExoCurr[exo].count;
      if (avant > 0) pctParExo.push((apres - avant) / avant * 100);
    }
  });
  const chargeEvolPct = pctParExo.length > 0
    ? Math.round(pctParExo.reduce((s, v) => s + v, 0) / pctParExo.length)
    : null;

  const chargeDetails = [];
  Object.keys(chargeExoCurr).forEach(exo => {
    const c = chargeExoCurr[exo];
    const p = chargeExoPrev[exo];
    const avgCurr = c.sum / c.count;
    const avgPrev = p && p.count > 0 ? p.sum / p.count : null;
    if (avgPrev === null) return;
    const evolPct = Math.round((avgCurr - avgPrev) / avgPrev * 100);
    const variation = evolPct > 0 ? '+' + evolPct + '%' : evolPct + '%';
    chargeDetails.push({ exercice: exo, variation, up: evolPct >= 2, down: evolPct <= -2 });
  });
  chargeDetails.sort((a, b) => {
    const va = a.up ? 1 : a.down ? -1 : 0;
    const vb = b.up ? 1 : b.down ? -1 : 0;
    return vb - va;
  });

  return {
    seances: {
      courant:   seancesCurr,
      precedent: seancesPrev,
      diff:      seancesCurr - seancesPrev,
      evol_pct:  seancesPrev > 0 ? Math.round((seancesCurr - seancesPrev) / seancesPrev * 100) : null,
      tendance:  tendance(seancesCurr, seancesPrev, 10)
    },
    tonnage: {
      courant:   tonCurr,
      precedent: tonPrev,
      diff:      Math.round((tonCurr - tonPrev) * 10) / 10,
      evol_pct:  tonPrev > 0 ? Math.round((tonCurr - tonPrev) / tonPrev * 100) : null,
      tendance:  tendance(tonCurr, tonPrev, 5)
    },
    charge: {
      evol_pct: chargeEvolPct,
      tendance: chargeEvolPct === null   ? 'inconnu'
               : chargeEvolPct >= 2     ? 'amelioration'
               : chargeEvolPct <= -10   ? 'diminution'
               : 'stable'
    },
    rpe: {
      courant:   rpeCurr,
      precedent: rpePrev,
      diff:      (rpeCurr !== null && rpePrev !== null) ? Math.round((rpeCurr - rpePrev) * 10) / 10 : null,
      tendance:  (rpeCurr !== null && rpePrev !== null)
                 ? (rpeCurr > rpePrev + 0.5 ? 'hausse' : rpeCurr < rpePrev - 0.5 ? 'baisse' : 'stable')
                 : 'inconnu'
    },
    charge_details: chargeDetails
  };
}

function tendance(curr, prev, seuilPct) {
  if (prev === 0) return curr > 0 ? 'amelioration' : 'stable';
  const pct = (curr - prev) / prev * 100;
  if (pct >= seuilPct)  return 'amelioration';
  if (pct <= -seuilPct) return 'diminution';
  return 'stable';
}

// =============================================================================
// HELPERS PARTAGÉS
// =============================================================================

function buildMuscleSecMap(rowsExo) {
  const map = {};
  for (let i = 1; i < rowsExo.length; i++) {
    if (rowsExo[i][1] && rowsExo[i][3]) map[String(rowsExo[i][1])] = String(rowsExo[i][3]);
  }
  return map;
}

function dateMinusDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getLundi(d) {
  const j = d.getDay();
  const lundi = new Date(d);
  lundi.setDate(d.getDate() - (j === 0 ? 6 : j - 1));
  lundi.setHours(0, 0, 0, 0);
  return lundi;
}

function formatDateYMD(dateObj) {
  return Utilities.formatDate(dateObj, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function computeVolumeSemaine(rows, athlete_id, rowsVol, lundi, muscleSecMap) {
  const seriesParMuscleHist = {};
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[4]) !== String(athlete_id)) continue;
    const dateRow = parseDateFR(row[0]);
    if (!dateRow || dateRow < lundi) continue;
    const muscle    = String(row[6]);
    const muscleSec = muscleSecMap[String(row[5])] || null;
    accMuscle(seriesParMuscleHist, muscle, 1);
    if (muscleSec) accMuscle(seriesParMuscleHist, muscleSec, 0.5);
  }
  const result = [];
  for (let i = 1; i < rowsVol.length; i++) {
    result.push({
      muscle:  String(rowsVol[i][0]),
      faites:  Math.round((seriesParMuscleHist[String(rowsVol[i][0])] || 0) * 10) / 10,
      min:     Number(rowsVol[i][1]),
      optimal: Number(rowsVol[i][2])
    });
  }
  return result;
}

function getProchaineSeance(rows, athlete_id, rowsProg, lundi) {
  const faitesSemaine = new Set();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[4]) !== String(athlete_id)) continue;
    const d = parseDateFR(row[0]);
    if (d && d >= lundi) faitesSemaine.add(String(row[2]).toLowerCase());
  }
  const ordre = [];
  const vues  = new Set();
  for (let i = 1; i < rowsProg.length; i++) {
    if (rowsProg[i][0] != athlete_id) continue;
    const sid = String(rowsProg[i][2]);
    if (!vues.has(sid)) { ordre.push(sid); vues.add(sid); }
  }
  if (ordre.length === 0) return null;
  let lastDone = -1;
  for (let k = ordre.length - 1; k >= 0; k--) {
    if (faitesSemaine.has(ordre[k].toLowerCase())) { lastDone = k; break; }
  }
  if (lastDone === -1) return ordre[0];
  for (let k = 1; k <= ordre.length; k++) {
    const idx = (lastDone + k) % ordre.length;
    if (!faitesSemaine.has(ordre[idx].toLowerCase())) return ordre[idx];
  }
  return null;
}

function buildDatesSeancesMap(rows, athlete_id) {
  const map = {};
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][4]) !== String(athlete_id)) continue;
    const d = parseDateFR(rows[i][0]);
    if (!d) continue;
    const k = formatDateFR(d);
    if (!map[k]) map[k] = String(rows[i][2]);
  }
  return map;
}

function buildPoids(rowsPoids, athlete_id) {
  const poids = [];
  for (let i = 1; i < rowsPoids.length; i++) {
    if (rowsPoids[i][1] == athlete_id && rowsPoids[i][3])
      poids.push({ date: formatDateFR(rowsPoids[i][0]), poids: rowsPoids[i][3] });
  }
  return poids.reverse();
}

function buildProgramme(rowsProg, athlete_id) {
  const programme = [];
  for (let i = 1; i < rowsProg.length; i++) {
    if (rowsProg[i][0] == athlete_id && rowsProg[i][3]) {
      programme.push({
        seance_id:     String(rowsProg[i][2]),
        exercice:      String(rowsProg[i][3]),
        series_prevues: Number(rowsProg[i][4]),
        reps_mini:     Number(rowsProg[i][5]),
        reps_max:      Number(rowsProg[i][6]),
        groupe_id:     String(rowsProg[i][8] || '')
      });
    }
  }
  return programme;
}

// =============================================================================
// COACH — Alertes & Athlètes
// =============================================================================

function viderCacheTout() {
  var cache = CacheService.getScriptCache();
  for (var i = 1; i <= 20; i++) cache.remove('appdata_' + i);
}

function loginCoach(e) {
  const loginVal = e.parameter.login;
  const pwd = e.parameter.password || '';
  if (!verifierRateLimit('coach_' + loginVal))
    return json({ success: false, error: 'Trop de tentatives. Réessaie dans 10 minutes.' });
  const sheet = SS.getSheetByName('Coachs');
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) === String(loginVal)) {
      const storedHash = String(rows[i][3] || '');       // col D = password_hash
      if (storedHash === '') {
        sheet.getRange(i + 1, 4).setValue('s2$' + hashPasswordSalted(pwd, loginVal));
      } else {
        const v = verifierMotDePasse(pwd, storedHash, loginVal);
        if (!v.ok) return json({ success: false, error: 'Mot de passe incorrect' });
        if (v.upgrade) sheet.getRange(i + 1, 4).setValue(v.upgrade);
      }
      resetRateLimit('coach_' + loginVal);
      // sport (Phase 2) en col E (index 4), 'muscu' par défaut
      return json({ success: true, coach: { coach_id: rows[i][0], nom: rows[i][2], sport: String(rows[i][4] || '').trim() || 'muscu' } });
    }
  }
  return json({ success: false, error: 'Identifiant introuvable' });
}

function loginCoachPost(body) { return loginCoach({ parameter: body }); }

function deleteCoachPost(body) {
  const coach_id = String(body.coach_id || '');
  if (!coach_id) return json({ success: false, error: 'coach_id manquant' });

  const sheetCoachs = SS.getSheetByName('Coachs');
  const rowsCoachs  = sheetCoachs.getDataRange().getValues();
  let coachRowIndex = -1;
  for (let i = 1; i < rowsCoachs.length; i++) {
    if (String(rowsCoachs[i][0]) === coach_id) { coachRowIndex = i + 1; break; }
  }
  if (coachRowIndex > 0) sheetCoachs.deleteRow(coachRowIndex);

  const sheetAth = SS.getSheetByName('Athletes');
  const rowsAth  = sheetAth.getDataRange().getValues();
  for (let i = 1; i < rowsAth.length; i++) {
    if (String(rowsAth[i][8]) === coach_id) {
      sheetAth.getRange(i + 1, 9).setValue('');
    }
  }

  return json({ success: true });
}

function getSeancesDetail(e) {
  const athlete_id = String(e.parameter.athlete_id || '');
  if (!athlete_id) return json({ error: 'athlete_id manquant' });

  const rows = SS.getSheetByName('Performances').getDataRange().getValues();

  const parDate = {};
  const ordreDate = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[4]) !== athlete_id) continue;
    const dateObj = parseDateFR(row[0]);
    if (!dateObj) continue;
    const dmy = Utilities.formatDate(dateObj, Session.getScriptTimeZone(), 'dd/MM/yyyy');
    const exo = String(row[5] || '');
    const seanceId = String(row[2] || 'Séance');

    if (!parDate[dmy]) {
      parDate[dmy] = { date: dmy, seance_id: seanceId, exos: [], _parExo: {}, _ordreExo: [] };
      ordreDate.push(dmy);
    }
    const bloc = parDate[dmy];
    if (!bloc._parExo[exo]) {
      bloc._parExo[exo] = [];
      bloc._ordreExo.push(exo);
    }
    bloc._parExo[exo].push({
      serie: bloc._parExo[exo].length + 1,
      charge: Number(row[9]) || null,
      reps:   Number(row[10]) || null,
      rpe:    Number(row[11]) || null
    });
  }

  const seances = ordreDate.map(dmy => {
    const bloc = parDate[dmy];
    return {
      date:      bloc.date,
      seance_id: bloc.seance_id,
      exos:      bloc._ordreExo.map(exo => ({ exo, series: bloc._parExo[exo] }))
    };
  });

  seances.sort((a, b) => {
    const toMs = d => { const p = d.split('/'); return new Date(+p[2], +p[1]-1, +p[0]).getTime(); };
    return toMs(b.date) - toMs(a.date);
  });

  return json({ seances: seances.slice(0, 30) });
}

function getCoachAthletes(e) {
  try {
    const coach_id  = e.parameter.coach_id;
    const sportCoach = lireSportCoach(coach_id);   // Phase 2 : sport du coach
    const sheetAth  = SS.getSheetByName('Athletes');
    const rowsAth   = sheetAth.getDataRange().getValues();
    const athletes  = [];

    for (let i = 1; i < rowsAth.length; i++) {
      const coachCol = String(rowsAth[i][8] || '');
      if (coachCol === String(coach_id)) {
        athletes.push({
          athlete_id:      rowsAth[i][0],
          nom:             rowsAth[i][3],
          annees_pratique: Number(rowsAth[i][6]) || 0
        });
      }
    }

    const sheetPerf = SS.getSheetByName('Performances');
    const rowsPerf  = sheetPerf ? sheetPerf.getDataRange().getValues() : [];
    const maintenant = new Date();
    const lundi = getLundi(maintenant);

    const derniereDateParAthlete = {};
    const seancesSemaineParAthlete = {};
    for (let i = 1; i < rowsPerf.length; i++) {
      const row   = rowsPerf[i];
      const aId   = String(row[4]);
      const dateRow = parseDateFR(row[0]);
      if (!dateRow) continue;
      if (!derniereDateParAthlete[aId] || dateRow > derniereDateParAthlete[aId])
        derniereDateParAthlete[aId] = dateRow;
      if (dateRow >= lundi) {
        if (!seancesSemaineParAthlete[aId]) seancesSemaineParAthlete[aId] = new Set();
        seancesSemaineParAthlete[aId].add(formatDateFR(dateRow));
      }
    }

    let historique = {};
    try { historique = chargerHistoriqueAlertes(); } catch (ex) {}
    const nouvellesLignes = [];
    const severiteScore = { haute: 2, moyenne: 1, basse: 0 };

    athletes.forEach(a => {
      try {
        a.sport = sportCoach;   // Phase 2 : l'athlète hérite du sport de son coach
        const d = derniereDateParAthlete[String(a.athlete_id)];
        a.derniere_seance = d ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy') : null;
        const s = seancesSemaineParAthlete[String(a.athlete_id)];
        a.seances_semaine = s ? s.size : 0;
        // Mode vacances / pause : aucune alerte, aucun historique enregistré.
        // Reprend seul dès que la date du jour dépasse la fin (fenêtre de dates).
        a.en_pause = athleteEnPause(a.athlete_id, maintenant);
        if (a.en_pause) {
          a.alertes = [];
          a.score_priorite = 0;
        } else {
          a.alertes = calculerAlertes(a.athlete_id, a.nom, a.annees_pratique);
          enregistrerEtCalculerRecurrence(a.athlete_id, a.alertes, lundi, historique, nouvellesLignes);
          a.score_priorite = a.alertes.reduce((acc, al) => acc + (severiteScore[al.severite] || 0), 0);
        }
      } catch (ex) {
        a.alertes = [];
        a.seances_semaine = 0;
        a.score_priorite = 0;
      }
    });

    try {
      if (nouvellesLignes.length > 0) {
        const sheetHist = SS.getSheetByName('AlertesHistorique');
        if (sheetHist) sheetHist.getRange(sheetHist.getLastRow() + 1, 1, nouvellesLignes.length, 3).setValues(nouvellesLignes);
      }
    } catch (ex) {}

    athletes.sort((x, y) => y.score_priorite - x.score_priorite);
    return json({ athletes, sport: sportCoach });
  } catch (err) {
    return json({ athletes: [], error: err.message });
  }
}

// =============================================================================
// SUIVI ÉQUIPE (générique multisport) — lit l'onglet Indicateurs + Bien_etre.
// Calcule par athlète : charge 7j, ACWR, régularité, bien-être, statut, alertes.
// Utilisé par la vue coach quand le sport n'est pas la musculation.
// =============================================================================
function getSuiviEquipe(e) {
  try {
    var coach_id = String(e.parameter.coach_id || '');
    var rowsAth = SS.getSheetByName('Athletes').getDataRange().getValues();
    var joueurs = [];
    for (var i = 1; i < rowsAth.length; i++) {
      if (String(rowsAth[i][8]) === coach_id) joueurs.push({ athlete_id: String(rowsAth[i][0]), nom: rowsAth[i][3], poste: String(rowsAth[i][11] || '') });
    }

    var shInd = _getSheetLoose('Indicateurs');
    var rowsInd = shInd.getLastRow() > 1 ? shInd.getDataRange().getValues() : [];
    var shBE = _getSheetLoose('Bien_etre');
    var rowsBE = shBE.getLastRow() > 1 ? shBE.getDataRange().getValues() : [];

    var maintenant = new Date(); maintenant.setHours(23,59,59,0);
    var j7  = dateMinusDays(maintenant, 7);
    var j28 = dateMinusDays(maintenant, 28);

    // Indicateurs par athlète
    var parAth = {};
    function acc(id) { if (!parAth[id]) parAth[id] = { charge7: 0, charge28: 0, seances7: {}, derniere: null }; return parAth[id]; }
    for (var r = 1; r < rowsInd.length; r++) {
      var row = rowsInd[r];
      var id = String(row[1]);
      var d = parseDateFR(row[0]);
      if (!d) continue;
      var cle = String(row[3]);
      var val = Number(row[4]) || 0;
      var a = acc(id);
      if (!a.derniere || d > a.derniere) a.derniere = d;
      if (cle === 'charge_interne') {
        if (d >= j28) a.charge28 += val;
        if (d >= j7)  { a.charge7 += val; a.seances7[formatDateFR(d)] = true; }
      }
    }

    // Bien-être récent (7j) par athlète
    var beAth = {};
    for (var b = 1; b < rowsBE.length; b++) {
      var rb = rowsBE[b];
      var idb = String(rb[2]);
      var db = parseDateFR(rb[0]);
      if (!db || db < j7) continue;
      if (!beAth[idb]) beAth[idb] = { fatigue: [], douleur: [], sommeil: [] };
      if (rb[5] !== '' && rb[5] != null) beAth[idb].fatigue.push(Number(rb[5]));
      if (rb[6] !== '' && rb[6] != null) beAth[idb].douleur.push(Number(rb[6]));
      if (rb[3] !== '' && rb[3] != null) beAth[idb].sommeil.push(Number(rb[3]));
    }
    function moy(arr) { return arr && arr.length ? arr.reduce(function(s,v){return s+v;},0)/arr.length : null; }
    function mx(arr)  { return arr && arr.length ? Math.max.apply(null, arr) : null; }

    // Blessures actives (indispo / retour_progressif) par athlète (§13)
    var shInj = _findSheetLoose('Blessures');
    var rowsInj = (shInj && shInj.getLastRow() > 1) ? shInj.getDataRange().getValues() : [];
    var injByAth = {};
    for (var bj = 1; bj < rowsInj.length; bj++) {
      var stj = String(rowsInj[bj][9] || '');
      if (stj !== 'indispo' && stj !== 'retour_progressif') continue;
      injByAth[String(rowsInj[bj][1])] = { type: String(rowsInj[bj][3] || ''), localisation: String(rowsInj[bj][4] || ''), statut: stj,
        retour_terrain: String(rowsInj[bj][7] || ''), retour_competition: String(rowsInj[bj][8] || '') };
    }
    // Progression via tests (premier vs dernier point, selon le sens du test)
    var shT = _findSheetLoose('Tests');
    var rowsT = (shT && shT.getLastRow() > 1) ? shT.getDataRange().getValues() : [];
    var SENS = { vma:1, sprint_10m:-1, sprint_30m:-1, cmj:1, squat_jump:1, yoyo_test:1, agilite_5_10_5:-1, force_iso:1, force_max:1, '1rm':1, test_vitesse:1 };
    var testsAth = {};
    for (var tt = 1; tt < rowsT.length; tt++) {
      var idt = String(rowsT[tt][1]), clet = String(rowsT[tt][2]), dtt = parseDateFR(rowsT[tt][0]); if (!dtt) continue;
      if (!testsAth[idt]) testsAth[idt] = {};
      if (!testsAth[idt][clet]) testsAth[idt][clet] = [];
      testsAth[idt][clet].push({ d: dtt.getTime(), v: Number(rowsT[tt][3]) });
    }
    function progressionAth(id) {
      var tset = testsAth[id]; if (!tset) return 'stable';
      var up = 0, down = 0;
      for (var c in tset) {
        var pts = tset[c].sort(function(a,b){ return a.d - b.d; });
        if (pts.length < 2) continue;
        var diff = (pts[pts.length-1].v - pts[0].v) * (SENS[c] || 1);
        if (diff > 0) up++; else if (diff < 0) down++;
      }
      return up > down ? 'progression' : (down > up ? 'regression' : 'stable');
    }

    var resultats = [];
    var nb = { vert: 0, orange: 0, rouge: 0 };
    var chargeEquipe = 0, fatigueEquipeArr = [];
    var beEquipeArr = [], nbProg = 0, nbReg = 0, nbIndispo = 0, blesses = [];

    joueurs.forEach(function(j) {
      var a = parAth[j.athlete_id] || { charge7: 0, charge28: 0, seances7: {}, derniere: null };
      var be = beAth[j.athlete_id] || {};
      var seances7 = Object.keys(a.seances7).length;
      var chronic = a.charge28 / 4;
      var acwr = chronic > 0 ? Math.round(a.charge7 / chronic * 100) / 100 : null;
      var fatigueMoy = moy(be.fatigue);
      var douleurMax = mx(be.douleur);
      var sommeilMoy = moy(be.sommeil);

      var alertes = [];
      if (seances7 === 0) alertes.push({ type: 'absence', severite: 'haute', message: 'Aucune séance depuis 7 jours' });
      if (acwr != null && acwr > 1.5) alertes.push({ type: 'surcharge', severite: 'haute', message: 'Charge aiguë élevée (ACWR ' + acwr + ')' });
      else if (acwr != null && acwr > 1.3) alertes.push({ type: 'charge', severite: 'moyenne', message: 'Charge en hausse (ACWR ' + acwr + ')' });
      if (douleurMax != null && douleurMax >= 2) alertes.push({ type: 'douleur', severite: 'haute', message: 'Douleur signalée' });
      if (fatigueMoy != null && fatigueMoy >= 4) alertes.push({ type: 'fatigue', severite: 'moyenne', message: 'Fatigue élevée (' + Math.round(fatigueMoy*10)/10 + '/5)' });

      var statut = 'vert';
      if (alertes.some(function(x){return x.severite==='haute';})) statut = 'rouge';
      else if (alertes.length) statut = 'orange';
      nb[statut]++;
      chargeEquipe += a.charge7;
      if (fatigueMoy != null) fatigueEquipeArr.push(fatigueMoy);

      var prog = progressionAth(j.athlete_id);
      var inj = injByAth[j.athlete_id] || null;
      var beComp = [];
      if (sommeilMoy != null) beComp.push(sommeilMoy);
      if (fatigueMoy != null) beComp.push(6 - fatigueMoy);
      if (douleurMax != null) beComp.push(6 - douleurMax);
      var beScore = beComp.length ? beComp.reduce(function(a,b){return a+b;},0)/beComp.length : null;
      if (beScore != null) beEquipeArr.push(beScore);
      if (prog === 'progression') nbProg++; else if (prog === 'regression') nbReg++;
      if (inj) { blesses.push({ athlete_id: j.athlete_id, nom: j.nom, poste: j.poste, type: inj.type, localisation: inj.localisation, statut: inj.statut, retour_terrain: inj.retour_terrain, retour_competition: inj.retour_competition }); if (inj.statut === 'indispo') nbIndispo++; }

      resultats.push({
        athlete_id: j.athlete_id, nom: j.nom, poste: j.poste,
        derniere_seance: a.derniere ? formatDateFR(a.derniere) : null,
        seances_7j: seances7,
        charge_7j: Math.round(a.charge7),
        acwr: acwr,
        fatigue_moy: fatigueMoy != null ? Math.round(fatigueMoy*10)/10 : null,
        douleur_max: douleurMax,
        sommeil_moy: sommeilMoy != null ? Math.round(sommeilMoy*10)/10 : null,
        statut: statut,
        progression: prog,
        blesse: inj ? inj.statut : null,
        alertes: alertes
      });
    });

    var rang = { rouge: 0, orange: 1, vert: 2 };
    resultats.sort(function(x,y){ return rang[x.statut] - rang[y.statut] || (y.charge_7j - x.charge_7j); });

    return json({
      joueurs: resultats,
      equipe: {
        total: joueurs.length,
        vert: nb.vert, orange: nb.orange, rouge: nb.rouge,
        indispo: nbIndispo,
        charge_equipe: Math.round(chargeEquipe),
        fatigue_moyenne: fatigueEquipeArr.length ? Math.round(moy(fatigueEquipeArr)*10)/10 : null,
        bienetre_moyen: beEquipeArr.length ? Math.round(moy(beEquipeArr)*10)/10 : null,
        en_progression: nbProg, en_regression: nbReg
      },
      blesses: blesses
    });
  } catch (err) {
    return json({ joueurs: [], equipe: {}, error: err.message });
  }
}

// Détail d'un joueur (sports co) : charge hebdo, ACWR, bien-être, dernières séances.
function getSuiviJoueur(e) {
  try {
    var athlete_id = String(e.parameter.athlete_id || '');
    var nom = '', poste = '', ddn = '', taille = null, jambe = '', poids = null, antecedents = '', heatmap = '';
    var sexe = '', club = '', categorie = '', date_entree = '', discipline = '';
    var ra = SS.getSheetByName('Athletes').getDataRange().getValues();
    for (var i = 1; i < ra.length; i++) {
      if (String(ra[i][0]) === athlete_id) {
        nom = ra[i][3];
        // Google Sheets peut stocker la date comme objet Date → normaliser en dd/MM/yyyy
        ddn = (ra[i][4] instanceof Date) ? Utilities.formatDate(ra[i][4], Session.getScriptTimeZone(), 'dd/MM/yyyy') : String(ra[i][4] || '');
        taille = (ra[i][5] !== '' && ra[i][5] != null) ? Number(ra[i][5]) : null;
        poste = String(ra[i][11] || '');
        jambe = String(ra[i][12] || '');                                    // col M (foot)
        poids = (ra[i][13] !== '' && ra[i][13] != null) ? Number(ra[i][13]) : null;  // col N (foot)
        antecedents = String(ra[i][14] || '');                              // col O (foot)
        heatmap = String(ra[i][15] || '');                                  // col P (foot)
        sexe = String(ra[i][16] || '');                                     // col Q
        club = String(ra[i][17] || '');                                     // col R
        categorie = String(ra[i][18] || '');                                // col S
        date_entree = (ra[i][19] instanceof Date) ? String(ra[i][19].getFullYear()) : String(ra[i][19] || ''); // col T
        discipline = String(ra[i][20] || '');                               // col U
        break;
      }
    }
    var age = null;
    if (ddn) { var dn = parseDateFR(ddn); if (dn) age = Math.floor((Date.now() - dn.getTime()) / 31557600000); }

    var shInd = _getSheetLoose('Indicateurs');
    var rowsInd = shInd.getLastRow() > 1 ? shInd.getDataRange().getValues() : [];
    var shBE = _getSheetLoose('Bien_etre');
    var rowsBE = shBE.getLastRow() > 1 ? shBE.getDataRange().getValues() : [];

    var maintenant = new Date(); maintenant.setHours(23,59,59,0);
    var j7 = dateMinusDays(maintenant, 7), j28 = dateMinusDays(maintenant, 28);

    // Séances (regroupées par seance_id) + charge par semaine ISO
    var seances = {};       // sid -> {date, dateObj, cles:{}}
    var chargeParSem = {};  // isoWeek -> somme charge_interne
    var semLundi = {};      // isoWeek -> lundi (Date)
    var charge7 = 0, charge28 = 0;
    var chargeParJour = {};   // date -> somme charge_interne (7j), pour monotonie/strain (§11)
    // Bien-être / récup (§3/§10) : dernière valeur saisie par métrique (depuis Indicateurs)
    var WELL = { sommeil:1, energie:1, fatigue:1, motivation:1, stress:1, courbatures:1, douleur:1, dispo_mentale:1,
                 fatigue_post:1, difficulte_seance:1, satisfaction:1, douleur_post:1 };
    var wellDate = {}, bienetreI = {};

    for (var r = 1; r < rowsInd.length; r++) {
      var row = rowsInd[r];
      if (String(row[1]) !== athlete_id) continue;
      var d = parseDateFR(row[0]); if (!d) continue;
      var sid = String(row[2]); var cle = String(row[3]); var val = Number(row[4]) || 0;
      if (!seances[sid]) seances[sid] = { date: formatDateFR(d), dateObj: d, cles: {} };
      seances[sid].cles[cle] = row[4];
      if (WELL[cle] && row[4] !== '' && row[4] != null) {
        if (!wellDate[cle] || d.getTime() >= wellDate[cle]) { wellDate[cle] = d.getTime(); bienetreI[cle] = Number(row[4]); }
      }
      if (cle === 'charge_interne') {
        var w = _isoWeek(d);
        chargeParSem[w] = (chargeParSem[w] || 0) + val;
        var lundi = new Date(d); var dow = lundi.getDay() === 0 ? 6 : lundi.getDay() - 1;
        lundi.setDate(lundi.getDate() - dow); lundi.setHours(0,0,0,0);
        if (!semLundi[w] || lundi < semLundi[w]) semLundi[w] = lundi;
        if (d >= j28) charge28 += val;
        if (d >= j7) { charge7 += val; var kj = formatDateFR(d); chargeParJour[kj] = (chargeParJour[kj] || 0) + val; }
      }
    }

    var chronic = charge28 / 4;
    var acwr = chronic > 0 ? Math.round(charge7 / chronic * 100) / 100 : null;

    // Charge hebdo (6 dernières semaines)
    var chargeHebdo = Object.keys(chargeParSem).sort().slice(-6).map(function(w) {
      return { semaine: w, charge: Math.round(chargeParSem[w]),
               label: semLundi[w] ? Utilities.formatDate(semLundi[w], Session.getScriptTimeZone(), 'dd/MM') : w };
    });

    // KPI de charge (§11) : charge mensuelle, monotonie (moy/écart-type sur 7j), strain
    var days7 = [];
    for (var dd = 0; dd < 7; dd++) { var dref = new Date(maintenant); dref.setDate(dref.getDate() - dd); days7.push(chargeParJour[formatDateFR(dref)] || 0); }
    var meanD = days7.reduce(function(a,b){ return a + b; }, 0) / 7;
    var sdD = Math.sqrt(days7.reduce(function(a,b){ return a + Math.pow(b - meanD, 2); }, 0) / 7);
    var monotonie = sdD > 0 ? Math.round(meanD / sdD * 100) / 100 : null;
    var strain = monotonie != null ? Math.round(charge7 * monotonie) : null;
    var kpiFoot = { charge_mensuelle: Math.round(charge28), monotonie: monotonie, strain: strain, temps_jeu: 0 };

    // Bien-être (14 derniers jours)
    var wellness = [];
    for (var b = 1; b < rowsBE.length; b++) {
      var rb = rowsBE[b];
      if (String(rb[2]) !== athlete_id) continue;
      var db = parseDateFR(rb[0]); if (!db || db < dateMinusDays(maintenant, 14)) continue;
      wellness.push({ date: formatDateFR(db), dateObj: db,
        sommeil: rb[3] !== '' ? Number(rb[3]) : null, energie: rb[4] !== '' ? Number(rb[4]) : null,
        fatigue: rb[5] !== '' ? Number(rb[5]) : null, douleur: rb[6] !== '' ? Number(rb[6]) : null });
    }
    wellness.sort(function(a,b){ return a.dateObj - b.dateObj; });
    wellness.forEach(function(w){ delete w.dateObj; });

    // Bilan du jour (§3/§10) : base = dernière entrée Bien_etre, surchargée par les saisies Indicateurs
    var bienetre = {};
    var wLast2 = wellness.length ? wellness[wellness.length - 1] : null;
    if (wLast2) {
      if (wLast2.sommeil != null) bienetre.sommeil = wLast2.sommeil;
      if (wLast2.energie != null) bienetre.energie = wLast2.energie;
      if (wLast2.fatigue != null) bienetre.fatigue = wLast2.fatigue;
      if (wLast2.douleur != null) bienetre.douleur = wLast2.douleur;
    }
    for (var wk in bienetreI) bienetre[wk] = bienetreI[wk];

    // Dernières séances (10)
    var listeSeances = Object.keys(seances).map(function(sid){ return seances[sid]; })
      .sort(function(a,b){ return b.dateObj - a.dateObj; }).slice(0, 10)
      .map(function(s){ return {
        date: s.date,
        type: s.cles['type_seance'] || '—',
        duree: s.cles['duree'] || null,
        rpe: s.cles['rpe'] || null,
        charge: s.cles['charge_interne'] || null,
        distance_hi: s.cles['distance_hi'] || null,
        sprints: s.cles['sprints'] || null
      }; });

    // Charge externe GPS (§8) — agrégat 7 jours
    var gps = { distance: 0, distance_hi: 0, sprint_distance: 0, sprints: 0, accel: 0, decel: 0, vmax: 0, charge_gps: 0, n: 0 };
    Object.keys(seances).forEach(function(sid){
      var s = seances[sid]; if (!s.dateObj || s.dateObj < j7) return;
      gps.n++;
      gps.distance        += Number(s.cles['distance_totale'] || 0);
      gps.distance_hi     += Number(s.cles['distance_hi'] || 0);
      gps.sprint_distance += Number(s.cles['sprint_distance'] || 0);
      gps.sprints         += Number(s.cles['sprints'] || 0);
      gps.accel       += Number(s.cles['accelerations'] || 0);
      gps.decel       += Number(s.cles['decelerations'] || 0);
      gps.charge_gps  += Number(s.cles['charge_gps'] || 0);
      var vm = Number(s.cles['vitesse_max'] || 0); if (vm > gps.vmax) gps.vmax = vm;
    });

    // Matchs (type_seance = 'match') + agrégats saison
    var tousMatchs = Object.keys(seances).map(function(sid){ return seances[sid]; })
      .filter(function(s){ return String(s.cles['type_seance']) === 'match'; })
      .sort(function(a,b){ return b.dateObj - a.dateObj; });
    var num = function(v){ return (v !== '' && v != null) ? Number(v) : null; };
    var matchs = tousMatchs.slice(0, 8).map(function(s){ return {
      date: s.date,
      note: num(s.cles['note']),
      buts: num(s.cles['buts']) || 0,
      passes_d: num(s.cles['passes_decisives']) || 0,
      xg: num(s.cles['xg']),
      xa: num(s.cles['xa']),
      minutes: num(s.cles['minutes_jouees'])
    }; });
    // Agrégation générique de toutes les métriques de match (somme + moyenne par match)
    var aggSum = {}, aggCnt = {};
    tousMatchs.forEach(function(s){
      for (var k in s.cles) {
        var vv = num(s.cles[k]);
        if (vv == null) continue;
        aggSum[k] = (aggSum[k] || 0) + vv;
        aggCnt[k] = (aggCnt[k] || 0) + 1;
      }
    });
    var matchAgg = {};
    for (var kk in aggSum) {
      matchAgg[kk] = { total: Math.round(aggSum[kk] * 100) / 100, moy: aggCnt[kk] ? Math.round(aggSum[kk] / aggCnt[kk] * 10) / 10 : 0 };
    }
    var matchStats = {
      nb: tousMatchs.length,
      note_moy: aggCnt['note'] ? Math.round(aggSum['note'] / aggCnt['note'] * 10) / 10 : null,
      minutes: aggSum['minutes_jouees'] || 0,
      buts: aggSum['buts'] || 0,
      passes_d: aggSum['passes_decisives'] || 0
    };
    kpiFoot.temps_jeu = matchStats.minutes;
    // Heatmap (18 zones), semée par joueur (col P)
    var heatArr = heatmap ? heatmap.split(',').map(function(v){ return Number(v) || 0; }) : [];

    // Objectifs (catalogue §2)
    var shObj = _findSheetLoose('Objectifs');
    var rowsObj = (shObj && shObj.getLastRow() > 1) ? shObj.getDataRange().getValues() : [];
    var objectifs = [];
    for (var o = 1; o < rowsObj.length; o++) {
      if (String(rowsObj[o][1]) !== athlete_id) continue;
      objectifs.push({ id: String(rowsObj[o][0] || ''), categorie: String(rowsObj[o][2] || ''), description: String(rowsObj[o][3] || ''), statut: String(rowsObj[o][4] || '') });
    }
    // Blessures / réathlé (catalogue §9, décision #5)
    var shInj = _findSheetLoose('Blessures');
    var rowsInj = (shInj && shInj.getLastRow() > 1) ? shInj.getDataRange().getValues() : [];
    var blessures = [];
    for (var bi = 1; bi < rowsInj.length; bi++) {
      if (String(rowsInj[bi][1]) !== athlete_id) continue;
      blessures.push({ id: String(rowsInj[bi][0] || ''), date: String(rowsInj[bi][2] || ''), type: String(rowsInj[bi][3] || ''), localisation: String(rowsInj[bi][4] || ''),
        gravite: String(rowsInj[bi][5] || ''), duree: (rowsInj[bi][6] !== '' && rowsInj[bi][6] != null) ? Number(rowsInj[bi][6]) : null,
        retour_terrain: String(rowsInj[bi][7] || ''), retour_competition: String(rowsInj[bi][8] || ''), statut: String(rowsInj[bi][9] || '') });
    }

    // ── Moteur d'analyse (§12) : décisions à partir de bien-être + blessures + charge ──
    var beM = bienetre || {};
    var _n = function(x){ return (x != null && x !== '') ? Number(x) : null; };
    var douleurM = _n(beM.douleur), fatigueM = _n(beM.fatigue), courbM = _n(beM.courbatures), sommeilM = _n(beM.sommeil), fpM = _n(beM.fatigue_post);
    var injActive = null;
    for (var im = 0; im < blessures.length; im++) { var stM = blessures[im].statut; if (stM === 'indispo' || stM === 'retour_progressif') { injActive = blessures[im]; break; } }
    var surchargeN = (acwr != null && acwr > 1.5) ? 2 : (acwr != null && acwr > 1.3) ? 1 : 0;
    var surcharge = ['Faible', 'Modéré', 'Élevé'][surchargeN];
    var rbPts = surchargeN + (douleurM >= 3 ? 2 : douleurM >= 2 ? 1 : 0) + (fatigueM >= 4 ? 1 : 0) + (courbM >= 4 ? 1 : 0);
    var risqueBlessureN = rbPts >= 3 ? 2 : rbPts >= 1 ? 1 : 0;
    var risqueBlessure = ['Faible', 'Modéré', 'Élevé'][risqueBlessureN];
    var recArr = [];
    if (sommeilM != null) recArr.push(sommeilM / 5);
    if (fatigueM != null) recArr.push((6 - fatigueM) / 5);
    if (courbM != null) recArr.push((6 - courbM) / 5);
    if (fpM != null) recArr.push((6 - fpM) / 5);
    var recScore = recArr.length ? (recArr.reduce(function(a, b){ return a + b; }, 0) / recArr.length) * 100 : null;
    var recup = recScore == null ? '—' : recScore >= 75 ? 'Excellent' : recScore >= 60 ? 'Bon' : recScore >= 45 ? 'Moyen' : 'Faible';
    var dispoN;
    if (injActive && injActive.statut === 'indispo') dispoN = 2;
    else {
      var bad = (risqueBlessureN === 2) || (surchargeN === 2) || (recScore != null && recScore < 45);
      var mid = (risqueBlessureN === 1) || (surchargeN === 1) || (recScore != null && recScore < 60) || (injActive && injActive.statut === 'retour_progressif');
      dispoN = bad ? 2 : mid ? 1 : 0;
    }
    var moteur = {
      disponibilite: { niveau: ['Prêt', 'Vigilance', 'À surveiller'][dispoN], couleur: ['#22c55e', '#f5a623', '#e5484d'][dispoN] },
      surcharge: surcharge, risque_blessure: risqueBlessure, recup: recup
    };
    if (injActive && injActive.statut === 'indispo') moteur.reco = 'Indisponible — poursuivre la réathlétisation.';
    else if (surchargeN === 2) moteur.reco = 'Charge aiguë élevée (ACWR ' + (acwr != null ? acwr.toFixed(2) : '—') + ') — réduire le volume 48 h.';
    else if (douleurM >= 3) moteur.reco = 'Douleur signalée — évaluer avant de charger.';
    else if (recScore != null && recScore < 45) moteur.reco = 'Récupération insuffisante — alléger et surveiller le sommeil.';
    else if (injActive && injActive.statut === 'retour_progressif') moteur.reco = 'Retour progressif — respecter la progressivité de charge.';
    else if (risqueBlessureN === 1 || surchargeN === 1) moteur.reco = 'Vigilance — surveiller les sensations, ne pas surcharger.';
    else moteur.reco = 'RAS — maintenir la charge actuelle.';

    return json({
      athlete_id: athlete_id, nom: nom, poste: poste,
      ddn: ddn, age: age, taille: taille, poids: poids, jambe_dominante: jambe, antecedents: antecedents,
      sexe: sexe, club: club, categorie: categorie, date_entree: date_entree, discipline: discipline,
      charge_7j: Math.round(charge7), acwr: acwr,
      charge_hebdo: chargeHebdo,
      wellness: wellness, bienetre: bienetre, gps: gps, kpi_foot: kpiFoot,
      seances: listeSeances,
      matchs: matchs, match_stats: matchStats, match_agg: matchAgg, heatmap: heatArr,
      objectifs: objectifs, blessures: blessures, moteur: moteur
    });
  } catch (err) { return json({ error: err.message }); }
}

// TESTS (générique, tous sports) — onglet Tests : date, athlete_id, cle, valeur, unite.
function getTests(e) {
  try {
    var athlete_id = String(e.parameter.athlete_id || '');
    var sh = _findSheetLoose('Tests');
    var rows = (sh && sh.getLastRow() > 1) ? sh.getDataRange().getValues() : [];
    var parCle = {};
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][1]) !== athlete_id) continue;
      var d = parseDateFR(rows[i][0]); if (!d) continue;
      var cle = String(rows[i][2]);
      if (!parCle[cle]) parCle[cle] = { cle: cle, unite: String(rows[i][4] || ''), points: [] };
      parCle[cle].points.push({ date: formatDateFR(d), dateObj: d.getTime(), valeur: Number(rows[i][3]) });
    }
    var tests = Object.keys(parCle).map(function(k) {
      var t = parCle[k];
      t.points.sort(function(a,b){ return a.dateObj - b.dateObj; });
      t.points.forEach(function(p){ delete p.dateObj; });
      return t;
    });
    return json({ tests: tests });
  } catch (err) { return json({ tests: [], error: err.message }); }
}

function saveTest(body) {
  var athlete_id = String(body.athlete_id || '');
  var cle = String(body.cle || '');
  if (!athlete_id || !cle) return json({ success: false, error: 'Champs manquants' });
  var sh = _getSheetLoose('Tests');
  if (sh.getLastRow() === 0) sh.getRange(1,1,1,5).setValues([['date','athlete_id','cle','valeur','unite']]);
  var dstr = body.date ? formatDateFR(body.date) : formatDateFR(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'));
  sh.appendRow([dstr, athlete_id, cle, Number(body.valeur) || 0, String(body.unite || '')]);
  return json({ success: true });
}

// ─── Objectifs joueur (sports co) : créer / modifier / supprimer ─────────────
function saveObjectifJoueur(body) {
  var athlete_id = String(body.athlete_id || '');
  if (!athlete_id) return json({ success: false, error: 'Athlète manquant' });
  var sh = _getSheetLoose('Objectifs');
  if (sh.getLastRow() === 0) sh.getRange(1,1,1,6).setValues([['id','athlete_id','categorie','description','statut','date']]);
  var cat = String(body.categorie || ''), desc = String(body.description || ''), stat = String(body.statut || 'en_cours');
  var today = formatDateFR(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'));
  var id = String(body.id || '');
  if (id) {
    var data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === id) { sh.getRange(i+1, 3, 1, 3).setValues([[cat, desc, stat]]); return json({ success: true, id: id }); }
    }
  }
  id = _newId('o');
  sh.appendRow([id, athlete_id, cat, desc, stat, today]);
  return json({ success: true, id: id });
}

function deleteObjectifJoueur(body) {
  var id = String(body.id || '');
  var sh = _findSheetLoose('Objectifs');
  if (!sh || !id) return json({ success: false, error: 'Paramètre manquant' });
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) { sh.deleteRow(i+1); return json({ success: true }); }
  }
  return json({ success: false, error: 'Introuvable' });
}

// ─── Blessures / réathlé (sports co) : créer / modifier / supprimer ──────────
function saveBlessure(body) {
  var athlete_id = String(body.athlete_id || '');
  if (!athlete_id) return json({ success: false, error: 'Athlète manquant' });
  var sh = _getSheetLoose('Blessures');
  if (sh.getLastRow() === 0) sh.getRange(1,1,1,10).setValues([['id','athlete_id','date','type','localisation','gravite','duree','retour_terrain','retour_competition','statut']]);
  var today = formatDateFR(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'));
  var vals = [
    String(body.date || '') || today,
    String(body.type || ''), String(body.localisation || ''), String(body.gravite || ''),
    (body.duree !== '' && body.duree != null) ? Number(body.duree) : '',
    String(body.retour_terrain || ''), String(body.retour_competition || ''), String(body.statut || 'indispo')
  ];
  var id = String(body.id || '');
  if (id) {
    var data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === id) { sh.getRange(i+1, 3, 1, 8).setValues([vals]); return json({ success: true, id: id }); }
    }
  }
  id = _newId('b');
  sh.appendRow([id, athlete_id].concat(vals));
  return json({ success: true, id: id });
}

function deleteBlessure(body) {
  var id = String(body.id || '');
  var sh = _findSheetLoose('Blessures');
  if (!sh || !id) return json({ success: false, error: 'Paramètre manquant' });
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) { sh.deleteRow(i+1); return json({ success: true }); }
  }
  return json({ success: false, error: 'Introuvable' });
}

// Convertit 'yyyy-MM-dd' (input date HTML) en 'dd/MM/yyyy'. Laisse tel quel sinon.
function _toDDMM(str) {
  var m = String(str || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? (m[3] + '/' + m[2] + '/' + m[1]) : String(str || '');
}

// ─── Saisie d'un match (sports co) : écrit les métriques §6 dans Indicateurs ──
function saveMatch(body) {
  var athlete_id = String(body.athlete_id || '');
  if (!athlete_id) return json({ success: false, error: 'Athlète manquant' });
  var sh = _getSheetLoose('Indicateurs');
  if (sh.getLastRow() === 0) sh.getRange(1,1,1,7).setValues([['date','athlete_id','seance_id','cle','valeur','unite','source']]);
  var date = _toDDMM(body.date) || formatDateFR(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'));
  var sid = 'm' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  var rows = [];
  function add(cle, val, unite, src) { if (val === '' || val == null || isNaN(Number(val))) return; rows.push([date, athlete_id, sid, cle, Number(val), unite || '', src || 'saisie']); }
  rows.push([date, athlete_id, sid, 'type_seance', 'match', '', 'saisie']);
  var duree = Number(body.duree) || 0, rpe = Number(body.rpe) || 0;
  if (duree) add('duree', duree, 'min', 'saisie');
  if (rpe) add('rpe', rpe, '1-10', 'saisie');
  if (duree && rpe) add('charge_interne', duree * rpe, 'UA', 'calculé');
  add('minutes_jouees', body.minutes_jouees, 'min', 'saisie');
  add('note', body.note, '/10', 'saisie');
  if (body.heure) rows.push([date, athlete_id, sid, 'heure', String(body.heure), '', 'saisie']);
  add('intensite_prevue', body.intensite_prevue, 'score', 'saisie');
  add('intensite_realisee', body.intensite_realisee, 'score', 'saisie');
  if (body.titulaire != null && body.titulaire !== '') add('titulaire', Number(body.titulaire) ? 1 : 0, 'bool', 'saisie');
  var stats = body.stats || {};
  for (var k in stats) { add(String(k), stats[k], 'nb', 'saisie'); }
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, 7).setValues(rows);
  return json({ success: true, seance_id: sid });
}

// ─── Bilan athlète : bien-être pré-séance (§3) + récup post-séance (§10) ──────
// Stocké dans Indicateurs (une ligne par métrique). Scores 1-5, commentaire texte.
function saveBilanAthlete(body) {
  var athlete_id = String(body.athlete_id || '');
  if (!athlete_id) return json({ success: false, error: 'Athlète manquant' });
  var sh = _getSheetLoose('Indicateurs');
  if (sh.getLastRow() === 0) sh.getRange(1,1,1,7).setValues([['date','athlete_id','seance_id','cle','valeur','unite','source']]);
  var date = _toDDMM(body.date) || formatDateFR(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'));
  var sid = 'bilan_' + Date.now();
  var CLES = ['sommeil','energie','fatigue','motivation','stress','courbatures','douleur','dispo_mentale',
              'fatigue_post','difficulte_seance','satisfaction','douleur_post'];
  var vals = body.vals || {};
  var rows = [];
  for (var i = 0; i < CLES.length; i++) {
    var c = CLES[i], v = vals[c];
    if (v === '' || v == null || isNaN(Number(v))) continue;
    rows.push([date, athlete_id, sid, c, Number(v), '1-5', 'saisie']);
  }
  if (body.commentaire) rows.push([date, athlete_id, sid, 'commentaire', String(body.commentaire), 'texte', 'saisie']);
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, 7).setValues(rows);
  return json({ success: true, seance_id: sid });
}

function getCoachAthleteDetail(e) {
  const athlete_id = e.parameter.athlete_id;
  const sheet = SS.getSheetByName('Performances');
  const rows  = sheet.getDataRange().getValues();

  const seances = {};
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[4]) !== String(athlete_id)) continue;
    const dateRow = parseDateFR(row[0]);
    if (!dateRow) continue;
    const dKey = formatDateFR(dateRow);
    if (!seances[dKey]) seances[dKey] = { date: dKey, dateObj: dateRow, seanceId: row[2], exercices: {} };
    const exo = String(row[5]);
    if (!seances[dKey].exercices[exo]) seances[dKey].exercices[exo] = [];
    seances[dKey].exercices[exo].push({ charge: Number(row[9]), reps: Number(row[10]), rpe: Number(row[11]) });
  }
  const liste = Object.values(seances).sort((a, b) => b.dateObj - a.dateObj).slice(0, 15);
  liste.forEach(s => delete s.dateObj);

  const progression = {};
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[4]) !== String(athlete_id)) continue;
    const dateRow = parseDateFR(row[0]);
    if (!dateRow) continue;
    const exo = String(row[5]);
    const charge = Number(row[9]), reps = Number(row[10]);
    if (!progression[exo]) progression[exo] = {};
    const dKey = formatDateFR(dateRow);
    if (!progression[exo][dKey] || charge > progression[exo][dKey].charge ||
        (charge === progression[exo][dKey].charge && reps > progression[exo][dKey].reps))
      progression[exo][dKey] = { date: dKey, dateObj: dateRow, charge, reps };
  }
  const progressionListe = {};
  Object.keys(progression).forEach(exo => {
    const entries = Object.values(progression[exo]).sort((a, b) => a.dateObj - b.dateObj);
    entries.forEach(e2 => delete e2.dateObj);
    progressionListe[exo] = entries;
  });

  return json({ seances: liste, progression: progressionListe });
}

function getCoachProgramme(e) {
  const athleteId = e.parameter.athlete_id;
  const sheet = SS.getSheetByName('Programme');
  const rows  = sheet.getDataRange().getValues();
  const lignes = [];
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(athleteId)) {
      lignes.push({
        row_index:     i + 1,
        seance_id:     String(rows[i][2]),
        exercice:      String(rows[i][3]),
        series_prevues: Number(rows[i][4]),
        reps_mini:     Number(rows[i][5]),
        reps_max:      Number(rows[i][6]),
        repos_sec:     Number(rows[i][7]) || null,
        groupe_id:     String(rows[i][8] || '')
      });
    }
  }
  return json({ lignes });
}

function saveProgrammeLigne(body) {
  const sheet = SS.getSheetByName('Programme');
  if (body.row_index) {
    sheet.getRange(body.row_index, 3, 1, 7).setValues([[
      body.seance_id, body.exercice, body.series_prevues, body.reps_mini, body.reps_max,
      body.repos_sec || '', body.groupe_id || ''
    ]]);
  } else {
    sheet.appendRow([body.athlete_id, body.athlete_nom || '', body.seance_id, body.exercice,
      body.series_prevues, body.reps_mini, body.reps_max, body.repos_sec || '', body.groupe_id || '']);
  }
  CacheService.getScriptCache().remove('appdata_' + body.athlete_id);
  return json({ success: true });
}

function supprimerProgrammeLigne(body) {
  SS.getSheetByName('Programme').deleteRow(body.row_index);
  CacheService.getScriptCache().remove('appdata_' + body.athlete_id);
  return json({ success: true });
}

// =============================================================================
// ALERTES COACH
// =============================================================================

function getNiveauExperienceGS(annees) {
  const a = Number(annees) || 0;
  if (a <= 3)  return 'debutant';
  if (a <= 7)  return 'intermediaire';
  if (a <= 12) return 'avance';
  return 'expert';
}

function getStrategieFromAnnees(annees) {
  const niveau = getNiveauExperienceGS(annees);
  if (niveau === 'debutant')      return 'Progression linéaire';
  if (niveau === 'intermediaire') return 'Double progression';
  return 'Progression avancée';
}

function seuilStagnation(niveau) {
  if (niveau === 'debutant')      return 3;
  if (niveau === 'intermediaire') return 4;
  if (niveau === 'avance')        return 6;
  return 8;
}

function cleAlerteHistorique(al) {
  if (al.type === 'stagnation') return 'stagnation:' + String(al.message).split(' : ')[0];
  return al.type;
}

function chargerHistoriqueAlertes() {
  let sheet = SS.getSheetByName('AlertesHistorique');
  if (!sheet) {
    sheet = SS.insertSheet('AlertesHistorique');
    sheet.appendRow(['athlete_id', 'cle_alerte', 'semaine']);
  }
  const rows = sheet.getDataRange().getValues();
  const map  = {};
  for (let i = 1; i < rows.length; i++) {
    const aId     = String(rows[i][0]);
    const cle     = String(rows[i][1]);
    const semaine = String(rows[i][2]);
    if (!map[aId]) map[aId] = {};
    if (!map[aId][cle]) map[aId][cle] = {};
    map[aId][cle][semaine] = true;
  }
  return map;
}

function enregistrerEtCalculerRecurrence(athlete_id, alertes, lundi, historique, nouvellesLignes) {
  const lundiStr = formatDateFR(lundi);
  const aId      = String(athlete_id);
  if (!historique[aId]) historique[aId] = {};
  alertes.forEach(al => {
    const cle = cleAlerteHistorique(al);
    if (!historique[aId][cle]) historique[aId][cle] = {};
    if (!historique[aId][cle][lundiStr]) {
      historique[aId][cle][lundiStr] = true;
      nouvellesLignes.push([athlete_id, cle, lundiStr]);
    }
    let compteur = 0;
    const semaineCheck = new Date(lundi);
    while (historique[aId][cle][formatDateFR(semaineCheck)]) {
      compteur++;
      semaineCheck.setDate(semaineCheck.getDate() - 7);
    }
    al.recurrence_semaines = compteur;
  });
}

function calculerAlertes(athlete_id, nom, anneesPratique) {
  const alertes   = [];
  const sheet     = SS.getSheetByName('Performances');
  const rows      = sheet.getDataRange().getValues();
  const maintenant = new Date();
  const sept_jours         = dateMinusDays(maintenant, 7);
  const troisSemainesAvant = dateMinusDays(maintenant, 21);

  const datesRecentes = {};
  let rpeTotal7j = 0, rpeCount7j = 0;
  const chargeParExo7jSum = {}, chargeParExo7jCount = {};
  const chargeParExoPrecSum = {}, chargeParExoPrecCount = {};
  const progressionParExo = {};
  const rpeParExo = {};

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[4]) !== String(athlete_id)) continue;
    const dateRow = parseDateFR(row[0]);
    if (!dateRow) continue;
    const exo    = String(row[5]);
    const charge = Number(row[9]) || 0;
    const reps   = Number(row[10]) || 0;
    const rpe    = Number(row[11]) || 0;

    if (dateRow >= sept_jours) {
      datesRecentes[formatDateFR(dateRow)] = true;
      if (rpe > 0) { rpeTotal7j += rpe; rpeCount7j++; }
      if (charge > 0) {
        chargeParExo7jSum[exo]   = (chargeParExo7jSum[exo]   || 0) + charge;
        chargeParExo7jCount[exo] = (chargeParExo7jCount[exo] || 0) + 1;
      }
    } else if (dateRow >= troisSemainesAvant) {
      if (charge > 0) {
        chargeParExoPrecSum[exo]   = (chargeParExoPrecSum[exo]   || 0) + charge;
        chargeParExoPrecCount[exo] = (chargeParExoPrecCount[exo] || 0) + 1;
      }
    }

    if (!progressionParExo[exo]) progressionParExo[exo] = {};
    const dKey = formatDateFR(dateRow);
    if (!progressionParExo[exo][dKey] || charge > progressionParExo[exo][dKey].charge ||
        (charge === progressionParExo[exo][dKey].charge && reps > progressionParExo[exo][dKey].reps))
      progressionParExo[exo][dKey] = { date: dateRow, charge, reps };

    if (rpe > 0 && charge > 0) {
      if (!rpeParExo[exo]) rpeParExo[exo] = {};
      if (!rpeParExo[exo][dKey] || charge > rpeParExo[exo][dKey].charge)
        rpeParExo[exo][dKey] = { date: dateRow, charge, rpe };
    }
  }

  if (Object.keys(datesRecentes).length === 0 && !athleteEnPause(athlete_id))
    alertes.push({ type: 'irregularite', severite: 'haute', message: 'Aucune séance depuis 7 jours ou plus' });

  if (rpeCount7j > 0) {
    const rpeMoyen = rpeTotal7j / rpeCount7j;
    const pctParExo = [];
    Object.keys(chargeParExo7jSum).forEach(exo => {
      if (chargeParExoPrecCount[exo] > 0) {
        const avant = chargeParExoPrecSum[exo] / chargeParExoPrecCount[exo];
        const apres = chargeParExo7jSum[exo]   / chargeParExo7jCount[exo];
        if (avant > 0) pctParExo.push((apres - avant) / avant * 100);
      }
    });
    if (pctParExo.length > 0) {
      const chargeEvol = Math.round(pctParExo.reduce((a, b) => a + b, 0) / pctParExo.length);
      if (rpeMoyen > 8.5 && chargeEvol < -5)
        alertes.push({ type: 'fatigue', severite: 'haute',
          message: 'RPE moyen élevé (' + Math.round(rpeMoyen * 10) / 10 + ') combiné à une baisse de charge de ' + chargeEvol + '%' });
    }
  }

  const niveau = getNiveauExperienceGS(anneesPratique);
  const seuil  = seuilStagnation(niveau);
  Object.keys(progressionParExo).forEach(exo => {
    const entries = Object.values(progressionParExo[exo]).sort((a, b) => a.date - b.date);
    if (entries.length < seuil) return;
    const derniersN = entries.slice(-seuil);
    let meilleurAvant = null, progresse = false;
    for (let k = 0; k < derniersN.length; k++) {
      const en = derniersN[k];
      if (meilleurAvant && (en.charge > meilleurAvant.charge || (en.charge === meilleurAvant.charge && en.reps > meilleurAvant.reps)))
        progresse = true;
      if (!meilleurAvant || en.charge > meilleurAvant.charge || (en.charge === meilleurAvant.charge && en.reps > meilleurAvant.reps))
        meilleurAvant = en;
    }
    if (!progresse)
      alertes.push({ type: 'stagnation', severite: 'moyenne',
        message: exo + ' : aucun progrès depuis ' + seuil + ' séances (niveau ' + niveau + ')' });
  });

  Object.keys(rpeParExo).forEach(exo => {
    const sessions = Object.values(rpeParExo[exo]).sort((a, b) => a.date - b.date);
    if (sessions.length < 4) return;
    const last4 = sessions.slice(-4);
    const rpeAvant  = (last4[0].rpe  + last4[1].rpe)  / 2;
    const rpeApres  = (last4[2].rpe  + last4[3].rpe)  / 2;
    const chgAvant  = (last4[0].charge + last4[1].charge) / 2;
    const chgApres  = (last4[2].charge + last4[3].charge) / 2;
    const rpeHausse = rpeApres - rpeAvant;
    const chgPct    = chgAvant > 0 ? (chgApres - chgAvant) / chgAvant * 100 : 0;
    if (rpeHausse >= 1.0 && chgPct < 3) {
      alertes.push({ type: 'fatigue_rpe', severite: 'moyenne',
        message: exo + ' : RPE en hausse de +' + Math.round(rpeHausse * 10) / 10
          + ' pt (moy. ' + Math.round(rpeApres * 10) / 10 + ') sans progression de charge — fatigue latente ?' });
    }
  });

  return alertes;
}

// =============================================================================
// AUTHENTIFICATION & PROFIL
// =============================================================================

function debug(e) {
  const login = e.parameter.login;
  const sheet = SS.getSheetByName('Athletes');
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) === login) return json({ login_sheet: String(rows[i][1]), nom: rows[i][2] });
  }
  return json({ message: 'login non trouve' });
}

function debugCoach(e) {
  const coach_id = e.parameter.coach_id;
  const sheet = SS.getSheetByName('Athletes');
  const rows  = sheet.getDataRange().getValues();
  const header = rows[0] || [];
  const matches = [];
  for (let i = 1; i < rows.length; i++) {
    matches.push({
      col0: rows[i][0], col2: rows[i][2],
      col6: rows[i][6], col7: rows[i][7], col8: rows[i][8]
    });
  }
  return json({ coach_id_cherche: coach_id, header, athletes_raw: matches.slice(0, 5) });
}

function athleteFromRow(row) {
  return {
    athlete_id:            row[0],
    nom:                   row[3],
    objectif:              getObjectif(row[0]),
    annees_pratique:       Number(row[6]) || 0,
    poids:                 getPoidsActuel(row[0]),
    strategie_progression: String(row[7] || 'Progression linéaire'),
    sport:                 lireSportAthlete(row[0])   // Phase 3 : route la vue athlète (muscu vs sport co)
  };
}

function loginPost(body) { return login({ parameter: body }); }

function registerPost(body) { return register({ parameter: body }); }

function login(e) {
  const loginVal = e.parameter.login;
  const pwd = e.parameter.password || '';
  if (!verifierRateLimit('ath_' + loginVal))
    return json({ success: false, error: 'Trop de tentatives. Réessaie dans 10 minutes.' });
  const sheet = SS.getSheetByName('Athletes');
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) === String(loginVal)) {
      const storedHash = String(rows[i][9] || '');       // col J = password_hash
      if (storedHash === '') {
        // Compte sans mot de passe (ex. inscrit pendant la panne) : on le fixe (salé) à la 1re connexion.
        sheet.getRange(i + 1, 10).setValue('s2$' + hashPasswordSalted(pwd, loginVal));
      } else {
        const v = verifierMotDePasse(pwd, storedHash, loginVal);
        if (!v.ok) return json({ success: false, error: 'Mot de passe incorrect' });
        if (v.upgrade) sheet.getRange(i + 1, 10).setValue(v.upgrade); // migration transparente
      }
      resetRateLimit('ath_' + loginVal);
      return json({ success: true, athlete: athleteFromRow(rows[i]) });
    }
  }
  return json({ success: false, error: 'Identifiant introuvable' });
}

function register(e) {
  const login    = String(e.parameter.login || '');
  const prenom   = String(e.parameter.prenom || '');
  const ddn      = String(e.parameter.ddn || '');
  const taille   = String(e.parameter.taille || '');
  const annees   = Number(e.parameter.annees) || 0;
  const password = String(e.parameter.password || '');
  const sport    = String(e.parameter.sport || 'muscu').trim() || 'muscu';   // Phase 3 : sport auto-déclaré
  const sheet    = SS.getSheetByName('Athletes');
  const rows     = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) === login) return json({ success: false, message: 'Ce login est deja utilise.' });
  }
  let maxId = 0;
  for (let j = 1; j < rows.length; j++) { const id = Number(rows[j][0]); if (!isNaN(id) && id > maxId) maxId = id; }
  const newId = maxId + 1;
  // Stratégie de progression = concept muscu → vide pour les autres sports.
  const strategie = (sport === 'muscu') ? getStrategieFromAnnees(annees) : '';
  // Mot de passe haché (salé) dès l'inscription → password_hash rempli (col J).
  const hash = password ? 's2$' + hashPasswordSalted(password, login) : '';
  // Colonnes Athletes : [id, login, C, prenom, ddn, taille, annees, strategie, coach_id(I), password_hash(J), sport(K)]
  sheet.appendRow([newId, login, '', prenom, formatDateFR(ddn), taille, annees, strategie, '', hash, sport]);
  return json({ success: true, athlete: {
    athlete_id: newId, nom: prenom, objectif: '',
    annees_pratique: annees, poids: null, strategie_progression: strategie, sport: sport
  }});
}

// =============================================================================
// SÉCURITÉ MOTS DE PASSE (restauré depuis la version du 08/07 — algorithme intact
// pour que les hash existants restent valides). Le pepper est en Script Properties.
// =============================================================================
function getPepper_() {
  const p = PropertiesService.getScriptProperties();
  let v = p.getProperty('PWD_PEPPER');
  if (!v) { v = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('PWD_PEPPER', v); }
  return v;
}
// Hachage salé (sel = identifiant unique de l'utilisateur) + pepper serveur.
function hashPasswordSalted(pwd, salt) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(salt) + '|' + getPepper_() + '|' + pwd,
    Utilities.Charset.UTF_8);
  return bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}
// Ancien hachage (non salé) — conservé UNIQUEMENT pour la migration.
function hashPasswordLegacy(pwd) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pwd, Utilities.Charset.UTF_8);
  return bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}
// Vérifie un mot de passe. Renvoie {ok, upgrade}. upgrade = hash salé à ré-écrire (migration) ou null.
function verifierMotDePasse(pwd, storedHash, salt) {
  if (storedHash.indexOf('s2$') === 0) {
    return { ok: storedHash === 's2$' + hashPasswordSalted(pwd, salt), upgrade: null };
  }
  if (storedHash === hashPasswordLegacy(pwd)) {
    return { ok: true, upgrade: 's2$' + hashPasswordSalted(pwd, salt) };
  }
  return { ok: false, upgrade: null };
}
// Rate-limiting : 5 tentatives / 10 min par clé (anti brute-force).
function verifierRateLimit(cle) {
  const cache = CacheService.getScriptCache();
  const k = 'rl_' + cle;
  const n = Number(cache.get(k) || 0);
  if (n >= 5) return false;
  cache.put(k, String(n + 1), 600);
  return true;
}
function resetRateLimit(cle) { CacheService.getScriptCache().remove('rl_' + cle); }

// =============================================================================
// INSCRIPTION COACH + SUPPRESSION COMPTE + LIAISON (restaurés depuis le 08/07)
// =============================================================================
function registerCoach(e) {
  const login = String(e.parameter.login || '');
  const nom = String(e.parameter.nom || '');
  const password = String(e.parameter.password || '');
  const sport = String(e.parameter.sport || 'muscu').trim() || 'muscu';   // Phase 3 : choisi à l'inscription
  if (!login || !nom || !password) return json({ success: false, error: 'Champs manquants' });
  const sheet = SS.getSheetByName('Coachs');
  const rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) === login) return json({ success: false, error: 'Cet identifiant coach est déjà utilisé.' });
  }
  var maxId = 0;
  for (var j = 1; j < rows.length; j++) { var id = Number(rows[j][0]); if (!isNaN(id) && id > maxId) maxId = id; }
  var newId = maxId + 1;
  var hash = 's2$' + hashPasswordSalted(password, login);
  // Colonnes Coachs : [coach_id, login, nom, password_hash(D), sport(E)]
  sheet.appendRow([newId, login, nom, hash, sport]);
  return json({ success: true, coach: { coach_id: newId, nom: nom, sport: sport } });
}

function supprimerCompte(body) {
  var athleteId = String(body.athlete_id || '');
  if (!athleteId) return json({ success: false, error: 'athlete_id manquant' });
  var cibles = [
    { sheet: 'Athletes',          col: 0 },
    { sheet: 'Performances',      col: 4 },
    { sheet: 'Poids_historique',  col: 1 },
    { sheet: 'Objectif',          col: 0 },
    { sheet: 'Programme',         col: 0 },
    { sheet: 'Commentaires',      col: 4 }
  ];
  cibles.forEach(function(c) {
    var sh = SS.getSheetByName(c.sheet);
    if (!sh) return;
    var data = sh.getDataRange().getValues();
    for (var i = data.length - 1; i >= 1; i--) {
      if (String(data[i][c.col]) === athleteId) sh.deleteRow(i + 1);
    }
  });
  try { CacheService.getScriptCache().remove('appdata_' + athleteId); } catch (e) {}
  return json({ success: true });
}

function lierAthlete(e) {
  const loginAth = e.parameter.login_athlete;
  const coach_id = e.parameter.coach_id;
  const sheet = SS.getSheetByName('Athletes');
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) === loginAth) {
      sheet.getRange(i + 1, 9).setValue(coach_id);   // col I = coach_id
      sheet.getRange(i + 1, 3).setValue(coach_id);   // col C = loginCoach
      return json({ success: true });
    }
  }
  return json({ success: false, error: 'Athlète introuvable' });
}

// Le coach crée un athlète directement (rattaché à lui, sport hérité). Phase 3.
function coachCreerAthlete(body) {
  var coach_id = String(body.coach_id || '');
  var login    = String(body.login || '');
  var prenom   = String(body.prenom || '');
  var ddn      = String(body.ddn || '');
  var taille   = String(body.taille || '');
  var annees   = Number(body.annees) || 0;
  var password = String(body.password || '');
  if (!coach_id || !login || !prenom || !password) return json({ success: false, error: 'Champs manquants' });
  var sheet = SS.getSheetByName('Athletes');
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) === login) return json({ success: false, error: 'Ce login est déjà utilisé.' });
  }
  var maxId = 0;
  for (var j = 1; j < rows.length; j++) { var id = Number(rows[j][0]); if (!isNaN(id) && id > maxId) maxId = id; }
  var newId = maxId + 1;
  var sportCoach = lireSportCoach(coach_id);   // le nouvel athlète hérite du sport du coach
  // Stratégie de progression = concept muscu → vide pour les autres sports.
  var strategie = (sportCoach === 'muscu') ? getStrategieFromAnnees(annees) : '';
  var hash = 's2$' + hashPasswordSalted(password, login);
  // Rattaché direct : col C + col I = coach_id (comme lierAthlete). Col K = sport hérité (lisibilité Sheet).
  sheet.appendRow([newId, login, coach_id, prenom, formatDateFR(ddn), taille, annees, strategie, coach_id, hash, sportCoach]);
  return json({ success: true, athlete_id: newId });
}

// =============================================================================
// SAUVEGARDE AUTOMATIQUE (restauré depuis le 08/07)
// =============================================================================
function sauvegarderApp() {
  var tz = Session.getScriptTimeZone();
  var nomBackup = 'Backup_MuscuApp_' + Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd_HH-mm');
  var fichier = DriveApp.getFileById(SS.getId());
  var dossierParent = fichier.getParents().hasNext() ? fichier.getParents().next() : DriveApp.getRootFolder();
  var dossiers = dossierParent.getFoldersByName('Backups MuscuApp');
  var dossierBackup = dossiers.hasNext() ? dossiers.next() : dossierParent.createFolder('Backups MuscuApp');
  fichier.makeCopy(nomBackup, dossierBackup);
  var fichiers = dossierBackup.getFiles();
  var liste = [];
  while (fichiers.hasNext()) liste.push(fichiers.next());
  liste.sort(function(a, b) { return b.getDateCreated() - a.getDateCreated(); });
  for (var i = 14; i < liste.length; i++) liste[i].setTrashed(true);
}
function installerSauvegardeAuto() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'sauvegarderApp') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sauvegarderApp').timeBased().everyDays(1).atHour(3).create();
}

function getObjectif(athlete_id) {
  try {
    const rows = SS.getSheetByName('Objectif').getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) if (rows[i][0] == athlete_id) return rows[i][4];
  } catch (e) {}
  return '';
}

function getPoidsActuel(athlete_id) {
  try {
    const rows = SS.getSheetByName('Objectif').getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) if (rows[i][0] == athlete_id) return rows[i][2];
  } catch (e) {}
  return null;
}

function saveObjectif(body) {
  const sheet = SS.getSheetByName('Objectif');
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] == body.athlete_id) {
      sheet.getRange(i + 1, 5).setValue(body.objectif);
      CacheService.getScriptCache().remove('appdata_' + body.athlete_id);
      return json({ success: true });
    }
  }
  return json({ success: false });
}

function savePoids(body) {
  const sheetObj  = SS.getSheetByName('Objectif');
  const rowsObj   = sheetObj.getDataRange().getValues();
  for (let i = 1; i < rowsObj.length; i++) {
    if (rowsObj[i][0] == body.athlete_id) {
      sheetObj.getRange(i + 1, 3).setValue(body.poids);
      sheetObj.getRange(i + 1, 4).setValue(formatDateFR(body.date));
      break;
    }
  }
  SS.getSheetByName('Poids_historique').appendRow([formatDateFR(body.date), body.athlete_id, body.athlete || '', body.poids]);
  CacheService.getScriptCache().remove('appdata_' + body.athlete_id);
  return json({ success: true });
}

function saveNote(body) {
  SS.getSheetByName('Notes').appendRow([formatDateFR(body.date), body.athlete_id, body.athlete, body.seance_id, body.note]);
  return json({ success: true });
}

// =============================================================================
// COMMENTAIRES
// =============================================================================

function getCommentaires(e) {
  const athlete_id = e.parameter.athlete_id;
  const sheet = SS.getSheetByName('Commentaires');
  if (!sheet) return json({ commentaires: [] });
  const rows = sheet.getDataRange().getValues();
  const commentaires = [];
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][4]) !== String(athlete_id)) continue;
    const auteurBrut = rows[i][7];
    const auteur = (auteurBrut != null && String(auteurBrut).trim() !== '')
      ? String(auteurBrut).trim().toLowerCase()
      : ((String(rows[i][2] || '').trim() === '' && String(rows[i][3] || '').trim() === '') ? 'athlete' : 'coach');
    commentaires.push({
      id:         rows[i][0],
      date:       rows[i][1],
      coach_id:   rows[i][2],
      coach_nom:  rows[i][3],
      message:    rows[i][5],
      lu:         rows[i][6] === true || String(rows[i][6]).toUpperCase() === 'TRUE',
      auteur:     auteur,
      auteur_nom: (rows[i][8] != null && String(rows[i][8]).trim() !== '') ? rows[i][8] : (auteur === 'coach' ? rows[i][3] : '')
    });
  }
  commentaires.sort((a, b) => Number(b.id) - Number(a.id));
  return json({ commentaires });
}

function saveCommentaire(data) {
  let sheet = SS.getSheetByName('Commentaires');
  if (!sheet) {
    sheet = SS.insertSheet('Commentaires');
    sheet.appendRow(['comment_id', 'date', 'coach_id', 'coach_nom', 'athlete_id', 'message', 'lu', 'auteur', 'auteur_nom']);
  }
  const id      = new Date().getTime();
  const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
  const auteur = (data.auteur === 'athlete') ? 'athlete' : 'coach';
  sheet.appendRow([id, dateStr, data.coach_id || '', data.coach_nom || '', data.athlete_id, data.message, false, auteur, data.auteur_nom || '']);
  return json({ success: true });
}

function marquerCommentairesLus(data) {
  const sheet = SS.getSheetByName('Commentaires');
  if (!sheet) return json({ success: true });
  const idsStr = (data.ids || []).map(String);
  const rows   = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (idsStr.indexOf(String(rows[i][0])) !== -1) sheet.getRange(i + 1, 7).setValue(true);
  }
  return json({ success: true });
}

function supprimerCommentaire(data) {
  const sheet = SS.getSheetByName('Commentaires');
  if (!sheet) return json({ success: false });
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0]) === String(data.id)) { sheet.deleteRow(i + 1); return json({ success: true }); }
  }
  return json({ success: false });
}

// =============================================================================
// EXERCICES & SÉANCES
// =============================================================================

function getExercices() {
  const cache  = CacheService.getScriptCache();
  const cached = cache.get('exercices');
  if (cached) return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);
  const sheet = SS.getSheetByName('Exercices');
  const rows  = sheet.getDataRange().getValues();
  const exercices = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0]) exercices.push({
      exercice_id:  rows[i][0],
      exercice:     rows[i][1],
      muscle:       rows[i][2],
      increment_kg: rows[i][3] || '2.5 / 5kg'
    });
  }
  const result = JSON.stringify({ exercices });
  cache.put('exercices', result, 3600);
  return ContentService.createTextOutput(result).setMimeType(ContentService.MimeType.JSON);
}

function getLastPerf(e) {
  const athlete_id = e.parameter.athlete_id;
  const seance_id  = e.parameter.seance_id;
  const sheet = SS.getSheetByName('Performances');
  const rows  = sheet.getDataRange().getValues();

  const seancesCourantes = {}, toutesSeances = {};

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[4]) !== String(athlete_id)) continue;
    const date    = String(row[0]);
    const exercice = String(row[5]);
    const charge  = Number(row[9]);
    const reps    = Number(row[10]);

    if (!toutesSeances[exercice]) toutesSeances[exercice] = {};
    if (!toutesSeances[exercice][date]) toutesSeances[exercice][date] = [];
    toutesSeances[exercice][date].push({ serie: row[8], charge, reps });

    if (String(row[2]) !== seance_id) continue;
    if (!seancesCourantes[exercice]) seancesCourantes[exercice] = {};
    if (!seancesCourantes[exercice][date]) seancesCourantes[exercice][date] = [];
    seancesCourantes[exercice][date].push({ serie: row[8], charge, reps });
  }

  const getRef = series => {
    let ref = series[0];
    for (const s of series) {
      if (s.charge > ref.charge || (s.charge === ref.charge && s.reps > ref.reps)) ref = s;
    }
    return ref;
  };

  const buildResult = seancesMap => {
    const dates    = Object.keys(seancesMap).sort().reverse();
    const lastDate = dates[0] || null, prevDate = dates[1] || null, prev2Date = dates[2] || null;
    const result   = {};
    if (lastDate) {
      Object.entries(seancesMap[lastDate]).forEach(([exo, series]) => {
        const ref = getRef(series);
        result[exo] = { date: lastDate, series, max_reps: ref.reps, last_charge: ref.charge,
          prev_max_reps: null, prev_charge: null, prev2_max_reps: null, prev2_charge: null };
      });
    }
    if (prevDate) Object.entries(seancesMap[prevDate]).forEach(([exo, series]) => {
      if (result[exo]) { const ref = getRef(series); result[exo].prev_max_reps = ref.reps; result[exo].prev_charge = ref.charge; }
    });
    if (prev2Date) Object.entries(seancesMap[prev2Date]).forEach(([exo, series]) => {
      if (result[exo]) { const ref = getRef(series); result[exo].prev2_max_reps = ref.reps; result[exo].prev2_charge = ref.charge; }
    });
    return { result, lastDate };
  };

  const { result: resultCourant } = buildResult(seancesCourantes);

  Object.keys(toutesSeances).forEach(exo => {
    if (!resultCourant[exo]) {
      const datesExo = Object.keys(toutesSeances[exo]).sort().reverse();
      const lastD = datesExo[0], prevD = datesExo[1], prev2D = datesExo[2];
      if (lastD) {
        const ref = getRef(toutesSeances[exo][lastD]);
        resultCourant[exo] = { date: lastD, series: toutesSeances[exo][lastD],
          max_reps: ref.reps, last_charge: ref.charge,
          prev_max_reps: null, prev_charge: null, prev2_max_reps: null, prev2_charge: null };
        if (prevD)  { const r = getRef(toutesSeances[exo][prevD]);  resultCourant[exo].prev_max_reps = r.reps; resultCourant[exo].prev_charge = r.charge; }
        if (prev2D) { const r = getRef(toutesSeances[exo][prev2D]); resultCourant[exo].prev2_max_reps = r.reps; resultCourant[exo].prev2_charge = r.charge; }
      }
    }
  });

  return json({ perfs: resultCourant });
}

function buildBienEtre(athlete_id) {
  const sheet = SS.getSheetByName('Bien_etre');
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (String(r[2]) !== String(athlete_id)) continue;
    out.push({
      _i:       i,
      date:     String(r[0] || ''),
      sommeil:  r[3] !== '' ? Number(r[3]) : null,
      energie:  r[4] !== '' ? Number(r[4]) : null,
      fatigue:  r[5] !== '' ? Number(r[5]) : null,
      douleur:  r[6] !== '' ? Number(r[6]) : null,
      zone:     String(r[7] || ''),
      ressenti: r[8] !== '' ? Number(r[8]) : null,
      note:     String(r[9] || '')
    });
  }
  out.sort((a, b) => {
    const da = parseDateFR(a.date), db = parseDateFR(b.date);
    const dd = (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
    return dd !== 0 ? dd : (b._i - a._i);
  });
  out.forEach(o => delete o._i);
  return out.slice(0, 10);
}

function saveBienEtre(body) {
  let sheet = SS.getSheetByName('Bien_etre');
  if (!sheet) {
    sheet = SS.insertSheet('Bien_etre');
    sheet.appendRow(['date','seance_id','athlete_id','sommeil','energie','fatigue_musculaire','douleur','zone_douloureuse','ressenti_global','note']);
  }
  sheet.appendRow([
    formatDateFR(body.date),
    String(body.seance_id || ''),
    String(body.athlete_id || ''),
    body.sommeil  != null ? Number(body.sommeil)  : '',
    body.energie  != null ? Number(body.energie)  : '',
    body.fatigue  != null ? Number(body.fatigue)  : '',
    body.douleur  != null ? Number(body.douleur)  : '',
    body.zone     != null ? String(body.zone)      : '',
    body.ressenti != null ? Number(body.ressenti)  : '',
    body.note     != null ? String(body.note)      : ''
  ]);
  if (body.athlete_id) { try { CacheService.getScriptCache().remove('appdata_' + body.athlete_id); } catch (ex) {} }
  return json({ success: true });
}

function saveSeance(data) {
  const sheet = SS.getSheetByName('Performances');
  data.forEach(row => { row[0] = formatDateFR(row[0]); row[1] = String(row[1]); sheet.appendRow(row); });

  // Phase 4 — double-écriture vers Indicateurs (agrégats session + par exercice).
  // Silencieux : ne jamais bloquer la sauvegarde principale.
  try {
    var shInd = _getSheetLoose('Indicateurs');
    if (shInd.getLastRow() === 0)
      shInd.getRange(1,1,1,7).setValues([['date','athlete_id','seance_id','cle','valeur','unite','source']]);

    var athlete_id = String(data[0][4]);
    var seance_id  = String(data[0][2]);
    var nom        = String(data[0][3] || '');
    var date       = data[0][0]; // déjà formaté dd/mm/yyyy

    // ── Agrégats ────────────────────────────────────────────────────────────
    var tonnage = 0, rpeSum = 0, rpeCount = 0;
    var exercicesSet = {}, musclesSet = {};
    // exo_id → { nom, muscle, charge_max, vol, reps, nb, rpe_s, rpe_n }
    var exoMap = {};

    data.forEach(function(r) {
      var charge = Number(r[9])  || 0;
      var reps   = Number(r[10]) || 0;
      var rpe    = Number(r[11]) || 0;
      var volume = Number(r[13]) || (charge * reps);
      var exo    = String(r[5]  || '');
      var muscle = String(r[6]  || '');
      var eid    = String(r[7]  || exo); // exercice_id ou nom exercice

      tonnage += volume;
      if (rpe > 0) { rpeSum += rpe; rpeCount++; }
      if (exo)    exercicesSet[exo]    = true;
      if (muscle) musclesSet[muscle]   = true;

      if (eid) {
        if (!exoMap[eid]) exoMap[eid] = { nom: exo, muscle: muscle, charge_max: 0, vol: 0, reps: 0, nb: 0, rpe_s: 0, rpe_n: 0 };
        var e = exoMap[eid];
        if (charge > e.charge_max) e.charge_max = charge;
        e.vol  += volume;
        e.reps += reps;
        e.nb++;
        if (rpe > 0) { e.rpe_s += rpe; e.rpe_n++; }
      }
    });

    var rpe_moy    = rpeCount > 0 ? Math.round((rpeSum / rpeCount) * 10) / 10 : null;
    var exoList    = Object.keys(exercicesSet).join(',');
    var muscleList = Object.keys(musclesSet).join(',');

    // ── Lignes session ───────────────────────────────────────────────────────
    var indRows = [];
    indRows.push([date, athlete_id, seance_id, 'type_seance', 'muscu', '', 'muscu']);
    if (nom) indRows.push([date, athlete_id, seance_id, 'nom_seance', nom, '', 'muscu']);
    indRows.push([date, athlete_id, seance_id, 'tonnage_total', Math.round(tonnage), 'kg', 'calculé']);
    indRows.push([date, athlete_id, seance_id, 'nb_series', data.length, 'n', 'calculé']);
    if (rpe_moy !== null) indRows.push([date, athlete_id, seance_id, 'rpe_moyen', rpe_moy, '1-10', 'calculé']);
    if (exoList)    indRows.push([date, athlete_id, seance_id, 'exercices', exoList, '', 'muscu']);
    if (muscleList) indRows.push([date, athlete_id, seance_id, 'muscles',   muscleList, '', 'muscu']);

    // ── Lignes par exercice ──────────────────────────────────────────────────
    for (var eid in exoMap) {
      var e   = exoMap[eid];
      var sid = seance_id + '_exo_' + eid;
      indRows.push([date, athlete_id, sid, 'exercice', e.nom, '', 'muscu']);
      if (e.muscle)       indRows.push([date, athlete_id, sid, 'muscle',       e.muscle,                          '', 'muscu']);
      if (e.charge_max > 0) indRows.push([date, athlete_id, sid, 'charge_max', e.charge_max,                     'kg', 'muscu']);
      if (e.vol > 0)      indRows.push([date, athlete_id, sid, 'volume_total', Math.round(e.vol),                'kg', 'muscu']);
      if (e.reps > 0)     indRows.push([date, athlete_id, sid, 'reps_total',   e.reps,                           'reps', 'muscu']);
      indRows.push([date, athlete_id, sid, 'nb_series', e.nb, 'n', 'muscu']);
      if (e.rpe_n > 0)    indRows.push([date, athlete_id, sid, 'rpe_moyen', Math.round((e.rpe_s / e.rpe_n) * 10) / 10, '1-10', 'muscu']);
    }

    if (indRows.length)
      shInd.getRange(shInd.getLastRow() + 1, 1, indRows.length, 7).setValues(indRows);

  } catch (err) {
    console.error('saveSeance > Indicateurs double-write:', err.message);
  }

  CacheService.getScriptCache().remove('appdata_' + data[0][4]);
  return json({ success: true });
}

// =============================================================================
// UTILITAIRES DATE
// =============================================================================

function formatDateFR(d) {
  if (!d) return '';
  try {
    const s = String(d);
    if (s.includes('/')) return s;
    const parts = s.split('-');
    if (parts.length === 3) return parts[2] + '/' + parts[1] + '/' + parts[0];
    const date = new Date(d);
    if (isNaN(date.getTime())) return s;
    const day   = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return day + '/' + month + '/' + date.getFullYear();
  } catch (e) { return String(d); }
}

function parseDateFR(d) {
  try {
    const s = String(d);
    if (s.includes('/')) {
      const parts = s.split('/');
      return new Date(parts[2] + '-' + parts[1] + '-' + parts[0]);
    }
    return new Date(d);
  } catch (e) { return null; }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// =============================================================================
// BILAN PDF — données pré-calculées côté serveur pour l'export coach
// Lit directement les colonnes brutes de Performances (muscle, rpe, charge, reps)
// afin de couvrir n'importe quelle période choisie.
// Colonnes Performances : [0]=date [2]=seance_id [4]=athlete_id
//                         [5]=exercice [6]=muscle [9]=charge [10]=reps [11]=rpe
// =============================================================================

function getBilanPDF(e) {
  const athlete_id = String(e.parameter.athlete_id || '');
  const periode    = String(e.parameter.periode    || 'mois'); // 'mois' | '3mois' | 'tout'
  if (!athlete_id) return json({ error: 'athlete_id manquant' });

  const rows = SS.getSheetByName('Performances').getDataRange().getValues();
  const maintenant = new Date(); maintenant.setHours(23, 59, 59, 0);

  // ── Fenêtre temporelle ──
  var debutPeriode;
  if (periode === '3mois') {
    debutPeriode = new Date(maintenant.getFullYear(), maintenant.getMonth() - 2, 1);
  } else if (periode === 'tout') {
    debutPeriode = new Date(2000, 0, 1);
  } else {
    debutPeriode = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
  }

  // ── Accumulation ──
  var seancesSet      = {};  // dates dans la période {dateStr: true}
  var toutesDatesSea  = {};  // toutes les dates (pour régularité)
  var totalSeries = 0, tonnage = 0;
  var rpeTotal = 0, rpeCount = 0;
  var rpeParExo      = {};  // {exo: {total, count}}
  var volParMuscle   = {};  // {muscle: count}
  var progParExo     = {};  // {exo: {dateStr: {charge, reps}}}
  var tonnageParSem  = {};  // {isoWeek: kg}
  var semDates       = {};  // {isoWeek: Date} — lundi de la semaine
  var premiereDate   = null;

  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    if (String(row[4]) !== athlete_id) continue;
    var dateRow = parseDateFR(row[0]);
    if (!dateRow) continue;

    var dateStr = formatDateFR(dateRow);
    toutesDatesSea[dateStr] = true;
    if (!premiereDate || dateRow < premiereDate) premiereDate = dateRow;
    if (dateRow < debutPeriode) continue;

    var exo    = String(row[5] || '');
    var muscle = String(row[6] || '').trim() || 'Non renseigné';
    var charge = Number(row[9]) || 0;
    var reps   = Number(row[10]) || 0;
    var rpe    = Number(row[11]) || 0;

    seancesSet[dateStr] = true;
    totalSeries++;
    var t = charge * reps;
    tonnage += t;
    var sem = _isoWeek(dateRow);
    tonnageParSem[sem] = (tonnageParSem[sem] || 0) + t;
    if (!semDates[sem] || dateRow < semDates[sem]) semDates[sem] = dateRow;

    if (rpe > 0) {
      rpeTotal += rpe; rpeCount++;
      if (!rpeParExo[exo]) rpeParExo[exo] = { total: 0, count: 0 };
      rpeParExo[exo].total += rpe; rpeParExo[exo].count++;
    }

    volParMuscle[muscle] = (volParMuscle[muscle] || 0) + 1;

    if (exo) {
      if (!progParExo[exo]) progParExo[exo] = {};
      var prev = progParExo[exo][dateStr];
      if (!prev || charge > prev.charge || (charge === prev.charge && reps > prev.reps))
        progParExo[exo][dateStr] = { date: dateStr, charge: charge, reps: reps };
    }
  }

  // ── Delta vs période précédente (même durée, juste avant) ──
  var delta = null;
  if (periode !== 'tout') {
    var dureeMs   = maintenant.getTime() - debutPeriode.getTime();
    var prevFin   = new Date(debutPeriode.getTime() - 1);
    var prevDebut = new Date(debutPeriode.getTime() - dureeMs);
    var prevSeancesSet = {}, prevSeries = 0, prevTonnage = 0;
    for (var p2 = 1; p2 < rows.length; p2++) {
      var rp = rows[p2];
      if (String(rp[4]) !== athlete_id) continue;
      var dp = parseDateFR(rp[0]);
      if (!dp || dp < prevDebut || dp > prevFin) continue;
      prevSeancesSet[formatDateFR(dp)] = true;
      prevSeries++;
      prevTonnage += (Number(rp[9]) || 0) * (Number(rp[10]) || 0);
    }
    var prevNbSeances = Object.keys(prevSeancesSet).length;
    delta = {
      seances:     Object.keys(seancesSet).length - prevNbSeances,
      series_pct:  prevSeries  > 0 ? Math.round((totalSeries - prevSeries)  / prevSeries  * 100) : null,
      tonnage_pct: prevTonnage > 0 ? Math.round((tonnage     - prevTonnage) / prevTonnage * 100) : null
    };
  }

  // ── Nombre de semaines réel ──
  var datesArr = Object.keys(seancesSet).map(function(ds) {
    var p = ds.split('/'); return new Date(+p[2], +p[1]-1, +p[0]);
  }).sort(function(a,b){ return a-b; });
  var debutEffectif = datesArr.length > 0 ? datesArr[0] : debutPeriode;
  var nbSemaines = Math.max(1, Math.round((maintenant - debutEffectif) / (7 * 24 * 3600 * 1000)));
  var nbSeances = Object.keys(seancesSet).length;

  // ── Streak (semaines consécutives avec au moins 1 séance) ──
  var streak = _computeStreak(Object.keys(toutesDatesSea), maintenant);

  // ── RPE par exercice ──
  var rpeParExoFmt = Object.keys(rpeParExo).map(function(exo) {
    var v = rpeParExo[exo];
    return { exo: exo, rpe: Math.round(v.total / v.count * 10) / 10 };
  }).sort(function(a,b){ return b.rpe - a.rpe; });
  var rpeMoyen = rpeCount > 0 ? Math.round(rpeTotal / rpeCount * 10) / 10 : null;

  // ── Volume par muscle ──
  var volParMuscleFmt = Object.keys(volParMuscle).map(function(m) {
    return { muscle: m, series: volParMuscle[m] };
  }).sort(function(a,b){ return b.series - a.series; });

  // ── Progression / Régression ──
  var progressionFmt = [];
  Object.keys(progParExo).forEach(function(exo) {
    var byDate = progParExo[exo];
    var entries = Object.values(byDate).sort(function(a, b) {
      var pa = a.date.split('/'), pb = b.date.split('/');
      return new Date(+pa[2],+pa[1]-1,+pa[0]) - new Date(+pb[2],+pb[1]-1,+pb[0]);
    });
    if (entries.length < 2) return;
    var first = entries[0], last = entries[entries.length - 1];
    var diffKg   = (last.charge || 0) - (first.charge || 0);
    var diffReps = (last.reps   || 0) - (first.reps   || 0);
    progressionFmt.push({
      exo:          exo,
      debut_charge: first.charge, debut_reps: first.reps,
      fin_charge:   last.charge,  fin_reps:   last.reps,
      diff_kg:      diffKg,       diff_reps:  diffReps,
      nb_seances:   entries.length,
      evol: diffKg > 0 ? 'up' : diffKg < 0 ? 'down' : diffReps > 0 ? 'reps_up' : 'stable'
    });
  });

  // ── Records du mois (pour les dots régularité) ──
  var recordsAllTime = {};
  var debutMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
  var datesRecordsMois = {};

  for (var j = 1; j < rows.length; j++) {
    var r2 = rows[j];
    if (String(r2[4]) !== athlete_id) continue;
    var dr = parseDateFR(r2[0]);
    if (!dr) continue;
    var exo2   = String(r2[5] || '');
    var chg2   = Number(r2[9]) || 0;
    if (!exo2 || chg2 <= 0) continue;
    var estCeMois = dr >= debutMois;
    var ds2 = formatDateFR(dr);
    if (!estCeMois) {
      if (!recordsAllTime[exo2] || chg2 > recordsAllTime[exo2]) recordsAllTime[exo2] = chg2;
    } else {
      if (recordsAllTime[exo2] && chg2 > recordsAllTime[exo2]) datesRecordsMois[ds2] = true;
    }
  }

  // ── Label période lisible ──
  var fmt = function(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy'); };
  var periodeLabel;
  if (periode === 'tout') {
    periodeLabel = premiereDate ? 'Depuis le ' + fmt(premiereDate) : 'Toute la période';
  } else {
    periodeLabel = fmt(debutPeriode) + ' → ' + fmt(maintenant);
  }

  return json({
    periode:               periode,
    periode_label:         periodeLabel,
    premiere_seance:       premiereDate ? fmt(premiereDate) : null,
    debut_periode_effectif: fmt(debutEffectif),
    seances:               nbSeances,
    series:                totalSeries,
    tonnage_kg:            Math.round(tonnage),
    tonnage_par_seance:    nbSeances > 0 ? Math.round(tonnage / nbSeances) : 0,
    nb_semaines:           nbSemaines,
    seances_par_semaine:   Math.round(nbSeances / nbSemaines * 10) / 10,
    streak:                streak,
    rpe_moyen:             rpeMoyen,
    rpe_par_exercice:      rpeParExoFmt,
    volume_par_muscle:     volParMuscleFmt,
    progression:           progressionFmt,
    dates_seances:         Object.keys(toutesDatesSea),
    dates_seances_periode: Object.keys(seancesSet),
    dates_records_mois:    Object.keys(datesRecordsMois),
    tonnage_par_semaine:   Object.keys(tonnageParSem).sort().map(function(w) {
      var lundi = semDates[w];
      var lundiLabel = lundi ? Utilities.formatDate(lundi, Session.getScriptTimeZone(), 'dd/MM') : w;
      return { semaine: w, tonnage: Math.round(tonnageParSem[w]), label: lundiLabel };
    }),
    delta: delta
  });
}

function _computeStreak(datesArr, maintenant) {
  // Groupe les dates par semaine ISO
  var semaines = {};
  datesArr.forEach(function(ds) {
    var p = ds.split('/');
    if (p.length < 3) return;
    var d = new Date(+p[2], +p[1]-1, +p[0]);
    semaines[_isoWeek(d)] = true;
  });

  // Lundi de la semaine courante
  var lundi = new Date(maintenant);
  var dow = lundi.getDay() === 0 ? 6 : lundi.getDay() - 1;
  lundi.setDate(lundi.getDate() - dow);
  lundi.setHours(0, 0, 0, 0);

  var streak = 0;
  var semDebut = new Date(lundi);
  for (var w = 0; w < 52; w++) {
    var yw = _isoWeek(semDebut);
    if (semaines[yw]) {
      streak++;
      semDebut.setDate(semDebut.getDate() - 7);
    } else {
      if (w === 0) {
        // Semaine courante sans séance — on commence à vérifier la précédente
        semDebut.setDate(semDebut.getDate() - 7);
        continue;
      }
      break;
    }
  }
  return streak;
}

function _isoWeek(date) {
  var d = new Date(date); d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  var w1 = new Date(d.getFullYear(), 0, 4);
  var wn = 1 + Math.round(((d - w1) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7);
  return d.getFullYear() + '-W' + (wn < 10 ? '0' : '') + wn;
}

// =============================================================================
// DÉMO FOOT — données fictives pour le pitch (À EXÉCUTER À LA MAIN depuis l'éditeur)
// Crée : 1 coach démo (foot) + 6 joueurs + ~5 semaines de séances (charge interne,
// GPS, RPE) dans l'onglet `Indicateurs` + le bien-être. 2 joueurs "à risque".
// Re-exécutable : nettoie la démo précédente avant de recréer.
//   → Lancer seedDemoFoot()   pour (re)créer.
//   → Lancer resetDemoFoot()  pour tout supprimer.
// Coach démo : login "demofoot" / mot de passe "demo1234".
// =============================================================================
var DEMO_COACH_LOGIN = 'demofoot';
var DEMO_PLAYER_LOGINS = ['9001','9002','9003','9004','9005','9006'];

// Retrouve un onglet par nom en tolérant espaces/casse ; le crée sinon.
function _getSheetLoose(name) {
  var target = String(name).trim().toLowerCase();
  var sheets = SS.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (String(sheets[i].getName()).trim().toLowerCase() === target) return sheets[i];
  }
  return SS.insertSheet(name);
}

// Trouve un onglet (tolérant au nom) SANS le créer. null si absent.
function _findSheetLoose(name) {
  var target = String(name).trim().toLowerCase();
  var sheets = SS.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (String(sheets[i].getName()).trim().toLowerCase() === target) return sheets[i];
  }
  return null;
}

// Supprime les lignes dont colIndex ∈ valuesSet, en RÉÉCRIVANT l'onglet d'un coup
// (bien plus rapide que deleteRow ligne par ligne sur des milliers de lignes).
function _demoSupprimerLignes(sheetName, colIndex, valuesSet) {
  var sh = _findSheetLoose(sheetName);
  if (!sh || sh.getLastRow() <= 1) return;
  var data = sh.getDataRange().getValues();
  var kept = [data[0]]; // en-tête
  var removed = 0;
  for (var i = 1; i < data.length; i++) {
    if (valuesSet[String(data[i][colIndex])]) { removed++; continue; }
    kept.push(data[i]);
  }
  if (removed === 0) return;
  sh.clearContents();
  sh.getRange(1, 1, kept.length, kept[0].length).setValues(kept);
}

function resetDemoFoot() {
  var shAth = SS.getSheetByName('Athletes');
  var ids = {};
  if (shAth) {
    var ra = shAth.getDataRange().getValues();
    for (var i = 1; i < ra.length; i++) {
      if (DEMO_PLAYER_LOGINS.indexOf(String(ra[i][1])) !== -1) ids[String(ra[i][0])] = true;
    }
  }
  _demoSupprimerLignes('Indicateurs', 1, ids);   // athlete_id en col B
  _demoSupprimerLignes('Bien_etre', 2, ids);     // athlete_id en col C
  _demoSupprimerLignes('Tests', 1, ids);         // athlete_id en col B
  _demoSupprimerLignes('Objectifs', 1, ids);     // athlete_id en col B (col A = id)
  _demoSupprimerLignes('Blessures', 1, ids);     // athlete_id en col B (col A = id)
  var loginsSet = {}; DEMO_PLAYER_LOGINS.forEach(function(l){ loginsSet[l] = true; });
  _demoSupprimerLignes('Athletes', 1, loginsSet); // login en col B
  var demoCoach = {}; demoCoach[DEMO_COACH_LOGIN] = true;
  _demoSupprimerLignes('Coachs', 1, demoCoach);   // login en col B
  return 'Démo foot supprimée.';
}

// Identifiant court unique (objectifs, blessures…).
function _newId(prefix) {
  return String(prefix || 'x') + Date.now().toString(36) + Math.floor(Math.random() * 1000000).toString(36);
}

// Heatmap démo : 18 zones (6 colonnes de la longueur du terrain × 3 couloirs), pondérées par le poste.
function genHeatFoot(poste) {
  var cols = 6, rows = 3, z = [];
  var centerCol = poste === 'Gardien' ? 0.3 : (poste === 'Défenseur' ? 1.4 : (poste === 'Milieu' ? 2.8 : 4.2));
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      var dc = Math.abs(c - centerCol), dr = Math.abs(r - 1);
      var base = Math.max(0, 100 - dc * 26 - dr * 22) * (0.7 + Math.random() * 0.5);
      z.push(Math.min(100, Math.round(base)));
    }
  }
  return z.join(',');
}

function seedDemoFoot() {
  resetDemoFoot();

  // --- Onglet Indicateurs (tolérant au nom) : garantir les en-têtes en ligne 1 ---
  var shInd = _getSheetLoose('Indicateurs');
  var HDR_IND = ['date','athlete_id','seance_id','cle','valeur','unite','source'];
  if (shInd.getLastRow() === 0) {
    shInd.getRange(1, 1, 1, HDR_IND.length).setValues([HDR_IND]);
  } else if (String(shInd.getRange(1, 1).getValue()).toLowerCase() !== 'date') {
    shInd.insertRowBefore(1);
    shInd.getRange(1, 1, 1, HDR_IND.length).setValues([HDR_IND]);
  }

  // --- Coach démo (foot) ---
  var shC = SS.getSheetByName('Coachs');
  var rc = shC.getDataRange().getValues();
  var maxCoach = 0;
  for (var c = 1; c < rc.length; c++) { var ci = Number(rc[c][0]); if (!isNaN(ci) && ci > maxCoach) maxCoach = ci; }
  var coachId = maxCoach + 1;
  shC.appendRow([coachId, DEMO_COACH_LOGIN, 'Coach Démo (Foot)', 's2$' + hashPasswordSalted('demo1234', DEMO_COACH_LOGIN), 'foot']);

  // --- 6 joueurs ---
  var shA = SS.getSheetByName('Athletes');
  var ra = shA.getDataRange().getValues();
  var maxAth = 0;
  for (var a = 1; a < ra.length; a++) { var ai = Number(ra[a][0]); if (!isNaN(ai) && ai > maxAth) maxAth = ai; }

  var profils = [
    { prenom: 'Lucas',  poste: 'Gardien',    risque: null,      jambe: 'Droite', ddn: '12/04/1998', taille: 186, poids: 82, antecedents: '' },
    { prenom: 'Hugo',   poste: 'Défenseur',  risque: null,      jambe: 'Gauche', ddn: '03/09/2001', taille: 182, poids: 78, antecedents: 'Entorse cheville gauche (2023)' },
    { prenom: 'Nathan', poste: 'Milieu',     risque: 'charge',  jambe: 'Droite', ddn: '14/03/2002', taille: 178, poids: 72, antecedents: 'Élongation ischio droit (2024)' },   // ACWR élevé + fatigue
    { prenom: 'Enzo',   poste: 'Milieu',     risque: null,      jambe: 'Droite', ddn: '27/06/2000', taille: 176, poids: 70, antecedents: '' },
    { prenom: 'Théo',   poste: 'Attaquant',  risque: 'douleur', jambe: 'Gauche', ddn: '08/11/1999', taille: 180, poids: 75, antecedents: 'Pubalgie (2023)' },  // douleur + fatigue
    { prenom: 'Malo',   poste: 'Attaquant',  risque: 'absence', jambe: 'Droite', ddn: '19/01/2003', taille: 179, poids: 74, antecedents: '' }   // irrégulier
  ];

  var joueurs = [];
  for (var p = 0; p < profils.length; p++) {
    var id = maxAth + 1 + p;
    var login = DEMO_PLAYER_LOGINS[p];
    var hash = 's2$' + hashPasswordSalted('demo1234', login);
    // [... antecedents(O), heatmap(P), sexe(Q), club(R), categorie(S), date_entree(T)]
    var heatmap = genHeatFoot(profils[p].poste);
    shA.appendRow([id, login, coachId, profils[p].prenom, profils[p].ddn, profils[p].taille, 0, '', coachId, hash, 'foot', profils[p].poste, profils[p].jambe, profils[p].poids, profils[p].antecedents, heatmap, 'H', 'FC Démo', 'Séniors', ['2019','2021','2018','2022','2020','2023'][p] || '', 'Football']);
    joueurs.push({ id: id, profil: profils[p] });
  }

  // --- Séances (5 semaines, 4/sem : lun/mer/ven entrainement + dim match) ---
  var indRows = [];
  var wellRows = [];
  var aujourd = new Date(); aujourd.setHours(0,0,0,0);
  var jourSemaine = [1, 3, 5, 0]; // lun, mer, ven, dim(match)

  function rnd(min, max) { return Math.round(min + Math.random() * (max - min)); }
  function fmt(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy'); }

  for (var ji = 0; ji < joueurs.length; ji++) {
    var J = joueurs[ji];
    var seanceN = 0;
    for (var sem = 4; sem >= 0; sem--) {          // 5 semaines, de la plus ancienne à cette semaine
      for (var d2 = 0; d2 < jourSemaine.length; d2++) {
        // "Malo" (absence) saute la moitié des séances
        if (J.profil.risque === 'absence' && Math.random() < 0.5) continue;

        var dt = new Date(aujourd);
        var delta = sem * 7 + (aujourd.getDay() === 0 ? 6 : aujourd.getDay() - 1) - jourSemaine[d2];
        dt.setDate(dt.getDate() - delta);
        if (dt > aujourd) continue;
        var dateStr = fmt(dt);
        seanceN++;
        var sid = 'demo_' + J.id + '_' + sem + '_' + d2;
        var estMatch = (jourSemaine[d2] === 0);
        var semaineRecente = (sem <= 1); // 2 dernières semaines

        // Charge interne (RPE × durée)
        var duree = estMatch ? 90 : rnd(70, 90);
        var rpe = estMatch ? rnd(7, 9) : rnd(5, 7);
        if (J.profil.risque === 'charge' && semaineRecente) { rpe = rnd(9, 10); duree = rnd(95, 110); } // spike
        var charge = rpe * duree;

        // GPS
        var distTot = estMatch ? rnd(9000, 11000) : rnd(4500, 7000);
        var distHi  = estMatch ? rnd(700, 950)    : rnd(350, 600);
        if (J.profil.risque === 'charge' && semaineRecente) distHi = rnd(950, 1300);
        var sprints = estMatch ? rnd(18, 28) : rnd(8, 16);
        var vmax = rnd(29, 34);
        var accel = rnd(20, 45), decel = rnd(20, 45);
        var chargeGps = Math.round(distTot / 10 + distHi / 5);

        var add = function(cle, val, unite, src) { indRows.push([dateStr, J.id, sid, cle, val, unite, src || 'saisie']); };
        add('type_seance', estMatch ? 'match' : 'entrainement', '', 'saisie');
        add('duree', duree, 'min', 'saisie');
        add('rpe', rpe, '1-10', 'saisie');
        add('charge_interne', charge, 'UA', 'calculé');
        add('distance_totale', distTot, 'm', 'gps');
        add('distance_hi', distHi, 'm', 'gps');
        add('sprint_distance', estMatch ? rnd(250, 450) : rnd(120, 260), 'm', 'gps');
        add('sprints', sprints, 'nb', 'gps');
        add('vitesse_max', vmax, 'km/h', 'gps');
        add('accelerations', accel, 'nb', 'gps');
        add('decelerations', decel, 'nb', 'gps');
        add('charge_gps', chargeGps, 'UA', 'gps');
        if (estMatch) {
          add('minutes_jouees', rnd(45, 90), 'min', 'saisie');
          var posteJ = J.profil.poste;
          var note = Math.round((6.0 + Math.random() * 1.8) * 10) / 10; if (note > 9) note = 9;
          add('note', note, '/10', 'saisie');
          // Stats de match SPÉCIFIQUES AU POSTE (catalogue §6)
          if (posteJ === 'Attaquant') {
            var buts = rnd(0, 2);
            add('buts', buts, 'nb', 'saisie');
            add('xg', Math.round((buts * 0.5 + Math.random() * 0.6) * 100) / 100, 'xG', 'calculé');
            add('xa', Math.round((Math.random() * 0.5) * 100) / 100, 'xA', 'calculé');
            add('tirs', rnd(2, 6), 'nb', 'saisie');
            add('tirs_cadres', rnd(1, 4), 'nb', 'saisie');
            add('passes_cles', rnd(1, 4), 'nb', 'saisie');
            add('centres_reussis', rnd(0, 3), 'nb', 'saisie');
            add('passes_decisives', Math.random() < 0.35 ? 1 : 0, 'nb', 'saisie');
          } else if (posteJ === 'Milieu') {
            add('passes_reussies', rnd(40, 72), 'nb', 'saisie');
            add('passes_progressives', rnd(4, 10), 'nb', 'saisie');
            add('ballons_recuperes', rnd(5, 12), 'nb', 'saisie');
            add('pressings_reussis', rnd(6, 16), 'nb', 'saisie');
            add('duels_gagnes', rnd(4, 10), 'nb', 'saisie');
            add('passes_decisives', Math.random() < 0.30 ? 1 : 0, 'nb', 'saisie');
            add('buts', Math.random() < 0.15 ? 1 : 0, 'nb', 'saisie');
          } else if (posteJ === 'Défenseur') {
            add('interceptions', rnd(2, 6), 'nb', 'saisie');
            add('tacles_reussis', rnd(2, 7), 'nb', 'saisie');
            add('degagements', rnd(3, 10), 'nb', 'saisie');
            add('duels_gagnes', rnd(4, 11), 'nb', 'saisie');
            add('fautes', rnd(0, 3), 'nb', 'saisie');
          } else if (posteJ === 'Gardien') {
            add('arrets', rnd(1, 6), 'nb', 'saisie');
            add('xgot_arrete', Math.round((Math.random() * 2) * 100) / 100, 'xGOT', 'calculé');
            add('relances_reussies', rnd(15, 30), 'nb', 'saisie');
            add('sorties_aeriennes', rnd(0, 4), 'nb', 'saisie');
          }
        }

        // Bien-être (Bien_etre : date, seance_id, athlete_id, sommeil, energie, fatigue, douleur, zone, ressenti, note)
        var sommeil = rnd(3, 5), energie = rnd(3, 5), fatigue = rnd(1, 3), douleur = 0, ressenti = rnd(3, 5);
        if (J.profil.risque === 'charge' && semaineRecente) { fatigue = rnd(4, 5); sommeil = rnd(2, 3); }
        if (J.profil.risque === 'douleur' && semaineRecente) { douleur = rnd(2, 3); fatigue = rnd(3, 5); }
        wellRows.push([dateStr, sid, J.id, sommeil, energie, fatigue, douleur, douleur > 0 ? 'Cuisse' : '', ressenti, '']);
      }
    }
  }

  // --- Écriture en lot ---
  if (indRows.length) shInd.getRange(shInd.getLastRow() + 1, 1, indRows.length, 7).setValues(indRows);
  var shW = _getSheetLoose('Bien_etre');
  if (shW.getLastRow() === 0) shW.getRange(1,1,1,10).setValues([['date','seance_id','athlete_id','sommeil','energie','fatigue_musculaire','douleur','zone_douloureuse','ressenti_global','note']]);
  if (wellRows.length) shW.getRange(shW.getLastRow() + 1, 1, wellRows.length, 10).setValues(wellRows);

  // --- Tests physiques (3 dates : progression VMA / sprint / détente) ---
  var testRows = [];
  joueurs.forEach(function(J) {
    var base = { vma: 15.2, sprint_10m: 1.88, cmj: 37 };
    [56, 28, 0].forEach(function(daysAgo, k) {
      var dt = new Date(aujourd); dt.setDate(dt.getDate() - daysAgo);
      var ds = fmt(dt);
      testRows.push([ds, J.id, 'vma',        Math.round((base.vma + k * 0.4 + Math.random() * 0.3) * 10) / 10, 'km/h']);
      testRows.push([ds, J.id, 'sprint_10m', Math.round((base.sprint_10m - k * 0.03 + Math.random() * 0.02) * 100) / 100, 's']);
      testRows.push([ds, J.id, 'cmj',        Math.round(base.cmj + k * 1.2 + Math.random() * 2), 'cm']);
    });
  });
  var shT = _getSheetLoose('Tests');
  if (shT.getLastRow() === 0) shT.getRange(1,1,1,5).setValues([['date','athlete_id','cle','valeur','unite']]);
  if (testRows.length) shT.getRange(shT.getLastRow() + 1, 1, testRows.length, 5).setValues(testRows);

  // --- Objectifs (catalogue §2) ---
  var objRows = [];
  joueurs.forEach(function(J) {
    objRows.push([_newId('o'), J.id, 'developpement_physique', 'Gagner en explosivité — CMJ +4 cm d\'ici la trêve.', 'en_cours', '']);
    objRows.push([_newId('o'), J.id, 'performance', 'Densifier le jeu vers l\'avant — plus de passes progressives / 90 min.', 'en_cours', '']);
    if (J.profil.risque === 'charge' || J.profil.risque === 'douleur') {
      objRows.push([_newId('o'), J.id, 'prevention', 'Maîtriser la charge — respecter la progressivité et garder l\'ACWR sous 1,3.', 'a_surveiller', '']);
    }
  });
  var shObj = _getSheetLoose('Objectifs');
  if (shObj.getLastRow() === 0) shObj.getRange(1,1,1,6).setValues([['id','athlete_id','categorie','description','statut','date']]);
  if (objRows.length) shObj.getRange(shObj.getLastRow() + 1, 1, objRows.length, 6).setValues(objRows);

  // --- Blessures / réathlé (catalogue §9, décision #5) ---
  function dAgo(n){ var dt = new Date(aujourd); dt.setDate(dt.getDate() - n); return fmt(dt); }
  var injRows = [];
  joueurs.forEach(function(J) {
    var pr = J.profil;
    if (pr.prenom === 'Nathan') {
      // blessure récente, retour progressif (cohérent avec le statut "à risque / vigilance")
      injRows.push([_newId('b'), J.id, dAgo(28), 'Élongation', 'Ischio-jambier droit', 'Modérée', 18, dAgo(21), '', 'retour_progressif']);
    } else if (pr.antecedents) {
      var type = pr.antecedents.indexOf('Entorse') !== -1 ? 'Entorse' : (pr.antecedents.indexOf('Pubalgie') !== -1 ? 'Pubalgie' : 'Blessure');
      var loc  = pr.antecedents.indexOf('cheville') !== -1 ? 'Cheville gauche' : (pr.antecedents.indexOf('Pubalgie') !== -1 ? 'Pubis' : '');
      injRows.push([_newId('b'), J.id, dAgo(180), type, loc, 'Légère', 9, dAgo(168), dAgo(165), 'retabli']);
    }
  });
  var shInj = _getSheetLoose('Blessures');
  if (shInj.getLastRow() === 0) shInj.getRange(1,1,1,10).setValues([['id','athlete_id','date','type','localisation','gravite','duree','retour_terrain','retour_competition','statut']]);
  if (injRows.length) shInj.getRange(shInj.getLastRow() + 1, 1, injRows.length, 10).setValues(injRows);

  return 'Démo foot créée : coach "demofoot" (mdp demo1234), ' + joueurs.length + ' joueurs, ' +
         indRows.length + ' lignes Indicateurs (onglet "' + shInd.getName() + '"), ' + wellRows.length + ' bien-être, ' + testRows.length + ' tests, ' +
         objRows.length + ' objectifs, ' + injRows.length + ' blessures.';
}
