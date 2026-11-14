/* Gêne ACTIVE (14/11, constat B1 du banc de profils) : une douleur ≥ 3/5 au DERNIER questionnaire (≤ 7 j) sur une zone
 * sollicitée par le muscle → le diagnostic la met en 1re cause (levier : ni charge ni séries en plus) et le plan met en
 * pause les actions sur cette zone (hors compteur, jamais envoyées au journal). « Dos » reconnu (avant : « do »). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const LV3 = fs.readFileSync(path.join(__dirname, '..', 'js', 'lecture-v3.js'), 'utf8');
function ex(src, n) { const m = src.match(new RegExp('function\\s+' + n + '\\s*\\(')); let i = src.indexOf('{', m.index), d = 0, j = i; for (; j < src.length; j++) { const c = src[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } } return src.slice(m.index, j); }
const S = {}; vm.createContext(S);
vm.runInContext(['_normTxt', '_musKey'].map((n) => ex(APP, n)).join('\n') + '\n' + LV3.match(/var _LV3_ZONE_MUS = \[[\s\S]*?\];/)[0] + '\n'
  + ['_lv3Iso', '_lv3T', '_lv3Num', '_lv3Cle', '_lv3ZoneTouche', '_lv3GeneActive', '_lv3GeneAutre'].map((n) => ex(LV3, n)).join('\n'), S);
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };
const now = Date.UTC(2026, 10, 12, 17), J = (n) => new Date(now - n * 864e5).toISOString().slice(0, 10);
const d = (be) => ({ bien_etre: be });
const doul = [{ date: J(3), douleur: 1 }, { date: J(0), douleur: 4, zone_douloureuse: 'Épaule' }];
eq(S._lv3GeneActive(d(doul), 'Epaule', now) && S._lv3GeneActive(d(doul), 'Epaule', now).val === 4, 'douleur 4/5 épaule aujourd\'hui → active sur l\'épaule');
eq(S._lv3GeneActive(d(doul), 'Pectoraux', now) && S._lv3GeneActive(d(doul), 'Pectoraux', now).indir === true, 'zone sollicitée (pectoraux) → active, indirecte');
eq(!!S._lv3GeneActive(d(doul), 'Dos', now), '« Dos » reconnu (zone épaule sollicite le dos)');
eq(S._lv3GeneActive(d(doul), 'Ischio', now) === null, 'ischio : non concerné');
eq(S._lv3GeneActive(d([{ date: J(2), douleur: 4, zone_douloureuse: 'Épaule' }, { date: J(0), douleur: 1 }]), 'Epaule', now) === null, 'gêne levée au questionnaire suivant → plus active');
eq(S._lv3GeneActive(d([{ date: J(9), douleur: 5, zone_douloureuse: 'Épaule' }]), 'Epaule', now) === null, 'questionnaire de plus de 7 jours → ignoré');
eq(S._lv3GeneActive(d([{ date: J(0), douleur: 2, zone_douloureuse: 'Épaule' }]), 'Epaule', now) === null, 'douleur 2/5 → pas une gêne');
eq(S._lv3GeneActive(d([{ date: J(1), douleur: 3, zone_douloureuse: 'Dos' }]), 'Dos', now) !== null, 'zone « Dos » déclarée → muscle Dos concerné');
eq(/if \(_gA\) \{[\s\S]*?cause = 'gene';[\s\S]*?n\\'ajoute ni charge ni séries/.test(LV3), 'diagnostic : gêne active = 1re cause, levier sans charge ni séries');
eq(/P\.actions\.filter\(function \(a\) \{ return !a\.gene; \}\)/.test(LV3), 'journal : action en pause jamais envoyée');
// Serveur (mail récap) : même règle que l'app sur les mêmes cas.
const { stripTypeScriptTypes } = require('node:module'); const { webcrypto } = require('crypto');
let js = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
js = js.split('\n').filter((l) => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { _rcGeneActive, _rcGeneAutre, _bilanRecapV2, buildProgressionParExo };';
const SV = { createClient: () => ({ from: () => ({}) }), webpush: { setVapidDetails() {}, sendNotification: async () => {} }, Deno: { env: { get: () => undefined }, serve: () => {} },
  Response, Request, URLSearchParams, TextEncoder, TextDecoder, console, atob, btoa, setTimeout, clearTimeout, crypto: webcrypto, fetch: async () => ({}) };
vm.createContext(SV); vm.runInContext(js, SV); const A = SV.__api;
const cas = [[doul, 'Epaule'], [doul, 'Pectoraux'], [doul, 'Dos'], [doul, 'Ischio'], [[{ date: J(2), douleur: 4, zone_douloureuse: 'Épaule' }, { date: J(0), douleur: 1 }], 'Epaule'],
  [[{ date: J(9), douleur: 5, zone_douloureuse: 'Épaule' }], 'Epaule'], [[{ date: J(0), douleur: 2, zone_douloureuse: 'Épaule' }], 'Epaule'], [[{ date: J(1), douleur: 3, zone_douloureuse: 'Dos' }], 'Dos'],
  [[{ date: J(1), douleur: 4, zone_douloureuse: 'Genou' }], 'Quadriceps'], [[{ date: J(1), douleur: 4, zone_douloureuse: 'Lombaires' }], 'Ischio']];
cas.forEach(([be, m], i) => { const a = S._lv3GeneActive(d(be), m, now), b = A._rcGeneActive(be, m, now);
  eq(!!a === !!b && (!a || (a.val === b.val && a.date === b.date && a.indir === b.indir)), 'cas ' + (i + 1) + ' (' + m + ') : serveur = app', { app: a, serveur: b }); });
// Mail récap : gêne épaule déclarée → pas de « séries pour atteindre le minimum » sur épaule / dos / pectoraux.
const perfs = []; const add = (exo, mus, dj, c, r) => [1, 2, 3].forEach((sr) => perfs.push({ date: J(dj), exercice: exo, muscle: mus, charge: c, reps: r, rpe: 8, serie: sr }));
[13, 9, 6, 2].forEach((dj) => { add('Développé militaire', 'Epaule', dj, 40, 10); add('Squat', 'Quadriceps', dj, 100, 8); });
const appData = { historique: { progression_par_exo: A.buildProgressionParExo(perfs) }, programme: [{ exercice: 'Développé militaire' }, { exercice: 'Squat' }], exo_categories: {}, niveau_experience: 'intermediaire',
  volume_obti: [{ muscle: 'Epaule', series_min: 10, series_opt: 14 }, { muscle: 'Quadriceps', series_min: 10, series_opt: 16 }], bien_etre: [{ date: J(0), douleur: 4, zone_douloureuse: 'Épaule' }], cardio: { history: [] }, dashboard: { regularite: { seances_prevues: 2 } } };
const b = A._bilanRecapV2({ perfs, appData, secByExo: {}, musByExo: {} }, 'semaine', new Date(now));
const txt = (b.recos || []).join(' | ');
eq(/Gêne épaule signalée/.test(txt), 'mail récap : la gêne est signalée en premier', txt);
eq(!/épaules? [0-9]/.test(txt.replace(/Gêne[^|]*/, '')), 'mail récap : pas de séries en plus proposées sur l\'épaule', txt);
// A (14/11, porteur) : nuque → trapèzes / épaules / dos ; « Autre » ou zone vide → ligne de prudence, rien en pause.
const nuq = [{ date: J(0), douleur: 4, zone_douloureuse: 'nuque' }];
for (const m of ['Trapèzes', 'Epaule', 'Dos']) eq(!!S._lv3GeneActive(d(nuq), m, now) && !!A._rcGeneActive(nuq, m, now), 'nuque → ' + m + ' protégé (app et serveur)');
eq(S._lv3GeneActive(d(nuq), 'Quadriceps', now) === null, 'nuque → quadriceps non concerné');
for (const z of ['autre', '', null]) {
  const be = [{ date: J(1), douleur: 3, zone_douloureuse: z }];
  const a = S._lv3GeneAutre(d(be), now), b = A._rcGeneAutre(be, now);
  eq(a && b && a.val === 3 && a.date === b.date, 'zone « ' + z + ' » → ligne de prudence (app = serveur)', { a, b });
  eq(['Pectoraux', 'Dos', 'Epaule', 'Quadriceps'].every((m) => S._lv3GeneActive(d(be), m, now) === null), 'zone « ' + z + ' » → rien mis en pause');
}
eq(S._lv3GeneAutre(d(doul), now) === null && A._rcGeneAutre(doul, now) === null, 'zone reliée (épaule) → pas de ligne « zone non précisée »');
eq(S._lv3GeneAutre(d([{ date: J(0), douleur: 2, zone_douloureuse: 'autre' }]), now) === null, '« Autre » à 2/5 → rien');
const b2 = A._bilanRecapV2({ perfs, appData: Object.assign({}, appData, { bien_etre: [{ date: J(0), douleur: 4, zone_douloureuse: 'autre' }] }), secByExo: {}, musByExo: {} }, 'semaine', new Date(now));
eq(/zone non précisée/.test((b2.recos || []).join(' ')), 'mail récap : ligne de prudence pour « Autre »', b2.recos);
console.log(`gene-active : ${ok} OK / ${ko} KO`); process.exit(ko ? 1 : 0);
