# Audit « Lier un athlète » (coach ↔ athlète) — 30 oct. 2026

> Méthode : lecture du code (front `lierAthlete` / `creerAthlete` / onboarding « J'ai un coach » / fil Coach,
> backend `handleLierAthlete` / `handleCoachCreerAthlete` / `authCheck`), logs Supabase du 30/10, test
> `tests/lier-athlete.test.js` sur le vrai handler (base en mémoire), captures du nouvel écran.

## Défauts trouvés

| # | Gravité | Défaut | Statut |
|---|---|---|---|
| 1 | **Critique (sécurité)** | **Un coach pouvait « prendre » n'importe quel athlète** avec son seul login à 4 chiffres, **y compris l'athlète d'un autre coach**, sans prévenir personne. Le `coach_id` était écrasé en silence. Or l'inscription coach est ouverte à tous, et un coach lié peut ensuite **tout lire** et **réinitialiser le mot de passe** de l'athlète (`coachResetAthlete`). | **Partiellement corrigé** : un athlète déjà suivi par un autre coach est désormais **refusé**. Il doit d'abord quitter son coach. **Reste ouvert** : un athlète **sans coach** peut toujours être lié par n'importe quel coach qui tape son login (10 000 possibilités) → **décision ci-dessous**. |
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

## Décision à prendre pour fermer #1
Aujourd'hui le login à 4 chiffres sert **à la fois** d'identifiant de connexion **et** de clé pour se faire lier.
Deux options :
- **A · Demande à accepter** : le coach saisit le login → l'athlète voit « Karim veut te suivre — Accepter / Refuser ». Le plus sûr, un écran de plus.
- **B · Code de liaison** : l'athlète voit dans Réglages un code à 6 caractères (renouvelable) et le donne à son coach avec son login. Pas d'écran d'acceptation, mais un code de plus à transmettre.

Recommandation : **A** (c'est le standard, et l'athlète voit qui le suit).
