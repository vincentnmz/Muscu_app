/* Historique par exercice envoyé à l'app (14/11) : toutes les dates des 400 derniers jours + au moins les 30 plus
 * récentes (avant : 30 dates seulement → vue Année tronquée, faux records, sommeil → performance amputé). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module'); const { webcrypto } = require('crypto');
let js = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
js = js.split('\n').filter((l) => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { buildProgressionParExo };';
const S = { createClient: () => ({ from: () => ({}) }), webpush: { setVapidDetails() {}, sendNotification: async () => {} }, Deno: { env: { get: () => undefined }, serve: () => {} },
  Response, Request, URLSearchParams, TextEncoder, TextDecoder, console, atob, btoa, setTimeout, clearTimeout, crypto: webcrypto, fetch: async () => ({}) };
vm.createContext(S); vm.runInContext(js, S); const A = S.__api;
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };
const now = Date.UTC(2026, 10, 14, 12), J = (n) => new Date(now - n * 864e5).toISOString().slice(0, 10);
const P = (exo, jours) => jours.flatMap((d) => [1, 2].map((s) => ({ date: J(d), exercice: exo, charge: 50 + (d % 7), reps: 8, rpe: 8, serie: s })));
eq(/const PROG_FENETRE_JOURS = 400, PROG_MIN_DATES = 30/.test(js), 'paramètres : 400 jours, minimum 30 dates');
// 3 séances / semaine pendant 3 ans (≈ 470 dates) : on garde les 400 derniers jours, pas seulement 30.
const freq = []; for (let d = 0; d < 1095; d++) if ([0, 2, 4].includes(d % 7)) freq.push(d);
const r1 = A.buildProgressionParExo(P('Squat', freq), now).Squat;
const attendu = freq.filter((d) => d <= 400).length;
eq(r1.length === attendu && r1.length > 30, 'exercice fréquent : toutes les dates des 400 derniers jours (' + attendu + ')', r1.length);
eq(r1.every((p, i) => i === 0 || p.date <= r1[i - 1].date || new Date(p.date.split('/').reverse().join('-')) <= new Date(r1[i - 1].date.split('/').reverse().join('-'))), 'ordre : la plus récente en premier');
eq(r1[0].series.length === 2 && r1[0].volTotal > 0, 'chaque point garde ses séries (structure inchangée)');
// Reprise après 2 ans d'arrêt : les 30 dernières dates restent, même si elles ont plus de 400 jours.
const vieux = []; for (let d = 800; d < 1000; d += 3) vieux.push(d);
const r2 = A.buildProgressionParExo(P('Développé couché barre', vieux), now)['Développé couché barre'];
eq(r2.length === 30, 'historique ancien seulement : les 30 dernières dates sont gardées', r2.length);
// Petit historique : inchangé.
const r3 = A.buildProgressionParExo(P('Curl', [1, 5, 9]), now).Curl;
eq(r3.length === 3, 'petit historique : rien n\'est retiré', r3.length);
// Sans date fournie : fenêtre calculée sur maintenant (pas d'erreur).
eq(Array.isArray(A.buildProgressionParExo(P('Curl', [1]))['Curl']), 'sans date fournie : fonctionne');
console.log(`progression-fenetre : ${ok} OK / ${ko} KO`); process.exit(ko ? 1 : 0);
