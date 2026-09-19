/* =============================================================================
 * EXPORT RGPD — backend (exportAthlete / exportEquipe) + front (_toCSV,
 * exporterMesDonnees / exporterEquipe). Exécute les VRAIS handlers + le VRAI
 * bloc front (Blob/URL/anchor stubs). Vérifie : collecte des tables, hash
 * JAMAIS exporté, format JSON/CSV, nom de fichier.
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');

let ok = 0, ko = 0;
function eq(cond, label) { if (cond) { ok++; } else { ko++; console.error('  ✗ ' + label); } }
const tick = () => new Promise(r => setTimeout(r, 0));

/* ---------- Backend ---------- */
function makeEngine(store) {
  function q(table) {
    const filters = []; let single = false;
    const base = () => (store[table] || (store[table] = []));
    const matches = (r) => filters.every(f => f(r));
    const self = {
      from(t) { return q(t); }, select() { return self; },
      update() { return self; }, insert() { return self; }, delete() { return self; },
      eq(c, v) { filters.push(r => String(r[c]) === String(v)); return self; },
      single() { single = true; return self; }, maybeSingle() { single = true; return self; },
      then(res) { const rows = base().filter(matches); res(single ? { data: rows[0] || null, error: null } : { data: rows, error: null }); },
    };
    return self;
  }
  return { from: q };
}
function loadBackend(store) {
  let js = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
  js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n');
  js += '\n;this.__api = { handleExportAthlete, handleExportEquipe };';
  const sandbox = {
    createClient: () => makeEngine(store),
    webpush: { setVapidDetails() {}, sendNotification: async () => {} },
    Deno: { env: { get: () => 'x' }, serve: () => {} },
    Response, Request, URLSearchParams, TextEncoder, TextDecoder, console, atob, btoa, setTimeout, clearTimeout,
    crypto: require('crypto').webcrypto, fetch: async () => ({ ok: false, json: async () => ({}) }),
  };
  vm.createContext(sandbox); vm.runInContext(js, sandbox); return sandbox.__api;
}
const J = async (r) => await r.json();

/* ---------- Front ---------- */
const APP = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const BLOCK = '/*' + APP.split('/* __EXPORT_RGPD_START__')[1].split('__EXPORT_RGPD_END__ */')[0] + '*/'
  + '\n;this.__fns = { _toCSV, exporterMesDonnees, exporterEquipe };';
function ctxFront({ athlete, coach, fetchImpl } = {}) {
  const els = {}; const el = (id) => (els[id] || (els[id] = { id, value: '', textContent: '', style: {} }));
  const downloads = [];
  function Blob(parts, opts) { this.parts = parts; this.type = opts && opts.type; }
  const anchor = { href: '', download: '', click() { downloads.push({ download: this.download, href: this.href, content: this._content }); }, remove() {} };
  const sandbox = {
    athlete: athlete === undefined ? { athlete_id: 'A1' } : athlete,
    coach: coach === undefined ? { coach_id: 'CA' } : coach,
    SCRIPT_URL: 'https://backend/x', showToast() {},
    document: { getElementById: el, createElement: () => anchor, body: { appendChild(a) { /* capture le contenu du dernier Blob créé */ a._content = sandbox.__lastBlob; } } },
    Blob: function (p, o) { sandbox.__lastBlob = (p && p[0]) || ''; return new Blob(p, o); },
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
    fetch: fetchImpl, setTimeout: (f) => f(), clearTimeout() {}, console,
  };
  sandbox.globalThis = sandbox; vm.createContext(sandbox); vm.runInContext(BLOCK, sandbox);
  return { fns: sandbox.__fns, downloads };
}

(async () => {
  /* ===== BACKEND ===== */
  {
    const store = {
      athletes: [{ id: 'A1', login: '1234', nom: 'Léa', coach_id: 'CA', password_hash: 'SECRET_HASH' }],
      performances: [{ athlete_id: 'A1', exercice: 'Squat', charge: 80 }, { athlete_id: 'ZZ', exercice: 'x' }],
      bien_etre: [{ athlete_id: 'A1', sommeil: 4 }],
      blessures: [{ athlete_id: 'A1', type: 'entorse' }],
    };
    const api = loadBackend(store);
    const r = await J(await api.handleExportAthlete({ athlete_id: 'A1' }));
    eq(r.success === true, 'exportAthlete: success');
    eq(r.data.profil && r.data.profil.nom === 'Léa', 'exportAthlete: profil inclus');
    eq(!('password_hash' in r.data.profil), 'exportAthlete: password_hash JAMAIS exporté');
    eq(Array.isArray(r.data.performances) && r.data.performances.length === 1, 'exportAthlete: seulement les perfs de A1');
    eq(r.data.bien_etre.length === 1 && r.data.blessures.length === 1, 'exportAthlete: bien_etre + blessures inclus');
    eq(r.data.type === 'athlete' && r.data.athlete_id === 'A1', 'exportAthlete: métadonnées');
  }
  { // athlète inexistant
    const api = loadBackend({ athletes: [] });
    const r = await J(await api.handleExportAthlete({ athlete_id: 'NOPE' }));
    eq(r.success === false, 'exportAthlete: inexistant → refus');
  }
  { // équipe
    const store = {
      athletes: [{ id: 'A1', nom: 'Léa', coach_id: 'CA', password_hash: 'H1' }, { id: 'A2', nom: 'Bob', coach_id: 'CA', password_hash: 'H2' }, { id: 'A3', nom: 'X', coach_id: 'AUTRE', password_hash: 'H3' }],
      performances: [{ athlete_id: 'A1', charge: 80 }, { athlete_id: 'A2', charge: 60 }],
    };
    const api = loadBackend(store);
    const r = await J(await api.handleExportEquipe({ coach_id: 'CA' }));
    eq(r.success === true && r.data.athletes.length === 2, 'exportEquipe: 2 athlètes du coach (pas A3)');
    eq(!('password_hash' in r.data.athletes[0].profil), 'exportEquipe: pas de hash');
    eq(r.data.athletes[0].performances.length === 1, 'exportEquipe: perfs par athlète');
  }

  /* ===== FRONT ===== */
  {
    const { fns } = ctxFront();
    eq(fns._toCSV([{ a: 1, b: 'x' }, { a: 2, b: 'y,z' }]) === 'a,b\n1,x\n2,"y,z"', '_toCSV: entêtes + échappement virgule');
    eq(fns._toCSV([]) === '', '_toCSV: vide → chaîne vide');
  }
  { // export athlète JSON
    let cap = null;
    const c = ctxFront({ athlete: { athlete_id: 'A9' }, fetchImpl: async (u, i) => { cap = JSON.parse(i.body); return { json: async () => ({ success: true, data: { performances: [{ exercice: 'Squat', charge: 80 }], profil: { nom: 'X' } } }) }; } });
    await c.fns.exporterMesDonnees('json'); await tick();
    eq(cap.action === 'exportAthlete' && cap.athlete_id === 'A9', 'front: action exportAthlete + athlete_id');
    eq(c.downloads.length === 1 && /\.json$/.test(c.downloads[0].download), 'front: téléchargement JSON');
    eq(/"nom": "X"/.test(c.downloads[0].content), 'front: contenu JSON complet');
  }
  { // export athlète CSV = performances
    const c = ctxFront({ athlete: { athlete_id: 'A9' }, fetchImpl: async () => ({ json: async () => ({ success: true, data: { performances: [{ exercice: 'Squat', charge: 80 }] } }) }) });
    await c.fns.exporterMesDonnees('csv'); await tick();
    eq(/\.csv$/.test(c.downloads[0].download), 'front: téléchargement CSV');
    eq(/exercice,charge/.test(c.downloads[0].content) && /Squat,80/.test(c.downloads[0].content), 'front: CSV séances');
  }
  { // export équipe CSV aplatit avec athlete_id
    const c = ctxFront({ coach: { coach_id: 'CA' }, fetchImpl: async (u, i) => { return { json: async () => ({ success: true, data: { athletes: [{ athlete_id: 'A1', performances: [{ exercice: 'Squat', charge: 80 }] }, { athlete_id: 'A2', performances: [{ exercice: 'Bench', charge: 60 }] }] } }) }; } });
    await c.fns.exporterEquipe('csv'); await tick();
    eq(/athlete_id,exercice,charge/.test(c.downloads[0].content), 'front équipe CSV: colonne athlete_id ajoutée');
    eq(/A1,Squat,80/.test(c.downloads[0].content) && /A2,Bench,60/.test(c.downloads[0].content), 'front équipe CSV: lignes des 2 athlètes');
  }
  { // échec backend → message, aucun téléchargement
    const c = ctxFront({ athlete: { athlete_id: 'A9' }, fetchImpl: async () => ({ json: async () => ({ success: false, error: 'boom' }) }) });
    await c.fns.exporterMesDonnees('json'); await tick();
    eq(c.downloads.length === 0, 'front: échec backend → aucun téléchargement');
  }

  console.log(`export-rgpd.test.js : ${ok} OK / ${ko} KO`);
  if (ko) process.exit(1);
})();
