/* =============================================================================
 * RÉGLAGES v3 — UI (front). Charge les VRAIS blocs de js/app.js
 * (__EMAIL_ATHLETE_*, __REGLAGES_V3_*, __REGLAGES_V3_COACH_*) avec document/
 * fetch/localStorage stubs. Vérifie payloads + validations + prefill.
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let ok = 0, ko = 0;
function eq(cond, label) { if (cond) { ok++; } else { ko++; console.error('  ✗ ' + label); } }
const tick = () => new Promise(r => setTimeout(r, 0));

const APP = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
function grab(tag) { return '/*' + APP.split('/* __' + tag + '_START__')[1].split('__' + tag + '_END__ */')[0] + '*/'; }
const CODE = [grab('EMAIL_ATHLETE'), grab('REGLAGES_V3'), grab('REGLAGES_V3_COACH')].join('\n')
  + '\n;this.__fns = { enregistrerProfil, prefillProfilReglages, _ddnVersISO, enregistrerProfilCoach, changerMotDePasseCoach, enregistrerClubCoach, prefillCoachReglages };';

function ctx({ athlete, coach, fetchImpl } = {}) {
  const els = {}; const el = (id) => (els[id] || (els[id] = { id, value: '', textContent: '', style: {} }));
  const toasts = []; const storage = {};
  const sandbox = {
    athlete: athlete === undefined ? { athlete_id: 'A1' } : athlete,
    coach: coach === undefined ? { coach_id: 'CA' } : coach,
    SCRIPT_URL: 'https://backend/x', showToast: (t) => toasts.push(t),
    document: { getElementById: el, querySelectorAll: () => [] },
    localStorage: { setItem: (k, v) => { storage[k] = v; }, getItem: (k) => storage[k] },
    fetch: fetchImpl || (async () => ({ json: async () => ({ success: true }) })), console,
  };
  sandbox.globalThis = sandbox; vm.createContext(sandbox); vm.runInContext(CODE, sandbox);
  return { fns: sandbox.__fns, el, toasts, storage, sandbox };
}

(async () => {
  /* --- ddn FR -> ISO --- */
  {
    const { fns } = ctx();
    eq(fns._ddnVersISO('12/03/2001') === '2001-03-12', 'ddn FR -> ISO');
    eq(fns._ddnVersISO('2001-03-12') === '2001-03-12', 'ddn ISO conservé');
    eq(fns._ddnVersISO('') === '', 'ddn vide -> vide');
  }

  /* --- enregistrerProfil (athlète) --- */
  {
    let cap = null;
    const c = ctx({ athlete: { athlete_id: 'A9', nom: 'X' }, fetchImpl: async (u, i) => { cap = JSON.parse(i.body); return { json: async () => ({ success: true }) }; } });
    c.el('prof-prenom').value = 'Léa'; c.el('prof-taille').value = '170'; c.el('prof-poids').value = '62'; c.el('prof-annees').value = '5'; c.el('prof-ddn').value = '2001-03-12';
    await c.fns.enregistrerProfil(); await tick();
    eq(cap.action === 'saveProfil' && cap.athlete_id === 'A9', 'profil: action + athlete_id');
    eq(cap.nom === 'Léa' && cap.taille === '170' && cap.poids === '62' && cap.annees === '5' && cap.ddn === '2001-03-12', 'profil: champs transmis');
    eq(c.sandbox.athlete.nom === 'Léa' && c.sandbox.athlete.poids === 62, 'profil: session mise à jour');
    eq(/enregistré/i.test(c.el('prof-msg').textContent), 'profil: message succès');
  }

  /* --- prefillProfilReglages --- */
  {
    const c = ctx({ athlete: { athlete_id: 'A1', nom: 'Bob', taille: 180, poids: 75, annees_pratique: 6, ddn: '05/06/1990' } });
    c.fns.prefillProfilReglages();
    eq(c.el('prof-prenom').value === 'Bob' && String(c.el('prof-taille').value) === '180', 'prefill profil: nom/taille');
    eq(c.el('prof-ddn').value === '1990-06-05', 'prefill profil: ddn ISO');
  }

  /* --- enregistrerProfilCoach --- */
  {
    let cap = null;
    const c = ctx({ coach: { coach_id: 'C9', nom: 'M' }, fetchImpl: async (u, i) => { cap = JSON.parse(i.body); return { json: async () => ({ success: true }) }; } });
    c.el('coach-prof-nom').value = 'Coach Martin'; c.el('coach-prof-email').value = 'm@club.fr';
    await c.fns.enregistrerProfilCoach(); await tick();
    eq(cap.action === 'saveCoachProfil' && cap.coach_id === 'C9', 'coach profil: action + coach_id');
    eq(cap.nom === 'Coach Martin' && cap.email === 'm@club.fr', 'coach profil: nom+email');
    eq(c.sandbox.coach.email === 'm@club.fr', 'coach profil: session màj');
    eq(!!c.storage['muscu_coach'], 'coach profil: localStorage màj');
  }
  { // email invalide bloque
    let appele = false;
    const c = ctx({ coach: { coach_id: 'C9' }, fetchImpl: async () => { appele = true; return { json: async () => ({ success: true }) }; } });
    c.el('coach-prof-email').value = 'pasunmail';
    await c.fns.enregistrerProfilCoach(); await tick();
    eq(appele === false, 'coach profil: email invalide -> aucun appel');
  }

  /* --- changerMotDePasseCoach --- */
  {
    let cap = null;
    const c = ctx({ coach: { coach_id: 'C9' }, fetchImpl: async (u, i) => { cap = JSON.parse(i.body); return { json: async () => ({ success: true }) }; } });
    c.el('cpwd-actuel').value = 'vieux1'; c.el('cpwd-nouveau').value = 'neuf12';
    await c.fns.changerMotDePasseCoach(); await tick();
    eq(cap.action === 'changePasswordCoach' && cap.coach_id === 'C9', 'coach mdp: action + coach_id');
    eq(cap.ancien_mdp === 'vieux1' && cap.nouveau_mdp === 'neuf12', 'coach mdp: ancien+nouveau');
  }
  { // validations
    let appele = false;
    const c = ctx({ coach: { coach_id: 'C9' }, fetchImpl: async () => { appele = true; return { json: async () => ({ success: true }) }; } });
    c.el('cpwd-actuel').value = 'aaaaaa'; c.el('cpwd-nouveau').value = 'abc';
    await c.fns.changerMotDePasseCoach(); await tick();
    eq(appele === false, 'coach mdp: trop court -> aucun appel');
    c.el('cpwd-nouveau').value = 'aaaaaa';
    await c.fns.changerMotDePasseCoach(); await tick();
    eq(appele === false, 'coach mdp: identique -> aucun appel');
  }

  /* --- enregistrerClubCoach --- */
  {
    let cap = null;
    const c = ctx({ coach: { coach_id: 'C9' }, fetchImpl: async (u, i) => { cap = JSON.parse(i.body); return { json: async () => ({ success: true }) }; } });
    c.el('coach-club').value = 'AS Novalyz'; c.el('coach-cat').value = 'U17';
    await c.fns.enregistrerClubCoach(); await tick();
    eq(cap.action === 'saveClubCoach' && cap.club === 'AS Novalyz' && cap.categorie_defaut === 'U17', 'club: action + club + catégorie');
    eq(c.sandbox.coach.club === 'AS Novalyz', 'club: session màj');
  }

  /* --- prefillCoachReglages --- */
  {
    const c = ctx({ coach: { coach_id: 'C9', nom: 'M', email: 'm@c.fr', club: 'AS', categorie_defaut: 'U15' } });
    c.fns.prefillCoachReglages();
    eq(c.el('coach-prof-nom').value === 'M' && c.el('coach-prof-email').value === 'm@c.fr', 'prefill coach: nom/email');
    eq(c.el('coach-club').value === 'AS' && c.el('coach-cat').value === 'U15', 'prefill coach: club/catégorie');
  }

  console.log(`settings-ui.test.js : ${ok} OK / ${ko} KO`);
  if (ko) process.exit(1);
})();
