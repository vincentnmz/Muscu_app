/* Construit la matrice route par route à partir de resultats.json (audit.js) + lecture du code.
 * Sortie : docs/audit-droits-routes-2026-11-10.md (section « Matrice »). Usage : node scripts/audit-droits/matrice.js */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const R = JSON.parse(fs.readFileSync(path.join(__dirname, 'resultats.json'), 'utf8'));
const TESTS = fs.readdirSync(path.join(ROOT, 'tests')).filter((f) => f.endsWith('.test.js')).map((f) => fs.readFileSync(path.join(ROOT, 'tests', f), 'utf8')).join('\n');
const ROW_OWNED = { supprimerCommentaire: 'commentaires', marquerCommentairesLus: 'commentaires', supprimerProgrammeLigne: 'programme', saveProgrammeLigne: 'programme', movePlanning: 'planning', unplanPlanning: 'planning', deleteObjectifJoueur: 'objectifs', saveObjectifJoueur: 'objectifs', deleteBlessure: 'blessures', saveBlessure: 'blessures', cloreContexte: 'contexte_athlete' };
const PUBLIC_CTRL = {
  ping: 'aucun (santé du service, ne renvoie rien)', login: 'identifiants (mot de passe vérifié, blocage après 5 échecs)', register: 'inscription ouverte (validation serveur, login unique)',
  loginCoach: 'identifiants coach (blocage après 5 échecs)', registerCoach: 'inscription coach ouverte (rôle limité à coach / prepa, sans privilège)', loginDispo: 'aucun (dit si un login est libre)',
  requestPasswordReset: 'aucun (réponse identique que le compte existe ou non)', resetPassword: 'jeton de réinitialisation à usage unique', confirmerEmail: 'jeton de confirmation à usage unique',
  exercices: 'aucun (catalogue validé uniquement, exercices privés exclus)', inscriptionBeta: 'aucun (formulaire public du site)',
  cronPushAlertes: 'secret CRON_SECRET (refus 401 sinon)', cronResumes: 'secret CRON_SECRET', cronResumesAuto: 'secret CRON_SECRET', envelopperHachages: 'jeton jetons_admin à durée limitée (créé en base, serveur seul)',
};
// Anomalies retenues après vérification (code + test dynamique ; préprod réelle pour getCommentaires).
const ANOM = {
  getCommentaires: ['🔴', 'Athlète connecté SANS athlete_id ni coach_id → AUCUN filtre : tous les messages de tous les athlètes + liens signés des médias. [V] code + test + préprod réelle'],
  deletePushSub: ['🟠', 'Aucun contrôle de propriétaire : tout utilisateur connecté peut supprimer l\'abonnement push d\'un autre s\'il connaît son endpoint (URL longue, non devinable) → coupe ses notifications. [V]'],
  savePushSub: ['🟠', 'Un utilisateur peut ré-enregistrer à son nom l\'endpoint d\'un autre (connu) → ses notifications partent sur l\'appareil de l\'autre / l\'autre ne reçoit plus les siennes. [V]'],
  deleteNativePushToken: ['🟠', 'Sans athlete_id, supprime le jeton FCM d\'un autre (s\'il est connu) : aucun contrôle de propriétaire. [V]'],
  repondreDemandeCoach: ['🟠', 'Action de l\'athlète (accepter / refuser un coach) également possible pour son coach actuel : il peut accepter à sa place la demande d\'un autre coach (l\'athlète change de coach) ou la refuser. [V]'],
  claimRecompense: ['🟡', 'Le coach peut appeler la boutique pour son athlète (dépenser ses points) : le traitement ne vérifie pas le rôle. Non démontré jusqu\'au débit (récompense testée « bientôt disponible »). [D]'],
  saveEmail: ['🟡', 'Le coach peut changer l\'e-mail de son athlète. Pas d\'élévation (le coach peut déjà réinitialiser le mot de passe de son athlète), mais à confirmer comme voulu. [V]'],
  loginDispo: ['🟡', 'Volontairement public (inscription), mais permet de tester si un login existe (énumération). [V]'],
};
const lab = { sansJeton: 'Sans jeton', athAversB: 'Athlète A → B', coachHorsPerimetre: 'Coach → hors périmètre', idManipule: 'ID manipulé', ressourceSeule: 'Ressource seule (sans id d\'identité)', athSurRouteCoach: 'Athlète → route coach', coachSurRouteAthlete: 'Coach → route athlète (son athlète)', proprietaire: 'Propriétaire', proprietaireAthlete: 'Propriétaire (athlète)', idInexistant: 'ID inexistant' };
const court = { sansJeton: 'S0', athAversB: 'A→B', coachHorsPerimetre: 'C→hors', idManipule: 'IDmanip', ressourceSeule: 'Ress.seule', athSurRouteCoach: 'A→routeC', coachSurRouteAthlete: 'C→routeA', proprietaire: 'Proprio', proprietaireAthlete: 'ProprioA', idInexistant: 'ID∅' };
const ATTAQUE = ['sansJeton', 'athAversB', 'coachHorsPerimetre', 'idManipule', 'ressourceSeule', 'athSurRouteCoach'];
function controle(x) {
  if (x.public) return 'public — ' + (PUBLIC_CTRL[x.action] || '?');
  const c = ['session signée'];
  if (x.cles.includes('athlete_id')) c.push('athlete_id (athlète = soi, coach = son athlète)');
  if (x.cles.includes('coach_id')) c.push('coach_id = session' + (['saveCommentaire', 'envoyerMediaCoach', 'mediaUploadUrl', 'getCommentaires', 'marquerCommentairesLus'].includes(x.action) ? ' (ou coach de l\'athlète)' : ''));
  if (x.action === 'saveSeance') c.push('athlete_id de chaque ligne [4] + saisi_par_coach = session');
  if (x.action === 'supprimerCompte') c.push('athlète uniquement');
  if (ROW_OWNED[x.action]) c.push('propriétaire de la ligne relu en base (' + ROW_OWNED[x.action] + ')');
  if (x.action === 'supprimerSuiviPhoto') c.push('chemin = athlète de la session');
  if (['saveSuiviPhoto', 'envoyerMediaCoach'].includes(x.action)) c.push('chemin préfixé par athlete_id (traitement)');
  if (x.sessRole) c.push('rôle / id de session dans le traitement');
  if (c.length === 1) c.push('**aucun identifiant contrôlé**');
  return c.join(' + ');
}
function ressource(x) {
  const k = x.cles.filter((k) => ['athlete_id', 'coach_id', 'id', 'ids', 'row_index', 'seance_id', 'path', 'media_path', 'endpoint', 'token', 'login_athlete', 'data'].includes(k));
  if (x.action === 'saveSeance') k.push('data[4]');
  return k.length ? k.join(', ') : '—';
}
function resultat(x) {
  return Object.entries(x.sc).map(([k, v]) => {
    const pb = (v.fuites.length || v.modifs.length) && !k.startsWith('proprietaire') && k !== 'idInexistant';
    const s = v.status === 401 ? '401' : (v.status === 200 ? (pb ? '200✖' : (v.succes ? '200✓' : '200')) : String(v.status));
    return court[k] + ' ' + s;
  }).join(' · ');
}
const lignes = [], stats = { '🔴': 0, '🟠': 0, '🟡': 0, '🟢': 0 };
for (const x of R) {
  const nTests = (TESTS.match(new RegExp("['\"]" + x.action + "['\"]", 'g')) || []).length;
  let cls = '🟢', anomalie = '—';
  const attaques = ATTAQUE.filter((k) => x.sc[k] && (x.sc[k].fuites.length || x.sc[k].modifs.length));
  if (ANOM[x.action]) { cls = ANOM[x.action][0]; anomalie = ANOM[x.action][1]; }
  else if (attaques.length) { cls = '🟠'; anomalie = 'Effet mesuré dans : ' + attaques.join(', ') + ' (à analyser)'; }
  else if (!x.public && nTests === 0) { cls = '🟡'; anomalie = 'Contrôle effectif vérifié par cet audit, mais aucun test dédié dans tests/'; }
  if (Object.values(x.sc).some((v) => v.status === 500 || v.status === 'EXC')) { cls = cls === '🟢' ? '🟡' : cls; anomalie += ' · erreur serveur sur un scénario'; }
  stats[cls]++;
  lignes.push(`| ${x.action} | ${x.methode} | ${x.public ? 'non' : 'oui'} | ${controle(x)} | ${ressource(x)} | ${nTests ? 'oui (' + nTests + ')' : 'non'} | ${resultat(x)} | ${cls} ${anomalie} |`);
}
const md = `| Route | Méthode | Auth requise | Contrôle | Ressource protégée | Test existant (mentions) | Résultat mesuré | Classement / anomalie |\n|---|---|---|---|---|---|---|---|\n` + lignes.join('\n');
const legende = `Codes du résultat : **S0** sans jeton · **A→B** athlète A1 sur données/ressources de A2 · **C→hors** coach C1 sur A2 / coach C2 · **IDmanip** A1 cite son athlete_id mais une ressource de A2 · **Ress.seule** identité retirée, ressource de A2 seule · **A→routeC** athlète sur route coach (coach_id de son coach) · **C→routeA** coach sur route athlète, pour SON athlète · **Proprio / ProprioA** appel légitime (contrôle positif) · **ID∅** identifiant inexistant. Statut : **401** refus du contrôle d'accès · **200** réponse sans effet chez l'autre (refus applicatif ou rien trouvé) · **200✓** succès · **200✖** fuite ou modification mesurée chez l'autre.`;
const out = path.join(ROOT, 'docs', 'audit-droits-routes-2026-11-10.md');
let doc = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
const debut = '<!-- MATRICE:DEBUT -->', fin = '<!-- MATRICE:FIN -->';
const bloc = debut + '\n\n' + legende + '\n\n' + md + '\n\n' + fin;
doc = doc.includes(debut) ? doc.replace(new RegExp(debut + '[\\s\\S]*' + fin), bloc) : doc + '\n' + bloc + '\n';
fs.writeFileSync(out, doc);
console.log(R.length + ' lignes ; ' + JSON.stringify(stats));
