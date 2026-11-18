/* Cohérence charge ↔ récupération (14/11/2026, audit A-D validé porteur).
 * 1) Le contrôle inter-écrans du banc (scripts/banc-profils/coherence.js) attrape bien chaque contradiction connue.
 * 2) A : la synthèse Croisé du serveur applique la MÊME règle que la reco du moteur (« tu encaisses bien » seulement si
 *    la charge monte ET que le ressenti est évalué sans être dégradé). Vrai code d'index.ts. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const { verifier } = require('../scripts/banc-profils/coherence.js');
let ok = 0, ko = 0;
const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (obtenu ' + JSON.stringify(g) + ')' : '')); } };

// ── 1) Contrôle inter-écrans ──
const pret = { disponibilite: { niveau: 'Prêt' }, alertes: [], surcharge: 'Faible', acwr_fiable: true, charge_ressenti: { evaluable: true, degrade: false } };
const D = (m) => ({ moteur: Object.assign({}, pret, m) });
eq(verifier('Tu as plus chargé que d\'habitude et tu encaisses bien (ressenti stable).', D({})).length === 0, 'R1 : ressenti évalué → « encaisses bien » permis');
eq(verifier('Ta récupération est excellente — tu encaisses bien ta charge actuelle.', D({ charge_ressenti: { evaluable: false } }))[0].startsWith('R1'), 'R1 : non évalué → contradiction');
eq(verifier('Charge globale en hausse, forme tenue → bonne assimilation pour l\'instant.', D({ charge_ressenti: { evaluable: true, degrade: true } }))[0].startsWith('R1'), 'R1 : dégradé → contradiction');
eq(verifier('ACWR\n0,97\nzone optimale', D({})).some((e) => e.startsWith('R2')), 'R2 : zone ACWR (tuile coach) détectée');
eq(verifier('1,49\nACWR', D({ acwr_fiable: false })).some((e) => e.startsWith('R3')), 'R3 : ACWR non fiable affiché (tuile valeur → libellé)');
eq(verifier('ACWR 1,00 · indice secondaire (à interpréter avec prudence)', D({})).length === 0, 'R3 : ACWR fiable, sans zone → permis');
eq(verifier('CHARGE\nHabituelle', D({ surcharge: 'Élevé' })).some((e) => e.startsWith('R4')), 'R4 : « Habituelle » vs moteur Élevé');
eq(verifier('Tu es reposé — bon moment pour pousser.', D({ alertes: [{ type: 'absence' }] }))[0].startsWith('R5'), 'R5 : absence → pas de « pousser »');
eq(verifier('Tu es reposé — bon moment pour pousser.', D({ disponibilite: { niveau: 'Vigilance' } }))[0].startsWith('R5'), 'R5 : vigilance → pas de « pousser »');
eq(verifier('Tu es reposé — bon moment pour pousser.', D({})).length === 0, 'R5 : prêt sans alerte → permis');
eq(verifier('Tu es reposé.', D({ alertes: [{ type: 'absence' }] })).length === 0, 'R5 : « Tu es reposé. » toujours permis');

// ── 2) A : synthèse Croisé du serveur ──
let js = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase/functions/handler/index.ts'), 'utf8'));
js = js.split('\n').filter((l) => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { buildSyntheseCroise };';
const sb = { createClient: () => ({}), webpush: { setVapidDetails() {} }, Deno: { env: { get: () => 'x' }, serve: () => {} }, Response, Request, URL, URLSearchParams, TextEncoder, TextDecoder, crypto, console, setTimeout, clearTimeout, fetch: async () => ({}) };
vm.createContext(sb); vm.runInContext(js, sb);
const { buildSyntheseCroise } = sb.__api;
const now = new Date('2026-11-12T17:00:00Z'), cmp = { j28_vs_j28prec: { tonnage: { j28: 20000 } } };
const txt = (m) => buildSyntheseCroise(cmp, { history: [] }, Object.assign({ recup: 'Excellent', disponibilite: { niveau: 'Prêt' } }, m), now).constats.map((c) => c.texte).join(' | ');
const t1 = txt({ surcharge: 'Élevé', charge_ressenti: { evaluable: false, degrade: false } });
eq(!/encaisses bien/.test(t1) && /renseigne ton état/.test(t1), 'A : charge haute + ressenti non évalué → pas de « encaisses bien »', t1);
const t2 = txt({ surcharge: 'Modéré', charge_ressenti: { evaluable: true, degrade: false } });
eq(/tu encaisses bien pour l'instant/.test(t2), 'A : charge haute + ressenti évalué stable → « encaisses bien »', t2);
const t3 = txt({ surcharge: 'Élevé', charge_ressenti: { evaluable: true, degrade: true } });
eq(!/encaisses bien/.test(t3) && /ressenti baisse/.test(t3), 'A : ressenti dégradé → alerte, pas « encaisses »', t3);
const t4 = txt({ surcharge: 'Faible', charge_ressenti: { evaluable: false } });
eq(!/encaisses/.test(t4) && /récupération est excellente ces 7 derniers jours/.test(t4), 'A : charge habituelle → récup seule, sans lien charge', t4);

// ── 3) E (14/11, validé porteur) : pic de charge non interprétable → pas d'augmentation ──
eq(verifier('Levier : +4 séries de Squat (4,5 → 10 séries/sem).', D({ surcharge: 'Élevé', charge_ressenti: { evaluable: false } })).some((e) => e.startsWith('R6')), 'R6 : +séries pendant un pic non interprétable');
eq(verifier('Séance du jour (A) : 3 exercices à pousser (charge ou +1 rep).', D({ surcharge: 'Modéré', charge_ressenti: { evaluable: true, degrade: true } })).some((e) => e.startsWith('R6')), 'R6 : « à pousser » avec ressenti dégradé');
eq(verifier('Levier : +4 séries de Squat.', D({ surcharge: 'Élevé', charge_ressenti: { evaluable: true, degrade: false } })).length === 0, 'R6 : charge en hausse BIEN encaissée → hors règle (pas de décision)');
eq(verifier('Levier : +4 séries de Squat.', D({ surcharge: 'Faible', charge_ressenti: { evaluable: false } })).length === 0, 'R6 : charge habituelle → +séries permis');
const LV3 = fs.readFileSync(path.join(__dirname, '..', 'js', 'lecture-v3.js'), 'utf8');
const fnSrc = (src, n) => { const i0 = src.indexOf('function ' + n + '('); let i = src.indexOf('{', i0), dd = 0, j = i; for (; j < src.length; j++) { if (src[j] === '{') dd++; else if (src[j] === '}') { dd--; if (!dd) { j++; break; } } } return src.slice(i0, j); };
const P = {}; vm.createContext(P); vm.runInContext(fnSrc(LV3, '_lv3PicCharge') + '\nthis.f = _lv3PicCharge;', P);
const pk = (sur, ev, dg) => P.f({ moteur: { surcharge: sur, charge_ressenti: { evaluable: ev, degrade: dg } } });
eq(pk('Élevé', false, false) && pk('Élevé', false, false).degrade === false, 'E app : Élevé + non évalué → pic');
eq(pk('Modéré', true, true) && pk('Modéré', true, true).degrade === true, 'E app : Modéré + dégradé → pic (ressenti en baisse)');
eq(pk('Élevé', true, false) === null, 'E app : Élevé + évalué stable → pas de pic (encaissée)');
eq(pk('Faible', false, false) === null && P.f({}) === null, 'E app : charge habituelle / pas de moteur → pas de pic');
eq(/if \(_picP\) acts\.forEach\(function \(a\) \{ if \(!a\.gene && !a\.fait && \(a\.type === 'series' \|\| a\.type === 'cible'\)\) a\.gene = _picP;/.test(LV3), 'E plan : séries / cibles non faites mises en pause (maintien, allègement, fait : intacts)');
// Mail récap (serveur) : « il manque N séries » remplacé par la prudence pendant un pic.
const { webcrypto } = require('crypto');
let js2 = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase/functions/handler/index.ts'), 'utf8'));
js2 = js2.split('\n').filter((l) => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { _bilanRecapV2, buildProgressionParExo };';
const SV = { createClient: () => ({ from: () => ({}) }), webpush: { setVapidDetails() {}, sendNotification: async () => {} }, Deno: { env: { get: () => undefined }, serve: () => {} },
  Response, Request, URLSearchParams, TextEncoder, TextDecoder, console, atob, btoa, setTimeout, clearTimeout, crypto: webcrypto, fetch: async () => ({}) };
vm.createContext(SV); vm.runInContext(js2, SV); const RC = SV.__api;
const nowM = Date.UTC(2026, 10, 12, 17), JM = (n) => new Date(nowM - n * 864e5).toISOString().slice(0, 10);
const perfs = []; const add = (exo, mus, dj, c, r) => [1, 2, 3].forEach((sr) => perfs.push({ date: JM(dj), exercice: exo, muscle: mus, charge: c, reps: r, rpe: 8, serie: sr }));
[13, 9, 6, 2].forEach((dj) => { add('Développé militaire', 'Epaule', dj, 40, 10); add('Squat', 'Quadriceps', dj, 100, 8); });
const ad = (mot) => ({ historique: { progression_par_exo: RC.buildProgressionParExo(perfs) }, programme: [{ exercice: 'Développé militaire' }, { exercice: 'Squat' }], exo_categories: {}, niveau_experience: 'intermediaire',
  volume_obti: [{ muscle: 'Epaule', series_min: 10, series_opt: 14 }, { muscle: 'Quadriceps', series_min: 10, series_opt: 16 }], bien_etre: [], cardio: { history: [] }, dashboard: { regularite: { seances_prevues: 2 } }, moteur: mot });
const rec = (mot) => (RC._bilanRecapV2({ perfs, appData: ad(mot), secByExo: {}, musByExo: {} }, 'semaine', new Date(nowM)).recos || []).join(' | ');
const r0 = rec({ surcharge: 'Faible', charge_ressenti: { evaluable: false } }), r1 = rec({ surcharge: 'Élevé', charge_ressenti: { evaluable: false } });
eq(/il manque environ/.test(r0), 'mail : charge habituelle → « il manque environ N séries » (inchangé)', r0);
eq(!/il manque environ/.test(r1) && /[Cc]harge en hausse/.test(r1) && /renseigne ton état du jour/.test(r1), 'mail : pic non interprétable → prudence, pas de séries en plus', r1);
// R7 (14/11) : douleur signalée → jamais « Aucune blessure active · OK » (affichage seulement).
eq(verifier('Douleurs & blessures\nAucune blessure active\nOK', D({ alertes: [{ type: 'douleur' }] })).some((e) => e.startsWith('R7')), 'R7 : douleur + « Aucune blessure active · OK » → contradiction');
eq(verifier('Douleurs & blessures\nDouleur forte signalée (épaule)\nà évaluer', D({ alertes: [{ type: 'douleur' }] })).length === 0, 'R7 : douleur affichée « à évaluer » → permis');
eq(verifier('Douleurs & blessures\nAucune douleur ni blessure signalée\nOK', D({})).length === 0, 'R7 : aucune douleur → « OK » permis');
eq(/a\.type === 'douleur'[\s\S]{0,200}blPill = \{ txt: 'à évaluer'/.test(fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8')), 'R7 code : tuile « à évaluer » branchée sur l\'alerte douleur du moteur');
// H (14/11) : douleur forte → aucune fuite de progression (R8a), accueil coach compris ; douleur modérée hors zone : permis (D2).
const DF = D({ alertes: [{ type: 'douleur', severite: 'haute', message: 'Douleur forte signalée (épaule)' }] });
eq(verifier('RDL barre : bloqué · +4 séries de RDL barre', DF).some((e) => e.startsWith('R8a')), 'R8a : accueil coach « +4 séries » avec douleur forte → contradiction');
eq(verifier('Levier : hors zone douloureuse : garde tes charges prévues. Pas besoin de forcer ni d\'aller à l\'échec.', DF).length === 0, 'R8a : phrase de maintien (« pas besoin… à l\'échec ») → permise');
eq(verifier('Levier : +4 séries de Squat.', D({ alertes: [{ type: 'douleur', severite: 'moyenne' }] })).length === 0, 'R8a : douleur modérée hors zone → progression permise (D2)');
vm.runInContext(fnSrc(LV3, '_lv3DouleurForte') + '\nthis.df = _lv3DouleurForte;', P);
eq(P.df({ moteur: { alertes: [{ type: 'douleur', severite: 'haute', message: 'Douleur forte signalée (épaule)' }] } }).zone === 'épaule', 'H app : douleur forte reconnue (zone lue)');
eq(P.df({ moteur: { alertes: [{ type: 'douleur', severite: 'moyenne' }] } }) === null, 'H app : douleur modérée → pas de règle H');
const r2 = rec({ surcharge: 'Faible', charge_ressenti: { evaluable: true }, alertes: [{ type: 'douleur', severite: 'haute', message: 'Douleur forte signalée (genou)' }] });
eq(!/il manque environ/.test(r2) && /[Dd]ouleur forte/.test(r2), 'mail : douleur forte → pas de séries en plus hors zone', r2);
console.log('-'.repeat(70));
console.log('cohérence charge ↔ récup : ' + ok + ' OK / ' + ko + ' KO');
if (ko) process.exit(1);
