/* =============================================================================
 * Sommeil → performance — COUCHE D'ANALYSE SÉPARÉE (13/11/2026)
 * Implémente EXACTEMENT la méthode validée : docs/sommeil-performance-methode.md
 * (figée commit c63c01e avant simulation ; résultats e8c02f5 ; feu vert du porteur le 13/11).
 *
 * RÈGLES (porteur) : ne modifie NI le moteur de performance, NI la formule de force estimée
 * (on APPELLE _lv3ForcePoint de js/lecture-v3.js), NI l'appariement nuit/séance (nuit déjà datée
 * au jour du réveil par l'import montre), NI les seuils ci-dessous sans NOUVEAU contrôle de
 * fiabilité (simulations : tests/sommeil-perf.test.js).
 * Le moteur ne lit rien ici : cette couche produit seulement une phrase pour Analyses ▸ Résumé.
 * ========================================================================== */
var SP_VERSION = 'sommeil-perf-2026-11-13';
var SP = Object.freeze({
  NUIT_MIN: 180,        // nuit < 3 h = enregistrement incomplet, ignorée (règle existante)
  NUIT_COURTE: 420,     // nuit courte = < 7 h (validé porteur)
  FENETRE: 28,          // référence d'un exercice : autres jours à ± 28 j
  MIN_REF: 2,           // au moins 2 jours de référence
  ECART_EPISODE: 2,     // séances courtes à ≤ 2 jours d'écart = même épisode
  MIN_N: 20, MIN_K: 5, MIN_M: 5,
  Z80: 0.84             // puissance 80 % pour le seuil minimal détectable
});
// Student bilatéral 5 % : t(0,975 ; ddl), ddl arrondi vers le bas, 1,96 au-delà de 30.
var SP_TC = [0, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131,
  2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];
function _spTcrit(df) { var k = Math.floor(df); return k < 1 ? SP_TC[1] : k <= 30 ? SP_TC[k] : 1.96; }
function _spMoy(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s / a.length; }
function _spMed(a) { a = a.slice().sort(function (x, y) { return x - y; }); var k = a.length >> 1; return a.length % 2 ? a[k] : (a[k - 1] + a[k]) / 2; }
function _spVar(a) { var m = _spMoy(a), s = 0; for (var i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m); return s / (a.length - 1); }

// § 2 — score de séance : médiane des écarts de force à la référence ± 28 j de chaque exercice.
// perf = [{ d: jour (entier), e: exercice, f: force estimée > 0 }]
function _spScores(perf) {
  var parE = {}, sc = {}, out = {};
  perf.forEach(function (p) { (parE[p.e] = parE[p.e] || []).push(p); });
  Object.keys(parE).forEach(function (e) {
    var pts = parE[e];
    pts.forEach(function (p) {
      var ref = pts.filter(function (q) { return q.d !== p.d && Math.abs(q.d - p.d) <= SP.FENETRE; });
      if (ref.length < SP.MIN_REF) return;
      var m = _spMoy(ref.map(function (q) { return q.f; }));
      (sc[p.d] = sc[p.d] || []).push((p.f - m) / m * 100);
    });
  });
  Object.keys(sc).forEach(function (d) { out[d] = _spMed(sc[d]); });
  return out;
}
function _spDelta(ep, no) { return _spMoy(no) - _spMoy(ep); }

// § 3 à § 8 — cœur de la méthode (entrées neutres, testable avec les jeux simulés).
// nuits = { jour: minutes }
function _spMethode(perf, nuits) {
  var sc = _spScores(perf);
  var P = Object.keys(sc).map(Number).filter(function (d) { return nuits[d] >= SP.NUIT_MIN; }).sort(function (a, b) { return a - b; });
  var court = P.filter(function (d) { return nuits[d] < SP.NUIT_COURTE; }), norm = P.filter(function (d) { return nuits[d] >= SP.NUIT_COURTE; });
  var eps = [];
  court.forEach(function (d) { var l = eps[eps.length - 1]; if (l && d - l[l.length - 1] <= SP.ECART_EPISODE) l.push(d); else eps.push([d]); });
  var N = P.length, K = eps.length, M = norm.length;
  if (N < SP.MIN_N || K < SP.MIN_K || M < SP.MIN_M) return { v: 'apprentissage', N: N, K: K, M: M };
  var se = eps.map(function (e) { return _spMoy(e.map(function (d) { return sc[d]; })); }), sn = norm.map(function (d) { return sc[d]; });
  var D = _spDelta(se, sn), a = _spVar(se) / K, b = _spVar(sn) / M, SE = Math.sqrt(a + b);
  var df = (a + b) * (a + b) / (a * a / (K - 1) + b * b / (M - 1)), tc = _spTcrit(df);
  var sig = SE > 0 && Math.abs(D / SE) >= tc;
  // § 7 — robustesse : Δ garde son signe en retirant chaque unité une à une.
  var rob = true, i, d2;
  for (i = 0; i < K && rob; i++) { d2 = _spDelta(se.filter(function (_, j) { return j !== i; }), sn); if (Math.sign(d2) !== Math.sign(D)) rob = false; }
  for (i = 0; i < M && rob; i++) { d2 = _spDelta(se, sn.filter(function (_, j) { return j !== i; })); if (Math.sign(d2) !== Math.sign(D)) rob = false; }
  var Y = Math.ceil((tc + SP.Z80) * SE);
  return { v: sig && rob ? 'net' : 'pas_net', D: D, SE: SE, df: df, Y: Y, N: N, K: K, M: M, sig: sig, rob: rob };
}

// Adaptateur : données de l'app → entrées neutres. Force = _lv3ForcePoint (formule existante, inchangée).
function _spJour(iso) { var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5) : null; }
function _spEntrees(data) {
  var prog = (data && data.historique && data.historique.progression_par_exo) || {}, perf = [], nuits = {};
  Object.keys(prog).forEach(function (exo) {
    var best = {};   // 1 valeur par exercice et par jour (max), comme la méthode validée
    (prog[exo] || []).forEach(function (p) {
      var d = _spJour(_lv3Iso(p && p.date)), f = _lv3ForcePoint(p);
      if (d == null || !(f > 0)) return;
      if (!(best[d] >= f)) best[d] = f;
    });
    Object.keys(best).forEach(function (d) { perf.push({ d: Number(d), e: exo, f: best[d] }); });
  });
  ((data && data.sante_historique) || []).forEach(function (x) {
    var d = _spJour(_lv3Iso(x && x.date)), m = Number(x && x.sommeil_min);
    if (d != null && m > 0 && !(nuits[d] >= m)) nuits[d] = m;
  });
  return { perf: perf, nuits: nuits, aNuits: Object.keys(nuits).length > 0 };
}
function _spAnalyse(data) { var E = _spEntrees(data); if (!E.aNuits) return null; var r = _spMethode(E.perf, E.nuits); r.version = SP_VERSION; return r; }

// § 8 — textes : 3 sorties, pas d'autre.
function _spTexte(r) {
  if (!r) return '';
  if (r.v === 'apprentissage') return 'En apprentissage : ' + Math.min(r.N, SP.MIN_N) + '/' + SP.MIN_N + ' séances · ' + Math.min(r.K, SP.MIN_K) + '/' + SP.MIN_K + ' épisodes de nuits courtes · ' + Math.min(r.M, SP.MIN_M) + '/' + SP.MIN_M + ' séances après nuit normale.';
  if (r.v === 'net') {
    var X = Math.abs(r.D) < 1 ? '0,5' : String(Math.round(Math.abs(r.D)));
    return 'Après tes nuits de moins de 7 h, ta force estimée est en moyenne ' + X + ' % ' + (r.D > 0 ? 'sous' : 'au-dessus de') + ' ton niveau du moment (' + r.K + ' épisodes, ' + r.M + ' séances après nuit normale).';
  }
  return 'Pas d\'écart net entre tes nuits de moins de 7 h et les autres. Un écart de moins de ' + r.Y + ' % ne serait pas détectable avec tes données.';
}
var SP_ASSOC = 'Association observée, pas une preuve de cause.';
function _spHtml(data) {
  var r = null; try { r = _spAnalyse(data); } catch (_) { r = null; }
  if (!r) return '';
  var esc = (typeof _maE === 'function') ? _maE : function (s) { return String(s); };
  var tete = '<div style="font-size:11.5px;color:var(--text-muted);margin-top:9px;font-weight:700">Sommeil → performance</div>';
  if (r.v === 'apprentissage') {
    var pc = Math.round(Math.min(1, r.N / SP.MIN_N) * 100);
    return tete + '<div style="display:flex;gap:9px;align-items:center;font-size:11.5px;color:var(--text-muted);margin-top:4px"><div style="flex:1;height:6px;background:var(--border);border-radius:9px;overflow:hidden"><i style="display:block;height:100%;width:' + pc + '%;background:var(--text-subtle)"></i></div><span style="flex:none">en apprentissage</span></div>'
      + '<div style="font-size:10.5px;color:var(--text-subtle);margin-top:4px;line-height:1.45">' + esc(Math.min(r.N, SP.MIN_N) + '/' + SP.MIN_N + ' séances avec nuit mesurée · ' + Math.min(r.K, SP.MIN_K) + '/' + SP.MIN_K + ' épisodes de nuits de moins de 7 h · ' + Math.min(r.M, SP.MIN_M) + '/' + SP.MIN_M + ' séances après nuit normale.') + ' Le résultat pourra être « pas d\'écart net » : c\'est une réponse, pas une panne.</div>';
  }
  return tete + '<div style="font-size:12px;color:var(--text);margin-top:4px;line-height:1.45">' + esc(_spTexte(r)) + '</div>'
    + '<div style="font-size:10.5px;color:var(--text-subtle);margin-top:3px">' + SP_ASSOC + '</div>';
}
if (typeof module !== 'undefined' && module.exports) module.exports = { SP: SP, SP_VERSION: SP_VERSION, _spMethode: _spMethode, _spScores: _spScores, _spEntrees: _spEntrees, _spAnalyse: _spAnalyse, _spTexte: _spTexte, _spHtml: _spHtml };
