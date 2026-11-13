/* DROITS D'ACCÈS — TOUTES LES ROUTES (test permanent, 13/11/2026).
 * Rejoue à chaque `npm test` le banc de l'audit P2.1 (scripts/audit-droits/banc.js) sur le VRAI index.ts
 * (AUTH_ENFORCE=1, sessions signées réelles, base neuve à chaque appel). Les routes sont relues dans index.ts :
 * une route AJOUTÉE est couverte d'office. Pour chaque route on exige :
 *   1. sans jeton → 401 (sauf routes publiques volontaires, liste fermée ci-dessous) ;
 *   2. dans chaque scénario d'attaque (athlète A → B, coach hors périmètre, ID manipulé, ressource seule,
 *      athlète → route coach, coach → route athlète) : AUCUNE fuite (réponse, e-mail / push sortant, lien
 *      signé vers un fichier d'un autre) et AUCUNE modification chez l'autre (ligne, fichier) ;
 *   3. le propriétaire légitime n'est pas refusé (sinon un refus ne prouverait rien) ;
 *   4. aucune exception ni erreur 500, y compris avec un identifiant inexistant.
 * Couvre notamment les 67 routes « contrôle effectif mais sans test dédié » de docs/audit-droits-routes-2026-11-10.md. */
const { lancerBanc, extraireRoutes } = require('../scripts/audit-droits/banc.js');

// Routes publiques VOLONTAIRES (connexion / inscription, jetons à usage unique, catalogue, formulaire bêta, crons
// protégés par CRON_SECRET). En ajouter une ici doit être une décision consciente.
const PUBLIC = new Set(['ping', 'login', 'register', 'loginDispo', 'loginCoach', 'registerCoach', 'requestPasswordReset',
  'resetPassword', 'confirmerEmail', 'exercices', 'inscriptionBeta', 'cronPushAlertes', 'cronResumes', 'cronResumesAuto', 'envelopperHachages']);
// Routes réservées au serveur : publiques côté jeton de session mais refusées sans le bon secret.
const SECRET = ['cronPushAlertes', 'cronResumes', 'cronResumesAuto', 'envelopperHachages'];

let ok = 0, ko = 0;
const eq = (c, n) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n); } };

(async () => {
  const routes = extraireRoutes();
  eq(routes.length >= 121, 'extraction : au moins 121 routes lues dans index.ts (' + routes.length + ')');
  const res = await lancerBanc(routes);
  for (const x of res) {
    const sc = x.sc, nom = x.methode + ' ' + x.action;
    if (!PUBLIC.has(x.action)) {
      eq(sc.sansJeton.status === 401, nom + ' : sans jeton → 401 (obtenu ' + sc.sansJeton.status + ')');
      const p = sc.proprietaire;
      eq(p && p.status !== 401, nom + ' : propriétaire légitime accepté (obtenu ' + (p && p.status) + ')');
    }
    for (const [k, v] of Object.entries(sc)) {
      eq(v.status !== 'EXC' && v.status !== 500, nom + ' / ' + k + ' : pas d\'exception ni de 500 (' + v.status + (v.exc ? ' ' + v.exc.slice(0, 120) : '') + ')');
      if (k.startsWith('proprietaire') || k === 'idInexistant') continue;
      eq(!v.fuites.length, nom + ' / ' + k + ' : aucune fuite (' + v.fuites.join(', ') + ')');
      eq(!v.modifs.length, nom + ' / ' + k + ' : aucune modification chez un autre (' + v.modifs.join(', ') + ')');
    }
  }
  // Décisions du porteur (13/11, audit 🟡) : routes réservées à l'athlète lui-même — refusées à son propre coach.
  for (const a of ['claimRecompense', 'saveEmail', 'supprimerCompte']) {
    const x = res.find((r) => r.action === a);
    eq(x && x.sc.coachSurRouteAthlete && x.sc.coachSurRouteAthlete.status === 401, a + ' : refusé au coach, même pour SON athlète (obtenu ' + (x && x.sc.coachSurRouteAthlete && x.sc.coachSurRouteAthlete.status) + ')');
    eq(x && x.sc.proprietaire.status !== 401, a + ' : accepté pour l\'athlète lui-même');
  }
  for (const a of SECRET) { const x = res.find((r) => r.action === a); eq(x && x.sc.sansJeton.status === 401, a + ' : refusé sans le bon secret'); }
  // Toute route qui répond sans jeton doit être dans la liste publique (pas de nouvelle route ouverte par erreur).
  const ouvertes = res.filter((x) => x.sc.sansJeton.status !== 401).map((x) => x.action).filter((a) => !PUBLIC.has(a));
  eq(!ouvertes.length, 'aucune route ouverte hors liste publique (' + ouvertes.join(', ') + ')');
  console.log(`securite-droits-routes : ${ok} OK / ${ko} KO (${res.length} routes)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
