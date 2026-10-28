/* =============================================================================
 * Suppression de compte COMPLÈTE (exigence Google Play + RGPD) — vrai
 * handleSupprimerCompte sur une base en mémoire contenant une ligne dans CHAQUE
 * table portant athlete_id (liste relevée sur la base réelle le 28/10/2026) +
 * des fichiers dans les buckets privés. L'athlète supprimé ne doit plus rien
 * avoir ; un autre athlète ne doit pas être touché.
 * ⚠️ Nouvelle table avec athlete_id → l'ajouter ici ET dans handleSupprimerCompte.
 * ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');

const ROOT = path.join(__dirname, '..');
const T = fs.readFileSync(path.join(__dirname, 'e2e-parcours.test.js'), 'utf8');
eval(T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend')));

const TABLES = ['activites', 'alertes_historique', 'bien_etre', 'blessures', 'commentaires', 'contexte_athlete', 'google_health_tokens',
  'indicateurs', 'native_push_tokens', 'notes', 'objectif', 'objectifs', 'password_reset_tokens', 'pauses', 'performances', 'planning',
  'poids_historique', 'programme', 'push_subscriptions', 'tests'];

const store = { athletes: [{ id: 'A1', login: '1111' }, { id: 'A2', login: '2222' }] };
for (const t of TABLES) store[t] = [{ athlete_id: 'A1', x: 1 }, { athlete_id: 'A2', x: 2 }];
const files = { 'coach-media': ['A1/a.jpg', 'A2/b.jpg'], 'suivi-photos': ['A1/face.jpg', 'A1/dos.jpg', 'A2/profil.jpg'] };
const client = makeEngine(store);
client.storage = { from: (b) => ({
  list: async (prefix) => ({ data: (files[b] || []).filter(f => f.startsWith(prefix + '/')).map(f => ({ name: f.slice(prefix.length + 1) })), error: null }),
  remove: async (paths) => { files[b] = (files[b] || []).filter(f => !paths.includes(f)); return { data: null, error: null }; },
}) };

let js = stripTypeScriptTypes(fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { handleSupprimerCompte };';
const sb = { createClient: () => client, webpush: { setVapidDetails() {}, sendNotification: async () => {} }, Deno: { env: { get: () => 'x' }, serve: () => {} },
  Response, Request, URLSearchParams, TextEncoder, TextDecoder, crypto, console, setTimeout, clearTimeout, fetch: async () => ({}) };
vm.createContext(sb); vm.runInContext(js, sb);

let ok = 0, ko = 0; const fails = [];
const eq = (c, n, g) => { if (c) ok++; else { ko++; fails.push(n); console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };

(async () => {
  await sb.__api.handleSupprimerCompte({ athlete_id: 'A1' });
  for (const t of TABLES) {
    eq(!(store[t] || []).some(r => String(r.athlete_id) === 'A1'), t + ' : plus aucune ligne de A1', store[t]);
    eq((store[t] || []).some(r => String(r.athlete_id) === 'A2'), t + ' : A2 intact');
  }
  eq(!store.athletes.some(a => a.id === 'A1') && store.athletes.some(a => a.id === 'A2'), 'athletes : A1 supprimé, A2 intact');
  eq(!files['suivi-photos'].some(f => f.startsWith('A1/')) && files['suivi-photos'].includes('A2/profil.jpg'), 'photos de suivi : A1 supprimées, A2 intactes', files['suivi-photos']);
  eq(!files['coach-media'].some(f => f.startsWith('A1/')) && files['coach-media'].includes('A2/b.jpg'), 'médias coach : A1 supprimés, A2 intacts', files['coach-media']);
  console.log('-'.repeat(70));
  console.log('suppression compte complète : ' + ok + ' OK / ' + ko + ' KO');
  if (ko) { console.log('Échecs : ' + fails.join(' | ')); process.exit(1); }
})();
