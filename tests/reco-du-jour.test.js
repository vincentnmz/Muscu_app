/* Reco du jour (audit R1-R2, 14/11) : « RAS — maintenir la charge actuelle » (défaut du moteur, aucun signal) n'est plus
 * affiché ; les recos portées par un signal restent. Pourquoi nommé quand la ligne cite plusieurs exercices (audit L3). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const LV3 = fs.readFileSync(path.join(__dirname, '..', 'js', 'lecture-v3.js'), 'utf8');
function ex(src, n) { const m = src.match(new RegExp('function\\s+' + n + '\\s*\\(')); let i = src.indexOf('{', m.index), d = 0, j = i; for (; j < src.length; j++) { const c = src[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } } return src.slice(m.index, j); }
const S = { _maE: (s) => String(s).replace(/</g, '&lt;'), _nvPropsAthlete: () => true }; vm.createContext(S);
vm.runInContext(ex(APP, '_nvRecoUtile') + '\n' + ex(LV3, '_lv3PourquoiHtml'), S);
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };
eq(S._nvRecoUtile('RAS — maintenir la charge actuelle.') === '', 'défaut « RAS » masqué');
eq(S._nvRecoUtile('RAS') === '', '« RAS » seul masqué');
eq(S._nvRecoUtile('Douleur modérée — adapte la charge.') === 'Douleur modérée — adapte la charge.', 'reco avec signal conservée');
eq(S._nvRecoUtile('Charge élevée (ACWR 1,6) — allège.') === 'Charge élevée — allège.', 'mention ACWR retirée');
eq(S._nvRecoUtile(null) === '' && S._nvRecoUtile('') === '', 'vide → rien');
eq(!/RASSURANT/.test(S._nvRecoUtile('Rassure-toi')) && S._nvRecoUtile('Rassure-toi') === 'Rassure-toi', 'un mot qui commence par « Ras » n\'est pas masqué');
const d = { pourquoi: 'X', levier: 'Y' };
eq(/Pourquoi \(Développé couché\) :/.test(S._lv3PourquoiHtml(d, 'Développé couché ')), 'Pourquoi nommé si demandé');
eq(/Pourquoi :<\/b>/.test(S._lv3PourquoiHtml(d)), 'Pourquoi sans nom par défaut');
eq(/_pq\(L\.bloque\[0\]\.exo, L\.bloque\.length > 1\)/.test(APP), 'Résumé : nom quand plusieurs exercices bloqués');
eq((APP.match(/_nvRecoUtile\(m\.reco\)/g) || []).length === 3, 'filtre appliqué à Aujourd\'hui, Forme (reco) et Forme (en-tête)');
console.log(`reco-du-jour : ${ok} OK / ${ko} KO`); process.exit(ko ? 1 : 0);
