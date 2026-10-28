/* Régularité de la lecture Analyses (buildSyntheseMuscu) selon le réglage
 * « semaine d'entraînement » (28/10/2026) : calendaire (lundi → aujourd'hui, prorata)
 * ou glissant (7 derniers jours). Vrai code d'index.ts. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
let js = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase/functions/handler/index.ts'), 'utf8'));
js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { buildSyntheseMuscu };';
const sb = { createClient: () => ({}), webpush: { setVapidDetails() {} }, Deno: { env: { get: () => 'x' }, serve: () => {} }, Response, Request, URL, URLSearchParams, TextEncoder, TextDecoder, crypto, console, setTimeout, clearTimeout, fetch: async () => ({}) };
vm.createContext(sb); vm.runInContext(js, sb);
const B = sb.__api.buildSyntheseMuscu;
let ok = 0, ko = 0;
const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + ' (got ' + JSON.stringify(g) + ')'); } };
const reg = (t) => { const s = JSON.stringify(t); const m = s.match(/R[ée]gularit[ée][^"]*/); return m ? m[0] : null; };
const run = (r, ex) => reg(B('', null, null, r, null, ex));
const R = { seances_semaine: 2, seances_j7: 4, seances_prevues: 4 };
eq(/2\/4 séances cette semaine/.test(run(R, { semaineType: 'calendaire', jourSemaine: 3 })), 'calendaire mercredi : 2/4 cette semaine (pas 4/4 sur 7 jours)', run(R, { semaineType: 'calendaire', jourSemaine: 3 }));
eq(/4\/4 séances sur les 7 derniers jours/.test(run(R, { semaineType: 'glissant', jourSemaine: 3 })), 'glissant : 4/4 sur les 7 derniers jours', run(R, { semaineType: 'glissant', jourSemaine: 3 }));
eq(!/sous ton objectif/.test(run({ seances_semaine: 0, seances_j7: 3, seances_prevues: 4 }, { semaineType: 'calendaire', jourSemaine: 1 }) || ''), 'calendaire lundi 0/4 : pas « sous l\'objectif »', run({ seances_semaine: 0, seances_j7: 3, seances_prevues: 4 }, { semaineType: 'calendaire', jourSemaine: 1 }));
eq(/sous ton objectif \(1\/4 séances cette semaine\)/.test(run({ seances_semaine: 1, seances_j7: 1, seances_prevues: 4 }, { semaineType: 'calendaire', jourSemaine: 7 }) || ''), 'calendaire dimanche 1/4 : sous l\'objectif', run({ seances_semaine: 1, seances_j7: 1, seances_prevues: 4 }, { semaineType: 'calendaire', jourSemaine: 7 }));
eq(/au rendez-vous \(4\/4 séances cette semaine\)/.test(run({ seances_semaine: 4, seances_j7: 4, seances_prevues: 4 }, { semaineType: 'calendaire', jourSemaine: 5 }) || ''), 'calendaire 4/4 : au rendez-vous', null);
eq(/cette semaine/.test(run(R, undefined) || ''), 'sans réglage → calendaire par défaut', run(R, undefined));
console.log('-'.repeat(70));
console.log('régularité semaine : ' + ok + ' OK / ' + ko + ' KO');
if (ko) process.exit(1);
