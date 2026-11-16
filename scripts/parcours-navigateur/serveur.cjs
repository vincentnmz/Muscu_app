// Parcours navigateur (16/11, audit P2) — le VRAI serveur (index.ts) sur une base en mémoire, sessions EXIGÉES
// (AUTH_ENFORCE=1), branché sur la vraie app servie en local. Aucune donnée réelle, aucun appel réseau sortant.
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const ROOT = path.join(__dirname, '..', '..');
const T = fs.readFileSync(path.join(ROOT, 'tests', 'e2e-parcours.test.js'), 'utf8');
const makeEngine = new Function(T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend')) + '\nreturn makeEngine;')();
function serveur(store) {
  const client = makeEngine(store);
  client.storage = { from: () => ({ createSignedUrls: async () => ({ data: [] }), upload: async () => ({ error: null }) }) };
  client.rpc = (name) => ({ then: (r) => r({ data: null, error: { code: 'PGRST202', message: 'absent' } }) });
  const env = { PEPPER: 'pepper-de-test', AUTH_ENFORCE: '1' };
  let handler = null;
  let js = stripTypeScriptTypes(fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
  js = js.split('\n').filter((l) => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { hashSalted };';
  const sb = { createClient: () => client, webpush: { setVapidDetails() {}, sendNotification: async () => {} },
    Deno: { env: { get: (k) => env[k] }, serve: (fn) => { handler = fn; } },
    Response, Request, URL, URLSearchParams, TextEncoder, TextDecoder, crypto, atob, btoa, setTimeout, clearTimeout,
    fetch: async () => ({ ok: false, status: 503, json: async () => ({}) }), console: { log() {}, warn() {}, error() {}, info() {} } };
  vm.createContext(sb); vm.runInContext(js, sb);
  return { handler, hashSalted: sb.__api.hashSalted };
}
module.exports = { serveur, ROOT };
