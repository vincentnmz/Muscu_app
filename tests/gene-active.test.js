/* Gêne ACTIVE (14/11, constat B1 du banc de profils) : une douleur ≥ 3/5 au DERNIER questionnaire (≤ 7 j) sur une zone
 * sollicitée par le muscle → le diagnostic la met en 1re cause (levier : ni charge ni séries en plus) et le plan met en
 * pause les actions sur cette zone (hors compteur, jamais envoyées au journal). « Dos » reconnu (avant : « do »). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const LV3 = fs.readFileSync(path.join(__dirname, '..', 'js', 'lecture-v3.js'), 'utf8');
function ex(src, n) { const m = src.match(new RegExp('function\\s+' + n + '\\s*\\(')); let i = src.indexOf('{', m.index), d = 0, j = i; for (; j < src.length; j++) { const c = src[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } } return src.slice(m.index, j); }
const S = {}; vm.createContext(S);
vm.runInContext(['_normTxt', '_musKey'].map((n) => ex(APP, n)).join('\n') + '\n' + LV3.match(/var _LV3_ZONE_MUS = \[[\s\S]*?\];/)[0] + '\n'
  + ['_lv3Iso', '_lv3T', '_lv3Num', '_lv3Cle', '_lv3ZoneTouche', '_lv3GeneActive'].map((n) => ex(LV3, n)).join('\n'), S);
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
console.log(`gene-active : ${ok} OK / ${ko} KO`); process.exit(ko ? 1 : 0);
