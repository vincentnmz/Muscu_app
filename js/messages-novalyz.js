/* =============================================================================
 * Canal « Message de Novalyz » (18/11/2026, demande du porteur).
 * L'équipe Novalyz écrit à un athlète (fonction SQL novalyz_message) → le message arrive
 * dans getAppData.messages_novalyz (session athlète seulement) et une notification part
 * (action serveur pushMessagesNovalyz, cible 'novalyz').
 * Affichage : fil « Novalyz · l'équipe » dans l'onglet Coach (liste des conversations) +
 * carte « Nouveau message de Novalyz » sur Aujourd'hui tant qu'il n'est pas lu.
 * Réponse : action repondreMessageNovalyz (rangée en base + e-mail à l'équipe).
 * Dépend de app.js (dernierAppData, escapeHtml, _cdPost, _cvShow, _cvHeure, switchTab).
 * ========================================================================== */
var _nvmEnvoi = false;

function nvmListe(data) {
  data = data || ((typeof dernierAppData !== 'undefined' && dernierAppData) ? dernierAppData : null);
  return (data && Array.isArray(data.messages_novalyz)) ? data.messages_novalyz : [];
}
function nvmNonLus(data) {
  return nvmListe(data).filter(function (m) { return m && m.auteur === 'novalyz' && !m.lu_at; }).length;
}
function _nvmEsc(t) { return (typeof escapeHtml === 'function') ? escapeHtml(t) : String(t == null ? '' : t); }
function _nvmQuand(iso) {
  try {
    var x = new Date(iso); if (isNaN(x.getTime())) return '';
    var now = new Date(), same = x.toDateString() === now.toDateString();
    var hm = String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0');
    return same ? hm : String(x.getDate()).padStart(2, '0') + '/' + String(x.getMonth() + 1).padStart(2, '0') + ' ' + hm;
  } catch (e) { return ''; }
}

// Ligne dans la liste des conversations (rien tant qu'aucun message n'a été envoyé).
function nvmThreadHtml() {
  var L = nvmListe(); if (!L.length) return '';
  var last = L[L.length - 1], n = nvmNonLus();
  var prev = (last.auteur === 'athlete' ? 'Toi : ' : '') + String(last.message || '').replace(/\s+/g, ' ');
  return '<button class="cv-thread" onclick="nvmOuvrir()" data-nvm="thread">'
    + '<span class="av ia" style="background:linear-gradient(135deg,#1A5FFF,#7C5CFF)">N</span>'
    + '<div class="mid"><div class="r1"><span class="nm">Novalyz</span><span class="tag">l\'équipe</span></div>'
    + '<div class="pv">' + _nvmEsc(prev) + '</div></div>'
    + '<div class="rt"><span class="tm">' + _nvmEsc(_nvmQuand(last.created_at)) + '</span>' + (n > 0 ? '<span class="cv-unread">' + n + '</span>' : '') + '</div></button>';
}

function nvmRenderFil() {
  var el = document.getElementById('cv-nv-msgs'); if (!el) return;
  var L = nvmListe();
  el.innerHTML = L.length ? L.map(function (m) {
    var t = _nvmEsc(String(m.message || '')).replace(/\n/g, '<br>');
    return m.auteur === 'athlete'
      ? '<div class="cv-me">' + t + '<div style="font-size:10px;opacity:.75;margin-top:4px;text-align:right">' + _nvmEsc(_nvmQuand(m.created_at)) + '</div></div>'
      : '<div class="cv-ai"><span class="av" style="background:linear-gradient(135deg,#1A5FFF,#7C5CFF)">N</span><div class="bub">' + t + '<div style="font-size:10px;color:var(--text-subtle);margin-top:6px">' + _nvmEsc(_nvmQuand(m.created_at)) + '</div></div></div>';
  }).join('') : '<div style="color:var(--text-subtle);font-size:13px;padding:16px">Aucun message pour l\'instant.</div>';
  try { el.scrollTop = el.scrollHeight; } catch (e) {}
}

function nvmOuvrir() {
  nvmRenderFil();
  if (typeof _cvShow === 'function') _cvShow('nv');
  nvmMarquerLus();
}
// Depuis Aujourd'hui ou une notification : ouvre l'onglet Coach directement sur le fil Novalyz.
function nvmAllerFil() {
  try { if (typeof _cvView !== 'undefined') _cvView = 'nv'; } catch (e) {}
  if (typeof switchTab === 'function') switchTab('conseils');
}

function nvmMarquerLus() {
  var L = nvmListe(), aLire = L.filter(function (m) { return m && m.auteur === 'novalyz' && !m.lu_at; });
  if (!aLire.length) return;
  var maintenant = new Date().toISOString();
  aLire.forEach(function (m) { m.lu_at = maintenant; });   // tout de suite à l'écran ; le serveur suit
  try { if (typeof _cdPost === 'function') _cdPost({ action: 'lireMessagesNovalyz' }); } catch (e) {}
  nvmMajBadges();
  try { nvmCarteAccueil(); } catch (e) {}
}

async function nvmRepondre() {
  if (_nvmEnvoi) return;
  var ta = document.getElementById('cv-nv-input'); if (!ta) return;
  var msg = String(ta.value || '').trim();
  if (msg.length < 3) { if (typeof showToast === 'function') showToast('Écris au moins quelques mots.'); return; }
  _nvmEnvoi = true;
  var r = null;
  try { r = await _cdPost({ action: 'repondreMessageNovalyz', message: msg }); } catch (e) {}
  _nvmEnvoi = false;
  if (r && r.success) {
    ta.value = '';
    var L = nvmListe(); L.push({ id: 'local-' + Date.now(), created_at: new Date().toISOString(), auteur: 'athlete', message: msg, lu_at: null });
    try { if (typeof dernierAppData !== 'undefined' && dernierAppData && !Array.isArray(dernierAppData.messages_novalyz)) dernierAppData.messages_novalyz = L; } catch (e) {}
    nvmRenderFil();
    if (typeof showToast === 'function') showToast('Envoyé à l\'équipe Novalyz.');
  } else if (typeof showToast === 'function') showToast((r && r.error) || 'Envoi impossible. Vérifie ta connexion.');
}

// Carte sur Aujourd'hui tant qu'un message n'est pas lu (la dernière en aperçu).
function nvmCarteAccueil(data) {
  var host = document.getElementById('tj-msg-novalyz'); if (!host) return;
  var L = nvmListe(data).filter(function (m) { return m && m.auteur === 'novalyz' && !m.lu_at; });
  if (!L.length) { host.style.display = 'none'; host.innerHTML = ''; return; }
  var last = L[L.length - 1], txt = String(last.message || '').replace(/\s+/g, ' ').trim();
  host.innerHTML = '<button onclick="nvmAllerFil()" style="display:flex;gap:12px;align-items:center;width:100%;text-align:left;background:var(--surface);border:1px solid rgba(124,92,255,.45);border-radius:14px;padding:12px 14px;margin:0 0 12px;cursor:pointer;font:inherit;color:var(--text)">'
    + '<span style="width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,#1A5FFF,#7C5CFF);display:grid;place-items:center;color:#fff;font-weight:800;flex:none">N</span>'
    + '<span style="flex:1;min-width:0"><span style="display:block;font-weight:800;font-size:13.5px">' + (L.length > 1 ? L.length + ' nouveaux messages de Novalyz' : 'Nouveau message de Novalyz') + '</span>'
    + '<span style="display:block;font-size:12px;color:var(--text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + _nvmEsc(txt) + '</span></span>'
    + '<span style="color:#7C5CFF;font-weight:800;font-size:12.5px;flex:none">Lire ›</span></button>';
  host.style.display = 'block';
}

// Pastille de l'onglet Coach : messages du coach non lus + messages Novalyz non lus.
function nvmMajBadges() {
  try { if (typeof majBadgeConseils === 'function') majBadgeConseils(); } catch (e) {}
}
