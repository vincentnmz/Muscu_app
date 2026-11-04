/* 04/11/2026 — « Entraînement à regarder » (accueil coach) : un athlète dont le plan de la semaine est
 * entièrement fait (ex. reprise faite ce matin) sort de la liste ; il reste seulement si un exercice pose question. */
const fs = require('fs'), path = require('path'), vm = require('vm');
let ok = 0, ko = 0; const eq = (c, n) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n); } };
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const pick = (n) => { const i = src.indexOf('function ' + n + '('); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } };
const run = (P, D) => { const sb = { _lv3Plan: () => P, _lv3Diags: () => D || [], escapeHtml: x => String(x), _cdFmtKg: x => String(x) }; vm.createContext(sb); vm.runInContext(pick('_coachEntrLigne') + '; this.r = _coachEntrLigne({ historique: {} });', sb); return sb.r; };
const rep = (fait) => ({ reprise: true, faits: fait ? 1 : 0, actions: [{ titre: 'Reprendre', fait, derniere: '2026-10-07' }] });
eq(run(rep(false)) && /Reprendre/.test(run(rep(false)).txt), 'reprise pas faite → listée');
eq(run(rep(true)) === null, 'reprise faite (Alizé ce matin) → sort de la liste');
const plan = (f, n) => ({ faits: f, actions: Array.from({ length: n }, (_, i) => ({ titre: 'Action ' + i, fait: i < f })) });
eq(run(plan(1, 3)) && /Action 1/.test(run(plan(1, 3)).txt), 'plan 1/3 → listée sur la prochaine action non faite');
eq(run(plan(3, 3)) === null, 'plan 3/3 fait, aucun exercice en question → sort de la liste');
eq(run(plan(3, 3), [{ exo: 'Squat', kind: 'bloque' }]) !== null, 'plan fait MAIS exercice bloqué → reste (chip verte)');
console.log('-'.repeat(70)); console.log('coach-entrainement-regarder : ' + ok + ' OK / ' + ko + ' KO'); if (ko) process.exitCode = 1;
