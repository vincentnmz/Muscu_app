/* =============================================================================
 * Audit Réglages R3 (01/11) — export par e-mail (app Android) : vrai
 * handleExportAthleteEmail, envoi Resend intercepté. Pièces jointes JSON + CSV en
 * base64, hash du mot de passe JAMAIS exporté, pas d'e-mail → message clair.
 * ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const T = fs.readFileSync(path.join(__dirname, 'e2e-parcours.test.js'), 'utf8');
eval(T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend')));
let ok = 0, ko = 0;
const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g).slice(0, 200) + ')' : '')); } };
const store = { athletes: [{ id: 'A1', login: '1111', nom: 'Léa Test', email: 'lea@example.com', password_hash: 's2$SECRET' }, { id: 'A2', login: '2222', nom: 'Sans', email: '' }],
  performances: [{ id: 1, athlete_id: 'A1', date: '2026-10-01', exercice: 'Squat', charge: 100, reps: 8 }, { id: 2, athlete_id: 'A2', date: '2026-10-01', exercice: 'X', charge: 1, reps: 1 }], indicateurs: [], bien_etre: [] };
const client = makeEngine(store);
const envois = [];
let js = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { handleExportAthleteEmail };';
const sb = { createClient: () => client, webpush: { setVapidDetails() {}, sendNotification: async () => {} }, Deno: { env: { get: (k) => k === 'RESEND_FROM' ? undefined : 'x' }, serve: () => {} },
  Response, Request, URLSearchParams, TextEncoder, TextDecoder, crypto, console, atob, btoa, setTimeout, clearTimeout,
  fetch: async (url, init) => { envois.push({ url, body: JSON.parse(init.body) }); return { ok: true, status: 200, json: async () => ({}) }; } };
vm.createContext(sb); vm.runInContext(js, sb);
(async () => {
  const r = await (await sb.__api.handleExportAthleteEmail({ athlete_id: 'A1' })).json();
  eq(r.success === true && r.email === 'lea@example.com', 'envoi à l\'e-mail du compte', r);
  const e = envois[0] && envois[0].body;
  eq(e && /resend/.test(envois[0].url) && e.to[0] === 'lea@example.com', 'Resend appelé vers la bonne adresse', e && e.to);
  const att = (e && e.attachments) || [];
  eq(att.length === 2 && /\.json$/.test(att[0].filename) && /\.csv$/.test(att[1].filename), 'pièces jointes JSON + CSV', att.map(a => a.filename));
  const json = att[0] ? Buffer.from(att[0].content, 'base64').toString('utf8') : '';
  eq(json.indexOf('SECRET') < 0 && json.indexOf('password_hash') < 0, 'hash du mot de passe jamais exporté');
  eq(/"Squat"/.test(json) && !/"X"/.test(json), 'seulement les données de l\'athlète');
  const csv = att[1] ? Buffer.from(att[1].content, 'base64').toString('utf8') : '';
  eq(/Squat/.test(csv) && csv.split('\n').length === 2, 'CSV : en-tête + 1 séance', csv);
  const r2 = await (await sb.__api.handleExportAthleteEmail({ athlete_id: 'A2' })).json();
  eq(r2.success === false && /e-mail/.test(r2.error) && envois.length === 1, 'sans e-mail : message clair, rien envoyé', r2);
  console.log('-'.repeat(70)); console.log('export par e-mail : ' + ok + ' OK / ' + ko + ' KO'); if (ko) process.exitCode = 1;
})();
