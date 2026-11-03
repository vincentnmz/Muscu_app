/* =============================================================================
 * Lecture Novalyz v3 (02/11/2026) — maquette validée par le porteur.
 *  A. Force estimée corrigée par le RPE (charge × (1 + (reps + reps en réserve) / 30),
 *     reps en réserve = 10 − RPE plafonnées à 4 — échelle RPE / RIR de Zourdos et al. 2016).
 *  B. Diagnostic d'un exercice qui coince : on TESTE les causes sur les données, on ne garde
 *     que la première qui est vraie → UN levier chiffré. Aucune cause trouvée → on le dit.
 *  C. Plan de la semaine : 3 actions max, calculé sur les données d'AVANT lundi (identique sur
 *     tous les appareils, stable toute la semaine), coché tout seul quand une séance le réalise.
 *  D. Fiabilité par conclusion (« sur N séances ») ; « en apprentissage » quand c'est trop tôt.
 * S'appuie sur l'existant (_lectureExos, _exoFourchette, _tjCibles, volume_obti…) sans le modifier.
 * ========================================================================== */
var LV3_SEUIL_SOMMEIL = 20;   // séances avec une nuit mesurée avant toute conclusion sommeil → perf

function _lv3Iso(d) { var s = String(d || ''); var m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/); return m ? m[3] + '-' + m[2] + '-' + m[1] : s.slice(0, 10); }
function _lv3T(d) { var i = _lv3Iso(d); var t = new Date(i + 'T12:00:00').getTime(); return isNaN(t) ? 0 : t; }
function _lv3Num(x) { var n = Number(x); return isNaN(n) ? 0 : n; }
function _lv3Fmt(x) { return String(Math.round(x * 10) / 10).replace('.', ','); }
function _lv3Lundi(nowT) { var d = new Date(nowT || Date.now()); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }
function _lv3Ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

// ── A. Force estimée ──────────────────────────────────────────────────────────
function _lv3Rir(s) { var r = _lv3Num(s && s.rpe); return r > 0 ? Math.max(0, Math.min(4, 10 - r)) : 0; }
function _lv3ForceSerie(s) { var c = _lv3Num(s && s.charge), r = _lv3Num(s && s.reps); return (c > 0 && r > 0) ? c * (1 + (r + _lv3Rir(s)) / 30) : 0; }
function _lv3ForcePoint(p) {
  var ser = (p && Array.isArray(p.series) && p.series.length) ? p.series : [{ charge: p && p.charge, reps: p && p.reps }];
  var m = 0; ser.forEach(function (s) { var f = _lv3ForceSerie(s); if (f > m) m = f; }); return m;
}
function _lv3Epley(p) { return _lv3Num(p.charge) * (1 + _lv3Num(p.reps) / 30); }
// Tendance par exercice : séances des 42 derniers jours (≥ 4, dernière ≤ 21 j), moyenne des 2
// dernières vs des 2 premières. Exercices au poids du corps (charge 0) exclus (pas de force en kg).
function _lv3Forces(data, nowT) {
  nowT = nowT || Date.now();
  var prog = (data && data.historique && data.historique.progression_par_exo) || {}, out = [];
  Object.keys(prog).forEach(function (exo) {
    var pts = (prog[exo] || []).filter(function (p) { var t = _lv3T(p.date); return t && t <= nowT && (nowT - t) / 864e5 <= 42; }).slice().reverse();
    if (pts.length < 4) return;
    if ((nowT - _lv3T(pts[pts.length - 1].date)) / 864e5 > 21) return;
    var v = pts.map(_lv3ForcePoint); if (v.some(function (x) { return !(x > 0); })) return;
    var ep = pts.map(_lv3Epley), m = function (a) { return (a[0] + a[1]) / 2; };
    var pct = (m(v.slice(-2)) - m(v)) / m(v) * 100, pctE = (m(ep.slice(-2)) - m(ep)) / m(ep) * 100;
    out.push({ exo: exo, pct: Math.round(pct * 10) / 10, pctSansRpe: Math.round(pctE * 10) / 10, n: pts.length, vals: v, last: v[v.length - 1],
      sem: Math.max(1, Math.round((_lv3T(pts[pts.length - 1].date) - _lv3T(pts[0].date)) / 864e5 / 7 * 10) / 10) });
  });
  return out.sort(function (a, b) { return b.pct - a.pct; });
}

// ── Volume / fréquence d'un muscle sur les 4 semaines précédant nowT ──────────
function _lv3MuscleExo(data, exo) {
  try { var e = (exercicesData || []).filter(function (x) { return x && String(x.exercice).trim() === String(exo).trim(); })[0]; if (e && e.muscle) return e.muscle; } catch (_) {}
  var m = ''; try { (data.seances_detail || []).some(function (s) { return (s.exercices || []).some(function (e) { if (String(e.nom).trim() === String(exo).trim()) { m = e.muscle || ''; return true; } return false; }); }); } catch (_) {}
  return m;
}
function _lv3Volume(data, muscle, nowT) {
  var dm = (data && data.historique && data.historique.daily_muscu) || {}, k = _musKey(muscle), fin = _lv3Ymd(new Date(nowT)), deb = _lv3Ymd(new Date(nowT - 28 * 864e5));
  var s = 0, j = 0;
  Object.keys(dm).forEach(function (d) {
    if (d < deb || d >= fin) return;
    var spm = (dm[d] && dm[d].spm) || {}, v = 0;
    Object.keys(spm).forEach(function (mm) { if (_musKey(mm) === k) v += _lv3Num(spm[mm]); });
    if (v > 0) { s += v; j++; }
  });
  var cible = ((data && data.volume_obti) || []).filter(function (o) { return o && _musKey(o.muscle) === k; })[0] || null;
  return { parSem: Math.round(s / 4 * 10) / 10, freq: Math.round(j / 4 * 10) / 10, min: cible ? _lv3Num(cible.series_min) : null, opt: cible ? _lv3Num(cible.series_opt) : null };
}

// ── B. Diagnostic ─────────────────────────────────────────────────────────────
// kind : 'sous' | 'bloque' | 'recule' | 'effort'. Renvoie { checks[], cause, pourquoi, levier, action, n, sem }.
function _lv3Diag(data, exo, kind, nowT) {
  nowT = nowT || Date.now();
  if (typeof _ctxAttendu === 'function' && _ctxAttendu(data)) return null;   // déload / reprise : baisse attendue (X1)
  var prog = (data && data.historique && data.historique.progression_par_exo) || {};
  var pts = (prog[exo] || []).filter(function (p) { var t = _lv3T(p.date); return t && t <= nowT; });   // récent → ancien
  if (pts.length < 2) return null;
  var lignes = (data && Array.isArray(data.programme)) ? data.programme : [];
  var pl = lignes.filter(function (l) { return l && String(l.exercice || '').trim() === String(exo).trim() && l.type !== 'cardio'; })[0];
  var f = _exoFourchette(exo, pl && pl.reps_mini != null && pl.reps_mini !== '' ? Number(pl.reps_mini) : null, pl && pl.reps_max != null && pl.reps_max !== '' ? Number(pl.reps_max) : null, (data && data.exo_categories) || {});
  var rmin = _lv3Num(f.rmin) || 6, rmax = _lv3Num(f.rmax) || 12;
  var rpeMax = function (p) { var v = (p.series || []).map(function (s) { return _lv3Num(s.rpe); }).filter(function (x) { return x > 0; }); return v.length ? Math.max.apply(null, v) : null; };
  var rpeMoy = function (p) { var v = (p.series || []).filter(function (s) { return _lv3Num(s.charge) === _lv3Num(p.charge); }).map(function (s) { return _lv3Num(s.rpe); }).filter(function (x) { return x > 0; }); return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null; };
  var p0 = pts[0], p1 = pts[1], c0 = _lv3Num(p0.charge), r0 = _lv3Num(p0.reps);
  var muscle = _lv3MuscleExo(data, exo), V = muscle ? _lv3Volume(data, muscle, nowT + 864e5) : null;
  var pas = (typeof _petitPas === 'function' && _petitPas(exo)) || 2.5;
  var checks = [], cause = null, levier = '', action = null;
  var kg = function (x) { return _cdFmtKg(x); };
  var nom = (muscle || '').toLowerCase();

  // 1) Charge trop lourde pour la fourchette (reps sous le minimum, effort maximal).
  var lourd = r0 > 0 && r0 < rmin && (rpeMax(p0) || 0) >= 9 && c0 > 0;
  if (lourd) {
    var cPrev = 0; for (var i = 1; i < pts.length; i++) { if (_lv3Num(pts[i].charge) !== c0) { cPrev = _lv3Num(pts[i].charge); break; } }
    var saut = cPrev > 0 && (c0 - cPrev) / cPrev >= 0.08 && cPrev < c0;
    var force = (_lv3ForcePoint(p0) + _lv3ForcePoint(p1)) / 2;
    var cible = Math.floor(force / (1 + (rmin + 1.5) / 30) / pas) * pas;
    if (cible >= c0) cible = c0 - pas;
    checks.push({ s: 'ko', t: '<b>Charge : ' + kg(c0) + ' kg pour ' + r0 + ' rep' + (r0 > 1 ? 's' : '') + '</b>, ta fourchette est ' + rmin + '-' + rmax });
    if (saut) checks.push({ s: 'ko', t: 'Saut de <b>' + kg(cPrev) + ' à ' + kg(c0) + ' kg</b> (+' + Math.round((c0 - cPrev) / cPrev * 100) + ' %)' });
    cause = 'charge'; levier = kg(cible) + ' kg, vise ' + rmin + ' reps à RPE 8-9, puis +1 rep par séance jusqu\'à ' + rmax + '.';
    action = { exo: exo, type: 'charge', charge: cible, reps: rmin, titre: exo + ' : redescends à ' + kg(cible) + ' kg', raison: 'Pour revenir à ' + rmin + ' reps à RPE 8-9 (fourchette ' + rmin + '-' + rmax + '). Calcul : ta force estimée actuelle (≈ ' + Math.round(force) + ' kg).' };
  }
  // 2) À l'échec répété.
  var nEchec = 0; for (var e = 0; e < Math.min(3, pts.length); e++) { if ((rpeMax(pts[e]) || 0) >= 10) nEchec++; }
  if (nEchec >= 3) checks.push({ s: 'ko', t: '3 séances d\'affilée à RPE 10 (à l\'échec)' });
  // 3) Volume du muscle vs minimum.
  if (V && V.min) {
    if (V.parSem < V.min) {
      checks.push({ s: 'ko', t: '<b>Volume ' + _maE(nom) + ' : ' + _lv3Fmt(V.parSem) + ' séries/sem</b> (minimum ' + V.min + ')' });
      if (!cause) {
        var add = Math.max(1, Math.min(4, Math.ceil(V.min - V.parSem)));
        cause = 'volume'; levier = '+' + add + ' série' + (add > 1 ? 's' : '') + ' de ' + exo + ' (' + _lv3Fmt(V.parSem) + ' → ' + V.min + ' séries/sem).';
        action = { exo: exo, type: 'series', muscle: muscle, min: V.min, add: add, titre: (muscle || exo) + ' : +' + add + ' série' + (add > 1 ? 's' : '') + ' de ' + exo, raison: _lv3Fmt(V.parSem) + ' → ' + V.min + ' séries/sem, ton minimum.' };
      }
    } else checks.push({ s: 'ok', t: 'Volume ' + _maE(nom) + ' : ' + _lv3Fmt(V.parSem) + ' séries/sem — pas en cause' });
  }
  // 4) Effort en hausse à charge égale.
  var ra = rpeMoy(p0), rb = rpeMoy(p1);
  // Même mesure que le moteur (RPE des 2 dernières séances vs les 2 d'avant, charge égale ou plus basse).
  try { var _rd = ((data.moteur && data.moteur.charge_ressenti && data.moteur.charge_ressenti.rpe_details) || []).filter(function (x) { return String(x.exo).trim() === String(exo).trim(); })[0]; if (_rd) { ra = _lv3Num(_rd.rpeApres); rb = _lv3Num(_rd.rpeAvant); c0 = _lv3Num(_rd.charge) || c0; p1 = { charge: c0 }; } } catch (_) {}
  if (_lv3Num(p1.charge) === c0 && ra != null && rb != null && ra >= rb + 0.5) {
    checks.push({ s: 'ko', t: 'Effort en hausse à ' + kg(c0) + ' kg : RPE ' + _lv3Fmt(rb) + ' → ' + _lv3Fmt(ra) });
    if (!cause) {
      cause = 'effort'; levier = 'garde ' + kg(c0) + ' kg et vise RPE 8 ; si le RPE monte encore la prochaine fois, allège cette semaine (−10 %).';
      action = { exo: exo, type: 'rpe', charge: c0, titre: exo + ' : garde ' + kg(c0) + ' kg, vise RPE 8', raison: 'RPE ' + _lv3Fmt(rb) + ' → ' + _lv3Fmt(ra) + ' à charge égale : signe de fatigue sur ce mouvement.' };
    }
  }
  // 5) Fréquence.
  if (V && V.freq > 0) {
    if (V.freq <= 1) { checks.push({ s: 'ko', t: 'Travaillé ' + _lv3Fmt(V.freq) + '×/sem' }); if (!cause) { cause = 'frequence'; levier = 'répartis ' + _maE(nom) + ' sur 2 séances dans la semaine.'; } }
    else checks.push({ s: 'ok', t: 'Fréquence : ' + _lv3Fmt(V.freq) + '×/sem — pas en cause' });
  }
  // 6) Bas de fourchette (bloqué sur le minimum de reps) : levier reps avant la charge.
  if (!cause && kind === 'bloque' && r0 <= rmin) { cause = 'bas'; levier = 'garde ' + kg(c0) + ' kg et vise +1 rep par séance (jusqu\'à ' + rmax + ') avant d\'ajouter du poids.'; }
  var pourquoi = '';
  var ko = checks.filter(function (c) { return c.s === 'ko'; });
  if (ko.length) pourquoi = ko.slice(0, 2).map(function (c) { return c.t; }).join(' · ');
  if (!cause) levier = 'aucune cause visible dans tes données — persiste en visant RPE 8-9 ; si ça dure 2 séances de plus, change de fourchette ou de variante.';
  var n = pts.filter(function (p) { return (nowT - _lv3T(p.date)) / 864e5 <= 42; }).length;
  var sem = Math.max(1, Math.round((_lv3T(pts[0].date) - _lv3T(pts[Math.min(pts.length, n) - 1].date)) / 864e5 / 7));
  return { exo: exo, kind: kind, checks: checks, cause: cause, pourquoi: pourquoi, levier: levier, action: action, n: n, sem: sem, rmin: rmin, rmax: rmax };
}
// Exercices à diagnostiquer (même classement que l'app + effort à charge égale du moteur).
function _lv3Diags(data, nowT) {
  var L = null; try { L = _lectureExos(data, nowT); } catch (_) {}
  if (!L) return [];
  var out = [], vu = {};
  var add = function (exo, kind) { if (vu[exo]) return; var d = _lv3Diag(data, exo, kind, nowT); if (d) { vu[exo] = 1; out.push(d); } };
  (L.sous || []).forEach(function (x) { add(x.exo, 'sous'); });
  (L.recule || []).forEach(function (x) { add(x.exo, 'recule'); });
  (L.bloque || []).forEach(function (x) { add(x.exo, 'bloque'); });
  try { ((data.moteur && data.moteur.charge_ressenti && data.moteur.charge_ressenti.rpe_details) || []).forEach(function (x) { add(x.exo, 'effort'); }); } catch (_) {}
  return out;
}

// ── C. Plan de la semaine ─────────────────────────────────────────────────────
function _lv3DataAvant(data, isoLundi) {
  var h = (data && data.historique) || {}, prog = {}, dm = {};
  Object.keys(h.progression_par_exo || {}).forEach(function (k) { var a = (h.progression_par_exo[k] || []).filter(function (p) { return _lv3Iso(p.date) < isoLundi; }); if (a.length) prog[k] = a; });
  Object.keys(h.daily_muscu || {}).forEach(function (d) { if (d < isoLundi) dm[d] = h.daily_muscu[d]; });
  var c = Object.assign({}, data); c.historique = Object.assign({}, h, { progression_par_exo: prog, daily_muscu: dm });
  return c;
}
function _lv3SeanceDe(data, exo) {
  var l = ((data && data.programme) || []).filter(function (x) { return x && String(x.exercice || '').trim() === String(exo).trim() && x.type !== 'cardio'; })[0];
  return l ? (l.seance_id || '') : '';
}
function _lv3Plan(data, nowT) {
  nowT = nowT || Date.now();
  if (!data || !data.historique) return null;
  if (typeof _ctxAttendu === 'function' && _ctxAttendu(data)) return null;   // déload / reprise : pas de plan de progression
  var lundi = _lv3Lundi(nowT), isoL = _lv3Ymd(lundi), tL = lundi.getTime() - 1;
  var D = _lv3DataAvant(data, isoL), acts = [], vuExo = {}, vuMus = {};
  var push = function (a) { if (!a || acts.length >= 3 || vuExo[a.exo]) return; vuExo[a.exo] = 1; if (a.muscle) vuMus[_musKey(a.muscle)] = 1; a.seance = _lv3SeanceDe(data, a.exo); acts.push(a); };
  var diags = _lv3Diags(D, tL);
  diags.filter(function (d) { return d.action && d.action.type === 'charge'; }).forEach(function (d) { push(d.action); });
  diags.filter(function (d) { return d.action && d.action.type === 'series'; }).forEach(function (d) { push(d.action); });
  // Volume sous le minimum (muscles du programme) sans exercice bloqué associé.
  try {
    var musProg = {};
    ((data.programme) || []).forEach(function (l) { if (!l || l.type === 'cardio') return; var m = _lv3MuscleExo(data, l.exercice); if (m && !musProg[_musKey(m)]) musProg[_musKey(m)] = { m: m, exo: l.exercice }; });
    Object.keys(musProg).forEach(function (k) {
      if (acts.length >= 3 || vuMus[k]) return;
      var V = _lv3Volume(D, musProg[k].m, lundi.getTime());
      if (V.min && V.parSem > 0 && V.parSem < V.min) {
        var add = Math.max(1, Math.min(4, Math.ceil(V.min - V.parSem)));
        push({ exo: musProg[k].exo, type: 'series', muscle: musProg[k].m, min: V.min, add: add, titre: musProg[k].m + ' : +' + add + ' série' + (add > 1 ? 's' : '') + ' de ' + musProg[k].exo, raison: _lv3Fmt(V.parSem) + ' → ' + V.min + ' séries/sem, ton minimum.' });
      }
    });
  } catch (_) {}
  diags.filter(function (d) { return d.action && d.action.type === 'rpe'; }).forEach(function (d) { push(d.action); });
  // À pousser : exercice en progrès → la cible de la prochaine fois (même calcul que la saisie).
  try {
    var L = _lectureExos(D, tL), F = {}; _lv3Forces(D, tL).forEach(function (x) { F[x.exo] = x; });
    (L.records || []).concat(L.progresse || []).forEach(function (x) {
      if (acts.length >= 3 || vuExo[x.exo]) return;
      var pl = ((data.programme) || []).filter(function (l) { return l && l.exercice === x.exo && l.type !== 'cardio'; })[0] || { exercice: x.exo };
      var tc = _tjCibles(D, [pl])[0];
      if (tc && tc.cib && (tc.cib.up === 'charge' || tc.cib.up === 'reps')) {
        var fx = F[x.exo];
        push({ exo: x.exo, type: 'cible', charge: tc.cib.charge, reps: tc.cib.reps, titre: x.exo + ' : vise ' + _cdFmtKg(tc.cib.charge) + ' kg × ' + tc.cib.reps, raison: 'En progrès' + (fx && fx.pct > 0 ? ' (+' + _lv3Fmt(fx.pct) + ' % en ' + _lv3Fmt(fx.sem) + ' sem.)' : '') + ' — même cible que ta saisie.' });
      }
    });
  } catch (_) {}
  // Rien à changer : muscles du programme dans leur zone (4 semaines).
  var ok = [];
  try {
    var seen = {};
    ((data.programme) || []).forEach(function (l) {
      if (!l || l.type === 'cardio') return; var m = _lv3MuscleExo(data, l.exercice), k = _musKey(m); if (!m || seen[k] || vuMus[k]) return; seen[k] = 1;
      var V = _lv3Volume(D, m, lundi.getTime()); if (V.min && V.parSem >= V.min && (!V.opt || V.parSem <= V.opt * 1.5)) ok.push(m.toLowerCase() + ' ' + _lv3Fmt(V.parSem));
    });
  } catch (_) {}
  // Fait cette semaine ? (séances depuis lundi, données réelles)
  var prog = (data.historique.progression_par_exo) || {}, dm = data.historique.daily_muscu || {};
  acts.forEach(function (a) {
    var pts = (prog[a.exo] || []).filter(function (p) { return _lv3Iso(p.date) >= isoL; });
    var sets = []; pts.forEach(function (p) { (p.series || []).forEach(function (s) { sets.push(s); }); });
    if (a.type === 'charge') a.fait = sets.some(function (s) { return Math.abs(_lv3Num(s.charge) - a.charge) <= 2.5 && _lv3Num(s.reps) >= a.reps; });
    else if (a.type === 'cible') a.fait = sets.some(function (s) { return _lv3Num(s.charge) >= a.charge && _lv3Num(s.reps) >= a.reps; });
    else if (a.type === 'rpe') a.fait = sets.some(function (s) { return _lv3Num(s.charge) >= a.charge && _lv3Num(s.rpe) > 0 && _lv3Num(s.rpe) <= 8; });
    else if (a.type === 'series') { var k = _musKey(a.muscle), tot = 0; Object.keys(dm).forEach(function (d) { if (d >= isoL) { var spm = (dm[d] && dm[d].spm) || {}; Object.keys(spm).forEach(function (mm) { if (_musKey(mm) === k) tot += _lv3Num(spm[mm]); }); } }); a.fait = tot >= a.min; a.cetteSem = tot; }
  });
  if (!acts.length) return null;
  return { actions: acts, ok: ok, lundi: isoL, faits: acts.filter(function (a) { return a.fait; }).length };
}

// ── D. Fiabilité : sommeil → performance en apprentissage ───────────────────
function _lv3Apprentissage(data) {
  var sh = (data && Array.isArray(data.sante_historique)) ? data.sante_historique : [];
  var nuit = {}; sh.forEach(function (x) { if (x && x.date && _lv3Num(x.sommeil_min) > 0) nuit[_lv3Iso(x.date)] = 1; });
  if (!Object.keys(nuit).length) return null;
  var dm = (data.historique && data.historique.daily_muscu) || {}, n = 0;
  Object.keys(dm).forEach(function (d) { if (dm[d] && _lv3Num(dm[d].series) > 0 && nuit[d]) n++; });
  return { n: n, seuil: LV3_SEUIL_SOMMEIL };
}

// ── Rendus ────────────────────────────────────────────────────────────────────
function _lv3Spark(vals, col) {
  if (!vals || vals.length < 2) return '';
  var w = 64, h = 22, mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), rg = (mx - mn) || 1;
  return '<svg width="' + w + '" height="' + h + '" aria-hidden="true"><path d="' + vals.map(function (v, i) { return (i ? 'L' : 'M') + (2 + i * (w - 4) / (vals.length - 1)).toFixed(1) + ' ' + (h - 3 - (v - mn) / rg * (h - 6)).toFixed(1); }).join(' ') + '" fill="none" stroke="' + col + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
function _lv3ForcesHtml(data) {
  var F = []; try { F = _lv3Forces(data); } catch (_) {}
  if (!F.length) return '';
  // Toujours visibles : les exercices en baisse (les plus utiles à voir) ; le reste par progrès décroissant.
  var bas = F.filter(function (x) { return x.pct < 0; }), haut = F.filter(function (x) { return x.pct >= 0; });
  var liste = haut.slice(0, Math.max(3, 8 - bas.length)).concat(bas);
  var pctTxt = function (p) { var a = Math.abs(p); return (p > 0 ? '+' : p < 0 ? '−' : '') + (a >= 10 ? String(Math.round(a)) : _lv3Fmt(a)) + ' %'; };
  var rows = liste.map(function (x) {
    var col = x.pct >= 3 ? '#00A854' : x.pct <= -1 ? '#DC3545' : (x.pct < 1 && x.pct > -1) ? '#E07800' : 'var(--text-muted)';
    var diff = Math.abs(x.pctSansRpe - x.pct) >= 2 ? ' <span style="font-size:10px;color:var(--text-subtle)">(' + (x.pctSansRpe >= 0 ? '+' : '−') + _lv3Fmt(Math.abs(x.pctSansRpe)) + ' % sans le RPE)</span>' : '';
    return '<div style="display:grid;grid-template-columns:minmax(0,1fr) 64px 54px;gap:8px;align-items:center;padding:7px 0;border-top:1px solid var(--border);font-size:12.5px">'
      + '<span style="min-width:0">' + _maE(x.exo) + diff + '<br><span style="font-size:10px;color:var(--text-subtle)">sur ' + x.n + ' séances</span></span>'
      + _lv3Spark(x.vals, col) + '<span style="text-align:right;font-weight:800;color:' + col + '">' + pctTxt(x.pct) + '</span></div>';
  }).join('');
  return '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px 13px">'
    + '<div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-subtle);font-weight:700;margin-bottom:2px">Ta force estimée · 6 semaines</div>'
    + rows.replace('border-top:1px solid var(--border);', '')
    + '<div style="font-size:10.5px;color:var(--text-subtle);margin-top:6px;line-height:1.45">Force estimée = charge × reps <b>+ les reps qu\'il te restait</b> (10 − RPE). Un même 80 kg × 8 compte plus à RPE 7 qu\'à RPE 9. Repère, pas un test de 1RM.</div></div>';
}
function _lv3PlanHtml(data, compact) {
  var P = null; try { P = _lv3Plan(data); } catch (_) {}
  if (!P) return '';
  if (compact) {
    return '<div style="background:var(--accent-a08,rgba(26,95,255,.08));border:1px solid var(--accent-a15,rgba(26,95,255,.18));border-radius:12px;padding:10px 12px;margin:0 0 12px">'
      + '<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);font-weight:800">Ton plan de la semaine</span><span style="font-size:11.5px;font-weight:800;color:var(--accent)">' + P.faits + ' / ' + P.actions.length + '</span></div>'
      + P.actions.map(function (a) {
        return '<div style="display:flex;gap:9px;align-items:center;margin-top:8px;font-size:12.5px"><span style="width:19px;height:19px;border-radius:6px;flex:none;display:grid;place-items:center;font-size:12px;color:#fff;' + (a.fait ? 'background:#00A854;border:2px solid #00A854' : 'border:2px solid var(--border)') + '">' + (a.fait ? '✓' : '') + '</span>'
          + '<span style="' + (a.fait ? 'text-decoration:line-through;color:var(--text-subtle)' : '') + '">' + _maE(a.titre) + (a.seance && !a.fait ? ' <span style="color:var(--text-subtle)">· « ' + _maE(a.seance) + ' »</span>' : '') + '</span></div>';
      }).join('') + '</div>';
  }
  return '<div style="background:var(--accent-a08,rgba(26,95,255,.08));border:1px solid var(--accent-a15,rgba(26,95,255,.18));border-radius:12px;padding:11px 13px">'
    + '<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--accent)">Ton plan de la semaine</span><span style="font-size:11.5px;font-weight:800;color:var(--accent)">' + P.faits + ' / ' + P.actions.length + ' fait' + (P.faits > 1 ? 's' : '') + '</span></div>'
    + P.actions.map(function (a, i) {
      return '<div style="display:flex;gap:10px;padding:9px 0;' + (i ? 'border-top:1px solid var(--border)' : '') + '"><span style="width:22px;height:22px;border-radius:999px;background:' + (a.fait ? '#00A854' : 'var(--accent)') + ';color:#fff;font-weight:800;font-size:12px;display:grid;place-items:center;flex:none">' + (a.fait ? '✓' : (i + 1)) + '</span>'
        + '<div style="min-width:0"><div style="font-size:13.5px;font-weight:700;' + (a.fait ? 'text-decoration:line-through;color:var(--text-subtle)' : '') + '">' + _maE(a.titre) + '</div><div style="font-size:11.5px;color:var(--text-muted);margin-top:2px;line-height:1.4">' + _maE(a.raison) + (a.seance ? ' Séance « ' + _maE(a.seance) + ' ».' : '') + '</div></div></div>';
    }).join('')
    + '<div style="font-size:10.5px;color:var(--text-subtle);margin-top:4px;line-height:1.45">' + (P.ok.length ? 'Rien à changer : ' + _maE(P.ok.join(' · ')) + ' séries/sem, dans ta zone. ' : '') + 'Calculé sur tes séances jusqu\'à dimanche ; chaque action se coche toute seule quand ta séance la réalise.</div></div>';
}
function _lv3PourquoiHtml(d) {
  if (!d) return '';
  return '<div style="margin:5px 0 0;padding:7px 9px;border-left:3px solid var(--accent);background:var(--accent-a08,rgba(26,95,255,.06));border-radius:0 8px 8px 0;font-size:12px;color:var(--text-muted);line-height:1.45">'
    + '<b style="color:var(--text)">Pourquoi :</b> ' + (d.pourquoi || 'aucune cause visible dans tes données') + (d.cause ? '' : '') + '<br><b style="color:var(--text)">Levier :</b> ' + _maE(d.levier) + '</div>';
}
function _lv3DiagCardHtml(d) {
  if (!d) return '';
  var ic = { ok: '<span style="color:#00A854">✓</span>', ko: '<span style="color:#DC3545">✗</span>' };
  return '<div style="background:var(--surface);border:1px solid var(--border);border-left:4px solid var(--accent);border-radius:12px;padding:12px 14px;margin-top:10px">'
    + '<div style="font-size:13px;font-weight:800">' + (d.kind === 'effort' ? 'Pourquoi l\'effort monte' : d.kind === 'recule' ? 'Pourquoi ça recule' : 'Pourquoi ça bloque') + '</div>'
    + '<div style="font-size:12.5px;line-height:1.6;margin-top:6px">' + (d.checks.length ? d.checks.map(function (c) { return ic[c.s] + ' ' + c.t; }).join('<br>') : 'Aucune cause visible dans tes données.') + '</div>'
    + '<div style="margin-top:8px;font-size:13px"><b>Levier :</b> ' + _maE(d.levier) + '</div>'
    + '<div style="font-size:10.5px;color:var(--text-subtle);margin-top:5px">Basé sur ' + d.n + ' séance' + (d.n > 1 ? 's' : '') + ' en ' + d.sem + ' semaine' + (d.sem > 1 ? 's' : '') + (d.n >= 4 ? ' · fiable' : ' · à confirmer') + '. C\'est toi qui décides.</div></div>';
}
function _lv3ApprentissageHtml(data) {
  var a = null; try { a = _lv3Apprentissage(data); } catch (_) {}
  if (!a || a.n >= a.seuil) return '';
  return '<div style="font-size:11.5px;color:var(--text-muted);margin-top:9px">En apprentissage : sommeil → performance</div>'
    + '<div style="display:flex;gap:9px;align-items:center;font-size:11.5px;color:var(--text-muted);margin-top:4px"><div style="flex:1;height:6px;background:var(--border);border-radius:9px;overflow:hidden"><i style="display:block;height:100%;width:' + Math.round(a.n / a.seuil * 100) + '%;background:var(--text-subtle)"></i></div><span style="flex:none">' + a.n + ' / ' + a.seuil + ' séances avec nuit mesurée</span></div>'
    + '<div style="font-size:10.5px;color:var(--text-subtle);margin-top:4px">Novalyz ne tirera de conclusion qu\'à partir de ' + a.seuil + ' séances. D\'ici là, rien n\'est affirmé.</div>';
}
