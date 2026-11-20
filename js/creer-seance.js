/* =============================================================================
 * Créer une séance — UN SEUL parcours (20/11/2026, retours testeurs : « on ne sait pas où est le bouton
 * pour créer une séance »). Entrées : Entraînement (« ＋ Créer une séance » / « Créer ma première séance »),
 * Mon programme (« ＋ Séance », « Programme vierge »), éditeur du coach.
 * 1) petite fenêtre : choix rapides (Push, Pull…) ou nom libre → 2) choix des exercices (ouvrirPickerExos,
 * enregistrés en UN envoi) → 3) retour dans « Mon programme », ouvert sur la nouvelle séance.
 * Une séance n'existe en base qu'avec au moins un exercice : fermé sans rien cocher → rien n'est créé (on le dit).
 * Dépend de app.js : progCtx, cdProgrammeLignes, cdProgOpen, ouvrirPickerExos, ouvrirEditeurProgramme,
 * chargerProgrammeCoach, dernierAppData, athlete, coach, escapeHtml, showToast, _etatAutoChecked.
 * ========================================================================== */
var _csOuvrirSid = null;   // séance à afficher à l'ouverture de « Mon programme » (lu par renderProgrammeCoach)
var CS_CHOIX = ['Push', 'Pull', 'Jambes', 'Haut du corps', 'Bas du corps', 'Full body'];

function _csEsc(t) { return (typeof escapeHtml === 'function') ? escapeHtml(t) : String(t == null ? '' : t); }
function _csEstCoach() { return typeof coach !== 'undefined' && !!coach && !!coach.coach_id; }
function _csEditeurOuvert() { var ov = document.getElementById('prog-editor-overlay'); return !!(ov && ov.style.display !== 'none' && getComputedStyle(ov).display !== 'none'); }

// Noms déjà pris (programme chargé dans l'éditeur + programme de l'athlète connecté).
function _csNomsPris() {
  var pris = {};
  try { (cdProgrammeLignes || []).forEach(function (l) { if (l && l.seance_id) pris[String(l.seance_id).toLowerCase()] = 1; }); } catch (e) {}
  try { if (!_csEstCoach() && typeof dernierAppData !== 'undefined' && dernierAppData) (dernierAppData.programme || []).forEach(function (l) { if (l && l.seance_id) pris[String(l.seance_id).toLowerCase()] = 1; }); } catch (e) {}
  return pris;
}
// « Push » déjà pris → « Push 2 » (sinon les exercices s'ajouteraient à la séance existante sans qu'on le veuille).
function _csNomUnique(nom) {
  var pris = _csNomsPris(), base = nom, k = 2;
  while (pris[nom.toLowerCase()]) { nom = base + ' ' + k; k++; }
  return nom;
}

function creerSeance() {
  // Athlète (depuis Entraînement) : le contexte d'édition pointe sur lui (comme « Mon programme »).
  if (!_csEstCoach() && typeof athlete !== 'undefined' && athlete && !_csEditeurOuvert()) {
    try { progCtx = { el: 'prog-editor-content', athleteId: athlete.athlete_id, athleteNom: athlete.nom || '', readonly: false }; } catch (e) {}
  }
  try { _etatAutoChecked = true; } catch (e) {}   // (C) pas de questionnaire du jour pendant / juste après la création
  var p = document.getElementById('cs-sheet');
  if (!p) { p = document.createElement('div'); p.id = 'cs-sheet'; p.className = 'jg-panel-ov'; document.body.appendChild(p); p.addEventListener('click', function (e) { if (e.target === p) creerSeanceFermer(); }); }
  var chips = CS_CHOIX.map(function (n) { return '<button class="jg-chip cta" onclick="creerSeanceChoix(\'' + n + '\')">+ ' + _csEsc(n) + '</button>'; }).join('');
  p.innerHTML = '<div class="jg-panel jg-panel-sm" role="dialog" aria-label="Créer une séance">'
    + '<div class="xp-hd"><button class="xp-back" onclick="creerSeanceFermer()" aria-label="Fermer">←</button><div class="xp-ti"><div class="a">Créer une séance</div><div class="b">Choisis un nom, puis coche tes exercices</div></div></div>'
    + '<div class="jg-pbody"><div class="jg-chips">' + chips + '</div>'
    + '<label class="jg-f"><span>Ou un autre nom</span><input id="cs-nom" type="text" maxlength="40" placeholder="ex. Dos-biceps, Séance A…" style="text-align:left" onkeydown="if(event.key===\'Enter\')creerSeanceValider()"></label></div>'
    + '<div class="jg-pfoot"><button class="xp-add" onclick="creerSeanceValider()">Choisir les exercices</button></div></div>';
  p.style.display = 'flex';
}
function creerSeanceFermer() { var p = document.getElementById('cs-sheet'); if (p) p.style.display = 'none'; }
function creerSeanceChoix(nom) { var i = document.getElementById('cs-nom'); if (i) i.value = nom; creerSeanceValider(); }

function creerSeanceValider() {
  var i = document.getElementById('cs-nom'); var brut = i ? String(i.value || '').trim().replace(/\s+/g, ' ') : '';
  if (!brut) { if (i) i.focus(); if (typeof showToast === 'function') showToast('Choisis un nom (ex. Push) ou tape le tien.'); return; }
  var nom = _csNomUnique(brut);
  creerSeanceFermer();
  ouvrirPickerExos(nom, function () { _csApresAjout(nom); }).then(function () {
    try { if (typeof _xp !== 'undefined' && _xp && _xp.sid === nom) _xp.onCancel = function () { if (typeof showToast === 'function') showToast('Séance « ' + nom + ' » non créée : coche au moins un exercice.'); }; } catch (e) {}
  });
}

// Après l'ajout : « Mon programme » ouvert sur la nouvelle séance (on voit et on ajuste séries / reps / jour).
function _csApresAjout(nom) {
  _csOuvrirSid = nom;
  try { cdProgOpen[nom] = true; } catch (e) {}
  if (_csEditeurOuvert() || _csEstCoach()) { if (typeof chargerProgrammeCoach === 'function') chargerProgrammeCoach(); }
  else if (typeof ouvrirEditeurProgramme === 'function') ouvrirEditeurProgramme();
}
