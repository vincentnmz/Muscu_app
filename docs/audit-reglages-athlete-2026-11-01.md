# Audit — Réglages athlète (01/11/2026)

Méthode : chaque réglage tracé jusqu'au code (front + route backend), base réelle (tables, droits), vrai backend rejoué (mode vacances), captures des 5 onglets (mobile).
Légende : ✅ vérifié · ❌ défaut (vérifié contre code + données) · 🟠 à décider · 🔍 à vérifier sur téléphone.

## Juste ✅
- **Profil** : taille, poids, années, date de naissance, sexe enregistrés ; les années ne sont plus comptées en double (base = saisie − années écoulées) ; le poids saisi devient aussi la pesée du jour (même source que le graphe).
- **Rapport par e-mail** : semaine = lundi, mois = le 1er, 3 mois = 1er janvier / avril / juillet / octobre ; le contenu annoncé (séances, volume, balance, progression) est bien dans le mail.
- **Mot de passe** : 6 caractères minimum contrôlés aussi par le serveur ; hachage inchangé.
- **Semaine d'entraînement** : appliquée à la régularité, à l'anneau d'Aujourd'hui et à la fenêtre « Semaine » des Analyses.
- **Import de fichier** .FIT / .GPX / .TCX : une valeur absente (ex. calories d'un GPX) n'est pas enregistrée à 0 ; avertissement de doublon.
- **Suppression du compte** : les 20 tables qui contiennent un `athlete_id` + les fichiers privés (photos, médias) sont effacés — liste comparée à la base réelle, rien d'oublié.
- **Version** affichée (Novalyz 1.4 · build).

## Défauts

| # | Constat | Correctif proposé |
|---|---|---|
| **R1** ❌ | **Mode vacances sans effet sur les alertes** : l'écran promet « on n'envoie plus d'alerte d'absence à ton coach », mais la pause n'est lue que par l'ancien calcul d'alertes, pas par le moteur qui produit les notifications. Vérifié sur le vrai backend : pause du 01 au 15/11 → le 09/11 « Absence prolongée » (haute) est quand même produite → notif à l'athlète **et** au coach. | Pendant la pause : pas d'alerte d'absence ni de « volume trop bas » ; au retour, l'absence se compte à partir de la **fin** de la pause (pas de rappel « J21 » le lendemain du retour). Texte : « …ni à toi ni à ton coach ». |
| **R2** ❌ (sécurité) | **Un coach peut supprimer le compte d'un de ses athlètes** : l'action « supprimer le compte » accepte une session coach liée à l'athlète. Et aucune ressaisie du mot de passe (2 simples confirmations). | Suppression réservée à la session de **l'athlète lui-même** + ressaisie de son mot de passe (vérifié par le serveur, hachage existant inchangé). |
| **R3** ❌ | **Export de mes données promis mais absent** : la politique de confidentialité dit « l'application propose un export de vos données (Réglages → Données) » ; la fonction et la route serveur existent, **aucun bouton** ne les appelle. 🔍 Sur l'APK, le téléchargement par lien risque de ne rien faire (pas de module fichiers/partage) tout en affichant « Téléchargement lancé ». | Bouton « Télécharger mes données (JSON / CSV des séances) » dans Données ; sur l'app Android : 🟠 (a) **recommandé** envoi du fichier par e-mail à l'adresse du compte ; (b) téléchargement seulement sur la version web (message clair sur l'app). |
| **R4** | Notifications : le texte dit seulement « quand ton coach t'envoie un message » ; il y a aussi les alertes (absence, douleur, volume) et la séance saisie par le coach. | Texte complet. |
| **R5** | Le champ s'appelle « Prénom » mais contient le **nom complet** (il est enregistré dans le nom affiché au coach). | Libellé « Nom affiché ». |
| **R6** | Onglets : « À propos » est coupé à droite sur téléphone (visible seulement en faisant défiler la rangée). | Onglets qui tiennent sur la largeur (libellés courts ou 2 lignes). |

## Constat supplémentaire (trouvé pendant R3) — ❌ critique : lectures plafonnées à 1 000 lignes
Supabase (PostgREST) renvoie **au plus 1 000 lignes par requête par défaut, sans erreur** (doc Supabase `select`). Aucune lecture du backend n'était paginée. Base réelle : **John = 2 808 lignes de séances** → seules les 1 000 plus récentes étaient lues (records, historique, tendances, vue coach faux) ; toi = 877 lignes (plafond atteint dans quelques semaines) ; tes indicateurs = 1 421 (l'export aurait été tronqué).
**Corrigé** : `_toutLire()` lit par pages de 1 000 (tri stable `…, id`) — séances, cardio, santé, nutrition, pas, indicateurs, bien-être de l'équipe, export. Test `lecture-complete` : base simulée plafonnée à 1 000 + 2 500 séries → **l'ancien code comptait 100 séances au lieu de 250** (historique commençant en nov. 2025 au lieu de janv.) ; le nouveau lit tout.

## Réalisé (01/11, validé porteur : tout, R3 option a)
- **R1** Mode vacances lu par le moteur : pas d'absence ni de « volume trop bas » pendant la pause **et 7 jours après** (reprise) ; l'absence se compte ensuite depuis la fin de la pause. Vérifié sur le vrai backend (pause 01→15/11) : 09/11 et 18/11 aucune alerte, 23/11 absence (8 j après la fin).
- **R2** Suppression du compte : session coach refusée ; ressaisie du mot de passe vérifiée par le serveur (`verifyPwd` existant, hachage inchangé) — sans / mauvais mot de passe : rien n'est supprimé (testé).
- **R3 (a)** « Télécharger mes données » (web : JSON + CSV) ; app Android : **« Recevoir mes données par e-mail »** (JSON complet + CSV des séances en pièces jointes, hash jamais exporté, message clair sans e-mail) — format des pièces jointes vérifié dans la doc Resend. Tables exportées complétées (notes, planning, pauses, activités).
- **R4** Texte des notifications complet. **R5** « Nom affiché — vu par ton coach ». **R6** Onglets « Compte · Options · Appareils · Données · Infos » sur une ligne (vérifié à 360, 390, 420 px).
- Tests : `lecture-complete` (4), `export-email` (7), `suppression-compte-complete` (+2), 67 suites vertes.
