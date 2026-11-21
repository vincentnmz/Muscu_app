/* Vérificateur de cohérence (18/11/2026) — « le calcul doit être fiable à 100 % ».
 * 1. Sur une base fictive, le VRAI handleGetAppData (index.ts) sort des chiffres identiques au recalcul indépendant.
 * 2. Le vérificateur ATTRAPE chaque type d'erreur trouvé lors des audits du 18/11 (sinon il ne prouverait rien) :
 *    record daté de la répétition, séries par muscle sur la mauvaise fenêtre, séances, tonnage, meilleure série,
 *    force estimée tuile ≠ tableau, point décimal, records affichés, compte de séances différent entre écrans. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const ROOT = path.join(__dirname, '..');
const T = fs.readFileSync(path.join(__dirname, 'e2e-parcours.test.js'), 'utf8');
eval(T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend')));
const { verifier, verifierBilan, verifierMailHtml, verifierIA } = require('../scripts/verif-coherence/verif.cjs');

let ok = 0, ko = 0;
const eq = (c, n, got) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (got !== undefined ? ' (got ' + JSON.stringify(got) + ')' : '')); } };
const ymd = (d) => d.toISOString().slice(0, 10);
const J = (n) => { const d = new Date(); d.setUTCHours(12, 0, 0, 0); d.setUTCDate(d.getUTCDate() - n); return ymd(d); };
const TODAY = J(0);

function charger(store) {
  let js = stripTypeScriptTypes(fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
  js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n');
  js += '\n;this.__api = { handleGetAppData, _bilanRecapV2, _emailRecapV2HTML, _iaContexte };';
  const sandbox = { createClient: () => makeEngine(store), webpush: { setVapidDetails() {}, sendNotification: async () => {} },
    Deno: { env: { get: () => undefined }, serve: () => {} }, Response, Request, URLSearchParams, TextEncoder, TextDecoder, crypto, console, setTimeout, clearTimeout,
    fetch: async () => ({ ok: false, status: 0, text: async () => '', json: async () => ({}) }) };
  vm.createContext(sandbox); vm.runInContext(js, sandbox); return sandbox.__api;
}
// Base fictive : 3 séances sur 10 jours, un record égalé plus tard, un muscle secondaire, semaine glissante.
let id = 1;
const S = (d, exo, mus, c, r, rpe) => ({ id: id++, date: d, semaine: 46, seance_id: 'S', exercice: exo, muscle: mus, exercice_id: exo, serie: 1, charge: c, reps: r, rpe, repos: 90, athlete_id: '5', nom: 'A', volume: c * r });
const store = {
  athletes: [{ id: '5', login: '5555', nom: 'A', sport: 'muscu', annees: 2, prefs: { semaine_type: 'glissant' } }],
  exercices: [{ exercice_id: 'Presse', exercice: 'Presse', muscle: 'Quadriceps', muscle_secondaire: 'Fessier' }, { exercice_id: 'Curl', exercice: 'Curl', muscle: 'Biceps', muscle_secondaire: null, increment_kg: '1.25' }],
  performances: [S(J(9), 'Presse', 'Quadriceps', 100, 10, 8), S(J(9), 'Presse', 'Quadriceps', 100, 8, 9), S(J(5), 'Presse', 'Quadriceps', 100, 10, 9), S(J(5), 'Curl', 'Biceps', 12.5, 10, 9), S(J(1), 'Curl', 'Biceps', 12.5, 12, 10), S(J(1), 'Presse', 'Quadriceps', 90, 12, 8)],
  volume_obti: [{ id: 1, muscle: 'Quadriceps', series_min_semaine: 9, series_opt_semaine: 12 }, { id: 2, muscle: 'Fessier', series_min_semaine: 9, series_opt_semaine: 12 }, { id: 3, muscle: 'Biceps', series_min_semaine: 6, series_opt_semaine: 12 }],
  indicateurs: [], bien_etre: [], programme: [], planning: [], contexte_athlete: [], decisions: [], pauses: [], poids_historique: [], objectif: [], blessures: [],
};

(async () => {
  const API = charger(store);
  const ad = await (await API.handleGetAppData(new URLSearchParams({ athlete_id: '5', _sess_role: 'a' }))).json();
  let r = verifier({ store, appdata: ad, now: TODAY });
  eq(r.length === 0, 'vrai backend : 0 écart avec le recalcul indépendant', r);
  eq(ad.global.records_par_exo.Presse.date.slice(0, 5) === J(9).slice(8, 10) + '/' + J(9).slice(5, 7), 'record Presse 100 × 10 daté de la 1re fois (J-9), pas de la répétition (J-5)', ad.global.records_par_exo.Presse);

  const mut = (f) => { const x = JSON.parse(JSON.stringify(ad)); f(x); return verifier({ store, appdata: x, now: TODAY }).map((e) => e.code); };
  eq(mut((x) => { x.global.records_par_exo.Presse.date = J(5).split('-').reverse().join('/'); }).includes('records.date'), 'attrape : record daté de la répétition');
  eq(mut((x) => { x.volume_obti.find((v) => v.muscle === 'Fessier').series_semaine = 0; }).includes('volume.muscle'), 'attrape : séries par muscle sur la mauvaise fenêtre (secondaire oublié)');
  eq(mut((x) => { x.dashboard.regularite.seances_j7 = 1; }).includes('seances.j7'), 'attrape : séances 7 jours fausses');
  eq(mut((x) => { x.dashboard.tonnage.j7 = (x.dashboard.tonnage.j7 || 0) + 1; }).includes('tonnage.j7'), 'attrape : tonnage 7 jours faux');
  eq(mut((x) => { const p = x.historique.progression_par_exo.Presse[0]; p.reps = p.reps + 1; }).includes('progression.meilleure'), 'attrape : meilleure série du jour fausse');
  eq(mut((x) => { x.global.total_series = 99; }).includes('global.series'), 'attrape : total de séries faux');

  const txt = (t) => verifier({ store, appdata: ad, ecrans: t, now: TODAY }).map((e) => e.code);
  eq(txt('######## ÉVOLUTION ▸ Curl\n12 kg\nFORCE ESTIMÉE\nx\nFORCE EST.\n18/11/2026\n12,5×12\n11 kg').includes('force.tuile_tableau'), 'attrape : force estimée 12 kg en haut, 11 kg dans le tableau');
  eq(txt('######## ÉVOLUTION ▸ Curl\nRECORD CHARGE\n12.5 kg').includes('format.decimal'), 'attrape : « 12.5 kg » (point décimal)');
  // 20/11 (données réelles) : petit pas hors grille (8 → 6,75 kg sur un pas de 1,25) ou différent d'un écran à l'autre (1 pas au lieu de −5 %).
  eq(txt('######## ANALYSES ▸ resume\nCurl : 8 kg × 8 à RPE 9 — au choix, à titre indicatif : un petit pas en dessous (6,75 kg) pour revenir à 10 reps').includes('cible.petit_pas'), 'attrape : petit pas hors grille (6,75 kg depuis 8 kg, pas 1,25)');
  eq(!txt('######## ANALYSES ▸ resume\nCurl : 8 kg × 8 à RPE 9 — au choix, à titre indicatif : un petit pas en dessous (7,5 kg) pour revenir à 10 reps').includes('cible.petit_pas'), 'petit pas juste (7,5 kg) : pas d\'alerte');
  eq(txt('######## ANALYSES\nRECORDS PERSONNELS\nPresse\n100 kg\n' + J(5).split('-').reverse().join('/')).includes('records.ecran'), 'attrape : record affiché à la mauvaise date');
  eq(txt('######## AUJOURD\'HUI\nObjectif semaine 1/3\n2 / 3 séances cette semaine').includes('objectif.libelle'), 'attrape : « Objectif semaine » calendaire à côté d\'une semaine glissante');
  eq(txt('######## AUJOURD\'HUI\n1 / 3 séances cette semaine\n######## ENTRAINEMENT\n67% 2/3 cette semaine').includes('seances.ecrans'), 'attrape : deux comptes de séances « cette semaine »');
  eq(txt('######## AUJOURD\'HUI\n' + ad.dashboard.regularite.seances_j7 + ' / 3 séances cette semaine\n######## ENTRAINEMENT\n67% ' + ad.dashboard.regularite.seances_j7 + '/3 cette semaine').length === 0, 'témoin : écrans cohérents → aucun écart');

  // 18/11 (suite) : « ta normale », montre, phrases du classement.
  const st2 = JSON.parse(JSON.stringify(store));
  st2.bien_etre = [0, 1, 2].map((i) => ({ athlete_id: '5', date: J(i), sommeil: 3, fatigue_musculaire: 4, stress: 2, courbatures: 2 }))
    .concat([8, 9, 10, 11, 12, 13, 14, 15].map((i) => ({ athlete_id: '5', date: J(i), sommeil: 4, fatigue_musculaire: 2, stress: 2, courbatures: 2 })));
  const adSansMoteur = { ...ad, moteur: undefined };   // le moteur de `ad` a été calculé sur l'autre base
  const t2 = (t) => verifier({ store: st2, appdata: adSansMoteur, ecrans: t, now: TODAY }).map((e) => e.code);
  eq(t2('######## AUJOURD\'HUI\nFatigue élevée (4/5)\n3 dernières saisies 4 · au-dessus de ta normale (2)').length === 0, 'normale : fatigue 4 contre 2 → « au-dessus » accepté');
  eq(t2('######## AUJOURD\'HUI\nFatigue élevée (4/5)\n3 dernières saisies 4 · dans ta normale (2)').includes('normale.ecran'), 'attrape : « dans ta normale » alors que +2 points');
  eq(t2('######## AUJOURD\'HUI\nSommeil moyen (3/5)\n3 dernières saisies 3 · dans ta normale (4)').includes('normale.ecran'), 'attrape : sommeil 1 point sous la normale dit « dans »');
  const st3 = JSON.parse(JSON.stringify(store)); st3.bien_etre = [0, 3, 9, 12].map((i) => ({ athlete_id: '5', date: J(i), sommeil: 4, fatigue_musculaire: 2, stress: 2, courbatures: 1 }));
  const t3 = (t) => verifier({ store: st3, appdata: adSansMoteur, ecrans: t, now: TODAY }).map((e) => e.code);
  eq(t3('######## AUJOURD\'HUI\nSommeil bon (4/5)\nta normale arrive dans 6 questionnaires (il en faut 10 sur 5 semaines, tu en as 4)').length === 0, 'normale : compteur 4 questionnaires → « dans 6 » accepté');
  eq(t3('######## AUJOURD\'HUI\nSommeil bon (4/5)\nta normale arrive après 7 saisies (1 pour l\'instant)\nStress (2/5)\nta normale arrive dans 7 questionnaires (il en faut 10 sur 5 semaines, tu en as 3)').includes('normale.compteur'), 'attrape : compteur de questionnaires faux');
  const st4 = JSON.parse(JSON.stringify(store)); st4.indicateurs = [];
  [0, 1, 2, 3, 4].forEach((i) => st4.indicateurs.push({ id: 100 + i, athlete_id: '5', date: J(i), seance_id: 'sante_' + J(i), cle: 'sommeil_min', valeur: String(400 + i * 10) }));
  [0, 1].forEach((i) => st4.indicateurs.push({ id: 200 + i, athlete_id: '5', date: J(i), seance_id: 'sante_' + J(i), cle: 'pas', valeur: i === 0 ? '3000' : '8000' }));
  const t4 = (t) => verifier({ store: st4, appdata: adSansMoteur, ecrans: t, now: TODAY }).map((e) => e.code);
  eq(t4('######## AUJOURD\'HUI\nSommeil réel 7 h 00 / nuit (7 j, 5 nuits)').length === 0, 'montre : sommeil réel 7 h 00 sur 5 nuits accepté');
  eq(t4('######## AUJOURD\'HUI\nSommeil réel 6 h 58 / nuit (7 j, 5 nuits)').includes('montre.sommeil'), 'attrape : sommeil réel faux');
  if (new Date(TODAY + 'T12:00:00Z').getUTCDay() !== 1) eq(t4('######## AUJOURD\'HUI\nmoy. 5500').includes('montre.pas'), 'attrape : journée de pas en cours comptée dans la moyenne');
  const t5 = (t) => verifier({ store, appdata: ad, ecrans: t, now: TODAY }).map((e) => e.code);
  eq(t5('######## ANALYSES ▸ resume\nProgresse : Curl 10 → 12 reps').length === 0, 'classement : « Curl 10 → 12 reps » (12,5 kg) accepté');
  eq(t5('######## ANALYSES ▸ resume\nProgresse : Curl 9 → 12 reps').includes('classement.progres'), 'attrape : progrès avec un mauvais nombre de reps');
  eq(t5('######## ÉVOLUTION ▸ Curl\nRecord : 12,5 kg × 12 le ' + J(1).split('-').reverse().join('/')).length === 0, 'classement : record Curl 12,5 × 12 accepté');
  eq(t5('######## ÉVOLUTION ▸ Presse\nRecord : 100 kg × 10 le ' + J(5).split('-').reverse().join('/')).includes('classement.record'), 'attrape : « record » qui ne fait qu\'égaler');
  eq(t5('######## ÉVOLUTION ▸ Presse\nBloqué à 90 kg × 12 depuis 3 séances').includes('classement.bloque'), 'attrape : « bloqué » sur des séances à des charges différentes');
  // Fraîcheur / ACWR (18/11) : valeurs du moteur et phrases de la carte.
  eq(mut((x) => { x.moteur.charge_fatigue = { ...(x.moteur.charge_fatigue || {}), ctl: 1, atl: 1, tsbPct: 0, source: (x.moteur.charge_fatigue || {}).source || 'tonnage' }; }).includes('fraicheur.valeurs'), 'attrape : forme de fond / fatigue récente fausses');
  eq(mut((x) => { x.dashboard.acwr = 9.99; }).includes('acwr'), 'attrape : ACWR faux');
  eq(t5('######## FORME\nEn unités de charge (tonnage pondéré par l\'effort) : seul leur rapport compte').includes('fraicheur.unite'), 'attrape : « tonnage pondéré par l\'effort » alors que la source est le tonnage brut');
  // Cibles « Ce que Novalyz vise » (18/11) : la raison doit être vraie dans les séries brutes.
  const cib = (why, c2, r2) => t5('######## ÉVOLUTION ▸ Presse\nCe que Novalyz vise la prochaine fois\n90 × 12 →\n' + c2 + ' kg × ' + r2 + '\n' + why);
  eq(cib('RPE 8 sur toutes tes séries la dernière fois : garde charge et reps (vise 2 reps en réserve).', 90, 12).length === 0, 'cible : « RPE 8 sur toutes » vrai (dernière séance 90 × 12 à RPE 8) accepté');
  eq(cib('RPE 10 sur toutes tes séries la dernière fois : garde charge et reps (vise 2 reps en réserve).', 90, 12).includes('cible.raison'), 'attrape : « RPE 10 sur toutes tes séries » faux');
  eq(cib('RPE 8 sur toutes tes séries la dernière fois : garde charge et reps (vise 2 reps en réserve).', '92,5', 12).includes('cible.raison'), 'attrape : « garde charge et reps » avec une charge qui monte');
  eq(t5('######## ÉVOLUTION ▸ Presse\nCe que Novalyz vise la prochaine fois\n100 × 10 →\n100 kg × 10\nRPE 8 sur toutes tes séries la dernière fois').includes('cible.depart'), 'attrape : point de départ ≠ dernière séance');
  // Leviers (18/11) : effort à charge égale (moteur ↔ recalcul) et repos cité.
  eq(mut((x) => { x.moteur.charge_ressenti = { ...(x.moteur.charge_ressenti || {}), raisons: (x.moteur.charge_ressenti || {}).raisons || [], rpe_details: [{ exo: 'Presse', charge: 95, rpeAvant: 8, rpeApres: 9 }] }; }).includes('rpe.hausse'), 'attrape : « effort en hausse » signalé sans hausse réelle');
  eq(t5('######## ÉVOLUTION ▸ Curl\n✓ Repos : 2 min, stable — pas en cause').includes('levier.repos'), 'attrape : repos cité ≠ repos réel (1 min 30)');
  eq(t5('######## ÉVOLUTION ▸ Curl\n✓ Repos : 1 min 30, stable — pas en cause').length === 0, 'repos cité = repos réel (1 min 30) accepté');
  // Vue coach ▸ Équipe (18/11).
  const tonA = Math.round(store.performances.filter((r) => r.date >= J(6)).reduce((x, r) => x + r.charge * r.reps, 0) / 100) / 10;
  const co = (t) => verifier({ store, appdata: null, ecrans: '######## COACH equipe\nA\nPrêt\n9,5\nRPE 7 J\n' + t + '\nTONNAGE\n1/1\nASSIDUITÉ\nPLAN', now: TODAY }).map((e) => e.code);
  eq(co(String(tonA).replace('.', ',') + ' t').length === 0 || co(String(tonA).replace('.', ',') + ' t').every((c) => c !== 'coach.tonnage'), 'coach : tonnage 7 j juste accepté');
  eq(co('99,9 t').includes('coach.tonnage'), 'attrape : tonnage 7 j faux côté coach');
  eq(co(String(tonA).replace('.', ',') + ' t · +5 %').includes('coach.tonnage_ref'), 'attrape : évolution du tonnage sans sa référence');
  // Journal des décisions (18/11).
  const lun = (d) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - (x.getUTCDay() + 6) % 7); return x.toISOString().slice(0, 10); };
  const sJ = lun(J(5)), stJ = JSON.parse(JSON.stringify(store));
  stJ.decisions = [{ athlete_id: '5', semaine: sJ, type_action: 'rpe', cle: 'Presse', exercice: 'Presse', titre: 'Presse : garde 100 kg, vise RPE 8', critere: { charge: 100 } }];
  const jr = (stat, det) => verifier({ store: stJ, appdata: adSansMoteur, ecrans: '######## ANALYSES\nSemaine du ' + sJ.slice(8, 10) + '/' + sJ.slice(5, 7) + '\n1 / 1 tentée\n' + stat + 'Presse : garde 100 kg, vise RPE 8\nProposé car : test. ' + det, now: TODAY }).map((e) => e.code);
  const best = store.performances.filter((r) => r.exercice === 'Presse' && r.date >= sJ && r.date < (() => { const x = new Date(sJ + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + 7); return x.toISOString().slice(0, 10); })()).sort((a, b) => b.charge - a.charge || b.reps - a.reps)[0];
  if (best) {
    const okStat = best.charge >= 100 && store.performances.some((r) => r.exercice === 'Presse' && r.date >= sJ && r.charge >= 100 && r.rpe <= 8) ? 'Atteint' : 'Pas atteint';
    eq(jr(okStat, 'Réalisé : ' + String(best.charge).replace('.', ',') + ' kg × ' + best.reps + ' (RPE ' + best.rpe + ').').length === 0, 'journal : statut et « Réalisé » justes acceptés');
    eq(jr(okStat === 'Atteint' ? 'Pas atteint' : 'Atteint', '').includes('journal.statut'), 'attrape : statut du journal faux');
    eq(jr(okStat, 'Réalisé : 1 kg × 1 (RPE 1).').includes('journal.realise'), 'attrape : « Réalisé » faux');
  }
  // Mail récapitulatif (18/11) : le VRAI code du mail, vérifié chiffre par chiffre et sans texte cassé.
  // Base fictive avec un plateau (50 kg : 8, 7, 8, 7 reps) pour forcer « bloqué » dans le mail.
  const stM = JSON.parse(JSON.stringify(store));
  [12, 9, 6, 3].forEach((n, i) => stM.performances.push({ id: 500 + i, date: J(n), semaine: 46, seance_id: 'S', exercice: 'Tirage', muscle: 'Dos', exercice_id: 'Tirage', serie: 1, charge: 50, reps: i % 2 ? 7 : 8, rpe: 9, repos: 120, athlete_id: '5', nom: 'A', volume: 50 * (i % 2 ? 7 : 8) }));
  stM.exercices.push({ exercice_id: 'Tirage', exercice: 'Tirage', muscle: 'Dos', muscle_secondaire: 'Biceps' });
  const APIM = charger(stM), adM = await (await APIM.handleGetAppData(new URLSearchParams({ athlete_id: '5', _sess_role: 'a' }))).json();
  const secB = {}, musB = {}; stM.exercices.forEach((e) => { const k = String(e.exercice).trim().toLowerCase(); if (e.muscle_secondaire) secB[k] = e.muscle_secondaire; if (e.muscle) musB[k] = e.muscle; });
  for (const per of ['semaine', 'mois']) {
    const bil = APIM._bilanRecapV2({ perfs: stM.performances, appData: adM, secByExo: secB, musByExo: musB }, per, new Date());
    const o = []; verifierBilan(stM, bil, '5', o); verifierMailHtml(APIM._emailRecapV2HTML('Test', bil), o);
    eq(o.length === 0, 'mail ' + per + ' (vrai code) : 0 écart avec le recalcul, aucun texte cassé', o.map((x) => x.message));
  }
  { const o = []; verifierMailHtml('<p>Tirage : 50 kg × 7 depuis 3 séances (au Sun N, fin de la période)</p>', o); eq(o.length > 0, 'attrape : date brute « Sun N » dans le mail'); }
  { const o = []; verifierBilan(stM, { per: 'semaine', bornes: { debut: J(13), fin: J(6) }, seances: 99, series: 0, reps: 0, tonnage: 0, volume: [], balance: [], records: [], lecture: {} }, '5', o); eq(o.some((x) => x.code === 'mail.seances'), 'attrape : nombre de séances du mail faux'); }
  // Contexte envoyé à l'IA (18/11) : vrai code, chaque chiffre vérifié ; une erreur injectée est attrapée.
  { const ctx = APIM._iaContexte(adM, new Date()); const o = []; verifierIA(stM, ctx, TODAY, '5', o);
    eq(o.length === 0, 'contexte IA (vrai code) : 0 écart', o.map((x) => x.message));
    const o2 = []; verifierIA(stM, ctx.replace(/· (\d+) séries/, (m0, n) => '· ' + (+n + 1) + ' séries'), TODAY, '5', o2);
    eq(o2.some((x) => x.code === 'ia.seance'), 'attrape : nombre de séries faux dans le contexte IA');
    const o3 = []; verifierIA(stM, '- Dernière séance muscu : S hier · 3 séries · RPE moyen 9.2.', TODAY, '5', o3);
    eq(o3.some((x) => x.code === 'ia.format'), 'attrape : point décimal dans le contexte IA'); }
  // Cardio (18/11) : résumé 4 semaines, tuiles, historique ; micro-sorties exclues ; marche hors charge.
  { const stC = JSON.parse(JSON.stringify(store)); let id2 = 9000;
    const cx = (n, sid, t, du, km, rpe) => [['type_cardio', t], ['duree', du], ['distance', km], ['rpe', rpe]].filter((x) => x[1] != null).forEach(([c, v]) => stC.indicateurs.push({ id: id2++, athlete_id: '5', date: J(n), seance_id: sid, cle: c, valeur: String(v) }));
    cx(2, 'cardio_a', 'footing', 40, 6.5, 6); cx(10, 'cardio_b', 'marche_normale', 60, 4.2, null); cx(3, 'cardio_c', 'footing', 2, 0.1, 5); cx(40, 'cardio_d', 'velo', 60, 20, 7);
    const vC = (t) => verifier({ store: stC, appdata: adSansMoteur, ecrans: t, now: TODAY }).map((e) => e.code);
    eq(vC('######## CARDIO ▸ resume\n2 sorties cardio ces 4 semaines (10,7 km au total).\nSORTIES 4 SEM.\n2\nDISTANCE 4 SEM.\n10,7 km\nCHARGE 7 J\n250 UA').length === 0, 'cardio : 2 sorties / 10,7 km (micro-sortie et vélo à J-40 exclus), charge 7 j 250 UA (marche = 0) acceptés');
    eq(vC('######## CARDIO ▸ resume\n3 sorties cardio ces 4 semaines (10,8 km au total).').includes('cardio.resume'), 'attrape : micro-sortie comptée dans le résumé cardio');
    eq(vC('######## CARDIO ▸ resume\nCHARGE 7 J\n490 UA').includes('cardio.tuile'), 'attrape : charge 7 j fausse');
    eq(vC('######## CARDIO ▸ resume\nDISTANCE 4 SEM.\n10.7 km').includes('format.decimal'), 'attrape : « 10.7 km » (point décimal)'); }
  // Écran de saisie (B11, 21/11) : fourchette de la ligne de CETTE séance + catégorie, exercice lu sur la carte (superset), dernière fois.
  { const stS = JSON.parse(JSON.stringify(store)); stS.athletes[0].prefs.exo_categories = { Curl: 'petit' };
    stS.programme = [{ athlete_id: '5', seance_id: 'A', exercice: 'Curl', reps_mini: 8, reps_max: 12, series_prevues: 3 }, { athlete_id: '5', seance_id: 'B', exercice: 'Curl', reps_mini: 10, reps_max: 12, series_prevues: 3 }];
    const vS = (t) => verifier({ store: stS, appdata: ad, ecrans: t, now: TODAY }).map((e) => e.code);
    const dd = J(1).slice(8, 10) + '/' + J(1).slice(5, 7);
    eq(vS('######## SAISIE ▸ A ▸ Curl\nCurl\nBiceps · 8-12 reps').includes('saisie.fourchette'), 'attrape : en-tête de saisie 8-12 alors que la catégorie Léger donne 8-20');
    eq(!vS('######## SAISIE ▸ A ▸ Curl\nCurl\nBiceps · 8-20 reps').includes('saisie.fourchette'), 'saisie : 8-20 (catégorie) accepté');
    eq(!vS('######## SAISIE ▸ B ▸ Curl\nCurl\nBiceps · 10-12 reps').includes('saisie.fourchette'), 'saisie : ligne 10-12 de la séance B acceptée (pas la 1re ligne du programme)');
    eq(!vS('######## SAISIE ▸ A ▸ Presse\n Superset · Tour 1/3\nCurl → Presse\nCurl\nBiceps · 8-20 reps').includes('saisie.fourchette'), 'saisie : superset → exercice lu sur la carte (Curl), pas sur le clic');
    eq(vS('######## SAISIE ▸ A ▸ Curl\nCurl\nBiceps · 8-20 reps\nTES SÉRIES · 0/4 PRÉVUES').includes('saisie.prevues'), 'attrape : séries prévues fausses');
    eq(vS('######## SAISIE ▸ A ▸ Curl\nCurl\nBiceps · 8-20 reps\nDERNIÈRE FOIS · ' + dd + '\tCIBLE\t\nS1\t12,5×11\nRPE 10\n\t12,5×12').includes('saisie.derniere'), 'attrape : dernière fois 12,5 × 11 au lieu de 12,5 × 12');
    eq(vS('######## SAISIE ▸ A ▸ Curl\nCurl\nBiceps · 8-20 reps\nDERNIÈRE FOIS · 01/01\tCIBLE\t').includes('saisie.date'), 'attrape : dernière fois à la mauvaise date'); }
  // Analyses ▸ Tendances (B12, 21/11) : répartition d'intensité et fréquence par muscle recalculées sur l'année affichée.
  { const an = TODAY.slice(0, 4), T = (corps) => txt('######## ANALYSES ▸ tendances\n' + an + '\n' + corps);
    const ok = 'RÉPARTITION D\'INTENSITÉ\n?\n6 séries\nLourd <6 reps · 0%\nMoyen 6-12 · 100%\nLéger >12 · 0%';
    eq(!T(ok).includes('tendances.intensite'), 'tendances : 6 séries, 100 % en 6-12 accepté');
    eq(T(ok.replace('6 séries', '7 séries')).includes('tendances.intensite'), 'attrape : nombre de séries faux dans la répartition d\'intensité');
    eq(T('FRÉQUENCE PAR MUSCLE\n?\ncette année\nQuadriceps\n9 séances').includes('tendances.frequence'), 'attrape : fréquence par muscle fausse'); }
  console.log('-'.repeat(70));
  console.log('vérificateur de cohérence : ' + ok + ' OK / ' + ko + ' KO');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
