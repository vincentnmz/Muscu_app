# Audit « Lier un athlète » (coach ↔ athlète) — 30 oct. 2026

> Méthode : lecture du code (front `lierAthlete` / `creerAthlete` / onboarding « J'ai un coach » / fil Coach,
> backend `handleLierAthlete` / `handleCoachCreerAthlete` / `authCheck`), logs Supabase du 30/10, test
> `tests/lier-athlete.test.js` sur le vrai handler (base en mémoire), captures du nouvel écran.

## Défauts trouvés

| # | Gravité | Défaut | Statut |
|---|---|---|---|
| 1 | **Critique (sécurité)** | **Un coach pouvait « prendre » n'importe quel athlète** avec son seul login à 4 chiffres, **y compris l'athlète d'un autre coach**, sans prévenir personne. Le `coach_id` était écrasé en silence. Or l'inscription coach est ouverte à tous, et un coach lié peut ensuite **tout lire** et **réinitialiser le mot de passe** de l'athlète (`coachResetAthlete`). | **Corrigé (option A, validée le 30/10)** : un athlète déjà suivi par un autre coach est **refusé** (il doit d'abord quitter son coach). Un athlète **sans coach** reçoit une **demande** (« X veut te suivre — Accepter / Refuser », fenêtre à l'ouverture + Réglages ▸ Mon coach + notification). Rien n'est lié tant qu'il n'a pas accepté. |
| 2 | **Élevée** | **Côté athlète, le lien n'apparaissait pas** tant qu'il ne se déconnectait pas. `coach_id` n'était lu **qu'à la connexion**. Cas normal : l'athlète se connecte, donne son login, le coach le lie → l'athlète reste « Pas encore de coach ? » (et l'inverse après un départ). | **Corrigé** : `getAppData` renvoie `coach_lie` (id + nom du coach), le front se met à jour à chaque chargement. |
| 3 | Moyenne | **Aucun moyen de quitter son coach** (ni pour l'athlète, ni pour le coach pour un seul athlète). Seule la suppression du compte coach détachait. | **Corrigé** : Réglages ▸ Mon compte ▸ **Mon coach** (« Tu es suivi par X » + « Quitter mon coach », avec confirmation). Nouvelle action `detacherCoach`. |
| 4 | Faible | Coach : aucun retour après une liaison réussie (la fenêtre se fermait sans rien dire). Aucun contrôle « 4 chiffres ». Message « Athlète introuvable » ambigu. Relier un athlète déjà dans l'équipe donnait un succès muet. | **Corrigé** : contrôle 4 chiffres (front + serveur), toast « X est rattaché à ton équipe » / « X est déjà dans ton équipe », message « Aucun athlète avec ce login ». |
| 5 | Faible | Fil Coach : le nom du coach était **deviné** depuis le dernier message (« Ton coach » s'il n'avait pas encore écrit). | **Corrigé** : vrai nom du coach (renvoyé par `getAppData`). |
| 6 | Faible | Onboarding « J'ai un coach » : « Bouton « Lier un athlète » » alors que le bouton s'appelle « + Inviter » (onglet Lier). | **Corrigé**. |

## Constat à connaître (hors liaison)
- **Logs Supabase du 30/10** : `[auth:observation] … jeton absent`. Le contrôle des jetons tourne en **mode observation**
  (`AUTH_ENFORCE` pas activé). Toutes les routes répondent donc encore sans vérifier qui appelle.
  Le défaut #1 n'est vraiment fermé qu'avec `AUTH_ENFORCE=1` (déjà prévu : « vérification des logs AUTH_ENFORCE »).

## Vérifié juste
- **« Créer » un athlète (coach)** : contrôles prénom / login 4 chiffres / mot de passe 6+ / e-mail, login déjà pris refusé, mot de passe haché côté serveur (`hashSalted`), sport hérité du coach.
- **`coachResetAthlete`** : refuse un athlète qui n'est pas lié à ce coach.
- **Droits** (`authCheck`) : un coach ne peut pas agir au nom d'un autre coach ; un athlète ne peut pas appeler `lierAthlete` (route coach).

## Décision prise pour #1 : option A (30/10)
- Coach : « + Inviter » ▸ Lier ▸ login → **demande envoyée** (toast « il doit l'accepter dans son app »). Relancer = « déjà envoyée ».
- Athlète : fenêtre « X veut te suivre » à l'ouverture (Accepter / Refuser / Plus tard), aussi dans Réglages ▸ Mon coach. Notification push si activée.
- Accepter → lié, le coach reçoit « X a accepté ton suivi ». Refuser → demande effacée.
- Stockage : `indicateurs` (pref `coach_demande` = coach_id), une demande en attente par athlète (la plus récente remplace). L'athlète accepte celle qu'il a **vue** (`coach_id_vu`), pas une autre arrivée entre-temps.
- « Créer » un athlète (le coach crée le compte) reste direct.
- Test : `tests/lier-athlete.test.js` (16 cas).
