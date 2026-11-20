/* =============================================================================
 * Brouillons de saisie (20/11/2026, demande porteur : « protège aussi les 3 autres cas » quand l'app est fermée).
 * 1) MESSAGES en cours d'écriture : un brouillon par conversation (coach ↔ chaque athlète, athlète → coach,
 *    Novalyz, IA, message à plusieurs, « Signaler un problème »). Remis dans la zone de saisie à la réouverture ;
 *    effacé dès que le message part (zone vidée par l'envoi).
 * 2) QUESTIONNAIRE (état du jour / bilan de séance) : réponses cochées + note gardées, remises si on le rouvre
 *    le même jour (même séance pour le bilan). L'état du jour commencé se rouvre tout seul à la réouverture.
 * 3) HYROX (chrono du circuit / par atelier) : segments, splits, pause gardés ; le chrono repart à l'heure de
 *    départ réelle. Fin de circuit pas enregistrée (réseau) → gardée et renvoyée automatiquement (avant : perdue).
 * Dépend de app.js : athlete, coach, coachAthleteCourant, cdJoueurCourant, wellnessState, selectWQ, selectRPE,
 * _wqMode, _wqType, _wqSeanceId, _wqDate, ouvrirEtatDuJour, _bienEtreFaitAujourdhui, variables _hx*, _hyroxMode,
 * _hyroxDiv, _hxOv, _hxLiveHtml, _hxRender*, _hxTick, _hxDoneHtml, _hxTodayISO, SCRIPT_URL, showToast.
 * ========================================================================== */
var BS_TXT_JOURS = 14;

function _bsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
function _bsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function _bsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
function _bsAid() { return (typeof athlete !== 'undefined' && athlete && athlete.athlete_id) ? String(athlete.athlete_id) : ''; }
function _bsCid() { return (typeof coach !== 'undefined' && coach && coach.coach_id) ? String(coach.coach_id) : ''; }

/* ─────────────── 1) Messages ─────────────── */
// id de la zone → contexte (conversation). '' = pas de contexte (rien gardé).
var BS_CHAMPS = {
  'athlete-chat-input': function () { return _bsAid() ? 'a' + _bsAid() : ''; },
  'cv-nv-input':        function () { return _bsAid() ? 'a' + _bsAid() : ''; },
  'cv-ia-input':        function () { return _bsAid() ? 'a' + _bsAid() : ''; },
  'cd-comment-input':   function () { var a = (typeof coachAthleteCourant !== 'undefined' && coachAthleteCourant) ? coachAthleteCourant.athlete_id : ''; return (_bsCid() && a) ? 'c' + _bsCid() + '-' + a : ''; },
  'djt-conv-input':     function () { var j = (typeof cdJoueurCourant !== 'undefined' && cdJoueurCourant) ? cdJoueurCourant : ''; return j ? (_bsCid() ? 'c' + _bsCid() : 'a' + _bsAid()) + '-j' + j : ''; },
  'msgx-txt':           function () { return _bsCid() ? 'c' + _bsCid() : ''; },
  'retour-msg':         function () { return _bsCid() ? 'c' + _bsCid() : (_bsAid() ? 'a' + _bsAid() : ''); }
};
function _bsTxtKey(id, ctx) { return 'nv_txt_' + id + '_' + ctx; }
function _bsTxtLire(id, ctx) { var d = _bsGet(_bsTxtKey(id, ctx)); if (!d || typeof d.v !== 'string') return ''; if (!(Date.now() - (d.ts || 0) < BS_TXT_JOURS * 864e5)) { _bsDel(_bsTxtKey(id, ctx)); return ''; } return d.v; }
function _bsTxtSync(id) {
  var f = BS_CHAMPS[id], el = document.getElementById(id); if (!f || !el) return;
  var ctx = ''; try { ctx = f() || ''; } catch (e) { ctx = ''; }
  if (!ctx) return;
  if (el.dataset.nvCtx !== ctx) {
    // Nouvelle conversation dans la même zone (le coach change d'athlète) ou 1re fois : on remet SON brouillon.
    var prev = el.dataset.nvCtx, prevTxt = prev ? _bsTxtLire(id, prev) : '';
    var draft = _bsTxtLire(id, ctx);
    if (!el.value || (prev && el.value === prevTxt)) { el.value = draft; try { el.dispatchEvent(new Event('bs-restore')); } catch (e) {} }
    el.dataset.nvCtx = ctx; el.dataset.nvLast = el.value;
    return;
  }
  if (el.value !== el.dataset.nvLast) {
    // Vidée (envoi réussi ou effacée) → brouillon supprimé ; sinon gardé (y compris texte remis après un envoi raté).
    if (String(el.value).trim()) _bsSet(_bsTxtKey(id, ctx), { v: el.value, ts: Date.now() }); else _bsDel(_bsTxtKey(id, ctx));
    el.dataset.nvLast = el.value;
  }
}
function bsTxtSyncTout() { Object.keys(BS_CHAMPS).forEach(_bsTxtSync); }
document.addEventListener('input', function (e) { try { var id = e.target && e.target.id; if (id && BS_CHAMPS[id]) _bsTxtSync(id); if (id === 'wq-note' || id === 'wq-zone-text') wqBrouillonSauver(); } catch (x) {} }, true);
setInterval(function () { try { bsTxtSyncTout(); } catch (e) {} }, 1000);

/* ─────────────── 2) Questionnaire ─────────────── */
function _wqBrKey() { var a = _bsAid(); return a ? 'nv_wq_brouillon_' + a : ''; }
function _wqAujourdhui() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function wqBrouillonSauver() {
  var k = _wqBrKey(); if (!k || typeof wellnessState === 'undefined' || (typeof _wqMode === 'undefined') || !_wqMode) return;
  try { if (document.body.classList.contains('saisie-coach')) return; } catch (e) {}
  var ws = {}, n = 0; Object.keys(wellnessState).forEach(function (q) { if (wellnessState[q] != null) { ws[q] = wellnessState[q]; n++; } });
  var note = (document.getElementById('wq-note') || {}).value || '', zt = (document.getElementById('wq-zone-text') || {}).value || '';
  if (!n && !note && !zt) { _bsDel(k); return; }
  _bsSet(k, { mode: _wqMode, type: (typeof _wqType !== 'undefined' ? _wqType : null), sid: (typeof _wqSeanceId !== 'undefined' ? _wqSeanceId : null), date: (typeof _wqDate !== 'undefined' ? _wqDate : null), jour: _wqAujourdhui(), ws: ws, note: note, zt: zt, ts: Date.now() });
}
function wqBrouillonEffacer() { var k = _wqBrKey(); if (k) _bsDel(k); }
function _wqBrValide(b, mode) {
  if (!b || b.mode !== mode || b.jour !== _wqAujourdhui()) return false;
  if (mode === 'bilan') return b.type === (typeof _wqType !== 'undefined' ? _wqType : null) && (b.date || null) === (typeof _wqDate !== 'undefined' ? _wqDate : null) && String(b.sid || '') === String((typeof _wqSeanceId !== 'undefined' ? _wqSeanceId : '') || '');
  return true;
}
// Appelée à l'ouverture du questionnaire (après la remise à zéro) : remet les réponses déjà données.
function wqBrouillonAppliquer(mode) {
  var b = _bsGet(_wqBrKey()); if (!_wqBrValide(b, mode)) return false;
  try {
    Object.keys(b.ws || {}).forEach(function (q) {
      var v = String(b.ws[q]);
      if (q === 'rpe') { var r = document.querySelector('#wq-rpe .wq-cr[data-val="' + v + '"]'); if (r && typeof selectRPE === 'function') selectRPE(r); return; }
      var c = document.querySelector('#wq-' + q + ' .wq-chip[data-val="' + v + '"]'); if (c && typeof selectWQ === 'function') selectWQ(q, c);
    });
    var n = document.getElementById('wq-note'); if (n && b.note) n.value = b.note;
    var z = document.getElementById('wq-zone-text'); if (z && b.zt) z.value = b.zt;
  } catch (e) {}
  return true;
}
// Réouverture de l'app : un état du jour commencé (et pas encore enregistré) se rouvre, prérempli.
function wqBrouillonReprendre() {
  var b = _bsGet(_wqBrKey()); if (!b) return false;
  if (b.jour !== _wqAujourdhui()) { wqBrouillonEffacer(); return false; }
  if (b.mode !== 'etat') return false;   // bilan : remis quand on revalide la séance (même séance, même jour)
  try { if (typeof _bienEtreFaitAujourdhui === 'function' && _bienEtreFaitAujourdhui()) { wqBrouillonEffacer(); return false; } } catch (e) {}
  try { _etatAutoChecked = true; } catch (e) {}
  if (typeof ouvrirEtatDuJour === 'function') ouvrirEtatDuJour({ date: b.date || null });
  return true;
}

/* ─────────────── 3) Hyrox ─────────────── */
function _hxBrKey() { var a = _bsAid(); return a ? 'nv_hyrox_brouillon_' + a : ''; }
function hxBrouillonSauver() {
  var k = _hxBrKey(); if (!k || typeof _hxTimer === 'undefined' || !_hxTimer) return;
  _bsSet(k, { v: 1, segs: _hxSegs, idx: _hxIdx, splits: _hxSplits, t0: _hxT0, segT0: _hxSegT0, paused: _hxPaused, pausedAt: _hxPausedAt, pauseAcc: _hxPauseAcc, weights: _hxWeights, mode: _hyroxMode, div: _hyroxDiv, ts: Date.now() });
}
function hxBrouillonEffacer(forcer) { var k = _hxBrKey(); if (!k) return; var b = _bsGet(k); if (!forcer && b && b.envoi) return; _bsDel(k); }   // une fin non enregistrée n'est jamais effacée par « Fermer »
function hxBrouillonFin(payload) { var k = _hxBrKey(); if (k) _bsSet(k, { v: 1, envoi: payload, ts: Date.now() }); }
async function _hxRenvoyer(payload) {
  try {
    var r = await fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
    var res = await r.json(); if (!r.ok || !res || res.error || res.success === false) throw new Error((res && res.error) || 'refus');
    hxBrouillonEffacer(true);
    return res;
  } catch (e) { return null; }
}
async function hxBrouillonReprendre() {
  var b = _bsGet(_hxBrKey()); if (!b) return false;
  if (b.envoi) {   // circuit terminé mais pas enregistré : on renvoie
    var res = await _hxRenvoyer(b.envoi);
    if (res) { if (typeof showToast === 'function') showToast('Ta Hyrox du ' + String(b.envoi.date || '').split('-').reverse().join('/') + ' a été enregistrée'); try { if (typeof chargerAppData === 'function') chargerAppData(); } catch (e) {} }
    return !!res;
  }
  if (!(Date.now() - (b.t0 || 0) < 6 * 3600e3) || !Array.isArray(b.segs) || !b.segs.length) { hxBrouillonEffacer(true); return false; }
  try {
    _hxSegs = b.segs; _hxIdx = b.idx || 0; _hxSplits = b.splits || []; _hxT0 = b.t0; _hxSegT0 = b.segT0 || b.t0;
    _hxPaused = !!b.paused; _hxPausedAt = b.pausedAt || 0; _hxPauseAcc = b.pauseAcc || 0; _hxWeights = b.weights || null;
    if (b.mode) _hyroxMode = b.mode; if (b.div) _hyroxDiv = b.div;
    var ov = _hxOv();
    if (!ov) { ov = document.createElement('div'); ov.id = 'hyrox-chrono-overlay'; ov.className = 'hx-overlay'; ov.style.cssText = 'position:fixed;inset:0;background:var(--bg);z-index:1200;overflow:auto;padding:0 16px 40px;'; document.body.appendChild(ov); }
    ov.style.display = 'block'; ov.innerHTML = _hxLiveHtml();
    _hxRenderProg(); _hxRenderCur(); _hxRenderSplits();
    if (_hxTimer) clearInterval(_hxTimer); _hxTimer = setInterval(_hxTick, 200); _hxTick();
    if (_hxPaused) { var pb = document.getElementById('hx-pause'); if (pb) pb.textContent = '▶ Reprendre'; }
    try { _nvWakeOn(); } catch (e) {}
    try { _etatAutoChecked = true; } catch (e) {}
    if (typeof showToast === 'function') showToast('Hyrox reprise : le chrono a continué');
    return true;
  } catch (e) { return false; }
}

document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') { try { bsTxtSyncTout(); hxBrouillonSauver(); } catch (e) {} } });
window.addEventListener('pagehide', function () { try { bsTxtSyncTout(); hxBrouillonSauver(); } catch (e) {} });
