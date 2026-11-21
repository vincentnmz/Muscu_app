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
// 09/11 (validé porteur) : une gêne déclarée sur une ZONE (articulation) compte aussi pour les exercices
// dont le muscle travaille cette zone. 1 = la zone EST le muscle, 2 = zone sollicitée par l'exercice, 0 = non.
var _LV3_ZONE_MUS = [
  ['nuque', ['trap', 'epau', 'dos']],   // 14/11 (porteur) : nuque / cou
  ['epaul', ['epau', 'pect', 'dos']], ['coude', ['bice', 'tric']], ['poign', ['avan', 'bice']], ['main', ['avan', 'bice']],
  ['avant', ['avan', 'bice']], ['haut', ['dos', 'trap']], ['lomb', ['dos', 'isch', 'lomb']], ['hanch', ['fess', 'addu', 'quad']],
  ['aine', ['fess', 'addu', 'quad']], ['genou', ['quad', 'isch']], ['chevi', ['moll']], ['pied', ['moll']]
];
// Clé muscle / zone pour _lv3ZoneTouche (14/11) : _musKey retire le « s » final → « Dos » devenait « do » et ne
// correspondait plus à rien (gêne jamais reliée aux exercices de dos).
function _lv3Cle(x) { var k = (typeof _musKey === 'function') ? _musKey(String(x || '')) : String(x || '').toLowerCase(); return k === 'do' ? 'dos' : k; }
function _lv3ZoneTouche(z, mk) {
  z = String(z || ''); mk = String(mk || '');
  if (!z || !mk) return 0;
  if (z.indexOf(mk) >= 0) return 1;
  for (var i = 0; i < _LV3_ZONE_MUS.length; i++) if (z.indexOf(_LV3_ZONE_MUS[i][0]) === 0) return _LV3_ZONE_MUS[i][1].indexOf(mk) >= 0 ? 2 : 0;
  return 0;
}
// Gêne par EXERCICE (14/11, option B validée par le porteur) : zones sollicitées par chaque exercice du catalogue
// (docs/gene-par-exercice-proposition.md). Copie identique côté serveur (index.ts _RC_ZONES_EXO, test gene-active).
var LV3_ZONES_EXO = {"Abduction machine":["hanche"],"Abduction à la poulie":["hanche"],"Adducteur machine":["aine","hanche"],"Adducteur à la poulie":["aine","hanche"],"Arrière épaule haltère":["epaule"],"Arrière épaule à la poulie":["epaule"],"Barre au front":["coude","poignet"],"Belt squat":["genou","hanche"],"Box jump":["genou","cheville","pied"],"Burpees":["poignet","epaule","genou","cheville"],"Coups de masse sur pneu":["epaule","poignet","lombaires"],"Crunch au sol":["nuque"],"Crunch machine":[],"Crunch à la poulie":[],"Curl barre":["coude","poignet"],"Curl barre poulie":["coude","poignet"],"Curl haltère":["coude","poignet"],"Curl incliné au banc":["coude","poignet"],"Curl incliné uni poignée à la poulie":["coude","poignet"],"Curl inversé barre":["poignet","coude"],"Curl machine":["coude","poignet"],"Curl marteau aux haltères":["coude","poignet"],"Curl marteau à la poulie":["coude","poignet"],"Curl poignet barre":["poignet","coude"],"Curl poignet inversé":["poignet","coude"],"Curl pupitre":["coude","poignet"],"Dips machine":["epaule","coude","poignet"],"Dips pectoraux":["epaule","coude","poignet"],"Dips triceps":["epaule","coude","poignet"],"Développé Arnold":["epaule","coude","poignet"],"Développé couché barre":["epaule","coude","poignet"],"Développé couché haltère":["epaule","coude","poignet"],"Développé couché incliné haltère":["epaule","coude","poignet"],"Développé décliné machine":["epaule","coude","poignet"],"Développé décliné à la Smith":["epaule","coude","poignet"],"Développé incliné Hammer":["epaule","coude","poignet"],"Développé incliné à la Smith":["epaule","coude","poignet"],"Développé machine":["epaule","coude","poignet"],"Développé machine Hammer":["epaule","coude","poignet"],"Développé militaire aux haltères":["epaule","coude","poignet"],"Développé militaire à la Smith":["epaule","coude","poignet"],"Développé militaire à la barre":["epaule","coude","poignet","lombaires"],"Développé épaules machine":["epaule","coude","poignet"],"Extension dos à la poulie corde":["coude","epaule"],"Extension lombaire au banc 45°":["lombaires","hanche"],"Extension nuque haltère":["coude","epaule"],"Extension poulie barre":["coude"],"Extension poulie corde":["coude"],"Extension triceps banc":["coude","poignet"],"Face pull":["epaule"],"Fente bulgare":["genou","hanche","cheville"],"Fente courte":["genou","hanche","cheville"],"Fente longue":["genou","hanche","cheville"],"Fentes marchées sac lesté":["genou","hanche","cheville"],"Front squat":["genou","hanche","lombaires","poignet"],"Good morning":["lombaires","hanche"],"Hack squat":["genou","hanche"],"Hip thrust":["hanche"],"Hip thrust machine":["hanche"],"Kettlebell swing":["lombaires","hanche"],"Kick back":["hanche"],"Kickback haltère":["coude"],"Leg curl allongé":["genou"],"Leg curl assis":["genou"],"Leg curl debout":["genou"],"Leg curl unilatéral":["genou"],"Leg extension":["genou"],"Leg extension unilatéral":["genou"],"Mollets assis":["cheville","pied"],"Mollets debout":["cheville","pied","haut_dos","lombaires"],"Mollets unilatéral haltère":["cheville","pied"],"Mollets à la Smith":["cheville","pied","haut_dos","lombaires"],"Mollets à la presse":["cheville","pied"],"Nordic curl":["genou"],"Oiseau machine":["epaule"],"Pallof press":[],"Pendulum":["genou","hanche"],"Pompe":["epaule","coude","poignet"],"Presse circulaire":["genou","hanche"],"Presse horizontale":["genou","hanche"],"Presse inclinée":["genou","hanche"],"Presse sumo":["genou","hanche","aine"],"Presse unilatérale":["genou","hanche"],"Pull over":["epaule","coude"],"Pull-through à la poulie":["hanche"],"RDL barre":["lombaires","hanche"],"RDL haltère":["lombaires","hanche"],"Relevé de bassin":["hanche"],"Relevé de genoux suspendu":["hanche","epaule","poignet"],"Relevé de jambe":["hanche","lombaires"],"Retournement de pneu":["lombaires","hanche","genou"],"Roulette":["lombaires","epaule"],"Rowing banc":["epaule","coude"],"Rowing barre":["epaule","coude","lombaires"],"Rowing bucheron":["epaule","coude","lombaires"],"Rowing machine":["epaule","coude"],"Rowing menton":["epaule","coude","poignet"],"Shrugs barre":["nuque"],"Shrugs haltères":["nuque"],"Sissy squat":["genou","cheville"],"Slam ball":["epaule","lombaires"],"Soulevé de terre":["lombaires","hanche","genou","poignet"],"Squat":["genou","hanche","lombaires"],"Squat gobelet":["genou","hanche"],"Squat gobelet kettlebell":["genou","hanche"],"Squat sac lesté":["genou","hanche"],"Squat sumo haltère":["genou","hanche","aine"],"T-bar row":["epaule","coude","lombaires"],"T-bar row prise basse":["epaule","coude","lombaires"],"T-bar row prise haute":["epaule","coude","lombaires"],"Tirage horizontal machine prise neutre":["epaule","coude"],"Tirage horizontal machine prise pronation":["epaule","coude"],"Tirage horizontal prise large":["epaule","coude"],"Tirage horizontal prise serrée":["epaule","coude"],"Tirage horizontal uni à la poulie":["epaule","coude"],"Tirage trapèze machine":["nuque"],"Tirage vertical machine":["epaule","coude"],"Tirage vertical prise large":["epaule","coude"],"Tirage vertical prise serrée":["epaule","coude"],"Tirage vertical uni à la poignée":["epaule","coude"],"Tirage vertical uni à la poulie":["epaule","coude"],"Traction":["epaule","coude"],"Wall ball":["genou","hanche","epaule"],"Écarté haltères":["epaule","coude"],"Écarté haltères décliné":["epaule","coude"],"Écarté haltères incliné":["epaule","coude"],"Écarté machine":["epaule","coude"],"Écarté machine uni":["epaule","coude"],"Écarté poulie basse":["epaule","coude"],"Écarté poulie haute":["epaule","coude"],"Élévation frontale barre":["epaule","poignet"],"Élévation frontale haltères":["epaule"],"Élévation frontale à la poulie":["epaule"],"Élévation latérale haltère":["epaule"],"Élévation latérale uni à la poulie":["epaule"]};
var _lv3ZexoIdx = null;
function _lv3ZonesExo(exo) {
  if (!_lv3ZexoIdx) { _lv3ZexoIdx = {}; Object.keys(LV3_ZONES_EXO).forEach(function (k) { _lv3ZexoIdx[k.trim().toLowerCase()] = LV3_ZONES_EXO[k]; }); }
  return _lv3ZexoIdx[String(exo || '').trim().toLowerCase()] || null;
}
// Zone du questionnaire → code de la table (avant-bras = poignet ; main = règle par muscle seulement — porteur 14/11).
function _lv3ZoneCode(z) {
  var k = String(z || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[_-]/g, ' ').trim();
  var P = [['epaul', 'epaule'], ['coude', 'coude'], ['poign', 'poignet'], ['avant', 'poignet'], ['nuque', 'nuque'], ['cou', 'nuque'], ['haut', 'haut_dos'], ['lomb', 'lombaires'], ['hanch', 'hanche'], ['aine', 'aine'], ['genou', 'genou'], ['chevi', 'cheville'], ['pied', 'pied']];
  for (var i = 0; i < P.length; i++) if (k.indexOf(P[i][0]) === 0) return P[i][1];
  return null;
}
// Dernier questionnaire (≤ 7 jours) s'il signale une douleur ≥ 3/5 sur une zone ; sinon null.
function _lv3DerniereGene(data, nowT) {
  var be = ((data && data.bien_etre) || []).filter(function (b) { var t = _lv3T(b && b.date); return t && t <= nowT + 864e5 && (nowT - t) / 864e5 <= 7; });
  if (!be.length) return null;
  be.sort(function (a, b) { return _lv3T(b.date) - _lv3T(a.date); });
  var b0 = be[0], z0 = String(b0.zone || b0.zone_douloureuse || '');
  if (!(_lv3Num(b0.douleur) >= 3) || !z0) return null;
  var d = new Date(_lv3T(b0.date));
  return { z0: z0, zone: ((typeof _anZoneLabel === 'function') ? String(_anZoneLabel(z0.toLowerCase())) : z0).toLowerCase().replace(/_/g, ' '),
    val: _lv3Num(b0.douleur), date: String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') };
}
// Gêne ACTIVE (14/11) : au DERNIER questionnaire (≤ 7 jours), douleur ≥ 3/5 sur une zone sollicitée par ce muscle
// (table des zones validée le 09/11) OU par cet exercice (table par exercice, 14/11). Les deux règles s'additionnent.
// Une gêne levée au questionnaire suivant n'est plus active. → { zone, val, date, indir } ou null.
function _lv3GeneActive(data, muscle, nowT, exo) {
  nowT = nowT || Date.now();
  var g = _lv3DerniereGene(data, nowT); if (!g) return null;
  var mk = _lv3Cle(muscle).slice(0, 4), z = _lv3Cle(g.z0);
  var tz = (mk && z) ? _lv3ZoneTouche(z, mk) : 0;
  if (!tz && exo) { var zc = _lv3ZoneCode(g.z0), ze = _lv3ZonesExo(exo); if (zc && ze && ze.indexOf(zc) >= 0) tz = 2; }
  if (!tz) return null;
  return { zone: g.zone, val: g.val, date: g.date, indir: tz === 2 };
}
// Gêne active pour un MUSCLE (action de volume « +N séries ») : le muscle est touché, ou un des exercices du programme
// qui le travaillent sollicite la zone (ex. poignet → développé couché → pectoraux). Même règle côté serveur.
function _lv3GeneMuscle(data, muscle, nowT) {
  var g = _lv3GeneActive(data, muscle, nowT); if (g) return g;
  var k = _lv3Cle(muscle), lignes = (data && Array.isArray(data.programme)) ? data.programme : [];
  for (var i = 0; i < lignes.length; i++) {
    var l = lignes[i]; if (!l || l.type === 'cardio' || !l.exercice) continue;
    var m = (typeof _lv3MuscleExo === 'function') ? _lv3MuscleExo(data, l.exercice) : null;
    if (m && _lv3Cle(m) === k) { var ge = _lv3GeneActive(data, null, nowT, l.exercice); if (ge) return ge; }
  }
  return null;
}
// Gêne SANS zone reliée à un muscle (« Autre », zone vide ou inconnue) au dernier questionnaire (≤ 7 j), douleur ≥ 3/5 :
// rien n'est mis en pause (on ne sait pas quoi), mais le plan affiche une ligne de prudence (14/11, porteur).
function _lv3GeneAutre(data, nowT) {
  nowT = nowT || Date.now();
  var be = ((data && data.bien_etre) || []).filter(function (b) { var t = _lv3T(b && b.date); return t && t <= nowT + 864e5 && (nowT - t) / 864e5 <= 7; });
  if (!be.length) return null;
  be.sort(function (a, b) { return _lv3T(b.date) - _lv3T(a.date); });
  var b0 = be[0]; if (!(_lv3Num(b0.douleur) >= 3)) return null;
  var z = _lv3Cle(b0.zone || b0.zone_douloureuse || '');
  var MUS = ['pect', 'dos', 'epau', 'bice', 'tric', 'avan', 'trap', 'lomb', 'abdo', 'quad', 'isch', 'fess', 'addu', 'moll'];
  if (z && MUS.some(function (m) { return _lv3ZoneTouche(z, m) > 0; })) return null;
  var d = new Date(_lv3T(b0.date));
  return { val: _lv3Num(b0.douleur), date: String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') };
}
function _lv3GeneAutreHtml(data) {
  var g = null; try { g = _lv3GeneAutre(data); } catch (_) {}
  return g ? '<div style="font-size:11.5px;color:#B35F00;margin-top:6px;line-height:1.45">⚠ Gêne ' + g.val + '/5 signalée le ' + g.date + ' (zone non précisée) : allège les exercices qui la réveillent, avis kiné si ça persiste.</div>' : '';
}
// B5 (banc 14/11) : nom de muscle lisible dans une phrase (« Volume épaules », « exercices d'ischios »).
function _lv3MusNom(m) {
  var M = { epaule: 'épaules', ischio: 'ischios', fessier: 'fessiers', adducteur: 'adducteurs', trapeze: 'trapèzes', trapezes: 'trapèzes', lombaire: 'lombaires', mollet: 'mollets', abdominau: 'abdominaux', pectorau: 'pectoraux' };
  var k = String(m || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  return M[k] || M[k.replace(/s$/, '')] || String(m || '').toLowerCase();
}
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
// 20/11 (banc « exercice remplacé ») : l'exemple d'une action « séries » cite un exercice du programme ACTUEL du muscle
// (le plan est figé lundi ; si l'exercice a été remplacé depuis, on citait l'ancien). L'action compte tout le muscle.
function _lv3ExoExemple(data, a) {
  var prog = (data && data.programme) || [], dans = prog.some(function (l) { return l && String(l.exercice || '').trim() === String(a.exo || '').trim(); });
  if (dans || !a.muscle) return a.exo;
  var m = _musKey(a.muscle), l = prog.filter(function (x) { return x && x.type !== 'cardio' && _musKey(_lv3MuscleExo(data, x.exercice) || '') === m; })[0];
  return l ? l.exercice : a.exo;
}
function _lv3MuscleExo(data, exo) {
  try { var e = (exercicesData || []).filter(function (x) { return x && String(x.exercice).trim() === String(exo).trim(); })[0]; if (e && e.muscle) return e.muscle; } catch (_) {}
  var m = ''; try { (data.seances_detail || []).some(function (s) { return (s.exercices || []).some(function (e) { if (String(e.nom).trim() === String(exo).trim()) { m = e.muscle || ''; return true; } return false; }); }); } catch (_) {}
  return m;
}
function _lv3Volume(data, muscle, nowT) {
  var dm = (data && data.historique && data.historique.daily_muscu) || {}, k = _musKey(muscle), fin = _lv3Ymd(new Date(nowT)), _d28 = new Date(nowT); _d28.setDate(_d28.getDate() - 28); var deb = _lv3Ymd(_d28);   // 18/11 : en jours (changement d'heure)
  var s = 0, j = 0, prem = null;
  Object.keys(dm).forEach(function (d) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d >= fin) return;
    if (prem == null || d < prem) prem = d;
    if (d < deb) return;
    var spm = (dm[d] && dm[d].spm) || {}, v = 0;
    Object.keys(spm).forEach(function (mm) { if (_musKey(mm) === k) v += _lv3Num(spm[mm]); });
    if (v > 0) { s += v; j++; }
  });
  // Audit 06/11 : on divise par les semaines RÉELLEMENT couvertes (1re séance → fin, max 4) ; avant, un compte de
  // 5 jours (18 séries d'épaule) affichait « 4,5 séries/sem, 0,5×/sem ». recul < 2 sem → pas de conclusion (appelants).
  var debEff = (prem && prem > deb) ? prem : deb;
  var sem = prem ? Math.min(4, Math.max(0, Math.round((_lv3T(fin) - _lv3T(debEff)) / 864e5) / 7)) : 0;   // jours entiers (changement d'heure)   // aucune séance avant → aucun recul
  var div = Math.max(1, sem);
  var cible = ((data && data.volume_obti) || []).filter(function (o) { return o && _musKey(o.muscle) === k; })[0] || null;
  return { parSem: Math.round(s / div * 10) / 10, freq: Math.round(j / div * 10) / 10, recul: Math.round(sem * 10) / 10, min: cible ? _lv3Num(cible.series_min) : null, opt: cible ? _lv3Num(cible.series_opt) : null, prio: !!(cible && cible.prio) };
}

// ── B. Diagnostic ─────────────────────────────────────────────────────────────
// kind : 'sous' | 'bloque' | 'recule' | 'effort'. Renvoie { checks[], cause, pourquoi, levier, action, n, sem }.
// E (14/11, validé porteur) : charge INHABITUELLE (moteur.surcharge ≠ Faible) dont le ressenti ne permet pas de dire
// qu'elle est encaissée (non évalué, ou dégradé) → aucune proposition d'AUGMENTATION (séries, cible « à pousser »,
// RPE 9-10). Maintien, allègement, récupération et garde-fous (gêne prioritaire) restent. Vérité = le moteur.
function _lv3PicCharge(data) {
  var m = (data && data.moteur) || {};
  if (!m.surcharge || m.surcharge === 'Faible') return null;
  var cr = m.charge_ressenti || {};
  if (cr.evaluable === true && cr.degrade !== true) return null;
  return { pic: true, degrade: cr.degrade === true };
}
// H (14/11, validé porteur) : douleur FORTE signalée (alerte moteur « douleur », sévérité haute). Hors zone : maintien,
// aucune progression (pas de +séries, RPE 9-10, échec) — la zone garde son garde-fou propre (gêne). Moteur de douleur inchangé.
function _lv3DouleurForte(data) {
  var a = (((data && data.moteur) || {}).alertes || []).filter(function (x) { return x && x.type === 'douleur' && x.severite === 'haute'; })[0];
  if (!a) return null;
  var z = (String(a.message || '').match(/\(([^)]+)\)/) || [])[1] || '';
  return { df: true, zone: z };
}
var LV3_HORS_ZONE = 'hors zone douloureuse : garde tes charges prévues. Pas besoin de forcer ni d\'aller à l\'échec.';
// Raison d'une action en pause (gêne ou pic de charge) — courte (liste) et longue (plan détaillé).
function _lv3PauseCourt(g) { return (g && g.df) ? 'douleur forte' : (g && g.pic) ? 'charge en hausse' : ('gêne ' + ((g && g.zone) || '')); }
function _lv3PauseLong(g) {
  if (g && g.df) return 'Douleur forte signalée' + (g.zone ? ' (' + _maE(g.zone) + ')' : '') + ' : hors zone, garde tes charges et tes séries prévues. Pas besoin de forcer ni d\'aller à l\'échec. L\'action revient d\'elle-même quand la douleur est levée.';
  if (g && g.pic) return g.degrade
    ? 'Ta charge est en hausse et ton ressenti baisse : on n\'ajoute rien cette semaine, priorité à la récupération. L\'action revient d\'elle-même quand ta charge redevient habituelle.'
    : 'Ta charge est en hausse et ton ressenti n\'est pas assez renseigné pour savoir si tu l\'encaisses : on n\'ajoute rien tant qu\'on ne sait pas. Renseigne ton état du jour ; l\'action revient d\'elle-même.';
  return 'Gêne ' + _maE(g.zone) + ' ' + g.val + '/5 signalée le ' + g.date + ' : n\'ajoute ni charge ni séries sur cette zone tant qu\'elle revient (avis kiné si ça persiste). L\'action revient d\'elle-même quand ton questionnaire ne signale plus la gêne.';
}
function _r5(x) { return Math.round((Number(x) || 0) / 5) * 5; }   // 21/11 : repos affichés arrondis à 5 s, partout pareil
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
  // Audit 06/11 : même fenêtre que le Résumé (plan, « Rien à changer ») et Tendances = 4 semaines TERMINÉES (avant le
  // lundi de la semaine en cours) ; avant : 28 derniers jours → 13,8 au Résumé, 15,8 dans « Pourquoi ça bloque ».
  // Moins de 2 semaines de recul → volume et fréquence non jugés.
  var muscle = _lv3MuscleExo(data, exo), V = muscle ? _lv3Volume(data, muscle, _lv3Lundi(nowT + 1).getTime()) : null;
  if (V && V.recul < 2) V = null;
  var pas = (typeof _petitPas === 'function' && _petitPas(exo)) || 2.5;
  var checks = [], cause = null, levier = '', action = null, avant = null;
  var kg = function (x) { return _cdFmtKg(x); };
  // 18/11 (validé porteur) : leviers « au choix » — l'option « +30 s de repos » s'appuie sur le repos RÉEL des séries de
  // travail de la dernière séance, proposée seulement s'il est connu et < 3 min.
  var _rtx = function (x) { var n = Math.round(Number(x) || 0), m = Math.floor(n / 60), r = n % 60; return m ? (m + ' min' + (r ? ' ' + String(r).padStart(2, '0') : '')) : (r + ' s'); };   // même format que _reposTxt (app.js)
  var _repJ = (function () { var c = _lv3Num(p0.charge), v = (p0.series || []).filter(function (x) { return _lv3Num(x.charge) === c; }).map(function (x) { return _lv3Num(x.repos); }).filter(function (x) { return x > 0; }); return v.length ? Math.round(v.reduce(function (a, b) { return a + b; }, 0) / v.length / 5) * 5 : null; })();   // 21/11 : même arrondi (5 s) que la ligne « Repos : X » (avant : 15 s → « 50 s » puis « tu prends 45 s »)
  // 21/11 (porteur + études) : repos utile selon le type d'exercice. Poly-articulaires (gros / moyen) : moins de 2 min limite
  // la progression (3 min > 1 min en force et en muscle, Schoenfeld 2016, JSCR) ; isolation / type inconnu : au-delà de 90 s,
  // aucune différence mesurée en hypertrophie (Singer 2024). L'option n'est proposée que sous ce seuil, plafonnée à 3 min.
  var _catR = ''; try { _catR = (typeof _exoCat === 'function') ? _exoCat(exo, (data && data.exo_categories) || {}) : ''; } catch (_) {}
  var _seuilR = (_catR === 'gros' || _catR === 'moyen') ? 120 : 90;
  var _optRepos = (_repJ && _repJ < _seuilR) ? '+' + (Math.min(180, _repJ + 30) - _repJ) + ' s de repos entre tes séries (tu prends ' + _rtx(_repJ) + ', essaie ' + _rtx(Math.min(180, _repJ + 30)) + ')'   /* 21/11 : écart réel quand le plafond 3 min s'applique */ : '';
  var nom = _lv3MusNom(muscle);

  // 1) Charge trop lourde pour la fourchette (reps sous le minimum, effort maximal).
  // 21/11 : même règle que la cible (« sous la fourchette » = la MAJORITÉ des séries de travail sous le minimum, échauffement
  // < 60 % de la plus lourde exclu). Avant : la seule meilleure série → « 30 kg pour 5 reps : trop lourd, 27,5 kg » à côté de
  // la cible « garde 30 × 5 » (1 série sur 3 sous 8 reps : 30×5 puis 25×8, 25×8).
  var _trv = (function () { var ss = (p0.series || []).filter(function (x) { return _lv3Num(x.reps) > 0; }), mx = Math.max.apply(null, [0].concat(ss.map(function (x) { return _lv3Num(x.charge); }))); return ss.filter(function (x) { var c = _lv3Num(x.charge); return !(c > 0 && c < 0.6 * mx); }); })();
  var _sousN = _trv.filter(function (x) { return _lv3Num(x.reps) < rmin; }).length;
  var lourd = r0 > 0 && r0 < rmin && (rpeMax(p0) || 0) >= 9 && c0 > 0 && _sousN * 2 > _trv.length;
  if (lourd) {
    var cPrev = 0; for (var i = 1; i < pts.length; i++) { if (_lv3Num(pts[i].charge) !== c0) { cPrev = _lv3Num(pts[i].charge); break; } }
    var saut = cPrev > 0 && (c0 - cPrev) / cPrev >= 0.08 && cPrev < c0;
    // Décision porteur 03/11 : on PROPOSE un petit pas (≈ −5 %, 80 → 75 kg) ; la charge « sûre » (rmin reps à
    // RPE 9 d'après la meilleure force estimée récente, jamais plus de −12,5 %) est donnée au choix.
    var recent = []; pts.slice(0, 3).forEach(function (p) { (p.series || []).forEach(function (x) { recent.push(x); }); });
    var pp = (typeof _sousPetitPas === 'function') ? _sousPetitPas(c0, pas) : c0 - pas;
    var alt = (typeof _sousAlt === 'function') ? _sousAlt(c0, recent, rmin, pas) : null;
    var Fb = 0; recent.forEach(function (x) { var f = _lv3ForceSerie(x); if (f > Fb) Fb = f; });
    checks.push({ s: 'ko', t: '<b>Charge : ' + kg(c0) + ' kg pour ' + r0 + ' rep' + (r0 > 1 ? 's' : '') + '</b>, ta fourchette est ' + rmin + '-' + rmax });
    if (saut) checks.push({ s: 'ko', t: 'Saut de <b>' + kg(cPrev) + ' à ' + kg(c0) + ' kg</b> (+' + Math.round((c0 - cPrev) / cPrev * 100) + ' %)' });
    cause = 'charge';
    levier = 'au choix — ' + kg(pp) + ' kg (petit pas' + (alt ? ', attends-toi à ≈ ' + alt.repsAuPetitPas + ' reps au début' : '') + ')'
      + (alt ? ' ou ' + kg(alt.charge) + ' kg (pour assurer ' + rmin + ' reps à RPE 9, d\'après ta meilleure série récente)' : '') + ', puis +1 rep par séance jusqu\'à ' + rmax + (_optRepos ? ' ; ou garde ' + kg(c0) + ' kg avec ' + _optRepos : '') + '. C\'est toi qui choisis.';
    action = { exo: exo, type: 'charge', charge: pp, alt: alt ? alt.charge : null, reps: rmin, titre: exo + ' : proposé ' + kg(pp) + ' kg' + (alt ? ' (ou ' + kg(alt.charge) + ' kg)' : ''),
      raison: 'Pour revenir dans ta fourchette ' + rmin + '-' + rmax + '. Petit pas de ≈ 5 %' + (alt ? ' ; ' + kg(alt.charge) + ' kg si tu veux être sûr de faire ' + rmin + ' reps (force estimée ≈ ' + Math.round(Fb) + ' kg)' : '') + '.' };
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
        cause = 'volume'; levier = (nom && V.freq > 0 && V.freq < 1.5 ? 'au choix — +' : '+') + add + ' série' + (add > 1 ? 's' : '') + ' de ' + exo + ' (' + _lv3Fmt(V.parSem) + ' → ' + V.min + ' séries/sem)' + (nom && V.freq > 0 && V.freq < 1.5 ? ', ou répartis ' + _maE(String(nom).toLowerCase()) + ' sur 2 séances dans la semaine (' + _lv3Fmt(V.freq) + '×/sem aujourd\'hui)' : '') + '.';
        action = { exo: exo, type: 'series', muscle: muscle, min: V.min, add: add, parSem: V.parSem, recul: V.recul, titre: (V.prio ? '★ ' : '') + (muscle || exo) + ' : +' + add + ' série' + (add > 1 ? 's' : '') + ' de ' + exo, raison: _lv3Fmt(V.parSem) + ' → ' + V.min + ' séries/sem, ' + (V.prio ? 'ta zone prioritaire.' : 'ton minimum.') };
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
      cause = 'effort'; levier = 'au choix — garde ' + kg(c0) + ' kg et vise RPE 8' + (_optRepos ? ' ; ou ' + _optRepos : '') + ' ; si le RPE monte encore la prochaine fois, allège un peu la charge ou retire une série cette semaine.';
      action = { exo: exo, type: 'rpe', charge: c0, titre: exo + ' : garde ' + kg(c0) + ' kg, vise RPE 8', raison: 'RPE ' + _lv3Fmt(rb) + ' → ' + _lv3Fmt(ra) + ' à charge égale : signe de fatigue sur ce mouvement.' };
    }
  }
  // 5) Fréquence.
  if (V && V.freq > 0) {
    if (V.freq <= 1) { checks.push({ s: 'ko', t: 'Travaillé ' + _lv3Fmt(V.freq) + '×/sem' }); if (!cause) { cause = 'frequence'; levier = 'ajoute 1 série de ' + exo + ' ; si ta séance est déjà longue, répartis ' + _maE(nom) + ' sur 2 séances dans la semaine pour placer ces séries.'; } }   // 21/11 : à volume égal, la fréquence seule ne change pas l'hypertrophie (Schoenfeld 2019) — c'est un moyen d'ajouter des séries
    // 18/11 (audit Vincent) : on nomme le muscle et on dit que le secondaire compte (spm), sinon « Trapèze 2×/sem » ici
    // contredisait « 0,4×/sem » dans Tendances (qui ne compte que le muscle principal).
    else checks.push({ s: 'ok', t: 'Fréquence ' + _maE(String(nom || '').toLowerCase()) + ' : ' + _lv3Fmt(V.freq) + '×/sem (y compris en muscle secondaire) — pas en cause' });
  }
  // 6) Bas de fourchette (bloqué sur le minimum de reps) : levier reps avant la charge.
  // (06/11, validé) Plus de « +1 rep » sur un exercice BLOQUÉ : il bloque déjà, on cherche la cause (étapes 6-10).
  // 7-9) (06/11, retour porteur) Exercice BLOQUÉ : « +1 rep » ne sert à rien s'il bloque déjà — on cherche POURQUOI
  // dans les séries de travail (charge du jour) des dernières séances : repos raccourci, effort laissé en réserve,
  // marche de charge trop grosse. Chaque cause trouvée est affichée ; le levier vient de la première.
  var rpeT = null;
  if (kind === 'bloque') {
    var trav = function (p) { var c = _lv3Num(p.charge); return (p.series || []).filter(function (x) { return _lv3Num(x.charge) === c; }); };
    var moyK = function (arr, k) { var v = arr.map(function (x) { return _lv3Num(x[k]); }).filter(function (x) { return x > 0; }); return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null; };
    var recentes = pts.slice(0, 3);
    var _rt = (typeof _reposTxt === 'function') ? _reposTxt : function (x) { return Math.round(x) + ' s'; };
    // 7) Repos raccourci à la dernière séance (≥ 30 s de moins que les précédentes).
    var rep0 = moyK(trav(p0), 'repos'), repAv = moyK([].concat.apply([], pts.slice(1, 4).map(trav)), 'repos');
    if (rep0 != null && repAv != null && repAv - rep0 >= 30) {
      checks.push({ s: 'ko', t: '<b>Repos raccourci</b> : ' + _rt(_r5(repAv)) + ' → ' + _rt(_r5(rep0)) + ' à la dernière séance' });
      if (!cause) { cause = 'repos'; levier = 'reviens à ' + _rt(_r5(repAv)) + ' de repos entre tes séries (' + _rt(_r5(rep0)) + ' la dernière fois).'; }
    } else if (rep0 != null) checks.push({ s: 'ok', t: 'Repos : ' + _rt(_r5(rep0)) + ', stable — pas en cause' });
    // 8) Effort laissé en réserve : séries de travail arrêtées à RPE ≤ 8 (≈ 2 reps ou plus en réserve).
    rpeT = moyK([].concat.apply([], recentes.map(trav)), 'rpe');
    // 16/11 (retour porteur) : pas de « réserve d'effort » quand l'effort MONTE déjà (cause « effort », signe de fatigue)
    // ou quand la dernière séance était à RPE ≥ 9 — avant : « vise RPE 8 … Et va jusqu'à RPE 9-10 » dans la même phrase.
    var _rpe0 = moyK(trav(p0), 'rpe');
    if (rpeT != null && rpeT < 8.5 && cause !== 'effort' && !(_rpe0 != null && _rpe0 >= 9)) {
      var res = Math.round(10 - rpeT);
      checks.push({ s: 'ko', t: '<b>Séries arrêtées à RPE ' + _lv3Fmt(Math.round(rpeT * 10) / 10) + '</b> (≈ ' + res + ' rep' + (res > 1 ? 's' : '') + ' en réserve) sur les ' + recentes.length + ' dernières séances' });
      if (!cause) { cause = 'reserve'; levier = 'le blocage peut venir de l\'arrêt de tes séries : tu t\'arrêtes avec ≈ ' + res + ' rep' + (res > 1 ? 's' : '') + ' en réserve. Au choix : sur ta dernière série, va jusqu\'à RPE 9 (≈ 1 rep en réserve)' + (c0 > 0 ? ' à ' + kg(c0) + ' kg, ou ajoute 1 série à ' + kg(c0) + ' kg.' : ', ou ajoute 1 série.') + (c0 <= 0 && rmax && r0 >= rmax ? ' Tu es au haut de ta fourchette (' + rmax + ' reps) au poids du corps : pour continuer à progresser, ajoute du lest ou passe à une variante plus difficile.' : ''); }
      else levier += ' Et sur ta dernière série, va jusqu\'à RPE 9 : tu t\'arrêtes avec ≈ ' + res + ' rep' + (res > 1 ? 's' : '') + ' en réserve.';
    } else if (rpeT != null && cause !== 'effort') checks.push({ s: 'ok', t: 'Effort : RPE ' + _lv3Fmt(Math.round(rpeT * 10) / 10) + ' sur tes séries de travail — tu pousses déjà, pas en cause' });
    // 9) Marche de charge trop grosse pour cet exercice (ex. 7,5 → 10 kg = +33 %).
    // 8) (validé 06/11) Gêne ≥ 3/5 signalée sur la zone du muscle pendant le plateau → cause POSSIBLE.
    try {
      var t0p = _lv3T(recentes[recentes.length - 1].date), mk = _lv3Cle(muscle).slice(0, 4);
      var gen = mk ? ((data && data.bien_etre) || []).filter(function (b) {
        var t = _lv3T(b.date), z = _lv3Cle(b.zone || b.zone_douloureuse || '');
        return t && t >= t0p - 864e5 && t <= nowT && _lv3Num(b.douleur) >= 3 && z && _lv3ZoneTouche(z, mk) > 0;
      }) : [];
      if (gen.length) {
        var gMax = Math.max.apply(null, gen.map(function (b) { return _lv3Num(b.douleur); }));
        var gDates = gen.map(function (b) { var d = new Date(_lv3T(b.date)); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); });
        var gZ0 = String(gen[0].zone || gen[0].zone_douloureuse || nom), gZone = ((typeof _anZoneLabel === 'function') ? String(_anZoneLabel(gZ0.toLowerCase())) : gZ0).toLowerCase().replace(/_/g, ' ');
        var gIndir = _lv3ZoneTouche(_lv3Cle(gZone), mk) === 2;
        checks.push({ s: 'ko', t: '<b>Possible : gêne ' + _maE(gZone) + ' ' + gMax + '/5</b> signalée le ' + gDates.join(', ') + (gIndir ? ' (zone sollicitée par cet exercice)' : '') });
        // 16/11 (constaté sur le compte démo) : la gêne sur la zone PASSE DEVANT les causes déjà trouvées (repos, réserve
        // d'effort) — avant, « va jusqu'à RPE 9-10 » était proposé avec une gêne épaule 3/5 signalée 7 fois. Aucun levier
        // ne pousse alors l'effort, la charge ou le volume (même règle que la gêne active du 14/11).
        cause = 'gene'; levier = 'gêne ' + gZone + ' signalée pendant ce plateau : tant qu\'elle revient, garde ta charge, sans aller à l\'échec ni ajouter de séries (avis kiné si ça persiste).';
        if (action && action.type === 'series') action = null;
      }
    } catch (_) {}
    // 9) (validé 06/11) Série plus légère AVANT les séries de travail dont les reps montent (+3 ou plus) pendant que
    // les séries de travail stagnent ou baissent → elle fatigue peut-être plus qu'avant. Cause POSSIBLE.
    try {
      var leg = function (p) { var c = _lv3Num(p.charge), ss = p.series || [], i1 = -1; for (var i = 0; i < ss.length; i++) { if (_lv3Num(ss[i].charge) === c) { i1 = i; break; } } return i1 > 0 ? ss.slice(0, i1).filter(function (x) { return _lv3Num(x.charge) < c; }) : []; };
      var topR = function (p) { var c = _lv3Num(p.charge); return Math.max.apply(null, [0].concat((p.series || []).filter(function (x) { return _lv3Num(x.charge) === c; }).map(function (x) { return _lv3Num(x.reps); }))); };
      var pRef = pts[Math.min(3, pts.length - 1)];
      var l0 = leg(p0), lR = leg(pRef);
      if (l0.length && lR.length && _lv3Num(l0[0].charge) === _lv3Num(lR[0].charge) && _lv3Num(pRef.charge) === c0) {
        var a0 = _lv3Num(l0[0].reps), aR = _lv3Num(lR[0].reps), tNow = topR(p0), tBest = Math.max.apply(null, pts.slice(1, 4).map(topR));
        if (a0 - aR >= 3 && tNow <= tBest) {
          var cl = kg(_lv3Num(l0[0].charge));
          checks.push({ s: 'ko', t: '<b>Possible : ta série à ' + cl + ' kg est passée de ' + aR + ' à ' + a0 + ' reps</b> pendant que tes séries à ' + kg(c0) + ' kg ' + (tNow < tBest ? 'sont redescendues de ' + tBest + ' à ' + tNow : 'stagnent à ' + tNow) });
          avant = { charge: _lv3Num(l0[0].charge), reps: aR };
          if (!cause) { cause = 'avant'; levier = 'garde ta série à ' + cl + ' kg au niveau d\'avant (≈ ' + aR + ' reps, sans aller au bout) pour arriver plus frais sur ' + kg(c0) + ' kg.'; }
          else levier += ' Et garde ta série à ' + cl + ' kg au niveau d\'avant (≈ ' + aR + ' reps, sans aller au bout).';
        }
      }
    } catch (_) {}
    // La marche ne bloque que quand on arrive en HAUT de la fourchette (retour porteur 06/11 : à 10 reps sur 20,
    // ce n'est pas elle qui coince — et la série plus légère d'avant est une mise en route voulue, pas un problème).
    var marche = c0 > 0 ? pas / c0 : 0;
    if (marche >= 0.15 && r0 >= rmax - 2) {
      var mPct = Math.round(marche * 100);
      checks.push({ s: 'ko', t: '<b>Marche suivante : +' + kg(pas) + ' kg = +' + mPct + ' %</b> de ta charge' });
      if (!cause) { cause = 'marche'; levier = 'la marche suivante (+' + kg(pas) + ' kg) fait +' + mPct + ' % : trop gros pour cet exercice. Passe-la au plus petit cran possible (micro-disque, cran intermédiaire de poulie) ou ajoute 1 série à ' + kg(c0) + ' kg en attendant de faire ' + rmax + ' reps.'; }
      else if (cause !== 'gene') levier += ' Et la marche suivante (+' + kg(pas) + ' kg) fait +' + mPct + ' % : monte seulement quand tu fais ' + rmax + ' reps sur toutes tes séries.';
    }
  }
  // Gêne ACTIVE sur la zone (14/11) : première cause, et le levier ne propose plus ni charge ni séries en plus.
  var _gA = null; try { _gA = _lv3GeneActive(data, muscle, nowT, exo); } catch (_) {}
  if (_gA) {
    checks = checks.filter(function (c) { return !/^<b>Possible : gêne /.test(c.t); });
    checks.unshift({ s: 'ko', t: '<b>Gêne ' + _maE(_gA.zone) + ' ' + _gA.val + '/5</b> signalée le ' + _gA.date + (_gA.indir ? ' (zone sollicitée par cet exercice)' : '') });
    cause = 'gene'; action = null;   // C1 (banc coach 14/11) : plus d'action « +séries / charge » proposée sur la zone
    levier = 'gêne ' + _gA.zone + ' signalée le ' + _gA.date + ' : n\'ajoute ni charge ni séries sur cet exercice tant qu\'elle revient ; garde ta charge ou allège (avis kiné si ça persiste).';
  }
  // E (14/11) : pic de charge non interprétable → le levier ne demande pas d'en rajouter (séries, RPE 9-10, série en plus).
  // L'action reste (le plan la met en pause, visible) ; la gêne, garde-fou explicite, reste prioritaire.
  // H (14/11) : douleur forte, exercice HORS zone (la zone est déjà traitée ci-dessus) → maintien, prioritaire sur le pic.
  var _dF = null; try { _dF = _gA ? null : _lv3DouleurForte(data); } catch (_) {}
  if (_dF && levier) {
    if (cause !== 'charge' && cause !== 'effort' && cause !== 'repos') levier = LV3_HORS_ZONE;
    else levier = levier.replace(/ Et sur ta dernière série, va jusqu'à RPE 9[^.]*\./, '');
  }
  var _pic = null; try { _pic = (_gA || _dF) ? null : _lv3PicCharge(data); } catch (_) {}
  if (_pic && levier) {
    var _prud = 'ta charge est en hausse ' + (_pic.degrade ? 'et ton ressenti baisse' : 'et ton ressenti n\'est pas assez renseigné pour savoir si tu l\'encaisses')
      + ' : garde tes séries et ta charge prévues, sans aller à l\'échec' + (_pic.degrade ? ', et priorise la récupération.' : ', et renseigne ton état du jour.');
    if (cause === 'volume' || cause === 'reserve' || cause === 'marche') levier = _prud;
    else levier = levier.replace(/ Et sur ta dernière série, va jusqu'à RPE 9[^.]*\./, '');
  }
  var pourquoi = '';
  var ko = checks.filter(function (c) { return c.s === 'ko'; });
  if (ko.length) pourquoi = ko.slice(0, kind === 'bloque' ? 3 : 2).map(function (c) { return c.t; }).join(' · ');
  // Levier sans cause trouvée : selon le niveau (03/11).
  var niv = _lv3Niveau(data);
  // 21/11 (porteur : « change de fourchette, ça n'apporte rien » ; audit docs/audit-leviers-science-2026-11-21.md) :
  // aucune cause visible → levier actionnable, par niveau. Changer de fourchette n'agit pas sur l'hypertrophie (Moesgaard 2022).
  //  · débutant : la régularité d'abord ;
  //  · intermédiaire : +2 séries/sem sur le muscle si < 20 (dose-réponse, Pelland 2024, Baz-Valle 2022), sinon l'exercice en
  //    début de séance (plus de gain de force sur les exercices faits en premier, Nunes 2021) ;
  //  · avancé / expert : idem + option tempo (descente 2-3 s, montée rapide : Wilk 2021 ; 0,5 à 8 s par rep = même hypertrophie,
  //    Schoenfeld 2015 → présenté comme « à tester ») ou variante proche 4 semaines (variation systématique, Kassiano 2022).
  var _volTxt = (V && V.parSem != null && V.parSem < 20 && nom) ? '+2 séries de ' + exo + ' par semaine (' + _maE(String(nom).toLowerCase()) + ' : ' + _lv3Fmt(V.parSem) + ' → ' + _lv3Fmt(Math.round((V.parSem + 2) * 10) / 10) + ' séries/sem)' : '';
  var _ordreTxt = 'si ce n\'est pas déjà le cas, fais ' + exo + ' en début de séance pendant 3-4 semaines';
  if (!cause) levier = niv === 'debutant' ? 'aucune cause visible dans tes données — à ton niveau, garde cet exercice et ta régularité avant de changer quoi que ce soit, en visant RPE 8-9.'
    : 'aucune cause visible dans tes données' + (kind === 'bloque' && typeof rpeT !== 'undefined' && rpeT != null && rpeT >= 8.5 ? ' (repos stable, tu pousses déjà tes séries : RPE ' + _lv3Fmt(Math.round(rpeT * 10) / 10) + ')' : '')
      + '. Au choix : ' + (_volTxt ? _volTxt + ' ; ou ' : '') + _ordreTxt
      + ((niv === 'avance' || niv === 'expert') ? ' ; ou, à tester, descends la charge en 2-3 s et remonte vite ; ou passe 4 semaines sur une variante proche' : '') + '.';
  // 21/11 : « RPE 8-9 Option à tester » (point manquant) → « RPE 8-9. Option à tester ».
  if (!cause && _optRepos && !_dF && !_pic) levier = levier.replace(/\.?$/, '.') + ' Option à tester : ' + _optRepos + '.';
  // 21/11 : « Basé sur N séances en S semaines » = les séances RÉELLEMENT lues par ce diagnostic (les 4 dernières pour un
  // blocage : repos comparé aux 3 précédentes ; sinon les 3 dernières) et l'écart réel entre la 1re et la dernière.
  // Avant : seulement celles des 42 derniers jours → « Basé sur 1 séance » sous « sur les 3 dernières séances ».
  var n = Math.min(pts.length, kind === 'bloque' ? 4 : 3);
  var jours = Math.round((_lv3T(pts[0].date) - _lv3T(pts[n - 1].date)) / 864e5);
  var sem = Math.max(1, Math.round(jours / 7));
  return { exo: exo, kind: kind, checks: checks, cause: cause, pourquoi: pourquoi, levier: levier, action: action, n: n, sem: sem, jours: jours, rmin: rmin, rmax: rmax, avant: avant };
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
// 19/11 (retour porteur) : séance où faire l'action = la PROCHAINE séance du programme pas encore faite cette semaine qui
// contient l'exercice (ou, pour un volume, un exercice du muscle). Avant : la 1re séance du programme qui le contient,
// même déjà faite (« Séance « dos jambes » » le jeudi alors que dos jambes était faite mardi). Aucune → '' (pas d'indication).
function _lv3ProchaineSeance(data, a, isoL) {
  try {
    var prog = ((data && data.programme) || []).filter(function (l) { return l && l.type !== 'cardio' && l.seance_id; });
    var k = a.muscle ? _musKey(a.muscle) : null;
    var cand = []; prog.forEach(function (l) { var sid = String(l.seance_id).trim(), ok = String(l.exercice || '').trim() === String(a.exo || '').trim() || (a.type === 'series' && k && _musKey(_lv3MuscleExo(data, l.exercice)) === k); if (ok && cand.indexOf(sid) < 0) cand.push(sid); });
    if (!cand.length) return '';
    var t = new Date(isoL + 'T12:00:00'); t.setDate(t.getDate() + 6); var isoD = _lv3Ymd(t);
    var faites = {}; try { if (typeof _faitesPeriode === 'function') faites = _faitesPeriode(data, isoL, isoD).faites || {}; } catch (_) {}
    var norm = function (x) { return (typeof _rattNorm === 'function') ? _rattNorm(x) : String(x || '').trim().toLowerCase(); };
    var jour = {}; prog.forEach(function (l) { var sid = String(l.seance_id).trim(); if (l.jour != null && l.jour !== '' && jour[sid] == null) jour[sid] = Number(l.jour); });
    var reste = cand.filter(function (sid) { return !faites[norm(sid)]; });
    if (!reste.length) return '';
    var auj = (new Date().getDay() + 6) % 7 + 1;   // 1 = lundi
    reste.sort(function (x, y) { var jx = jour[x] != null ? jour[x] : 99, jy = jour[y] != null ? jour[y] : 99; var ax = jx >= auj ? 0 : 1, ay = jy >= auj ? 0 : 1; return ax - ay || jx - jy; });
    return reste[0];
  } catch (_) { return _lv3SeanceDe(data, a.exo); }
}
function _lv3SeanceDe(data, exo) {
  var l = ((data && data.programme) || []).filter(function (x) { return x && String(x.exercice || '').trim() === String(exo).trim() && x.type !== 'cardio'; })[0];
  return l ? (l.seance_id || '') : '';
}
// Réalisation d'une action du plan sur une fenêtre [isoL, isoFin[ (isoFin null = jusqu'à aujourd'hui) — SOURCE UNIQUE :
// coche le plan de la semaine ET donne le statut des décisions passées du journal (P1-1). Critères inchangés (06/11).
// → { fait, tente (au moins une séance concernée), tot (séries du muscle), sets (séries de l'exercice) }.
function _lv3Realise(a, data, isoL, isoFin) {
  var h = (data && data.historique) || {}, prog = h.progression_par_exo || {}, dm = h.daily_muscu || {};
  var dans = function (iso) { return iso >= isoL && (!isoFin || iso < isoFin); };
  if (a.type === 'reprise') { var j = Object.keys(dm).filter(function (d) { return /^\d{4}-\d{2}-\d{2}$/.test(d) && dans(d); }); return { fait: j.length > 0, tente: j.length > 0, tot: 0, sets: [] }; }
  if (a.type === 'series') {
    var k = _musKey(a.muscle), tot = 0;
    Object.keys(dm).forEach(function (d) { if (dans(d)) { var spm = (dm[d] && dm[d].spm) || {}; Object.keys(spm).forEach(function (mm) { if (_musKey(mm) === k) tot += _lv3Num(spm[mm]); }); } });
    return { fait: tot >= a.min, tente: tot > 0, tot: tot, sets: [] };
  }
  var sets = []; (prog[a.exo] || []).filter(function (p) { return dans(_lv3Iso(p.date)); }).forEach(function (p) { (p.series || []).forEach(function (x) { sets.push(x); }); });
  var fait = false;
  if (a.type === 'charge') fait = sets.some(function (x) { var c = _lv3Num(x.charge); return c <= a.charge + 0.01 && c >= (a.alt != null ? a.alt : a.charge) - 2.5 && _lv3Num(x.reps) >= a.reps; });
  else if (a.type === 'cible') fait = sets.some(function (x) { return _lv3Num(x.charge) >= a.charge && _lv3Num(x.reps) >= a.reps; });
  else if (a.type === 'rpe') fait = sets.some(function (x) { return _lv3Num(x.charge) >= a.charge && _lv3Num(x.rpe) > 0 && _lv3Num(x.rpe) <= 8; });
  return { fait: fait, tente: sets.length > 0, tot: 0, sets: sets };
}
function _lv3Plan(data, nowT) {
  nowT = nowT || Date.now();
  if (!data || !data.historique) return null;
  if (typeof _ctxAttendu === 'function' && _ctxAttendu(data)) return null;   // déload / reprise : pas de plan de progression
  var lundi = _lv3Lundi(nowT), isoL = _lv3Ymd(lundi), tL = lundi.getTime() - 1;
  // A5 (audit coach 03/11) : après un arrêt (aucune séance muscu dans les 14 jours avant lundi), le plan
  // de volume n'a pas de sens (le volume est « bas » parce que l'athlète ne vient plus) → une seule action.
  try { if (typeof estEnPause === 'function' && estEnPause(data.pause)) return null; } catch (_) {}
  var _dmA = (data.historique.daily_muscu) || {}, _jours = Object.keys(_dmA).filter(function (d) { return /^\d{4}-\d{2}-\d{2}$/.test(d); }).sort();
  var _avant = _jours.filter(function (d) { return d < isoL; }), _derA = _avant.length ? _avant[_avant.length - 1] : null;
  if (_derA) {
    var _l14 = new Date(lundi.getTime()); _l14.setDate(_l14.getDate() - 14);
    if (_derA < _lv3Ymd(_l14)) {
      var _fait = _jours.some(function (d) { return d >= isoL; });
      var _p = _derA.split('-');
      return { actions: [{ exo: null, type: 'reprise', titre: 'Reprendre : 1 séance de muscu cette semaine', raison: 'Dernière séance le ' + _p[2] + '/' + _p[1] + '. On reprend à ton rythme ; le plan habituel revient la semaine suivante.', fait: _fait, derniere: _derA }], ok: [], lundi: isoL, faits: _fait ? 1 : 0, reprise: true };
    }
  }
  var D = _lv3DataAvant(data, isoL), acts = [], vuExo = {}, vuMus = {};
  var push = function (a) { if (!a || acts.length >= 3 || vuExo[a.exo]) return; vuExo[a.exo] = 1; if (a.muscle) vuMus[_musKey(a.muscle)] = 1; a.seance = _lv3ProchaineSeance(data, a, isoL); acts.push(a); };
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
      if (V.recul >= 2 && V.min && V.parSem > 0 && V.parSem < V.min) {
        var add = Math.max(1, Math.min(4, Math.ceil(V.min - V.parSem)));
        push({ exo: musProg[k].exo, type: 'series', muscle: musProg[k].m, min: V.min, add: add, parSem: V.parSem, recul: V.recul, titre: (V.prio ? '★ ' : '') + musProg[k].m + ' : +' + add + ' série' + (add > 1 ? 's' : '') + ' de ' + musProg[k].exo, raison: _lv3Fmt(V.parSem) + ' → ' + V.min + ' séries/sem, ' + (V.prio ? 'ta zone prioritaire.' : 'ton minimum.') });
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
        push({ exo: x.exo, type: 'cible', charge: tc.cib.charge, reps: tc.cib.reps, titre: x.exo + ' : vise ' + (typeof _cxr === 'function' ? _cxr(tc.cib.charge, tc.cib.reps) : _cdFmtKg(tc.cib.charge) + ' kg × ' + tc.cib.reps), raison: 'En progrès' + (fx && fx.pct > 0 ? ' (+' + _lv3Fmt(fx.pct) + ' % en ' + _lv3Fmt(fx.sem) + ' sem.)' : '') + ' — même cible que ta saisie.' });
      }
    });
  } catch (_) {}
  // Rien à changer : muscles du programme dans leur zone (4 semaines).
  var ok = [];
  try {
    var seen = {};
    ((data.programme) || []).forEach(function (l) {
      if (!l || l.type === 'cardio') return; var m = _lv3MuscleExo(data, l.exercice), k = _musKey(m); if (!m || seen[k] || vuMus[k]) return; seen[k] = 1;
      var V = _lv3Volume(D, m, lundi.getTime()); if (V.recul >= 2 && V.min && V.parSem >= V.min && (!V.opt || V.parSem <= V.opt * 1.5)) ok.push(m.toLowerCase() + ' ' + _lv3Fmt(V.parSem));
    });
  } catch (_) {}
  // Fait cette semaine ? (séances depuis lundi, données réelles) — même règle que le journal des décisions (_lv3Realise).
  acts.forEach(function (a) {
    var R = _lv3Realise(a, data, isoL, null);
    a.fait = R.fait;
    // 19/11 (retour porteur) : exercice DÉJÀ fait cette semaine sans atteindre l'objectif (ex. Tirage trapèze fait mardi
    // dans « dos jambes » au lieu de « dos jambe 2 ») → on dit ce qui a été fait et quand, au lieu de renvoyer vers une
    // séance où il ne sera pas refait. L'action reste non cochée (le journal la jugera « pas atteint » en fin de semaine).
    a.tente = null;
    if (!R.fait && R.tente && (a.type === 'charge' || a.type === 'cible' || a.type === 'rpe')) {
      try {
        var _pts = ((data.historique && data.historique.progression_par_exo) || {})[a.exo] || [], _b = null, _bd = null;
        _pts.forEach(function (p) { var iso = _lv3Iso(p.date); if (iso < isoL) return; (p.series || []).forEach(function (x) { var dc = _lv3Num(x.charge) - (_b ? _lv3Num(_b.charge) : -1), dr = _b ? _lv3Num(x.reps) - _lv3Num(_b.reps) : 0, de = _b ? _lv3Num(x.rpe) - _lv3Num(_b.rpe) : 0; if (!_b || dc > 0 || (dc === 0 && (dr > 0 || (dr === 0 && de > 0)))) { _b = x; _bd = iso; } }); });   // à égalité : la série la plus dure (RPE le plus haut)
        if (_b) {
          var _J = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'], _jr = _J[new Date(_bd + 'T12:00:00').getDay()];
          var _obj = a.type === 'rpe' ? 'RPE 8 ou moins à ' + _cdFmtKg(a.charge) + ' kg' : _cdFmtKg(a.charge) + ' kg × ' + a.reps;
          a.tente = { court: 'tenté ' + _jr + ' (' + _cdFmtKg(_b.charge) + ' kg × ' + _lv3Num(_b.reps) + (_lv3Num(_b.rpe) > 0 ? ', RPE ' + _lv3Fmt(_lv3Num(_b.rpe)) : '') + ')',
            long: 'Tenté ' + _jr + ' : ' + _cdFmtKg(_b.charge) + ' kg × ' + _lv3Num(_b.reps) + (_lv3Num(_b.rpe) > 0 ? ' à RPE ' + _lv3Fmt(_lv3Num(_b.rpe)) : '') + ' — objectif (' + _obj + ') pas atteint cette fois. Si tu ne refais pas l\'exercice d\'ici dimanche, il comptera comme « pas atteint » au journal.' };
        }
      } catch (_) {}
    }
    if (a.type === 'series') { var tot = R.tot; a.cetteSem = tot;
      // 06/11 : l'action dit ce qui est réellement compté — le TOTAL du muscle sur la semaine (tous ses exercices),
      // pas « +N séries de tel exercice » (retour porteur : 4 séries de Belt squat ne semblaient pas comptées).
      var _mu = String(a.muscle || '');
      var _muL = _lv3MusNom(_mu); _muL = _muL.charAt(0).toUpperCase() + _muL.slice(1);   // C3 (14/11) : « Épaules », pas « Epaule »
      a.titre = (String(a.titre || '').indexOf('★') === 0 ? '★ ' : '') + _muL + ' : ' + a.min + ' séries cette semaine';
      a.progres = _lv3Fmt(tot) + ' / ' + a.min;
      a.raison = (a.parSem != null ? 'Moyenne ' + _lv3Fmt(a.parSem) + ' séries/sem sur ' + (a.recul && a.recul < 4 ? _lv3Fmt(Math.round(a.recul)) : '4') + ' semaines, ton minimum ' + a.min + '. ' : '')
        + 'Tous tes exercices ' + (/^[aeiouyéèêh]/i.test(_mu) ? 'd\'' : 'de ') + _lv3MusNom(_mu) + ' comptent (ex. +' + a.add + ' série' + (a.add > 1 ? 's' : '') + ' de ' + (typeof _lv3ExoExemple === 'function' ? _lv3ExoExemple(data, a) : a.exo) + (a.add >= 3 ? ', idéalement sur 2 séances' : '') + ').';
    }
  });
  if (!acts.length) return null;
  // Gêne ACTIVE (14/11) : une action qui chargerait la zone douloureuse est MISE EN PAUSE (affichée comme telle, hors
  // compteur, jamais enregistrée au journal comme proposée). Calculé sur le dernier questionnaire, pas sur lundi.
  acts.forEach(function (a) { try { var m = a.muscle || (a.exo ? _lv3MuscleExo(data, a.exo) : null); var g = (a.type === 'series') ? (m ? _lv3GeneMuscle(data, m, nowT) : null) : (m || a.exo ? _lv3GeneActive(data, m, nowT, a.exo) : null); if (g && a.type !== 'reprise') a.gene = g; } catch (_) {} });
  // E (14/11) : pic de charge non interprétable → les actions d'AUGMENTATION (séries, cible « à pousser ») passent en pause
  // (même mécanique que la gêne : affichées barrées, hors compteur, jamais au journal). Maintien / allègement restent.
  // H (14/11) : douleur forte → actions d'augmentation hors zone en pause (maintien) ; la zone garde sa raison « gêne ».
  try { var _dfP = _lv3DouleurForte(data); if (_dfP) acts.forEach(function (a) { if (!a.gene && !a.fait && (a.type === 'series' || a.type === 'cible')) a.gene = _dfP; }); } catch (_) {}
  try { var _picP = _lv3PicCharge(data); if (_picP) acts.forEach(function (a) { if (!a.gene && !a.fait && (a.type === 'series' || a.type === 'cible')) a.gene = _picP; if (a.fait && a.type === 'series' && a.raison) a.raison = String(a.raison).replace(/ ?Tous tes exercices .*? comptent \(ex\. [^)]*\)\./, ' Objectif atteint cette semaine : n\'en rajoute pas tant que ta charge est en hausse.'); });   /* déjà fait = acquis, pas une proposition */ } catch (_) {}
  var actifs = acts.filter(function (a) { return !a.gene; });
  return { actions: acts, ok: ok, lundi: isoL, faits: actifs.filter(function (a) { return a.fait; }).length, nActifs: actifs.length };
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
  // 06/11 : un exercice peut avoir progressé sur 6 semaines ET être bloqué depuis quelques séances → on le dit sur la ligne.
  var _bq = {}; try { (_lectureExos(data).bloque || []).forEach(function (b) { _bq[String(b.exo).trim()] = b.n || 0; }); } catch (_) {}
  var pctTxt = function (p) { var a = Math.abs(p); return (p > 0 ? '+' : p < 0 ? '−' : '') + (a >= 10 ? String(Math.round(a)) : _lv3Fmt(a)) + ' %'; };
  var rows = liste.map(function (x) {
    var col = x.pct >= 3 ? '#00A854' : x.pct <= -1 ? '#DC3545' : (x.pct < 1 && x.pct > -1) ? '#E07800' : 'var(--text-muted)';
    var diff = Math.abs(x.pctSansRpe - x.pct) >= 2 ? ' <span style="font-size:10px;color:var(--text-subtle)">(' + (x.pctSansRpe >= 0 ? '+' : '−') + _lv3Fmt(Math.abs(x.pctSansRpe)) + ' % sans le RPE)</span>' : '';
    return '<div style="display:grid;grid-template-columns:minmax(0,1fr) 64px 54px;gap:8px;align-items:center;padding:7px 0;border-top:1px solid var(--border);font-size:12.5px">'
      + '<span style="min-width:0">' + _maE(x.exo) + diff + '<br><span style="font-size:10px;color:var(--text-subtle)">sur ' + x.n + ' séances</span>'
      + (_bq[String(x.exo).trim()] != null ? ' <span style="font-size:10px;font-weight:800;color:#B45F00">· bloqué depuis ' + _bq[String(x.exo).trim()] + ' séance' + (_bq[String(x.exo).trim()] > 1 ? 's' : '') + '</span>' : '') + '</span>'
      + _lv3Spark(x.vals, col) + '<span style="text-align:right;font-weight:800;color:' + col + '">' + pctTxt(x.pct) + '</span></div>';
  }).join('');
  return '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px 13px">'
    + '<div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-subtle);font-weight:700;margin-bottom:2px">Ta force estimée · 6 semaines</div>'
    + rows.replace('border-top:1px solid var(--border);', '')
    + '<div style="font-size:10.5px;color:var(--text-subtle);margin-top:6px;line-height:1.45">Force estimée = charge × reps <b>+ les reps qu\'il te restait</b> (10 − RPE). Un même 80 kg × 8 compte plus à RPE 7 qu\'à RPE 9. Repère, pas un test de 1RM.'
    + (function () { var nv = _lv3Niveau(data); return nv === 'debutant' ? ' À ton niveau, la force monte souvent d\'une séance à l\'autre.' : (nv === 'avance' || nv === 'expert') ? ' À ton niveau, la progression est lente : quelques % sur plusieurs semaines, c\'est déjà bien.' : ''; })()
    + '</div></div>';
}
function _lv3PlanHtml(data, compact) {
  var P = null; try { P = _lv3Plan(data); } catch (_) {}
  if (!P) return '';
  if (compact) {
    return '<div style="background:var(--accent-a08,rgba(26,95,255,.08));border:1px solid var(--accent-a15,rgba(26,95,255,.18));border-radius:12px;padding:10px 12px;margin:0 0 12px">'
      + '<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);font-weight:800">Ton plan de la semaine</span><span style="font-size:11.5px;font-weight:800;color:var(--accent)">' + (P.nActifs ? P.faits + ' / ' + P.nActifs : 'en pause') + '</span></div>'
      + P.actions.map(function (a) {
        if (a.gene) return '<div style="display:flex;gap:9px;align-items:center;margin-top:8px;font-size:12.5px;color:var(--text-muted)"><span style="width:19px;height:19px;border-radius:6px;flex:none;display:grid;place-items:center;font-size:11px;color:#B35F00;border:2px solid #E0780055">⏸</span><span><s>' + _maE(a.titre) + '</s> <b style="color:#B35F00">· en pause (' + _maE(_lv3PauseCourt(a.gene)) + ')</b></span></div>';
        return '<div style="display:flex;gap:9px;align-items:center;margin-top:8px;font-size:12.5px"><span style="width:19px;height:19px;border-radius:6px;flex:none;display:grid;place-items:center;font-size:12px;color:#fff;' + (a.fait ? 'background:#00A854;border:2px solid #00A854' : 'border:2px solid var(--border)') + '">' + (a.fait ? '✓' : '') + '</span>'
          + '<span style="' + (a.fait ? 'text-decoration:line-through;color:var(--text-subtle)' : '') + '">' + _maE(a.titre) + (a.progres && !a.fait ? ' <b style="color:var(--accent)">· ' + _maE(a.progres) + '</b>' : '') + (a.tente ? ' <b style="color:#B35F00">· ' + _maE(a.tente.court) + '</b>' : (a.seance && !a.fait && !a.progres ? ' <span style="color:var(--text-subtle)">· « ' + _maE(a.seance) + ' »</span>' : '')) + '</span></div>';
      }).join('') + _lv3GeneAutreHtml(data) + '</div>';
  }
  return '<div style="background:var(--accent-a08,rgba(26,95,255,.08));border:1px solid var(--accent-a15,rgba(26,95,255,.18));border-radius:12px;padding:11px 13px">'
    + '<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--accent)">Ton plan de la semaine</span><span style="font-size:11.5px;font-weight:800;color:var(--accent)">' + (P.nActifs ? P.faits + ' / ' + P.nActifs + ' fait' + (P.faits > 1 ? 's' : '') : 'en pause') + '</span></div>'
    + P.actions.map(function (a, i) {
      if (a.gene) return '<div style="display:flex;gap:10px;padding:9px 0;' + (i ? 'border-top:1px solid var(--border)' : '') + '"><span style="width:22px;height:22px;border-radius:999px;background:#FFF1E0;color:#B35F00;font-weight:800;font-size:11px;display:grid;place-items:center;flex:none">⏸</span>'
        + '<div style="min-width:0"><div style="font-size:13.5px;font-weight:700;color:var(--text-muted)"><s>' + _maE(a.titre) + '</s> <span style="color:#B35F00">· en pause</span></div><div style="font-size:11.5px;color:var(--text-muted);margin-top:2px;line-height:1.4">' + _lv3PauseLong(a.gene) + '</div></div></div>';
      return '<div style="display:flex;gap:10px;padding:9px 0;' + (i ? 'border-top:1px solid var(--border)' : '') + '"><span style="width:22px;height:22px;border-radius:999px;background:' + (a.fait ? '#00A854' : 'var(--accent)') + ';color:#fff;font-weight:800;font-size:12px;display:grid;place-items:center;flex:none">' + (a.fait ? '✓' : (i + 1)) + '</span>'
        + '<div style="min-width:0"><div style="font-size:13.5px;font-weight:700;' + (a.fait ? 'text-decoration:line-through;color:var(--text-subtle)' : '') + '">' + _maE(a.titre) + (a.progres && !a.fait ? ' <span style="color:var(--accent);font-weight:800">· ' + _maE(a.progres) + '</span>' : '') + '</div><div style="font-size:11.5px;color:var(--text-muted);margin-top:2px;line-height:1.4">' + _maE(a.raison) + (a.tente ? '<br><b style="color:#B35F00">' + _maE(a.tente.long) + '</b>' : (a.seance ? ' Séance « ' + _maE(a.seance) + ' ».' : '')) + '</div></div></div>';
    }).join('')
    + '<div style="font-size:10.5px;color:var(--text-subtle);margin-top:4px;line-height:1.45">' + (P.ok.length ? 'Rien à changer : ' + _maE(P.ok.join(' · ')) + ' séries/sem, dans ta zone. ' : '') + 'Ce sont des propositions : c\'est toi qui choisis. Calculées sur tes séances jusqu\'à dimanche ; chacune se coche toute seule quand ta séance la réalise.</div>' + _lv3GeneAutreHtml(data) + '</div>';
}
function _lv3PourquoiHtml(d, nom) {   // nom : exercice concerné, affiché quand la ligne en cite plusieurs (audit L3, 14/11)
  if (!d) return '';
  return '<div style="margin:5px 0 0;padding:7px 9px;border-left:3px solid var(--accent);background:var(--accent-a08,rgba(26,95,255,.06));border-radius:0 8px 8px 0;font-size:12px;color:var(--text-muted);line-height:1.45">'
    + '<b style="color:var(--text)">Pourquoi' + (nom ? ' (' + _maE(String(nom).trim()) + ')' : '') + ' :</b> ' + (d.pourquoi || 'aucune cause visible dans tes données') + (typeof _nvPropsAthlete === 'function' && !_nvPropsAthlete() ? '' : '<br><b style="color:var(--text)">Levier :</b> ' + _maE(d.levier)) + '</div>';
}
function _lv3DiagCardHtml(d) {
  if (!d) return '';
  var ic = { ok: '<span style="color:#00A854">✓</span>', ko: '<span style="color:#DC3545">✗</span>' };
  return '<div style="background:var(--surface);border:1px solid var(--border);border-left:4px solid var(--accent);border-radius:12px;padding:12px 14px;margin-top:10px">'
    + '<div style="font-size:13px;font-weight:800">' + (d.kind === 'effort' ? 'Pourquoi l\'effort monte' : d.kind === 'recule' ? 'Pourquoi ça recule' : 'Pourquoi ça bloque') + '</div>'
    + '<div style="font-size:12.5px;line-height:1.6;margin-top:6px">' + (d.checks.length ? d.checks.map(function (c) { return ic[c.s] + ' ' + c.t; }).join('<br>') : 'Aucune cause visible dans tes données.') + '</div>'
    + (typeof _nvPropsAthlete === 'function' && !_nvPropsAthlete() ? '' : '<div style="margin-top:8px;font-size:13px"><b>Levier :</b> ' + _maE(d.levier) + '</div>')   // écran 6 : le coach a la main
    + '<div style="font-size:10.5px;color:var(--text-subtle);margin-top:5px">Basé sur ' + d.n + ' séance' + (d.n > 1 ? 's' : '') + ' en ' + d.sem + ' semaine' + (d.sem > 1 ? 's' : '') + (d.n >= 4 && d.jours >= 14 && d.sem <= 6 ? ' · fiable' : ' · à confirmer')   /* 21/11 : 4 séances étalées sur 11 semaines ≠ fiable */ + '. C\'est toi qui décides.</div></div>';
}
function _lv3ApprentissageHtml(data) {
  var a = null; try { a = _lv3Apprentissage(data); } catch (_) {}
  if (!a || a.n >= a.seuil) return '';
  return '<div style="font-size:11.5px;color:var(--text-muted);margin-top:9px">En apprentissage : sommeil → performance</div>'
    + '<div style="display:flex;gap:9px;align-items:center;font-size:11.5px;color:var(--text-muted);margin-top:4px"><div style="flex:1;height:6px;background:var(--border);border-radius:9px;overflow:hidden"><i style="display:block;height:100%;width:' + Math.round(a.n / a.seuil * 100) + '%;background:var(--text-subtle)"></i></div><span style="flex:none">' + a.n + ' / ' + a.seuil + ' séances avec nuit mesurée</span></div>'
    + '<div style="font-size:10.5px;color:var(--text-subtle);margin-top:4px">Novalyz ne tirera de conclusion qu\'à partir de ' + a.seuil + ' séances. D\'ici là, rien n\'est affirmé.</div>';
}

// ── Niveau d'expérience (03/11) : donné par le serveur (getAppData.niveau_experience), sinon profil ──
function _lv3Niveau(data) {
  if (data && data.niveau_experience) return data.niveau_experience;
  try { if (typeof _maCoach !== 'undefined' && _maCoach && typeof coachAthleteCourant !== 'undefined' && coachAthleteCourant) return getNiveauExperience(coachAthleteCourant.annees_pratique != null ? coachAthleteCourant.annees_pratique : coachAthleteCourant.annees); } catch (_) {}
  try { return getNiveauExperience(athlete && athlete.annees_pratique); } catch (_) { return 'intermediaire'; }
}
var LV3_NIV_LBL = { debutant: 'débutant (0-3 ans)', intermediaire: 'intermédiaire (4-7 ans)', avance: 'avancé (8-10 ans)', expert: 'expert (11 ans et +)' };
// Séances identiques avant de dire « bloqué » : un débutant progresse presque à chaque séance, un
// avancé beaucoup plus lentement (règle de terrain, pas un chiffre d'étude).
var LV3_BLOQUE_N = { debutant: 2, intermediaire: 3, avance: 4, expert: 4 };

// ── Fenêtre d'aide générique (manquait : les « ? » tombaient sur une alerte système) ──
function ouvrirInfoGenerique(titre, contenu, estHtml) {
  var esc = (typeof escapeHtml === 'function') ? escapeHtml : function (x) { return String(x == null ? '' : x); };
  var ov = document.getElementById('nv-info-overlay');
  if (!ov) {
    ov = document.createElement('div'); ov.id = 'nv-info-overlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(7,11,20,.55);z-index:1300;display:flex;align-items:flex-end;justify-content:center';
    ov.onclick = function (ev) { if (ev.target === ov) ov.style.display = 'none'; };
    document.body.appendChild(ov);
  }
  ov.innerHTML = '<div role="dialog" aria-label="' + esc(titre) + '" style="background:var(--surface);color:var(--text);width:100%;max-width:520px;border-radius:20px 20px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom));max-height:82vh;overflow:auto;box-shadow:0 -8px 30px rgba(7,11,20,.25)">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px"><div style="font-weight:800;font-size:16px;color:var(--accent)">' + esc(titre) + '</div>'
    + '<button onclick="document.getElementById(\'nv-info-overlay\').style.display=\'none\'" aria-label="Fermer" style="border:none;background:var(--surface2);color:var(--text-muted);width:30px;height:30px;border-radius:999px;font-size:16px;cursor:pointer;flex:none">×</button></div>'
    + '<div style="font-size:13px;color:var(--text-muted);line-height:1.55">' + (estHtml ? contenu : esc(contenu)) + '</div></div>';
  ov.style.display = 'flex';
}
// ── A. « Comment Novalyz te fait progresser » (adapté au niveau) ─────────────
function _lv3InfoBtn() { if (typeof _nvPropsAthlete === 'function' && !_nvPropsAthlete()) return ''; return '<div style="margin-top:9px"><button type="button" onclick="event.stopPropagation();ouvrirInfoProgression()" style="display:inline-flex;align-items:center;gap:6px;background:var(--accent-a10,rgba(26,95,255,.10));color:var(--accent);border:1px solid var(--accent-a25,rgba(26,95,255,.28));border-radius:999px;padding:7px 12px;font:inherit;font-weight:800;font-size:12px;cursor:pointer">ⓘ Comment Novalyz te fait progresser ›</button></div>'; }   // bouton visible (validé 03/11)
function ouvrirInfoProgression() {
  var d = (typeof dernierAppData !== 'undefined') ? dernierAppData : null;
  try { if (typeof _maCoach !== 'undefined' && _maCoach && typeof coachAthleteData !== 'undefined' && coachAthleteData) d = coachAthleteData; } catch (_) {}
  var niv = _lv3Niveau(d || {}), N = LV3_BLOQUE_N[niv] || 3;
  var charge = niv === 'debutant'
    ? 'toutes tes séries au <b>haut de ta fourchette</b> une fois, à RPE 8 ou moins → la charge monte d\'un petit pas et tu repars au bas de la fourchette'
    : 'toutes tes séries au <b>haut de ta fourchette</b> <b>2 séances de suite</b> à RPE 8 ou moins (ou une seule fois à RPE 7 ou moins) → la charge monte d\'un petit pas et tu repars au bas de la fourchette';
  var li = function (t) { return '<li style="margin:0 0 8px">' + t + '</li>'; };
  var html = '<div style="margin-bottom:10px">Ton niveau : <b style="color:var(--text)">' + (LV3_NIV_LBL[niv] || niv) + '</b>, d\'après tes années de pratique.</div>'
    + '<div style="font-weight:800;color:var(--text);margin:12px 0 6px">Série par série, à partir de ton RPE</div><ul style="padding-left:18px;margin:0">'
    + li('<b>RPE 9 ou 10</b> (1 rep en réserve ou moins) → on <b>garde</b> la charge et les reps : on consolide jusqu\'à ce que ça devienne plus facile.')
    + li('<b>RPE 8 ou moins</b> → <b>+1 rep</b> la prochaine fois, jusqu\'au haut de ta fourchette.')
    + li('Charge en plus : ' + charge + '. Jamais juste après une séance à l\'échec (RPE 10).')
    + (niv === 'avance' || niv === 'expert' ? li('À ton niveau, quand la charge peut monter, tu choisis le levier du jour : charge, charge + 30 s de repos, +1 rep avec +30 s de repos, ou repos −30 s.') : '')
    + li('<b>Sous ta fourchette</b> à l\'effort maximal → au choix : un <b>petit pas</b> en dessous (≈ −5 %) ou une charge <b>sûre</b> calculée sur ta force estimée (jamais plus de −12,5 %).')
    + '</ul><div style="font-weight:800;color:var(--text);margin:12px 0 6px">Garde-fous</div><ul style="padding-left:18px;margin:0">'
    + li('2 séances de suite à l\'échec, jour de vigilance, déload ou reprise après 3 semaines sans séance → <b>pas de progression</b> ce jour-là.')
    + li('Exercice dit « bloqué » après <b>' + N + ' séances</b> identiques (à ton niveau) : Novalyz cherche la cause dans tes données (charge, volume du muscle, effort qui monte, fréquence) et te propose <b>un</b> levier.')
    + '</ul><div style="font-weight:800;color:var(--text);margin:12px 0 6px">Ta fourchette</div>'
    + '<div>Celle de ton programme, sinon celle du type d\'exercice : lourd / moyen <b>6-12</b>, léger <b>8-20</b>.</div>'
    + '<div style="margin-top:12px;padding:10px 12px;background:var(--surface2);border-radius:11px;font-size:12px">Ce sont des <b>propositions</b> : c\'est toi qui choisis à chaque séance.</div>';
  ouvrirInfoGenerique('Comment Novalyz te fait progresser', html, true);
}

// ── Effort des séances (variante A validée 03/11) ─────────────────────────────
// Barre = note de séance (bilan, CR-10) ; point bleu = RPE moyen des SÉRIES ce jour-là ; 1 séance = carte.
function _maEffortBloc(data, w, rsArr) {
  var esc = (typeof _maE === 'function') ? _maE : function (x) { return String(x); };
  var dm = (data && data.historique && data.historique.daily_muscu) || {};
  var durees = {}; (((data && data.analyses) || {}).duree_muscu || []).forEach(function (x) { if (x && x.date) durees[x.date] = x.valeur; });
  var serieRpe = function (iso) { var o = dm[iso]; return (o && o.rpe_n) ? Math.round(o.rpe_sum / o.rpe_n * 10) / 10 : null; };
  var col = function (v) { return (typeof _maRpeCol === 'function') ? _maRpeCol(v) : '#E07800'; };
  var pts = (rsArr || []).slice(0, 14).reverse().map(function (x) { var iso = _lv3Iso(x.date); return { iso: iso, s: x.seance_id && !/^(muscu|cardio)_\d/.test(String(x.seance_id)) ? String(x.seance_id) : '', v: Number(x.valeur), sr: serieRpe(iso), dur: durees[iso] }; });
  var dd = function (iso) { var p = String(iso).split('-'); return p.length === 3 ? (+p[2]) + '/' + (+p[1]) : iso; };
  var f1 = function (x) { return String(Math.round(x * 10) / 10).replace('.', ','); };
  var cap = '<div style="font-size:10.5px;color:var(--text-subtle);margin-top:6px;line-height:1.45">Note de séance = ce que tu indiques dans le bilan (0-10, toute la séance). RPE des séries = ce que tu notes à chaque série.</div>';
  if (pts.length === 1) {
    var p = pts[0], jours = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'], jd = new Date(p.iso + 'T12:00:00');
    return '<div class="ma-card" style="padding:12px 14px"><div style="display:flex;gap:12px;align-items:center">'
      + '<div style="width:54px;height:54px;border-radius:14px;display:grid;place-items:center;color:#fff;font-weight:800;font-size:20px;flex:none;background:' + col(p.v) + '">' + f1(p.v) + '</div>'
      + '<div style="font-size:12.5px;line-height:1.5"><b>' + (isNaN(jd.getTime()) ? '' : jours[jd.getDay()].charAt(0).toUpperCase() + jours[jd.getDay()].slice(1) + ' ') + dd(p.iso) + (p.s ? ' · ' + esc(p.s) : '') + '</b><br>Note de séance <b>' + f1(p.v) + '/10</b>'
      + (p.sr != null ? ' · séries <b>' + f1(p.sr) + '/10</b>' : '') + (p.dur ? ' · ' + Math.round(p.dur) + ' min' : '') + '</div></div>'
      + '<div style="font-size:10.5px;color:var(--text-subtle);margin-top:8px">Une seule séance sur la période : le graphique apparaît dès 2 séances.</div>' + cap + '</div>';
  }
  var W = 340, H = 196, pl = 24, pr = 8, top = 18, bot = H - 40, n = pts.length;
  var Y = function (v) { return bot - (v / 10) * (bot - top); }, step = (W - pl - pr) / n, bw = Math.min(26, step * 0.55);
  var g = '';
  [10, 8, 6, 4, 2].forEach(function (v) { g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(v).toFixed(0) + '" y2="' + Y(v).toFixed(0) + '" stroke="var(--border)"/><text x="' + (pl - 5) + '" y="' + (Y(v) + 3).toFixed(0) + '" font-size="9" text-anchor="end" fill="var(--text-subtle)">' + v + '</text>'; });
  var b = '', ligne = [], courts = n > 7;
  pts.forEach(function (p, i) {
    var cx = pl + step * (i + 0.5);
    b += '<rect x="' + (cx - bw / 2).toFixed(1) + '" y="' + Y(p.v).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (bot - Y(p.v)).toFixed(1) + '" rx="5" fill="' + col(p.v) + '" opacity=".9"><title>' + dd(p.iso) + ' · séance ' + f1(p.v) + '/10' + (p.sr != null ? ' · séries ' + f1(p.sr) + '/10' : '') + '</title></rect>'
      + '<text x="' + cx.toFixed(1) + '" y="' + (Y(p.v) + 14).toFixed(1) + '" font-size="10.5" font-weight="800" text-anchor="middle" fill="#fff">' + f1(p.v) + '</text>';   // valeur DANS la barre (le point bleu ne la cache plus)
    if (p.sr != null) { b += '<circle cx="' + cx.toFixed(1) + '" cy="' + Y(p.sr).toFixed(1) + '" r="4" fill="var(--surface)" stroke="#1A5FFF" stroke-width="2.2"/>'; ligne.push([cx, Y(p.sr)]); }
    if (!courts || (n - 1 - i) % 2 === 0) {   // une date sur deux, alignée sur la dernière (pas de chevauchement)
      b += '<text x="' + cx.toFixed(1) + '" y="' + (bot + 13) + '" font-size="9.5" text-anchor="middle" fill="var(--text-muted)">' + dd(p.iso) + '</text>';
      if (!courts && p.s) b += '<text x="' + cx.toFixed(1) + '" y="' + (bot + 25) + '" font-size="8.5" text-anchor="middle" fill="var(--text-subtle)">' + esc(p.s.length > 9 ? p.s.slice(0, 8) + '…' : p.s) + '</text>';
    }
  });
  if (ligne.length > 1) b = '<path d="' + ligne.map(function (q, i) { return (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join(' ') + '" fill="none" stroke="#1A5FFF" stroke-width="1.5" stroke-dasharray="3 3"/>' + b;
  var moy = pts.reduce(function (a, p) { return a + p.v; }, 0) / n;
  var avecS = pts.filter(function (p) { return p.sr != null; }), moyS = avecS.length ? avecS.reduce(function (a, p) { return a + p.sr; }, 0) / avecS.length : null;
  var vmin = Math.min.apply(null, pts.map(function (p) { return p.v; })), vmax = Math.max.apply(null, pts.map(function (p) { return p.v; }));
  var phrase = 'Tes séances sont notées <b>' + (vmin === vmax ? f1(vmin) : f1(vmin) + ' à ' + f1(vmax)) + '/10</b>'
    + (moyS != null ? ', tes séries sont à <b>' + f1(moyS) + '/10</b> en moyenne' + ((moyS >= 8 && moyS - moy >= 1) ? ' : chaque série va près de l\'échec, la séance dans son ensemble te paraît moins dure.' : '.') : '.');
  var kp = function (v, t) { return '<div style="flex:1;background:var(--surface2);border-radius:10px;padding:8px;text-align:center"><b style="display:block;font-size:18px">' + v + '</b><span style="font-size:10px;color:var(--text-subtle)">' + t + '</span></div>'; };
  return '<div class="ma-card" style="padding:12px 14px">'
    + '<div style="display:flex;gap:8px;margin-bottom:6px">' + kp(f1(moy), 'note moyenne de tes séances') + (moyS != null ? kp(f1(moyS), 'RPE moyen de tes séries') : '') + '</div>'
    + '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;font-family:inherit" role="img" aria-label="Effort des séances">' + g + b + '</svg>'
    + '<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:11px;color:var(--text-muted);margin-top:4px"><span><i style="display:inline-block;width:11px;height:11px;border-radius:3px;background:#E07800;margin-right:5px;vertical-align:-1px"></i>Note de ta séance (bilan)</span><span><i style="display:inline-block;width:11px;height:11px;border-radius:999px;border:2px solid #1A5FFF;margin-right:5px;vertical-align:-2px;box-sizing:border-box"></i>RPE moyen de tes séries</span></div>'
    + '<div style="font-size:12.5px;color:var(--text-muted);line-height:1.5;margin-top:8px">' + phrase + '</div>' + cap + '</div>';
}

// ── E. Journal des décisions (P1-1, 13/11 — maquette mockups/journal-decisions.html validée) ──────────────
// Règle fondamentale (porteur) : le moteur reste UNIQUE côté app (_lv3Plan). Le journal ne calcule rien : il FIGE ce
// que le moteur a réellement produit (première version VALIDE de la semaine), puis on lit ce qui s'est passé ensuite.
// Statuts d'une décision passée (même critère que la coche du plan, _lv3Realise, sur la semaine de la décision) :
// objectif atteint · pas atteint (tenté) · pas tenté · non évaluable (données absentes). « Résultat observé après la
// recommandation », jamais « grâce à » ; « association observée, pas une preuve de cause » côté coach.
var LV3_REGLE_VERSION = 'plan-2026-11-14';   // 14/11 : règle progresse / bloqué (L1) — le journal garde la version de chaque plan
var _lv3JournalCache = {};      // athlete_id → { rows, t }
var _lv3JournalEnCours = {};
var LV3_STATUTS = { atteint: ['Objectif atteint', '#E3F7EC', '#00813F'], pas_atteint: ['Pas atteint', '#FFF1E0', '#B35F00'], pas_tente: ['Pas tenté', 'var(--surface2,#EEF1F7)', 'var(--text-muted,#55627E)'], non_evaluable: ['Non évaluable', 'var(--surface2,#F2F2F2)', 'var(--text-subtle,#777)'] };

// Session ATHLÈTE (jeton « v1.a.… ») : seul cas où le plan peut être enregistré (garde-fou 1 ; le serveur refuse aussi).
function _lv3SessionAthlete() { try { var t = (typeof _nvzTok === 'function') ? _nvzTok() : localStorage.getItem('nvz_tok'); return !!t && String(t).split('.')[1] === 'a'; } catch (_) { return false; } }
// Plan calculé → charge utile du journal (forme seule, aucun recalcul). Critère = celui de la coche du plan.
function _lv3PlanPourJournal(P, data) {
  if (!P || !P.actions || !P.actions.length) return null;
  var avant = _lv3DataAvant(data, P.lundi), prog = (avant.historique && avant.historique.progression_par_exo) || {};
  var actions = P.actions.filter(function (a) { return !a.gene; }).slice(0, 3).map(function (a) {   // action en pause (gêne) : pas proposée
    var crit = {}, de = {};
    var put = function (o, k, v) { if (v != null && v !== '' && isFinite(Number(v))) o[k] = Math.round(Number(v) * 100) / 100; };
    if (a.type === 'charge') { put(crit, 'charge', a.charge); put(crit, 'alt', a.alt); put(crit, 'reps', a.reps); }
    else if (a.type === 'cible') { put(crit, 'charge', a.charge); put(crit, 'reps', a.reps); }
    else if (a.type === 'rpe') put(crit, 'charge', a.charge);
    else if (a.type === 'series') { put(crit, 'min', a.min); put(crit, 'add', a.add); put(crit, 'parSem', a.parSem); put(de, 'recul', a.recul); }
    else if (a.type === 'reprise') { crit.seances = 1; if (a.derniere) de.derniere = String(a.derniere).slice(0, 10); }
    if (a.exo && a.type !== 'series' && a.type !== 'reprise') {   // dernière séance de l'exercice AVANT la semaine (ce qui a conduit à la décision)
      var p0 = (prog[a.exo] || [])[0];
      if (p0) { var rp = (p0.series || []).map(function (x) { return _lv3Num(x.rpe); }).filter(function (x) { return x > 0; }); de.date = _lv3Iso(p0.date); put(de, 'c', p0.charge); put(de, 'r', p0.reps); if (rp.length) de.rpe = Math.max.apply(null, rp); de.n = (prog[a.exo] || []).length; }
    }
    return { type: a.type, exo: a.exo || null, muscle: a.muscle || null, titre: String(a.titre || '').replace(/^★\s*/, '').slice(0, 200), raison: a.raison ? String(a.raison).slice(0, 600) : null, critere: crit, donnees_entree: de };
  });
  if (!actions.length) return null;
  return { semaine: P.lundi, actions: actions };
}
// Envoi du plan (garde-fous 1 à 4) : appelé UNIQUEMENT après un getAppData réseau complet (chargerAppData), jamais
// depuis le cache ni hors ligne, jamais en session coach. Une fois par semaine et par appareil ; le serveur garde la
// première version valide (renvoi = sans effet).
function _lv3JournalEnvoyer(data) {
  try {
    if (!data || !data.historique || !Array.isArray(data.programme)) return false;                    // données incomplètes
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;                 // hors ligne
    if (!_lv3SessionAthlete()) return false;                                                          // coach / sans session
    if (typeof _nvPropsAthlete === 'function' && !_nvPropsAthlete(data)) return false;                // plan NON montré à l'athlète (le coach a la main) → rien à figer
    if (typeof athlete === 'undefined' || !athlete || !athlete.athlete_id) return false;
    var P = _lv3Plan(data); var pl = _lv3PlanPourJournal(P, data); if (!pl) return false;
    var cle = 'nv_journal_' + athlete.athlete_id + '_' + pl.semaine;
    try { if (localStorage.getItem(cle) === '1') return false; } catch (_) {}
    var body = { action: 'enregistrerPlan', athlete_id: athlete.athlete_id, semaine: pl.semaine, regle_version: LV3_REGLE_VERSION, donnees_completes: true, actions: pl.actions };
    fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); }).then(function (j) { if (j && j.success === true) { try { localStorage.setItem(cle, '1'); } catch (_) {} delete _lv3JournalCache[athlete.athlete_id]; } }).catch(function () {});
    return true;
  } catch (_) { return false; }
}
// Lecture du journal (athlète : le sien ; coach : son athlète). cb() après chargement → remplit les emplacements.
function _lv3JournalCharger(athleteId, cb) {
  if (!athleteId) return;
  var c = _lv3JournalCache[athleteId];
  if (c && Date.now() - c.t < 5 * 60000) { if (cb) cb(c.rows); return; }
  if (_lv3JournalEnCours[athleteId]) return; _lv3JournalEnCours[athleteId] = true;
  fetch(SCRIPT_URL + '?action=getDecisions&athlete_id=' + encodeURIComponent(athleteId) + '&semaines=12')
    .then(function (r) { return r.json(); }).then(function (j) { if (j && j.success && Array.isArray(j.decisions)) { _lv3JournalCache[athleteId] = { rows: j.decisions, t: Date.now() }; if (cb) cb(j.decisions); } })
    .catch(function () {}).then(function () { delete _lv3JournalEnCours[athleteId]; });
}
// Statut d'une décision PASSÉE, d'après les séances réelles de sa semaine (même critère que la coche du plan).
function _lv3JournalEvaluer(d, data) {
  if (!data || !data.historique) return { statut: 'non_evaluable', detail: 'Données de séances indisponibles.' };
  var isoL = String(d.semaine).slice(0, 10), t = new Date(isoL + 'T12:00:00'); t.setDate(t.getDate() + 7);
  var isoFin = _lv3Ymd(t), c = d.critere || {};
  var a = { type: d.type_action, exo: d.exercice, muscle: d.muscle || d.cle, charge: c.charge, alt: c.alt, reps: c.reps, min: c.min };
  if ((a.type === 'charge' || a.type === 'cible' || a.type === 'rpe') && !(a.charge > 0)) return { statut: 'non_evaluable', detail: 'Critère incomplet.' };
  var R = _lv3Realise(a, data, isoL, isoFin), detail = '';
  // 18/11 (audit Vincent) : semaine en VACANCES (≥ 3 jours de pause) et action pas tentée → non évaluable, pas « pas tenté ».
  // 18/11 (audit coach, Alizé) : même règle pendant une BLESSURE en cours ou un contexte « retour de blessure ».
  if (!R.tente && !R.fait) { try {
    var iso = function (v) { v = String(v || ''); var m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/); return m ? m[3] + '-' + m[2] + '-' + m[1] : v.slice(0, 10); };
    var auj = _lv3Ymd(new Date()), bl = [];
    ((data.blessures) || []).forEach(function (b) { if (b && b.statut !== 'gueri' && b.date) bl.push({ debut: iso(b.date), fin: auj }); });
    if (data.contexte && data.contexte.etat === 'retour_blessure') bl.push({ debut: iso(data.contexte.date_debut) || auj, fin: iso(data.contexte.date_fin) || auj });
    var jp = 0, jb = 0, dj = new Date(isoL + 'T12:00:00');
    for (var k = 0; k < 7; k++) { var ik = _lv3Ymd(dj); var dans = function (p) { return p && p.debut <= ik && ik <= p.fin; }; if ((data.pauses_hist || []).some(dans)) jp++; else if (bl.some(dans)) jb++; dj.setDate(dj.getDate() + 1); }
    if (jp >= 3) return { statut: 'non_evaluable', detail: 'Semaine de vacances (' + jp + ' jours en pause) : pas jugée.' };
    if (jb + jp >= 3) return { statut: 'non_evaluable', detail: 'Semaine de blessure (' + (jb + jp) + ' jours) : pas jugée.' };
  } catch (_) {} }
  var kg = function (x) { return (typeof _cdFmtKg === 'function') ? _cdFmtKg(x) : String(x); };
  if (a.type === 'series') detail = R.tente ? 'Réalisé : ' + _lv3Fmt(R.tot) + ' série' + (R.tot > 1 ? 's' : '') + ' (objectif ' + a.min + ').' : 'Aucune série de ce muscle cette semaine-là.';
  else if (a.type === 'reprise') detail = R.tente ? 'Séance faite cette semaine-là.' : 'Pas de séance cette semaine-là.';
  else if (R.tente) {
    var b = R.sets.slice().sort(function (x, y) { return _lv3Num(y.charge) - _lv3Num(x.charge) || _lv3Num(y.reps) - _lv3Num(x.reps); })[0];
    detail = 'Réalisé : ' + kg(b.charge) + ' kg × ' + _lv3Num(b.reps) + (_lv3Num(b.rpe) > 0 ? ' (RPE ' + _lv3Num(b.rpe) + ')' : '') + '.';
  } else detail = 'Exercice pas refait cette semaine-là.';
  return { statut: R.fait ? 'atteint' : (R.tente ? 'pas_atteint' : 'pas_tente'), detail: detail };
}
// P1-2 (13/11) — « Résultat observé ensuite » : ce qui s'est passé APRÈS la semaine de la décision (1 à 2 semaines),
// avec le critère enregistré. Déterministe, recalculé sur les séances réelles, rien de stocké. On ne conclut qu'avec assez
// de séances (« trop tôt pour conclure » sinon) et on ne parle jamais de cause (« observé », pas « grâce à »).
// → { etat: 'confirme' | 'non_confirme' | 'trop_tot' | 'pas_refait', texte, n (séances prises en compte) } ou null.
function _lv3JournalSuite(d, data, nowT) {
  if (!data || !data.historique) return null;
  nowT = nowT || Date.now();
  var h = data.historique, prog = h.progression_par_exo || {}, dm = h.daily_muscu || {}, c = d.critere || {};
  var plus = function (iso, n) { var t = new Date(String(iso).slice(0, 10) + 'T12:00:00'); t.setDate(t.getDate() + n); return _lv3Ymd(t); };
  var auj = _lv3Ymd(new Date(nowT)), s1 = plus(d.semaine, 7), s2 = plus(d.semaine, 14), fin = plus(d.semaine, 21);
  if (auj < s1) return null;                                                     // la semaine de la décision n'est pas finie
  var kg = function (x) { return (typeof _cdFmtKg === 'function') ? _cdFmtKg(x) : String(x); };
  var T = function (t) { return 'Résultat observé ensuite : ' + t; };
  var type = d.type_action;
  // Critère incomplet → aucune conclusion (on n'invente pas de seuil).
  if ((type === 'series' && !(c.min > 0)) || ((type === 'charge' || type === 'cible') && !(c.charge > 0 && c.reps > 0)) || (type === 'rpe' && !(c.charge > 0))) return null;
  if (type === 'series' || type === 'reprise') {                                  // la semaine suivante, complète
    var k = _musKey(d.muscle || d.cle), tot = 0, jours = 0;
    Object.keys(dm).forEach(function (j) { if (j >= s1 && j < s2) { jours++; var spm = (dm[j] && dm[j].spm) || {}; Object.keys(spm).forEach(function (mm) { if (_musKey(mm) === k) tot += _lv3Num(spm[mm]); }); } });
    if (auj < s2) return { etat: 'trop_tot', n: 0, texte: T('semaine suivante en cours, trop tôt pour conclure.') };
    if (type === 'reprise') return jours ? { etat: 'confirme', n: jours, texte: T('régularité reprise la semaine suivante (' + jours + ' séance' + (jours > 1 ? 's' : '') + ').') } : { etat: 'non_confirme', n: 0, texte: T('pas de séance la semaine suivante.') };
    return tot >= c.min ? { etat: 'confirme', n: 1, texte: T('minimum tenu la semaine suivante (' + _lv3Fmt(tot) + ' séries).') }
      : { etat: 'non_confirme', n: 1, texte: T('semaine suivante : ' + _lv3Fmt(tot) + ' série' + (tot > 1 ? 's' : '') + ' (minimum ' + c.min + ').') };
  }
  // Exercice : les séances des 2 semaines suivantes.
  var pts = (prog[d.exercice] || []).filter(function (p) { var i = _lv3Iso(p.date); return i >= s1 && i < fin && i <= auj; })
    .sort(function (a, b) { return _lv3Iso(a.date) < _lv3Iso(b.date) ? -1 : 1; });
  var n = pts.length, finie = auj >= fin;
  if (!n) return finie ? { etat: 'pas_refait', n: 0, texte: T('exercice pas refait dans les 2 semaines suivantes.') } : { etat: 'trop_tot', n: 0, texte: T('pas encore refait depuis, trop tôt pour conclure.') };
  var serie = function (p, ok) { return (p.series || []).filter(ok); };
  var dd = function (p) { var i = _lv3Iso(p.date).split('-'); return i[2] + '/' + i[1]; };
  var trouve = null;
  if (type === 'charge') {
    var bas = (c.alt != null ? c.alt : c.charge) - 2.5;
    for (var i = 0; i < n && !trouve; i++) { var ok = serie(pts[i], function (x) { return _lv3Num(x.charge) >= bas && _lv3Num(x.reps) >= c.reps; }); if (ok.length) trouve = { p: pts[i], x: ok.sort(function (a, b) { return _lv3Num(b.charge) - _lv3Num(a.charge) || _lv3Num(b.reps) - _lv3Num(a.reps); })[0] }; }
    if (trouve) return { etat: 'confirme', n: n, texte: T(kg(trouve.x.charge) + ' kg × ' + _lv3Num(trouve.x.reps) + ' le ' + dd(trouve.p) + ' — revenu dans ta fourchette.') };
    return n >= 2 ? { etat: 'non_confirme', n: n, texte: T('toujours sous ' + c.reps + ' reps sur ' + n + ' séances.') } : { etat: 'trop_tot', n: n, texte: T('une seule séance depuis, trop tôt pour conclure.') };
  }
  if (type === 'cible') {
    for (var j = 0; j < n && !trouve; j++) { var ok2 = serie(pts[j], function (x) { return _lv3Num(x.charge) >= c.charge && _lv3Num(x.reps) >= c.reps; }); if (ok2.length) trouve = { p: pts[j], x: ok2[0] }; }
    if (trouve) return { etat: 'confirme', n: n, texte: T('cible tenue ou dépassée : ' + kg(trouve.x.charge) + ' kg × ' + _lv3Num(trouve.x.reps) + ' le ' + dd(trouve.p) + '.') };
    return n >= 2 ? { etat: 'non_confirme', n: n, texte: T('cible pas atteinte sur ' + n + ' séances.') } : { etat: 'trop_tot', n: n, texte: T('une seule séance depuis, trop tôt pour conclure.') };
  }
  if (type === 'rpe') {
    var aCharge = pts.map(function (p) { var ss = serie(p, function (x) { return _lv3Num(x.charge) >= c.charge && _lv3Num(x.rpe) > 0; }); return ss.length ? { p: p, rpe: Math.max.apply(null, ss.map(function (x) { return _lv3Num(x.rpe); })) } : null; }).filter(Boolean);
    var bon = aCharge.filter(function (x) { return x.rpe <= 8; })[0];
    if (bon) return { etat: 'confirme', n: aCharge.length, texte: T('RPE revenu à ' + _lv3Fmt(bon.rpe) + ' à ' + kg(c.charge) + ' kg le ' + dd(bon.p) + '.') };
    if (aCharge.length >= 2) return { etat: 'non_confirme', n: aCharge.length, texte: T('RPE toujours au-dessus de 8 à ' + kg(c.charge) + ' kg (' + aCharge.length + ' séances).') };
    return { etat: 'trop_tot', n: aCharge.length, texte: T(aCharge.length ? 'une seule séance à cette charge depuis, trop tôt pour conclure.' : 'pas refait à cette charge depuis, trop tôt pour conclure.') };
  }
  return null;
}
var LV3_SUITE_COL = { confirme: '#00813F', non_confirme: '#B35F00', trop_tot: 'var(--text-subtle,#8A96B0)', pas_refait: 'var(--text-subtle,#8A96B0)' };
function _lv3JournalSuiteHtml(d, data) {
  var r = null; try { r = _lv3JournalSuite(d, data); } catch (_) {}
  if (!r) return '';
  var esc = (typeof _maE === 'function') ? _maE : function (x) { return String(x); };
  return '<div style="font-size:11.5px;margin-top:3px;color:' + (LV3_SUITE_COL[r.etat] || 'inherit') + '">' + esc(r.texte) + (r.n >= 2 ? ' <span style="color:var(--text-subtle)">(sur ' + r.n + ' séances)</span>' : '') + '</div>';
}
function _lv3JournalTag(st) { var s = LV3_STATUTS[st] || LV3_STATUTS.non_evaluable; return '<span style="display:inline-block;font-size:10px;font-weight:800;border-radius:6px;padding:2px 7px;margin-right:6px;vertical-align:1px;background:' + s[1] + ';color:' + s[2] + '">' + s[0] + '</span>'; }
// Semaines PASSÉES du journal (la semaine en cours = le plan affiché, avec ses coches).
function _lv3JournalSemaines(rows, data) {
  var lundi = _lv3Ymd(_lv3Lundi(Date.now())), par = {};
  (rows || []).forEach(function (d) { var s = String(d.semaine).slice(0, 10); if (s >= lundi) return; (par[s] = par[s] || []).push(d); });
  return Object.keys(par).sort().reverse().map(function (s) {
    var L = par[s].map(function (d) { return { d: d, ev: _lv3JournalEvaluer(d, data) }; });
    return { semaine: s, lignes: L, tentes: L.filter(function (x) { return x.ev.statut === 'atteint' || x.ev.statut === 'pas_atteint'; }).length, atteints: L.filter(function (x) { return x.ev.statut === 'atteint'; }).length };
  });
}
function _lv3TitrePasse(t) { return String(t || '').replace(/ cette semaine$/, ''); }   // affichage d'une semaine passée
function _lv3Ddmm(iso) { var p = String(iso).slice(0, 10).split('-'); return p[2] + '/' + p[1]; }
// « Semaine dernière » (sous le plan, athlète).
function _lv3JournalResumeHtml(rows, data) {
  var S = _lv3JournalSemaines(rows, data)[0]; if (!S) return '';
  var dern = _lv3Ymd(new Date(_lv3Lundi(Date.now()).getTime() - 7 * 864e5)); if (S.semaine !== dern) return '';
  var n = S.lignes.length;
  return '<div style="margin-top:10px;padding:9px 11px;background:var(--surface2);border:1px solid var(--border);border-radius:11px;font-size:12px;line-height:1.5">'
    + '<b>Semaine dernière</b><br>' + n + ' action' + (n > 1 ? 's' : '') + ' proposée' + (n > 1 ? 's' : '') + ' · ' + S.tentes + ' tentée' + (S.tentes > 1 ? 's' : '') + ' · <b>' + S.atteints + ' objectif' + (S.atteints > 1 ? 's' : '') + ' atteint' + (S.atteints > 1 ? 's' : '') + '</b>.<br>'
    + '<span onclick="ouvrirJournalDecisions()" style="color:var(--accent);font-weight:700;cursor:pointer">Voir le détail · Tes décisions ›</span></div>';
}
// Historique complet (Analyses ▸ Tes décisions ; fenêtre « Tes décisions »).
function _lv3JournalHtml(rows, data, opts) {
  opts = opts || {}; var sem = _lv3JournalSemaines(rows, data).slice(0, opts.max || 4), esc = (typeof _maE === 'function') ? _maE : function (x) { return String(x); };
  if (!sem.length) return '<div style="font-size:12.5px;color:var(--text-muted);line-height:1.5">Pas encore de décision passée : ton premier plan enregistré apparaîtra ici la semaine prochaine, avec ce qui s\'est passé ensuite.</div>';
  return sem.map(function (S) {
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:11px 13px;margin-bottom:10px">'
      + '<div style="display:flex;justify-content:space-between;font-weight:800;font-size:13px">Semaine du ' + _lv3Ddmm(S.semaine) + '<span style="font-size:11px;color:var(--text-subtle)">' + S.tentes + ' / ' + S.lignes.length + ' tentée' + (S.tentes > 1 ? 's' : '') + '</span></div>'
      + S.lignes.map(function (x, i) {
        return '<div style="font-size:12.5px;padding:8px 0;line-height:1.45;' + (i ? 'border-top:1px solid var(--border)' : '') + '">' + _lv3JournalTag(x.ev.statut) + '<b>' + esc(_lv3TitrePasse(x.d.titre)) + '</b>'
          + '<div style="font-size:11.5px;color:var(--text-muted);margin-top:3px">' + (x.d.raison ? 'Proposé car : ' + esc(x.d.raison) + ' ' : '') + esc(x.ev.detail) + '</div>' + (x.ev.statut === 'atteint' || x.ev.statut === 'pas_atteint' ? _lv3JournalSuiteHtml(x.d, data) : '') + '</div>';
      }).join('') + '</div>';
  }).join('') + '<div style="font-size:10.5px;color:var(--text-subtle);line-height:1.45">Statut : d\'après tes séances de la semaine concernée (même critère que la coche du plan). « Résultat observé ensuite » : les 1 à 2 semaines suivantes, conclu seulement avec assez de séances. Résultat observé après la recommandation. Association observée, pas une preuve de cause.</div>';
}
// Emplacements à remplir quand le journal arrive (évite de redessiner l'écran).
function _lv3JournalSlot(mode) { return '<div class="lv3-journal-slot" data-mode="' + mode + '"></div>'; }
function _lv3JournalRemplir(athleteId, data) {
  var c = _lv3JournalCache[athleteId]; if (!c) return;
  try { document.querySelectorAll('.lv3-journal-slot').forEach(function (el) { el.innerHTML = el.getAttribute('data-mode') === 'resume' ? _lv3JournalResumeHtml(c.rows, data) : _lv3JournalHtml(c.rows, data); }); } catch (_) {}
}
function _lv3JournalAfficher(data) {
  if (typeof athlete === 'undefined' || !athlete || !athlete.athlete_id) return;
  var id = athlete.athlete_id;
  _lv3JournalCharger(id, function () { _lv3JournalRemplir(id, data); });
}
function ouvrirJournalDecisions() {
  var d = (typeof dernierAppData !== 'undefined') ? dernierAppData : null, id = (typeof athlete !== 'undefined' && athlete) ? athlete.athlete_id : null;
  var c = id ? _lv3JournalCache[id] : null;
  ouvrirInfoGenerique('Tes décisions', '<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;line-height:1.45">Ce que Novalyz t\'a proposé · et ce qui s\'est passé.</div>' + _lv3JournalHtml(c ? c.rows : [], d, { max: 12 }), true);
}
// Coach : « Déjà proposé » sur un exercice (dernière décision passée qui le concerne) + bilan 4 semaines.
function _lv3JournalDejaPropose(rows, data, exo) {
  var S = _lv3JournalSemaines(rows, data), esc = (typeof _maE === 'function') ? _maE : function (x) { return String(x); };
  for (var i = 0; i < S.length; i++) for (var j = 0; j < S[i].lignes.length; j++) { var x = S[i].lignes[j]; if (String(x.d.exercice || '').trim() === String(exo).trim() || String(x.d.cle || '').trim() === String(exo).trim()) {
    return '<div style="margin-top:7px;background:var(--surface2);border:1px solid var(--border);border-radius:9px;padding:7px 9px;font-size:12px;line-height:1.45"><b>Déjà proposé</b> · semaine du ' + _lv3Ddmm(S[i].semaine) + ' : « ' + esc(_lv3TitrePasse(x.d.titre)) + ' » → ' + _lv3JournalTag(x.ev.statut) + '<span style="color:var(--text-muted)">' + esc(x.ev.detail) + '</span>' + (x.ev.statut === 'atteint' || x.ev.statut === 'pas_atteint' ? _lv3JournalSuiteHtml(x.d, data) : '') + '</div>';
  } }
  return '';
}
function _lv3JournalBilanCoachHtml(rows, data) {
  var S = _lv3JournalSemaines(rows, data).slice(0, 4); if (!S.length) return '';
  var n = 0, t = 0, a = 0, p = 0, ne = 0; S.forEach(function (s) { s.lignes.forEach(function (x) { n++; if (x.ev.statut === 'atteint') { a++; t++; } else if (x.ev.statut === 'pas_atteint') { p++; t++; } else if (x.ev.statut === 'non_evaluable') ne++; }); });
  return '<div class="dash-card" style="padding:12px 14px;margin-bottom:10px"><div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-subtle);font-weight:800;margin-bottom:5px">Historique des propositions</div>'
    + '<div style="font-size:12.5px;line-height:1.5"><b>Sur ' + S.length + ' semaine' + (S.length > 1 ? 's' : '') + '</b> : ' + n + ' action' + (n > 1 ? 's' : '') + ' proposée' + (n > 1 ? 's' : '') + ' · ' + t + ' tentée' + (t > 1 ? 's' : '') + ' · <b>' + a + ' objectif' + (a > 1 ? 's' : '') + ' atteint' + (a > 1 ? 's' : '') + '</b> · ' + p + ' pas atteint' + (p > 1 ? 's' : '') + (ne ? ' · ' + ne + ' non évaluable' + (ne > 1 ? 's' : '') : '') + '</div>'
    + '<div style="font-size:10.5px;color:var(--text-subtle);margin-top:6px;line-height:1.45">Résultat observé après la recommandation. Association observée, pas une preuve de cause : d\'autres facteurs (sommeil, programme, contexte) peuvent jouer.</div></div>';
}
