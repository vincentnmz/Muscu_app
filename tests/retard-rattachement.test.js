/* 07/11 — Résumé coach « N séances en retard » : les séances libres rattachées (choix explicite ou
 * automatique ≥ 50 % d'exercices communs) comptent comme faites — même règle que l'app (Ma semaine). */
const fs = require('fs'), path = require('path'), vm = require('vm'); const { stripTypeScriptTypes } = require('node:module');
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };
let js = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8')).split('\n').filter((l) => !/^import\s/.test(l)).join('\n');
js += '\n;this.__api={_seancesEnRetard,_faitesSemaineRatt};';
const sb = { createClient: () => ({}), webpush: { setVapidDetails() {} }, Deno: { env: { get: () => '' }, serve: () => {} }, Response, Request, URLSearchParams, TextEncoder, TextDecoder, crypto, console, setTimeout, clearTimeout, fetch: async () => ({ ok: false }) };
vm.createContext(sb); vm.runInContext(js, sb);
const A = sb.__api;
const ex = (...n) => n.map((x) => ({ nom: x }));
const programme = [
  ...['Développé couché barre', 'Développé militaire', 'Élévation latérale haltère'].map((e) => ({ seance_id: 'pec epaule', exercice: e, jour: 1 })),
  ...['Tirage vertical prise large', 'Squat', 'Leg curl assis'].map((e) => ({ seance_id: 'dos jambes', exercice: e, jour: 2 })),
  ...['Développé incliné haltère', 'Écarté poulie haute', 'Élévation latérale uni à la poulie'].map((e) => ({ seance_id: 'pec epaule 2', exercice: e, jour: 4 })),
  ...['Rowing barre', 'Presse inclinée', 'Leg curl allongé'].map((e) => ({ seance_id: 'dos jambe 2', exercice: e, jour: 5 })),
];
const planning = [['2026-11-02', 'pec epaule'], ['2026-11-03', 'dos jambes'], ['2026-11-05', 'pec epaule 2'], ['2026-11-06', 'dos jambe 2']].map(([d, s]) => ({ date_iso: d, seance_id: s, statut: 'planifie' }));
const base = (sd) => ({ programme, planning, seances_detail: sd });
const now = new Date('2026-11-07T06:00:00Z');   // samedi matin (cron du résumé coach)
const sdLibre = [
  { date: '2026-11-02', seance_id: 'pec epaule', exercices: ex('Développé couché barre', 'Développé militaire') },
  { date: '2026-11-05', seance_id: 'Libre', exercices: ex('Développé incliné haltère', 'Écarté poulie haute', 'Curl barre') },   // 2/3 de pec epaule 2 → auto
  { date: '2026-11-06', seance_id: 'Libre', exercices: ex('Abdos', 'Gainage') },                                              // rien en commun
];
eq(A._seancesEnRetard(base(sdLibre), now) === 2, 'auto ≥ 50 % : « pec epaule 2 » faite en libre → plus en retard (reste dos jambes + dos jambe 2)', A._seancesEnRetard(base(sdLibre), now));
const sdChoix = sdLibre.map((x) => x.date === '2026-11-06' ? Object.assign({}, x, { rattache: 'dos jambe 2' }) : x);
eq(A._seancesEnRetard(base(sdChoix), now) === 1, 'choix explicite : « dos jambe 2 » rattachée → seule « dos jambes » en retard', A._seancesEnRetard(base(sdChoix), now));
const sdPlus = sdLibre.map((x) => x.date === '2026-11-05' ? Object.assign({}, x, { rattache: '__plus__' }) : x);
eq(A._seancesEnRetard(base(sdPlus), now) === 3, '« en plus » choisi : ne remplace rien → 3 en retard', A._seancesEnRetard(base(sdPlus), now));
eq(A._seancesEnRetard(base(sdLibre.slice(0, 1)), now) === 3, 'sans séance libre : 3 en retard (comportement inchangé)');
const sem = A._faitesSemaineRatt(base(sdChoix), '2026-11-02');
eq(sem.has('pec epaule') && sem.has('pec epaule 2') && sem.has('dos jambe 2') && !sem.has('dos jambes'), 'faites de la semaine', [...sem]);
console.log('-'.repeat(70)); console.log('retard + rattachement : ' + ok + ' OK / ' + ko + ' KO'); if (ko) process.exitCode = 1;
