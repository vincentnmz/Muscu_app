/* Audit Cardio / Croisé (28/10/2026) — vrai code d'index.ts.
 * #3 : après une forte baisse de cardio, la reco ne dit plus « continue sur ce rythme ».
 * #9 : accord « ta récupération est excellente / bonne ». */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
let js = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase/functions/handler/index.ts'), 'utf8'));
js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { buildSyntheseCardio, buildSyntheseCroise };';
const sb = { createClient: () => ({}), webpush: { setVapidDetails() {} }, Deno: { env: { get: () => 'x' }, serve: () => {} }, Response, Request, URL, URLSearchParams, TextEncoder, TextDecoder, crypto, console, setTimeout, clearTimeout, fetch: async () => ({}) };
vm.createContext(sb); vm.runInContext(js, sb);
const { buildSyntheseCardio, buildSyntheseCroise } = sb.__api;
let ok = 0, ko = 0;
const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + ' (got ' + JSON.stringify(g) + ')'); } };
const now = new Date('2026-10-28T12:00:00Z');
const day = (n) => new Date(now - n * 864e5).toISOString().slice(0, 10);
const S = (n, km, min) => ({ date: day(n), distance: km, duree: min, rpe: 4, type_cardio: 'marche' });
const hist = [S(25, 0.7, 18), S(26, 2.8, 44)];
for (let i = 0; i < 26; i++) hist.push(S(30 + i, 2, 35));
const c = buildSyntheseCardio({ history: hist }, { recup: 'Excellent', disponibilite: { niveau: 'Prêt' } }, now);
eq(c.constats.some(x => /Forte baisse/.test(x.texte)), 'constat « forte baisse » présent', c.constats);
eq(!/Continue sur ce rythme/.test(c.reco.texte) && /Reprends progressivement/.test(c.reco.texte), 'reco cohérente avec la baisse', c.reco.texte);
const stable = []; for (let i = 0; i < 8; i++) stable.push(S(2 + i * 7, 3, 40));
const c2 = buildSyntheseCardio({ history: stable }, { recup: 'Bon', disponibilite: { niveau: 'Prêt' } }, now);
eq(/Continue sur ce rythme/.test(c2.reco.texte), 'rythme stable → « continue » conservé', c2.reco.texte);
const x = buildSyntheseCroise({ j28_vs_j28prec: { tonnage: { j28: 20000 } } }, { history: hist }, { recup: 'Excellent', disponibilite: { niveau: 'Prêt' } }, now);
eq(JSON.stringify(x).includes('récupération est excellente'), 'accord « excellente »', x.constats);
console.log('-'.repeat(70));
console.log('audit cardio / croisé : ' + ok + ' OK / ' + ko + ' KO');
if (ko) process.exit(1);
