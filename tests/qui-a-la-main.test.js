/* Écran 6 (04/11/2026) — « qui a la main » : propositions Novalyz à l'athlète seulement sans coach
 * (ou si le coach l'autorise) ; toujours visibles côté coach. */
const fs = require('fs'), path = require('path'), vm = require('vm');
let ok = 0, ko = 0; const eq = (c, n) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n); } };
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const pick = (n) => { const i = src.indexOf('function ' + n + '('); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } };
const run = (ctx) => { const sb = Object.assign({ _maCoach: false, coach: null, dernierAppData: null }, ctx); vm.createContext(sb); vm.runInContext(pick('_nvPropsAthlete') + '; this.r = _nvPropsAthlete();', sb); return sb.r; };
eq(run({ dernierAppData: { propositions_novalyz: true } }) === true, 'sans coach → propositions à l\'athlète');
eq(run({ dernierAppData: { propositions_novalyz: false } }) === false, 'avec coach (réglage par défaut) → pas de propositions à l\'athlète');
eq(run({ dernierAppData: {} }) === true, 'serveur pas encore redéployé → comportement d\'avant');
eq(run({ _maCoach: true, dernierAppData: { propositions_novalyz: false } }) === true, 'fiche coach → le coach voit les propositions');
eq(run({ coach: { coach_id: '1' }, dernierAppData: { propositions_novalyz: false } }) === true, 'session coach (saisie présentiel) → propositions visibles');
console.log('-'.repeat(70)); console.log('qui-a-la-main : ' + ok + ' OK / ' + ko + ' KO'); if (ko) process.exitCode = 1;
