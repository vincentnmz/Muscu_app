/* =============================================================================
 * Audit Novalyz IA (01/11/2026) — vrai handleChatIA, API Anthropic SIMULÉE (aucun envoi réel).
 *  I1 contexte daté / état affiché ; I3 garde-fou chiffres (régénération puis retrait) ;
 *  I4 mode coach (3e personne, quota du coach, pas celui de l'athlète).
 * ========================================================================== */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const T = fs.readFileSync(path.join(__dirname, 'e2e-parcours.test.js'), 'utf8');
eval(T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend')));
let ok = 0, ko = 0;
const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g).slice(0, 300) + ')' : '')); } };
const today = new Date().toISOString().slice(0, 10);
const store = { athletes: [{ id: 'A1', nom: 'Léa Test', coach_id: 'C1', login: '1111' }], performances: [], indicateurs: [], bien_etre: [], programme: [] };
const client = makeEngine(store);
client.storage = { from: () => ({ createSignedUrls: async () => ({ data: [] }) }) };
let reponses = [], appels = [];
let js = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { handleChatIA, _iaChiffresInconnus, _iaContexte };';
const sb = { createClient: () => client, webpush: { setVapidDetails() {}, sendNotification: async () => {} },
  Deno: { env: { get: (k) => k === 'ANTHROPIC_API_KEY' ? 'cle-de-test' : undefined }, serve: () => {} },
  Response, Request, URLSearchParams, TextEncoder, TextDecoder, crypto, console, atob, btoa, setTimeout, clearTimeout,
  fetch: async (url, init) => { const b = JSON.parse(init.body); appels.push(b); const t = reponses.shift() || 'ok'; return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: t }] }) }; } };
vm.createContext(sb); vm.runInContext(js, sb);
const A = sb.__api;
(async () => {
  // Garde-fou : chiffres connus / inconnus.
  eq(JSON.stringify(A._iaChiffresInconnus('Tu as fait 4 séances et 83 kg, vise 92,5 kg.', 'poids 83 kg')) === '["92,5"]', 'détection : 92,5 inconnu, 83 connu, 4 toléré');
  // 1) réponse avec un chiffre inventé → régénérée.
  reponses = ['Ton squat devrait passer à 120 kg.', 'Je n\'ai pas tes charges de squat dans tes données.'];
  let r = await (await A.handleChatIA({ athlete_id: 'A1', messages: [{ role: 'user', content: 'Combien au squat ?' }] })).json();
  eq(appels.length === 2 && /pas tes charges/.test(r.reply), 'chiffre inventé → réponse régénérée sans le chiffre', r.reply);
  eq(/120/.test(appels[1].messages[appels[1].messages.length - 1].content), 'la 2e demande cite le chiffre fautif (120)');
  // 2) la régénération invente encore → phrase retirée.
  appels = []; reponses = ['Bonne semaine. Vise 140 kg demain.', 'Bonne semaine. Vise 140 kg demain.'];
  r = await (await A.handleChatIA({ athlete_id: 'A1', messages: [{ role: 'user', content: 'Et demain ?' }] })).json();
  eq(r.reply === 'Bonne semaine.' , 'chiffre toujours inventé → la phrase est retirée', r.reply);
  // 3) contexte : pas de questionnaire → état « non renseigné », pas « Prêt ».
  eq(/Aucun questionnaire|non renseigné/.test(appels[0].system) && !/État du jour \(verdict de l'app\) : Prêt\./.test(appels[0].system), 'contexte : jamais « Prêt » sans questionnaire récent');
  // 4) mode coach : 3e personne + quota du coach.
  appels = []; reponses = ['Léa reprend bien.'];
  const avant = store.indicateurs.filter(x => x.seance_id === 'ia_quota' && x.athlete_id === 'A1').map(x => x.valeur).join();
  r = await (await A.handleChatIA({ athlete_id: 'A1', coach_id: 'C1', mode: 'coach', messages: [{ role: 'user', content: 'Comment va-t-elle ?' }] })).json();
  eq(/Tu parles au COACH de l'athlète Léa/.test(appels[0].system), 'mode coach : l\'IA parle au coach de Léa (3e personne)', appels[0].system.slice(0, 200));
  const apres = store.indicateurs.filter(x => x.seance_id === 'ia_quota' && x.athlete_id === 'A1').map(x => x.valeur).join();
  eq(avant === apres && store.indicateurs.some(x => x.seance_id === 'ia_quota' && x.athlete_id === 'coach:C1'), 'mode coach : quota du coach décompté, pas celui de l\'athlète', [avant, apres]);
  console.log('-'.repeat(70)); console.log('IA garde-fou : ' + ok + ' OK / ' + ko + ' KO'); if (ko) process.exitCode = 1;
})();
