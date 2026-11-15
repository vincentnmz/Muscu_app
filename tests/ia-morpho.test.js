/* IA morpho (15/11/2026, spec docs/chantiers-futurs/ia-morpho-programme-2026-11.md) :
 * modèle Opus 5.5, schéma de sortie strict valide, zones de l'app, et bloc « zones → programme » dont les chiffres viennent des
 * DONNÉES (moteur), avec une zone déjà à l'optimum jamais pré-cochée (cohérence photo ↔ données). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (obtenu ' + JSON.stringify(g) + ')' : '')); } };
// ── Serveur ──
let js = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase/functions/handler/index.ts'), 'utf8'));
js = js.split('\n').filter((l) => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { MORPHO_SCHEMA, IA_MODELE, MORPHO_PROMPT_VERSION, recoMorphoExercices };';
const sb = { createClient: () => ({}), webpush: { setVapidDetails() {} }, Deno: { env: { get: () => 'x' }, serve: () => {} }, Response, Request, URL, URLSearchParams, TextEncoder, TextDecoder, crypto, console, setTimeout, clearTimeout, fetch: async () => ({}) };
vm.createContext(sb); vm.runInContext(js, sb);
const { MORPHO_SCHEMA, IA_MODELE, MORPHO_PROMPT_VERSION, recoMorphoExercices } = sb.__api;
eq(IA_MODELE === 'claude-opus-5-5', 'modèle IA = Claude Opus 5.5', IA_MODELE);
eq(/^morpho-\d{4}-\d{2}-\d{2}[a-z]?$/.test(MORPHO_PROMPT_VERSION), 'version de consigne datée (traçabilité)', MORPHO_PROMPT_VERSION);
const objets = []; (function walk(n) { if (!n || typeof n !== 'object') return; if (n.type === 'object') objets.push(n); Object.values(n).forEach(walk); })(MORPHO_SCHEMA);
eq(objets.length === 6 && objets.every((o) => o.additionalProperties === false && JSON.stringify(Object.keys(o.properties).sort()) === JSON.stringify(o.required.slice().sort())), 'schéma strict : additionalProperties false + tous les champs requis, partout', objets.length);
eq(JSON.stringify(MORPHO_SCHEMA.properties.priorites.items.properties.zone.enum) === JSON.stringify(['fessiers', 'jambes', 'pectoraux', 'dos', 'epaules', 'bras', 'abdos', 'aucune']), 'priorités reliées aux zones de l\'app (+ aucune)');
eq(!/minimum|maximum|minLength|maxLength/.test(JSON.stringify(MORPHO_SCHEMA)), 'aucune contrainte non supportée par les sorties structurées');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'supabase/functions/handler/index.ts'), 'utf8');
eq(/output_config: \{ effort: 'high', format: \{ type: 'json_schema', schema: MORPHO_SCHEMA \} \}/.test(SRC), 'appel morpho : effort high + format json_schema');
eq(!/claude-(haiku|sonnet)-5-5/.test(SRC), 'plus aucun appel Haiku / Sonnet');
eq(/Lx\.bloque\.slice\(\)\.sort\(\(a: any, b: any\) => \(Number\(b\.n\) \|\| 0\) - \(Number\(a\.n\) \|\| 0\)\)/.test(SRC) && /_bq\.slice\(0, 6\)/.test(SRC) && /du plus long au plus court/.test(SRC), 'contexte IA : tous les exercices bloqués (6 max), triés du plus long au plus court (constat préprod 15/11)');
// 15/11 (relecture d'un vrai compte rendu en préprod) : badge « À mesurer » posé sur une mesure fournie → enum distinct ;
// chiffre calculé par l'IA (37,5 %) → interdit ; cartes leviers qui recommandaient squat / soulevé de terre malgré un antécédent dos.
eq(JSON.stringify(MORPHO_SCHEMA.properties.synthese.items.properties.c.enum) === JSON.stringify(['visible', 'probable', 'mesure_fournie', 'a_mesurer']), 'confiance : mesure fournie ≠ à mesurer');
eq(/N'effectue AUCUN calcul/.test(SRC), 'consigne : aucun calcul fait par l\'IA (valeurs fournies telles quelles)');
const seg = { taille: 168, tronc: 63, femur: 46, tibia: 40, envergure: 174, epaules: 31, hanches: 41 };
const avec = recoMorphoExercices(seg, { antecedents: ['disque'] }), sans = recoMorphoExercices(seg, {});
const bonsMes = (L) => L.filter((e) => e.src === 'mesure' || e.src === 'piste').flatMap((e) => e.bons || []);
eq(bonsMes(sans).some((x) => /Back squat|Soulevé de terre conventionnel|Rack pull/.test(x)), 'sans antécédent : squat / soulevé de terre restent proposés (rien ne change)');
eq(!bonsMes(avec).some((x) => /squat|soulevé|rack pull/i.test(x) && !/gobelet/i.test(x)), 'antécédent dos : aucune charge axiale lourde dans les cartes leviers', bonsMes(avec));
eq(avec.some((e) => /Mis de côté tant que ton dos/.test(e.d || '')) && avec.some((e) => e.src === 'antecedent' && /dos/.test(e.t)), 'antécédent dos : la carte dit ce qui est mis de côté et renvoie au garde-fou');
// ── App : bloc zones → programme ──
const APP = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8'), LV3 = fs.readFileSync(path.join(__dirname, '..', 'js', 'lecture-v3.js'), 'utf8');
const ex = (src, n) => { const i0 = src.indexOf('function ' + n + '('); let i = src.indexOf('{', i0), d = 0, j = i; for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}') { d--; if (!d) { j++; break; } } } return src.slice(i0, j); };
const S = { escapeHtml: (x) => String(x), Date, _lv3MusNom: (m) => String(m).toLowerCase() }; vm.createContext(S);
vm.runInContext(APP.match(/var ZONES_PRIO_UI = \[[\s\S]*?\]\];/)[0] + '\nvar _morphoZonesSel = [], _morphoFromCoach = false, dernierAppData = null;\n'
  + ['_normTxt', '_musKey', '_zpLabels', '_morphoData', '_morphoZoneVol', '_morphoZonesHtml'].map((n) => ex(APP, n)).join('\n') + '\n'
  + ['_lv3Iso', '_lv3Ymd', '_lv3T', '_lv3Num', '_lv3Volume'].map((n) => ex(LV3, n)).join('\n') + '\nthis.f = _morphoZonesHtml; this.sel = function(){ return _morphoZonesSel; }; this.setData = function(d){ dernierAppData = d; };', S);
const now = Date.now(), J = (n) => new Date(now - n * 864e5).toISOString().slice(0, 10), dm = {};
for (let w = 1; w <= 4; w++) { dm[J(w * 7 - 2)] = { spm: { Fessier: 4, Dos: 18 } }; }   // 4 semaines : fessiers 4/sem, dos 18/sem
S.setData({ historique: { daily_muscu: dm }, volume_obti: [{ muscle: 'Fessier', series_min: 10, series_opt: 16 }, { muscle: 'Dos', series_min: 10, series_opt: 16 }] });
const html = S.f({ priorites: [{ t: 'Fessiers', zone: 'fessiers' }, { t: 'Dos', zone: 'dos' }, { t: 'Posture', zone: 'aucune' }] });
eq(/Fessiers/.test(html) && /Dos/.test(html) && !/Posture/.test(html), 'zones issues des priorités (« aucune » ignorée)');
eq(/◆ fessier : <b>4,3 séries\/sem<\/b> \(min\. 10, optimum 16\)/.test(html), 'chiffre affiché = volume réel des séances (4,3 séries/sem, semaines réellement couvertes), pas l\'IA', html.match(/◆ fessier[^<]*<b>[^<]*<\/b>[^<]*/));
eq(/dos : <b>19,4 séries\/sem<\/b>[^<]*déjà dans ta zone/.test(html), 'dos déjà au-dessus de l\'optimum → « déjà dans ta zone : priorité à l\'exécution »');
eq(JSON.stringify(S.sel()) === '["fessiers"]', 'zone déjà à l\'optimum NON pré-cochée (cohérence photo ↔ données)', S.sel());
eq(/Construire mon programme avec ces zones/.test(html) && /générateur Novalyz/.test(html), 'programme construit par le générateur, validation requise');
console.log('-'.repeat(70));
console.log('ia-morpho : ' + ok + ' OK / ' + ko + ' KO');
if (ko) process.exit(1);
