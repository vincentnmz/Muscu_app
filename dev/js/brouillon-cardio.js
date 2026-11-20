/* =============================================================================
 * Brouillon de séance CARDIO (20/11/2026, question porteur : « quand on ferme l'app, tout ce qu'on était en
 * train de faire disparaît ? »). La séance muscu était déjà gardée (muscu_brouillon_<id>) ; la séance cardio en
 * cours (activité, chrono, durée, distance… saisies) était perdue si l'app était fermée ou tuée par le téléphone.
 * Sauvegarde : à chaque saisie dans le formulaire cardio, au démarrage, et quand l'app passe en arrière-plan.
 * Effacé : séance enregistrée, ou séance quittée volontairement (←). Repris à la réouverture (≤ 12 h) :
 * page séance cardio rouverte, champs remplis, chrono reparti de l'heure de départ réelle (≤ 6 h).
 * Dépend de app.js : athlete, _saisieCoach, _modeSeance, _seanceChronoT0/_Start/_Stop, ouvrirSeancePage,
 * switchModeSeance, switchTab, _buildCardioTypeOptions, renderCardioFields, _majSeancePageTitre, showToast.
 * ========================================================================== */
var BC_MAX_MS = 12 * 3600e3;
var _bcRestaure = false;

function _bcKey() {
  try { if (typeof _saisieCoach !== 'undefined' && _saisieCoach) return null; } catch (e) {}
  return (typeof athlete !== 'undefined' && athlete && athlete.athlete_id) ? 'nv_cardio_brouillon_' + athlete.athlete_id : null;
}
function _bcEnCours() {
  try {
    return document.body.classList.contains('seance-active') && typeof _modeSeance !== 'undefined' && _modeSeance === 'cardio'
      && !!document.getElementById('cardio-type') && !!document.getElementById('cardio-fields-content');
  } catch (e) { return false; }
}
function bcSauver() {
  var k = _bcKey(); if (!k || !_bcEnCours()) return;
  try {
    var champs = {};
    document.querySelectorAll('#cardio-fields-content input[id], #cardio-fields-content select[id], #cardio-fields-content textarea[id]').forEach(function (el) {
      if (el.value !== '' && el.type !== 'button') champs[el.id] = el.value;
    });
    var t0 = (typeof _seanceChronoT0 !== 'undefined' && _seanceChronoT0) ? _seanceChronoT0 : 0;
    var type = (document.getElementById('cardio-type') || {}).value || '';
    if (!t0 && !Object.keys(champs).length) return;
    localStorage.setItem(k, JSON.stringify({ v: 1, type: type, date: (document.getElementById('cardio-date') || {}).value || '', t0: t0, champs: champs, ts: Date.now() }));
  } catch (e) {}
}
function bcEffacer() { var k = _bcKey(); if (k) { try { localStorage.removeItem(k); } catch (e) {} } }

// Reprise à la réouverture de l'app (appelée une fois, après le chargement des données).
function bcRestaurer() {
  if (_bcRestaure) return; _bcRestaure = true;
  var k = _bcKey(); if (!k) return;
  var b = null; try { b = JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { b = null; }
  if (!b || !b.type) return;
  if (!(Date.now() - (Number(b.ts) || 0) < BC_MAX_MS)) { bcEffacer(); return; }
  try {
    if (typeof switchTab === 'function') switchTab('seance');
    try { _seanceChronoStop(); } catch (e) {}
    var t0 = Number(b.t0) || 0;
    _seanceChronoT0 = (t0 > 0 && Date.now() - t0 < 6 * 3600e3) ? t0 : 0;
    ouvrirSeancePage();
    if (typeof switchModeSeance === 'function') switchModeSeance('cardio');
    try { _buildCardioTypeOptions(); } catch (e) {}
    var ct = document.getElementById('cardio-type'); if (ct) ct.value = b.type;
    if (typeof renderCardioFields === 'function') renderCardioFields();
    var cd = document.getElementById('cardio-date'); if (cd && b.date) cd.value = b.date;
    Object.keys(b.champs || {}).forEach(function (id) { var el = document.getElementById(id); if (el) el.value = b.champs[id]; });
    try { if (b.type === 'hyrox' && typeof _hyroxRecalcTotal === 'function') _hyroxRecalcTotal(); else if (typeof calcAutoCardio === 'function') calcAutoCardio(); } catch (e) {}
    try { if (_seanceChronoT0) _seanceChronoStart(); } catch (e) {}
    try { _majSeancePageTitre(); } catch (e) {}
    try { _etatAutoChecked = true; } catch (e) {}
    if (typeof showToast === 'function') showToast('Séance cardio reprise là où tu l\'avais laissée');
  } catch (e) {}
}

// Sauvegarde à chaque saisie dans le formulaire cardio, et quand l'app passe en arrière-plan / est fermée.
document.addEventListener('input', function (e) { try { if (e.target && e.target.closest && e.target.closest('#cardio-block')) bcSauver(); } catch (x) {} }, true);
document.addEventListener('change', function (e) { try { if (e.target && e.target.closest && e.target.closest('#cardio-block')) bcSauver(); } catch (x) {} }, true);
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') bcSauver(); });
window.addEventListener('pagehide', function () { bcSauver(); });
