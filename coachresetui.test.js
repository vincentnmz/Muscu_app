/* =============================================================================
 * RESET MOT DE PASSE — ÉTAPE 2 — UI coach (front).
 * Charge le VRAI bloc de js/app.js (entre marqueurs __RESET_MDP_*) dans un
 * sandbox vm avec document/fetch/crypto/navigator stubs, et teste : génération,
 * validation, payload backend correct (action/coach_id/athlete_id/nouveau_mdp),
 * succès, erreur, et garanties de sécurité (jamais de hash, coach_id venant de
 * la session, jamais d'ancien mdp). Pas de repro de la logique.
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { webcrypto } = require('crypto');

let ok = 0, ko = 0;
function eq(cond, label) { if (cond) { ok++; } else { ko++; console.error('  ✗ ' + label); } }
const tick = () => new Promise(r => setTimeout(r, 0));

const APP = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const bloc = APP.split('/* __RESET_MDP_START__')[1].split('__RESET_MDP_END__ */')[0];
const CODE = '/*' + bloc + '*/\n;this.__fns = { ouvrirResetMdp, fermerResetMdp, genererMdpCoach, _resetMdpValide, toggleResetMdpVisibility, copierResetMdp, confirmerResetMdp };';

// Construit un contexte avec DOM stub + globals injectables.
function ctx({ coach, fetchImpl } = {}) {
  const els = {};
  const el = (id) => (els[id] || (els[id] = { id, value: '', type: '', textContent: '', disabled: false, style: {} }));
  const toasts = [];
  const sandbox = {
    coach: coach === undefined ? { coach_id: 'CA' } : coach,
    SCRIPT_URL: 'https://backend/x',
    showToast: (t) => toasts.push(t),
    document: { getElementById: el },
    navigator: { clipboard: { writeText: async () => {} } },
    crypto: webcrypto,
    fetch: fetchImpl || (async () => ({ json: async () => ({ success: true }) })),
    console,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(CODE, sandbox);
  return { fns: sandbox.__fns, el, els, toasts };
}

(async () => {
  /* --- 1. Génération : longueur, charset lisible, aléatoire --------------- */
  {
    const { fns, el } = ctx();
    // Même charset non ambigu que le générateur (sans 0/1/i/l/o/I/L/O).
    const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const p = fns.genererMdpCoach();
    eq(typeof p === 'string' && p.length === 8, 'génère 8 caractères');
    eq([...p].every(c => CHARSET.includes(c)), 'charset lisible (pas de 0/1/i/l/o/I/L/O)');
    eq(fns._resetMdpValide(p), 'mdp généré valide (>=6)');
    eq(el('reset-mdp-input').value === p, 'mdp généré rempli dans le champ');
    const p2 = fns.genererMdpCoach();
    eq(p !== p2, 'deux générations diffèrent (aléatoire)');
  }

  /* --- 2. Validation ----------------------------------------------------- */
  {
    const { fns } = ctx();
    eq(fns._resetMdpValide('') === false, 'vide → invalide');
    eq(fns._resetMdpValide('abc') === false, 'trop court (3) → invalide');
    eq(fns._resetMdpValide('abcde') === false, 'trop court (5) → invalide');
    eq(fns._resetMdpValide('abcdef') === true, '6 caractères → valide');
  }

  /* --- 3. Payload backend correct (succès) ------------------------------- */
  {
    let captured = null;
    const fetchImpl = async (url, init) => { captured = { url, body: JSON.parse(init.body) }; return { json: async () => ({ success: true }) }; };
    const { fns, el } = ctx({ coach: { coach_id: 'COACH-9' }, fetchImpl });
    fns.ouvrirResetMdp('ATH-42', 'Alice');
    el('reset-mdp-input').value = 'motdepasse1';
    await fns.confirmerResetMdp(); await tick();
    eq(captured && captured.url === 'https://backend/x', 'appel vers SCRIPT_URL');
    eq(captured.body.action === 'coachResetAthlete', "action === 'coachResetAthlete'");
    eq(captured.body.coach_id === 'COACH-9', 'coach_id vient de la SESSION');
    eq(captured.body.athlete_id === 'ATH-42', 'athlete_id vient du CONTEXTE');
    eq(captured.body.nouveau_mdp === 'motdepasse1', 'nouveau_mdp transmis');
    eq(!('ancien_mdp' in captured.body) && !('old' in captured.body) && !('password_hash' in captured.body), 'aucun ancien mdp / hash envoyé');
  }

  /* --- 4. Succès : message + mot de passe affiché, pas de hash ------------ */
  {
    const { fns, el } = ctx({ coach: { coach_id: 'CA' } });
    fns.ouvrirResetMdp('A1', 'Bob');
    el('reset-mdp-input').value = 'nouveau12';
    await fns.confirmerResetMdp(); await tick();
    const msg = el('reset-mdp-msg').textContent;
    eq(/réinitialisé/i.test(msg), 'succès: message de confirmation');
    eq(msg.includes('nouveau12'), 'succès: nouveau mot de passe affiché');
    eq(!/hash/i.test(msg), 'succès: aucun hash affiché');
    eq(el('reset-mdp-input').type === 'text', 'succès: mdp rendu visible pour lecture');
    eq(el('reset-mdp-confirm').textContent === 'Terminé', 'succès: bouton passe à Terminé');
  }

  /* --- 5. Erreur backend → message utilisateur --------------------------- */
  {
    const fetchImpl = async () => ({ json: async () => ({ success: false, error: 'Accès refusé' }) });
    const { fns, el } = ctx({ coach: { coach_id: 'CB' }, fetchImpl });
    fns.ouvrirResetMdp('A1', 'Bob');
    el('reset-mdp-input').value = 'nouveau12';
    await fns.confirmerResetMdp(); await tick();
    const msg = el('reset-mdp-msg').textContent;
    eq(/Accès refusé/.test(msg), 'erreur: message backend affiché');
    eq(el('reset-mdp-confirm').disabled === false, 'erreur: bouton réactivé');
  }

  /* --- 6. Validation front bloque l'appel (trop court) ------------------- */
  {
    let appele = false;
    const fetchImpl = async () => { appele = true; return { json: async () => ({ success: true }) }; };
    const { fns, el } = ctx({ fetchImpl });
    fns.ouvrirResetMdp('A1', 'Bob');
    el('reset-mdp-input').value = 'abc';
    await fns.confirmerResetMdp(); await tick();
    eq(appele === false, 'mdp trop court: AUCUN appel backend');
    eq(/6 caractères/.test(el('reset-mdp-msg').textContent), 'mdp trop court: message longueur');
  }

  /* --- 7. Sécurité : coach_id jamais demandé à l'utilisateur ------------- */
  {
    // Aucun input coach_id n'est lu : le payload doit provenir de `coach` (session).
    let captured = null;
    const fetchImpl = async (u, init) => { captured = JSON.parse(init.body); return { json: async () => ({ success: true }) }; };
    const { fns, el } = ctx({ coach: { coach_id: 'SESSION-COACH' }, fetchImpl });
    fns.ouvrirResetMdp('A1', 'Bob');
    el('reset-mdp-input').value = 'abcdef1';
    // On ne renseigne AUCUN champ coach_id dans le DOM.
    await fns.confirmerResetMdp(); await tick();
    eq(captured.coach_id === 'SESSION-COACH', 'coach_id provient de la session, pas d\'un champ saisi');
  }

  /* --- 8. Garde-fous d'ouverture ---------------------------------------- */
  {
    const { fns, el, toasts } = ctx({ coach: null });
    fns.ouvrirResetMdp('A1', 'Bob');
    eq(el('reset-mdp-overlay').style.display !== 'flex', 'sans coach: modale non ouverte');
    eq(toasts.some(t => /coach/i.test(t)), 'sans coach: toast d\'avertissement');
  }
  {
    const { fns, el, toasts } = ctx({ coach: { coach_id: 'CA' } });
    fns.ouvrirResetMdp(null, 'Bob');
    eq(el('reset-mdp-overlay').style.display !== 'flex', 'sans athlète: modale non ouverte');
    eq(toasts.some(t => /athlète/i.test(t)), 'sans athlète: toast d\'avertissement');
  }

  console.log(`coach-reset-ui.test.js : ${ok} OK / ${ko} KO`);
  if (ko) process.exit(1);
})();
