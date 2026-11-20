/* =============================================================================
 * Écran admin « Écrire aux athlètes » (20/11/2026, demande du porteur : réservé à lui seul).
 * Visible seulement si getCoachPrefs renvoie admin:true (compte coach inscrit dans la table
 * admins_novalyz, service_role seul). Le serveur revérifie le droit à CHAQUE appel adminNovalyz :
 * masquer l'entrée n'est qu'un confort, pas la sécurité.
 * Envoi = message « Novalyz » dans le fil de l'athlète (js/messages-novalyz.js) + notification immédiate.
 * Dépend de app.js : _cdPost, _coachPrefs, escapeHtml, showToast.
 * ========================================================================== */
var _admNv = { athletes: [], cible: null, filtre: '', envoi: false };

function _admEsc(t) { return (typeof escapeHtml === 'function') ? escapeHtml(t) : String(t == null ? '' : t); }
function _admQuand(iso) {
  try {
    var x = new Date(iso); if (isNaN(x.getTime())) return '';
    var hm = String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0');
    if (x.toDateString() === new Date().toDateString()) return hm;
    return String(x.getDate()).padStart(2, '0') + '/' + String(x.getMonth() + 1).padStart(2, '0') + ' ' + hm;
  } catch (e) { return ''; }
}
function _admStyles() {
  if (document.getElementById('adm-nv-style')) return;
  var st = document.createElement('style'); st.id = 'adm-nv-style';
  st.textContent = '#adm-nv{position:fixed;inset:0;z-index:9000;background:var(--bg);color:var(--text);display:flex;flex-direction:column}'
    + '#adm-nv .adm-h{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--border);background:var(--surface)}'
    + '#adm-nv .adm-h b{flex:1;font-size:16px}#adm-nv .adm-h small{display:block;font-weight:600;font-size:11.5px;color:var(--text-muted)}'
    + '#adm-nv .adm-x{border:1px solid var(--border);background:var(--surface2);color:var(--text);border-radius:10px;width:38px;height:38px;font-size:16px;cursor:pointer}'
    + '#adm-nv .adm-b{flex:1;overflow-y:auto;padding:12px 16px;max-width:760px;width:100%;margin:0 auto;box-sizing:border-box}'
    + '#adm-nv .adm-s{width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:12px;color:var(--text);font-size:14px;padding:11px 12px;margin-bottom:10px}'
    + '#adm-nv .adm-a{display:flex;gap:10px;align-items:center;width:100%;text-align:left;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:10px 12px;margin-bottom:8px;cursor:pointer;color:var(--text);font:inherit}'
    + '#adm-nv .adm-av{width:36px;height:36px;border-radius:10px;background:var(--surface2);display:grid;place-items:center;font-weight:800;flex:none}'
    + '#adm-nv .adm-m{flex:1;min-width:0}#adm-nv .adm-n{font-weight:800;font-size:13.5px}#adm-nv .adm-l{color:var(--text-muted);font-weight:600;font-size:11.5px}'
    + '#adm-nv .adm-p{font-size:12px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}'
    + '#adm-nv .adm-rep{background:#7C5CFF;color:#fff;border-radius:999px;font-size:10.5px;font-weight:800;padding:2px 7px;flex:none}'
    + '#adm-nv .adm-msg{max-width:85%;padding:10px 12px;border-radius:14px;margin:6px 0;font-size:13.5px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}'
    + '#adm-nv .adm-moi{margin-left:auto;background:linear-gradient(135deg,#1A5FFF,#7C5CFF);color:#fff;border-bottom-right-radius:4px}'
    + '#adm-nv .adm-lui{background:var(--surface);border:1px solid var(--border);border-bottom-left-radius:4px}'
    + '#adm-nv .adm-meta{font-size:10.5px;opacity:.8;margin-top:5px}'
    + '#adm-nv .adm-f{border-top:1px solid var(--border);background:var(--surface);padding:10px 16px calc(10px + env(safe-area-inset-bottom))}'
    + '#adm-nv .adm-f textarea{width:100%;box-sizing:border-box;min-height:84px;resize:vertical;background:var(--surface2);border:1px solid var(--border);border-radius:12px;color:var(--text);font:inherit;font-size:14px;padding:10px 12px}'
    + '#adm-nv .adm-send{width:100%;margin-top:8px;background:var(--accent);border:none;color:var(--on-accent);border-radius:12px;padding:12px;font-size:14px;font-weight:800;cursor:pointer}'
    + '#adm-nv .adm-send:disabled{opacity:.5;cursor:default}#adm-nv .adm-note{font-size:11.5px;color:var(--text-muted);line-height:1.4;margin:6px 0 0}';
  document.head.appendChild(st);
}

// Carte d'entrée dans Réglages ▸ Mon compte (rien si le compte n'est pas admin).
function admNvRenderEntree() {
  var el = document.getElementById('crgx-admin'); if (!el) return;
  var admin = (typeof _coachPrefs !== 'undefined' && _coachPrefs && _coachPrefs.admin === true);
  if (!admin) { el.innerHTML = ''; el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.innerHTML = '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#7C5CFF;margin-bottom:8px">Novalyz · admin</div>'
    + '<button onclick="admNvOuvrir()" style="display:flex;gap:12px;align-items:center;width:100%;text-align:left;background:var(--surface);border:1px solid rgba(124,92,255,.45);border-radius:14px;padding:12px 14px;cursor:pointer;font:inherit;color:var(--text)">'
    + '<span style="width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,#1A5FFF,#7C5CFF);display:grid;place-items:center;color:#fff;font-weight:800;flex:none">N</span>'
    + '<span style="flex:1"><b style="display:block;font-size:13.5px">Écrire aux athlètes</b><span style="font-size:12px;color:var(--text-muted)">Message « Novalyz » + notification. Visible par toi seul.</span></span>'
    + '<span style="color:#7C5CFF;font-weight:800">›</span></button>';
}

async function admNvOuvrir() {
  _admStyles();
  var ov = document.getElementById('adm-nv');
  if (!ov) { ov = document.createElement('div'); ov.id = 'adm-nv'; document.body.appendChild(ov); }
  ov.style.display = 'flex'; _admNv.cible = null;
  ov.innerHTML = '<div class="adm-h"><b>Écrire aux athlètes<small>Novalyz · admin</small></b><button class="adm-x" onclick="admNvFermer()" aria-label="Fermer">✕</button></div><div class="adm-b" id="adm-nv-b"><div class="adm-note">Chargement…</div></div>';
  var r = await _cdPost({ action: 'adminNovalyz', op: 'etat' });
  if (!r || !r.success) { document.getElementById('adm-nv-b').innerHTML = '<div class="adm-note">' + _admEsc((r && r.error) || 'Chargement impossible. Vérifie ta connexion.') + '</div>'; return; }
  _admNv.athletes = (r.athletes || []).sort(function (a, b) {
    var da = a.dernier ? a.dernier.created_at : '', db = b.dernier ? b.dernier.created_at : '';
    if (da !== db) return da < db ? 1 : -1;
    return String(a.nom).localeCompare(String(b.nom), 'fr');
  });
  admNvRenderListe();
}
function admNvFermer() { var ov = document.getElementById('adm-nv'); if (ov) { ov.style.display = 'none'; ov.innerHTML = ''; } _admNv.cible = null; }

function admNvRenderListe() {
  var b = document.getElementById('adm-nv-b'); if (!b) return;
  var f = _admNv.filtre.trim().toLowerCase();
  var L = _admNv.athletes.filter(function (a) { return !f || (a.nom + ' ' + a.login + ' ' + a.coach).toLowerCase().indexOf(f) >= 0; });
  var html = '<input class="adm-s" id="adm-nv-s" placeholder="Chercher un athlète (nom, login, coach)" value="' + _admEsc(_admNv.filtre) + '" oninput="_admNv.filtre=this.value;admNvRenderListe();var i=document.getElementById(\'adm-nv-s\');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length);}">'
    + '<div class="adm-note" style="margin:0 0 10px">' + L.length + ' athlète' + (L.length > 1 ? 's' : '') + ' (comptes de démo exclus). Les conversations récentes sont en haut.</div>';
  html += L.map(function (a) {
    var d = a.dernier, ini = String(a.nom || '?').trim().charAt(0).toUpperCase();
    var prev = d ? ((d.auteur === 'athlete' ? '↩ ' : 'Toi : ') + d.apercu) : 'Aucun message';
    var rep = d && d.auteur === 'athlete' ? '<span class="adm-rep">Réponse</span>' : '';
    return '<button class="adm-a" onclick="admNvOuvrirFil(\'' + _admEsc(a.id).replace(/'/g, '') + '\')">'
      + '<span class="adm-av">' + _admEsc(ini) + '</span><span class="adm-m"><span class="adm-n">' + _admEsc(a.nom) + '</span> <span class="adm-l">· ' + _admEsc(a.login) + (a.coach ? ' · coach ' + _admEsc(a.coach) : ' · sans coach') + '</span>'
      + '<div class="adm-p">' + _admEsc(prev) + '</div></span>' + rep + '<span class="adm-l" style="flex:none">' + (d ? _admEsc(_admQuand(d.created_at)) : '') + '</span></button>';
  }).join('');
  b.innerHTML = html;
}

async function admNvOuvrirFil(id) {
  var a = _admNv.athletes.filter(function (x) { return x.id === id; })[0]; if (!a) return;
  _admNv.cible = a;
  var ov = document.getElementById('adm-nv'); if (!ov) return;
  ov.innerHTML = '<div class="adm-h"><button class="adm-x" onclick="admNvRetour()" aria-label="Retour">←</button><b>' + _admEsc(a.nom) + '<small>login ' + _admEsc(a.login) + (a.coach ? ' · coach ' + _admEsc(a.coach) : '') + '</small></b><button class="adm-x" onclick="admNvFermer()" aria-label="Fermer">✕</button></div>'
    + '<div class="adm-b" id="adm-nv-fil"><div class="adm-note">Chargement…</div></div>'
    + '<div class="adm-f"><textarea id="adm-nv-txt" maxlength="3000" placeholder="Ton message à ' + _admEsc(a.nom) + '…"></textarea>'
    + '<button class="adm-send" id="adm-nv-go" onclick="admNvEnvoyer()">Envoyer (avec notification)</button>'
    + '<div class="adm-note">Il le verra dans son fil « Novalyz » (onglet Coach) et sur Aujourd\'hui. Sa réponse s\'affichera ici et t\'arrivera par e-mail.</div></div>';
  await admNvChargerFil();
}
function admNvRetour() { admNvOuvrir(); }

async function admNvChargerFil() {
  var a = _admNv.cible, el = document.getElementById('adm-nv-fil'); if (!a || !el) return;
  var r = await _cdPost({ action: 'adminNovalyz', op: 'fil', cible: a.id });
  if (!r || !r.success) { el.innerHTML = '<div class="adm-note">' + _admEsc((r && r.error) || 'Chargement impossible.') + '</div>'; return; }
  var M = r.messages || [];
  el.innerHTML = M.length ? M.map(function (m) {
    var moi = m.auteur === 'novalyz';
    var etat = moi ? (m.lu_at ? 'Lu ' + _admQuand(m.lu_at) : (m.push_at ? 'Notifié · pas encore lu' : 'Pas encore lu')) : '';
    return '<div class="adm-msg ' + (moi ? 'adm-moi' : 'adm-lui') + '">' + _admEsc(m.message) + '<div class="adm-meta">' + _admEsc([_admQuand(m.created_at), etat].filter(Boolean).join(' · ')) + '</div></div>';
  }).join('') : '<div class="adm-note">Aucun message avec ' + _admEsc(a.nom) + ' pour l\'instant.</div>';
  try { el.scrollTop = el.scrollHeight; } catch (e) {}
}

async function admNvEnvoyer() {
  if (_admNv.envoi || !_admNv.cible) return;
  var ta = document.getElementById('adm-nv-txt'), bt = document.getElementById('adm-nv-go');
  var msg = String((ta && ta.value) || '').trim();
  if (msg.length < 3) { if (typeof showToast === 'function') showToast('Écris au moins quelques mots.'); return; }
  _admNv.envoi = true; if (bt) { bt.disabled = true; bt.textContent = '⏳ Envoi…'; }
  var r = null;
  try { r = await _cdPost({ action: 'adminNovalyz', op: 'envoyer', cible: _admNv.cible.id, message: msg }); } catch (e) {}
  _admNv.envoi = false; if (bt) { bt.disabled = false; bt.textContent = 'Envoyer (avec notification)'; }
  if (r && r.success) {
    if (ta) ta.value = '';
    if (typeof showToast === 'function') showToast(r.notifie ? 'Envoyé · notification partie' : 'Envoyé · pas de notification (téléphone non inscrit) : il le verra en ouvrant l\'app');
    await admNvChargerFil();
  } else if (typeof showToast === 'function') showToast((r && r.error) || 'Envoi impossible. Vérifie ta connexion.', '#ff4444');
}
