// Banc de profils — exécute le VRAI handleGetAppData (index.ts) sur une base en mémoire, à une date FIGÉE.
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const ROOT = path.join(__dirname, '..', '..');
const T = fs.readFileSync(path.join(ROOT, 'tests', 'e2e-parcours.test.js'), 'utf8');
const makeEngine = new Function(T.slice(T.indexOf('function makeEngine'), T.indexOf('// ── Chargement du VRAI backend')) + '\nreturn makeEngine;')();
function dateFigee(nowMs) {
  const D0 = Date;
  function FakeDate(...a) { if (!(this instanceof FakeDate)) return new D0(nowMs).toString(); return a.length ? new D0(...a) : new D0(nowMs); }
  FakeDate.prototype = D0.prototype; FakeDate.now = () => nowMs; FakeDate.UTC = D0.UTC; FakeDate.parse = D0.parse;
  return FakeDate;
}
function charger(store, nowMs) {
  const client = makeEngine(store);
  client.storage = { from: () => ({ createSignedUrls: async () => ({ data: [] }) }) };
  let js = stripTypeScriptTypes(fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
  js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { handleGetAppData, handleGetCoachAthletes };';
  const sb = { createClient: () => client, webpush: { setVapidDetails() {}, sendNotification: async () => {} }, Deno: { env: { get: () => undefined }, serve: () => {} },
    Response, Request, URLSearchParams, TextEncoder, TextDecoder, crypto, console: { log() {}, warn() {}, error() {}, info() {} }, setTimeout, clearTimeout,
    fetch: async () => ({ ok: false, json: async () => ({}) }), Date: dateFigee(nowMs) };
  vm.createContext(sb); vm.runInContext(js, sb);
  return sb.__api;
}
// Équipe : liste du coach (getCoachAthletes) + getAppData de chaque athlète, sur la même base.
async function equipeData(store, coachId, athleteIds, nowMs) {
  const api = charger(store, nowMs);
  const liste = await (await api.handleGetCoachAthletes(new URLSearchParams({ coach_id: coachId }))).json();
  const fiches = {};
  for (const id of athleteIds) fiches[id] = await (await api.handleGetAppData(new URLSearchParams({ athlete_id: id }))).json();
  return { liste, fiches };
}
async function getAppData(store, athleteId, nowMs) {
  const client = makeEngine(store);
  client.storage = { from: () => ({ createSignedUrls: async () => ({ data: [] }) }) };
  let js = stripTypeScriptTypes(fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
  js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { handleGetAppData };';
  const sb = { createClient: () => client, webpush: { setVapidDetails() {}, sendNotification: async () => {} }, Deno: { env: { get: () => undefined }, serve: () => {} },
    Response, Request, URLSearchParams, TextEncoder, TextDecoder, crypto, console: { log() {}, warn() {}, error() {}, info() {} }, setTimeout, clearTimeout,
    fetch: async () => ({ ok: false, json: async () => ({}) }), Date: dateFigee(nowMs) };
  vm.createContext(sb); vm.runInContext(js, sb);
  return await (await sb.__api.handleGetAppData(new URLSearchParams({ athlete_id: athleteId }))).json();
}
module.exports = { getAppData, equipeData };
