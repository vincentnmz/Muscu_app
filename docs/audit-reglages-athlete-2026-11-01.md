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
