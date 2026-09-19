/* =============================================================================
 * RESET PAR EMAIL — P1 — UI email athlète (front).
 * Charge le VRAI bloc __EMAIL_ATHLETE_* de js/app.js dans un sandbox vm avec
 * document/fetch/localStorage stubs. Teste : validation, payload saveEmail,
 * succès (maj athlete + localStorage), effacement, invalide bloqué, prefill.
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let ok = 0, ko = 0;
function eq(cond, label) { if (cond) { ok++; } else { ko++; console.error('  ✗ ' + label); } }
const tick = () => new Promise(r => setTimeout(r, 0));

const APP = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const bloc = APP.split('/* __EMAIL_ATHLETE_START__')[1].split('__EMAIL_ATHLETE_END__ */')[0];
const CODE = '/*' + bloc + '*/\n;this.__fns = { emailValideFront, enregistrerEmailAthlete, prefillEmailReglages };';

function ctx({ athlete, fetchImpl } = {}) {
  const els = {};
  const el = (id) => (els[id] || (els[id] = { id, value: '', textContent: '', style: {} }));
  const toasts = [];
  const storage = {};
  const sandbox = {
    athlete: athlete === undefined ? { athlete_id: 'A1', email: '' } : athlete,
    SCRIPT_URL: 'https://backend/x',
    showToast: (t) => toasts.push(t),
    document: { getElementById: el },
    localStorage: { setItem: (k, v) => { storage[k] = v; }, getItem: (k) => storage[k] },
    fetch: fetchImpl || (async () => ({ json: async () => ({ success: true }) })),
    console,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(CODE, sandbox);
  return { fns: sandbox.__fns, el, toasts, storage, sandbox };
}

(async () => {
  /* --- 1. emailValideFront ---------------------------------------------- */
  {
    const { fns } = ctx();
    eq(fns.emailValideFront('a@b.co') === true, 'valide a@b.co');
    eq(fns.emailValideFront('x@y') === false, 'invalide x@y');
    eq(fns.emailValideFront('') === false, 'invalide vide');
  }

  /* --- 2. enregistrer : payload + succès + maj athlete/localStorage ------ */
  {
    let captured = null;
    const fetchImpl = async (u, init) => { captured = { u, body: JSON.parse(init.body) }; return { json: async () => ({ success: true }) }; };
    const c = ctx({ athlete: { athlete_id: 'ATH-7', email: '' }, fetchImpl });
    c.el('reglages-email').value = 'moi@mail.com';
    await c.fns.enregistrerEmailAthlete(); await tick();
    eq(captured.u === 'https://backend/x', 'appel SCRIPT_URL');
    eq(captured.body.action === 'saveEmail', "action saveEmail");
    eq(captured.body.athlete_id === 'ATH-7', 'athlete_id de la session');
    eq(captured.body.email === 'moi@mail.com', 'email transmis');
    eq(c.sandbox.athlete.email === 'moi@mail.com', 'athlete.email mis à jour');
    eq(c.storage['muscu_athlete'] && JSON.parse(c.storage['muscu_athlete']).email === 'moi@mail.com', 'localStorage mis à jour');
    eq(/enregistré/i.test(c.el('reglages-email-msg').textContent), 'message succès');
  }

  /* --- 3. email vide → effacement -------------------------------------- */
  {
    let captured = null;
    const fetchImpl = async (u, init) => { captured = JSON.parse(init.body); return { json: async () => ({ success: true }) }; };
    const c = ctx({ athlete: { athlete_id: 'A1', email: 'ancien@mail.com' }, fetchImpl });
    c.el('reglages-email').value = '';
    await c.fns.enregistrerEmailAthlete(); await tick();
    eq(captured.email === '', 'email vide envoyé');
    eq(c.sandbox.athlete.email === '', 'athlete.email vidé');
    eq(/retiré/i.test(c.el('reglages-email-msg').textContent), 'message retiré');
  }

  /* --- 4. email invalide → aucun appel --------------------------------- */
  {
    let appele = false;
    const fetchImpl = async () => { appele = true; return { json: async () => ({ success: true }) }; };
    const c = ctx({ fetchImpl });
    c.el('reglages-email').value = 'pasunmail';
    await c.fns.enregistrerEmailAthlete(); await tick();
    eq(appele === false, 'invalide: aucun appel backend');
    eq(/invalide/i.test(c.el('reglages-email-msg').textContent), 'invalide: message');
  }

  /* --- 5. non connecté → garde-fou ------------------------------------- */
  {
    let appele = false;
    const fetchImpl = async () => { appele = true; return { json: async () => ({ success: true }) }; };
    const c = ctx({ athlete: null, fetchImpl });
    c.el('reglages-email').value = 'a@b.co';
    await c.fns.enregistrerEmailAthlete(); await tick();
    eq(appele === false, 'sans athlète: aucun appel');
    eq(c.toasts.some(t => /connecte/i.test(t)), 'sans athlète: toast');
  }

  /* --- 6. prefill ------------------------------------------------------- */
  {
    const c = ctx({ athlete: { athlete_id: 'A1', email: 'pre@mail.com' } });
    c.fns.prefillEmailReglages();
    eq(c.el('reglages-email').value === 'pre@mail.com', 'prefill: champ pré-rempli');
  }

  console.log(`email-athlete-ui.test.js : ${ok} OK / ${ko} KO`);
  if (ko) process.exit(1);
})();
