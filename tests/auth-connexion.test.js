/* =============================================================================
 * Audit connexion (02/11/2026) — vrais handlers, base en mémoire, Resend simulé.
 * C3 reset sans casse + multi-comptes · C4 reset coach · C5 limite d'essais ·
 * C6 6 caractères côté serveur · C7 espaces · C8 sessions révoquées ·
 * C9 mail de bienvenue (login, jamais le mot de passe) + confirmation d'adresse · C10 en-tête.
 * ========================================================================== */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const { webcrypto } = require('crypto');
let ok = 0, ko = 0;
const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g).slice(0, 300) + ')' : '')); } };
const T = fs.readFileSync(path.join(__dirname, 'password-reset-request.test.js'), 'utf8');
eval(T.slice(T.indexOf('function makeEngine'), T.indexOf('const KEY')));
function load(store, mails) {
  let js = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
  js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { handleLogin, handleLoginCoach, handleRegister, handleRegisterCoach, handleChangePassword, handleRequestPasswordReset, handleResetPassword, handleConfirmerEmail, handleSaveEmail, hashSalted, authCheck, signSession };';
  const env = { RESEND_API_KEY: 'k', PEPPER: 'pep' };
  const sb = { createClient: () => makeEngine(store), webpush: { setVapidDetails() {}, sendNotification: async () => {} }, Deno: { env: { get: k => env[k] }, serve: () => {} },
    Response, Request, URLSearchParams, TextEncoder, TextDecoder, crypto: webcrypto, console: { log() {}, error() {}, warn() {} }, atob, btoa, setTimeout, clearTimeout, Intl,
    fetch: async (u, init) => { mails.push(JSON.parse(init.body)); return { ok: true, status: 200, json: async () => ({}) }; } };
  vm.createContext(sb); vm.runInContext(js, sb); return sb.__api;
}
const J = async r => (await r).json(), P = o => new URLSearchParams(o);
const lien = (html, p) => { const m = html.match(new RegExp('[?&]' + p + '=([^"&]+)')); return m ? decodeURIComponent(m[1]) : null; };
(async () => {
  const mails = [], store = { athletes: [], coachs: [], login_echecs: [], password_reset_tokens: [], objectif: [] };
  const A = load(store, mails);
  store.athletes.push({ id: '1', login: '1234', nom: 'Léa Test', password_hash: await A.hashSalted('secret1', '1234'), email: 'Lea@Mail.com' });
  store.coachs.push({ coach_id: '7', login: 'coachx', nom: 'Coach X', password_hash: await A.hashSalted('coachpw', 'coachx'), email: 'lea@mail.com' });

  // C5 — 5 échecs → bloqué, même avec le bon mot de passe ; un autre login n'est pas touché.
  for (let i = 0; i < 5; i++) await J(A.handleLogin(P({ login: '1234', password: 'faux' + i })));
  const b = await J(A.handleLogin(P({ login: '1234', password: 'secret1' })));
  eq(!b.success && b.bloque && /Réessaie dans 1[45] min/.test(b.error), 'C5 : 6e essai bloqué (même bon mot de passe)', b);
  for (let i = 0; i < 5; i++) await J(A.handleLoginCoach(P({ login: 'inconnu', password: 'x' })));
  eq((await J(A.handleLoginCoach(P({ login: 'inconnu', password: 'x' })))).bloque === true, 'C5 : login inexistant compté aussi (pas d\'énumération)');
  eq((await J(A.handleLoginCoach(P({ login: 'coachx', password: 'coachpw' })))).success === true, 'C5 : un autre login reste libre');
  store.login_echecs.forEach(r => { r.created_at = new Date(Date.now() - 16 * 60000).toISOString(); });
  const r5 = await J(A.handleLogin(P({ login: '1234', password: 'secret1' })));
  eq(r5.success === true && !store.login_echecs.some(r => r.cle === 'a:1234'), 'C5 : après 15 min, connexion OK et échecs effacés', r5);

  // C6 — 6 caractères minimum côté serveur.
  eq(!(await J(A.handleRegister(P({ login: '5555', password: 'abc' })))).success, 'C6 : inscription athlète, mot de passe court refusé');
  eq(!(await J(A.handleRegisterCoach({ login: 'cc', password: 'abc' }))).success, 'C6 : inscription coach, mot de passe court refusé');

  // C9 — bienvenue : login, jamais le mot de passe, lien de confirmation, nouvel en-tête.
  mails.length = 0;
  const reg = await J(A.handleRegister(P({ login: '4821', password: 'MonMotDePasse9', prenom: 'Zoé', email: 'zoe@x.fr', sexe: 'H', ddn: '2000-01-01', taille: '170', poids: '70', annees: '2' })));
  const m = mails[0] || {};
  eq(reg.success && m.to && m.to[0] === 'zoe@x.fr' && /4821/.test(m.html), 'C9 : mail de bienvenue avec le login', m.subject);
  eq(!/MonMotDePasse9/.test(m.html || ''), 'C9 : le mot de passe n\'est JAMAIS dans le mail');
  eq(/mail-header\.png/.test(m.html || '') && /Confirmer mon adresse/.test(m.html || ''), 'C9/C10 : en-tête image + bouton « Confirmer mon adresse »');
  eq(/^https:\/\/vincentnmz\.github\.io\/Muscu_app\/\?confirm_email=/.test((m.html || '').match(/href="([^"]+confirm_email[^"]+)"/)?.[1] || ''), 'C2 : lien vers la prod (pas /dev/)');
  const tokC = lien(m.html || '', 'confirm_email');
  eq((await J(A.handleConfirmerEmail({ token: tokC }))).success === true && store.athletes.find(a => a.login === '4821').email_verifie === true, 'C9 : le lien confirme l\'adresse');
  eq(!(await J(A.handleConfirmerEmail({ token: tokC.slice(0, -2) + 'xx' }))).success, 'C9 : lien falsifié refusé');
  // Changement d'adresse → redevient « non confirmée », l'ancien lien ne confirme pas la nouvelle.
  const idZ = store.athletes.find(a => a.login === '4821').id; mails.length = 0;
  const se = await J(A.handleSaveEmail({ athlete_id: idZ, email: 'zoe2@x.fr' }));
  eq(se.confirmation_envoyee === true && se.email_verifie === false && mails.length === 1, 'C9 : nouvelle adresse → lien de confirmation envoyé', se);
  eq(!(await J(A.handleConfirmerEmail({ token: tokC }))).success, 'C9 : l\'ancien lien ne confirme pas la nouvelle adresse');

  // C3/C4 — reset sans casse, adresse partagée athlète + coach → un mail, un lien par compte.
  mails.length = 0;
  await J(A.handleRequestPasswordReset({ email: 'LEA@mail.COM' }));
  const h = (mails[0] || {}).html || '';
  const liens = [...h.matchAll(/reset_token=([0-9a-f]{64})/g)].map(x => x[1]);
  eq(mails.length === 1 && liens.length === 2 && /Compte athlète/.test(h) && /Compte coach/.test(h), 'C3/C4 : 1 mail, 2 liens (athlète + coach), sans casse', liens.length);
  const tCoach = (h.slice(h.indexOf('Compte coach')).match(/reset_token=([0-9a-f]{64})/) || [])[1];
  eq((await J(A.handleResetPassword({ token: tCoach, nouveau_mdp: '  nouveauCoach1  ' }))).success === true, 'C4 : reset du compte coach');
  eq((await J(A.handleLoginCoach(P({ login: 'coachx', password: 'nouveauCoach1' })))).success === true, 'C4/C7 : connexion coach avec le nouveau mot de passe (espaces retirés)');

  // C7 + C8 — changer son mot de passe : espaces traités comme à la connexion, autres appareils déconnectés.
  const vieux = await A.signSession('a', '1', Math.floor(Date.now() / 1000) - 3600);
  eq((await A.authCheck('getAppData', P({ athlete_id: '1', _t: vieux }), {})).ok === true, 'C8 : session valide avant le changement');
  const ch = await J(A.handleChangePassword({ athlete_id: '1', ancien_mdp: 'secret1', nouveau_mdp: 'nouveau9 ' }));
  eq(ch.success && typeof ch.token === 'string', 'C8 : jeton neuf renvoyé à l\'appareil qui change', ch);
  const rv = await A.authCheck('getAppData', P({ athlete_id: '1', _t: vieux }), {});
  eq(rv.ok === false && /révoquée/.test(rv.reason), 'C8 : l\'ancienne session (autre appareil) est refusée', rv);
  eq((await A.authCheck('getAppData', P({ athlete_id: '1', _t: ch.token }), {})).ok === true, 'C8 : cet appareil reste connecté');
  eq((await J(A.handleLogin(P({ login: '1234', password: 'nouveau9' })))).success === true, 'C7 : connexion avec le nouveau mot de passe (espace final retiré)');
  console.log('-'.repeat(70)); console.log('auth-connexion : ' + ok + ' OK / ' + ko + ' KO'); if (ko) process.exitCode = 1;
})();
