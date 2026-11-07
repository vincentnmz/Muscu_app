/* =============================================================================
 * INSCRIPTION BÊTA DU SITE (07/11) — action publique inscriptionBeta.
 * Exécute le VRAI index.ts (handleInscriptionBeta) sur un moteur Supabase en
 * mémoire : validations, champ piège, doublon (mise à jour sans 2e mail),
 * limite 5 envois / heure / IP, notification envoyée à hello@novalyz.fr.
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const { webcrypto } = require('crypto');

let ok = 0, ko = 0;
function eq(cond, label) { if (cond) { ok++; } else { ko++; console.error('  ✗ ' + label); } }

function makeEngine(store) {
  function q(table) {
    const filters = []; let op = null, payload = null, single = false;
    const base = () => (store[table] || (store[table] = []));
    const matches = (r) => filters.every(f => f(r));
    const self = {
      from(t) { return q(t); },
      select() { return self; },
      insert(p) { op = 'insert'; payload = Array.isArray(p) ? p : [p]; return self; },
      update(p) { op = 'update'; payload = p; return self; },
      delete() { op = 'delete'; return self; },
      eq(c, v) { filters.push(r => String(r[c]) === String(v)); return self; },
      limit() { return self; },
      order() { return self; },
      single() { single = true; return self; },
      maybeSingle() { single = true; return self; },
      then(res, rej) { try { res(resolve()); } catch (e) { rej ? rej(e) : res({ data: null, error: { message: String(e) } }); } },
    };
    function resolve() {
      if (op === 'insert' || op === 'upsert') { base().push(...payload); return { data: single ? payload[0] : payload, error: null }; }
      if (op === 'update') { base().filter(matches).forEach(r => Object.assign(r, payload)); return { data: null, error: null }; }
      if (op === 'delete') { store[table] = base().filter(r => !matches(r)); return { data: null, error: null }; }
      const rows = base().filter(matches);
      return single ? { data: rows[0] || null, error: null } : { data: rows, error: null };
    }
    return self;
  }
  return { from: q };
}


const mails = [];
function loadBackend(store) {
  let js = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
  js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n');
  js += '\n;this.__api = { handleInscriptionBeta, AUTH_PUBLIC };';
  const client = makeEngine(store);
  const sandbox = {
    createClient: () => client,
    webpush: { setVapidDetails() {}, sendNotification: async () => {} },
    Deno: { env: { get: (k) => (k === 'PEPPER' ? 'test-pepper' : k === 'RESEND_API_KEY' ? 'cle-de-test' : undefined) }, serve: () => {} },
    Response, Request, URLSearchParams, TextEncoder, TextDecoder, console, atob, btoa, setTimeout, clearTimeout,
    crypto: webcrypto,
    fetch: async (u, o) => { mails.push({ u, b: JSON.parse(o.body) }); return { ok: true, json: async () => ({}), text: async () => '' }; },
  };
  vm.createContext(sandbox);
  vm.runInContext(js, sandbox);
  return sandbox.__api;
}

(async () => {
  const store = { beta_inscriptions: [] };
  const api = loadBackend(store);
  const call = async (b, ip) => (await api.handleInscriptionBeta(b, ip)).json();
  const ok1 = { prenom: '  Léa ', email: 'Lea@Exemple.fr', profil: 'athlete', appareil: 'android', source: 'instagram' };

  eq(api.AUTH_PUBLIC.has('inscriptionBeta'), 'action publique (pas de session)');
  eq((await call({ ...ok1, prenom: '' }, 'a')).error === 'Indique ton prénom.', 'prénom obligatoire');
  eq((await call({ ...ok1, email: 'pas-un-mail' }, 'b')).error === 'E-mail invalide.', 'e-mail valide');
  eq((await call({ ...ok1, profil: 'admin' }, 'c')).error === 'Choisis ton profil.', 'profil limité');
  eq((await call({ ...ok1, appareil: 'nokia' }, 'd')).error === 'Choisis ton appareil.', 'appareil limité');
  eq(store.beta_inscriptions.length === 0 && mails.length === 0, 'rien enregistré ni envoyé sur refus');

  const robot = await call({ ...ok1, site_web: 'http://spam' }, 'e');
  eq(robot.success === true && store.beta_inscriptions.length === 0, 'champ piège : succès apparent, rien enregistré');

  const r1 = await call(ok1, 'f');
  eq(r1.success === true && store.beta_inscriptions.length === 1, 'inscription enregistrée');
  const row = store.beta_inscriptions[0];
  eq(row.prenom === 'Léa' && row.email === 'lea@exemple.fr' && row.source === 'instagram', 'prénom nettoyé, e-mail en minuscules, source gardée');
  eq(mails.length === 1 && mails[0].b.to[0] === 'hello@novalyz.fr' && /Léa/.test(mails[0].b.subject), 'notification à hello@novalyz.fr');
  eq(/Google Play/.test(mails[0].b.html), 'Android : rappel « ajouter aux testeurs Google Play »');

  const r2 = await call({ ...ok1, email: 'LEA@exemple.fr', appareil: 'iphone' }, 'g');
  eq(r2.success === true && store.beta_inscriptions.length === 1 && store.beta_inscriptions[0].appareil === 'iphone', 'doublon : mise à jour, pas de 2e ligne');
  eq(mails.length === 1, 'doublon : pas de 2e mail');

  const src = await call({ ...ok1, email: 'x@y.fr', source: '<script>' }, 'h');
  eq(src.success && store.beta_inscriptions[1].source === null, 'source invalide ignorée');

  let dernier;
  for (let i = 0; i < 6; i++) dernier = await call({ ...ok1, email: 'r' + i + '@y.fr' }, 'ip-limite');
  eq(dernier.success === false && /Trop/.test(dernier.error), 'limite 5 envois / heure / IP');

  console.log(`inscription-beta : ${ok} ok, ${ko} ko`);
  if (ko) process.exit(1);
})();
