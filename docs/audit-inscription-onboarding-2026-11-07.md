# Audit inscription + onboarding (07/11/2026) — avant maquettes

Lu dans le code (`index.html` `#auth-signup` / `#coach-auth-signup`, `js/app.js` `sInscrire`, `ouvrirOnboarding`, `_guideAthleteCards`, `_guideCoachCards`, `index.ts` `handleRegister`, `handleRegisterCoach`). Rien n'est codé.

## 0. Exercices créés par un coach — risque de doublons
Déjà en place (06/11) : le serveur refuse un nom **identique** (sans tenir compte des accents ni des majuscules) ; muscle choisi dans la liste des 14.
Pas couvert :
- **Quasi-doublons** : « Curl araignée » vs « Spider curl », « Dév. couché » vs « Développé couché barre ».
- **Catalogue commun pollué** : l'exercice d'un coach apparaît chez **tous** les athlètes de **tous** les coachs.
- **Numéro d'exercice** : deux coachs qui créent au même instant peuvent obtenir le même identifiant (pas de contrainte d'unicité en base).

Proposé :
1. Pendant la saisie du nom, liste « **Il existe peut-être déjà** » (mots en commun, même muscle) avec « Utiliser celui-ci ».
2. Exercice créé par un coach = **privé à ce coach et à ses athlètes** ; le porteur (admin) peut le **valider** pour le rendre commun. La validation se fait d'abord avec moi (SQL), un écran admin plus tard.
3. Contrainte d'unicité en base (nom normalisé + identifiant) : supprime le risque de collision.

## 1. Inscription
### Athlète — champs actuels
Sport · Prénom · Taille · Poids · Login (4 chiffres, choisi) · Années de pratique (muscu) · Date de naissance · E-mail · Mot de passe · Code d'invitation (bêta) · Consentement.

### Incohérences trouvées
| # | Constat | Conséquence |
|---|---|---|
| I1 | **Vérification seulement dans l'app** : le serveur n'exige que login + mot de passe (date de naissance, taille, poids, e-mail facultatifs côté serveur). | Un compte peut exister à moitié rempli (ancienne version de l'app, appel direct). |
| I2 | **Sexe absent** de l'inscription (seulement dans Réglages ▸ Profil). Il sert au calcul des calories et à l'analyse morpho. | « cible indisponible (profil incomplet) » en nutrition ; morpho moins juste. |
| I3 | **Code d'invitation toujours affiché** (« bêta »), même quand le serveur ne l'exige pas (il ne l'exige que si le secret `BETA_INVITE_CODE` est posé). | Champ inutile / déroutant, ou blocage si le secret est posé sans que les testeurs aient le code. |
| I4 | **Message d'erreur unique** : toute erreur serveur s'affiche « Ce login est déjà utilisé ». | Faux message (ex. mot de passe trop court côté serveur, réseau). |
| I5 | **Login 4 chiffres choisi par l'utilisateur** : 10 000 combinaisons, collisions fréquentes à mesure que les comptes augmentent ; il sert aussi de code pour être lié par un coach. | Frustration (« déjà utilisé ») ; facile à deviner. |
| I6 | **E-mail obligatoire** mais l'e-mail de bienvenue / mot de passe oublié n'arrive qu'au porteur tant que Resend est en mode test (P0 roadmap). | Testeurs sans e-mail de confirmation. |
| I7 | Coach : le serveur n'exige que login + mot de passe (nom, e-mail, sport facultatifs côté serveur). | Même risque que I1. |

### Le code bêta est-il nécessaire ?
- **Sur Android (test fermé Play Store)** : non. Seules les personnes invitées dans la Play Console peuvent installer l'app.
- **Sur le web** (`vincentnmz.github.io/Muscu_app`) : l'adresse est publique, donc n'importe qui peut créer un compte. Le code n'est utile que pour fermer le web.
- **Proposé** : garder le mécanisme serveur, mais **n'afficher le champ que si le serveur l'exige**. Tu décides : on ferme le web (secret posé, code donné aux testeurs) ou pas.

### Proposé (« tout doit être rempli »)
- Inscription en **2 petits écrans** (moins long qu'un formulaire unique) :
  1. **Compte** : prénom, e-mail, mot de passe, login (avec vérification « disponible » en direct, ou proposition automatique d'un login libre), sport, coach ou pas.
  2. **Profil** : sexe, date de naissance, taille, poids, années de pratique (muscu) + consentement.
- Bouton « Créer mon compte » **grisé tant qu'un champ manque**, champ manquant signalé en rouge.
- **Même règle côté serveur** (refus si un champ manque) → plus de comptes incomplets.
- Messages d'erreur précis (login pris, e-mail invalide, réseau…).
- Coach : nom, e-mail, login, mot de passe, sport, rôle tous obligatoires, côté serveur aussi.

## 2. Onboarding — état actuel (2 parties)
**Partie 1 (athlète seulement, 1ʳᵉ connexion)** : 4 écrans — « Bienvenue » · « Comment ça marche » (cadre / exécution / ajustement) · « Données + ressenti » · « Comment veux-tu être suivi ? » (Novalyz me construit un programme · Je gère moi-même · J'ai un coach · Morpho « bientôt »).
**Partie 2** : visite par cartes (une carte par écran, surbrillance de la barre du bas), athlète (7 cartes) et coach (12 cartes) + « Gratuit / Premium ».

### Manques et erreurs
- **Coach : pas de partie 1** — un coach arrive directement dans la visite, sans explication de ce que fait l'app pour lui ni de comment démarrer (lier ou créer un athlète).
- Partie 1 athlète : explique la philosophie mais **pas concrètement ce que fait l'app** (séance du jour, analyses, forme, montre…).
- Le choix « comment utiliser l'app » ne dit pas **ce que chaque choix change** ensuite.
- **Cartes périmées** (fonctions changées depuis) :
  - « 1RM estimé » (retiré → force estimée),
  - « Agenda daté dans la colonne de droite » côté coach (retiré le 03/11 → diagnostic),
  - montre : ancien bouton (pas le nouveau parcours guidé ni « Synchronisée à … »),
  - IA et morpho « Prochainement » alors que c'est codé (activation = clé serveur).
- **Fonctions absentes de la visite** (inventaire ci-dessous) : plan de la semaine, « pourquoi ça bloque » + levier, cibles série par série en séance, séance libre + rattachement, Ma semaine, catalogue par muscle/matériel, contexte (déload/reprise), récompenses/points, rapport e-mail, photo de profil (à venir), morpho mise en avant, coach : saisie en présentiel, « Planifier la semaine », création d'exercice, Novalyz propose (qui a la main), alertes « À décider ».

## 3. Inventaire des fonctionnalités (base de la partie 2 — rien oublié)
### Athlète
- **Aujourd'hui** : état du jour (prêt / vigilance) et pourquoi · questionnaire bien-être (1 min) et « ta normale » · Lecture Novalyz du jour + reco · séance du jour (à lancer) · ta séance d'aujourd'hui / depuis ta dernière séance (records, progrès, bloqué) · plan de la semaine (3 actions qui se cochent seules) · Ma semaine (séances prévues, faites, en séance libre, en plus) · régularité · montre (sommeil, FC, « ancien ») · récompenses (points, badges).
- **Entraînement** : ton programme (Novalyz / toi / ton coach) · démarrer une séance · séance libre (+ « remplace laquelle ? ») · saisie série par série avec cible par série, RPE, chrono de repos · « pas de +1 rep forcé » quand c'est bloqué · catalogue par muscle et matériel · enchaîner (biset, superset) · agenda · cardio · Hyrox.
- **Analyses** : Résumé (verdict, records, progrès, bloqué + pourquoi + levier, force 6 semaines, plan, fiabilité, volume par muscle, balance) · Évolution (par exercice / groupe / séance, ce que Novalyz vise) · Tendances (régularité, tonnage, exercices en progrès, fréquence, intensité) · Historique (séances, « Changer » sur une séance libre, records) · Cardio · Croisé.
- **Forme** : contexte (déload, reprise, vacances) · questionnaire et ressenti 7 j · charge & fraîcheur · poids · montre (pas, sommeil, FC) · suivis : nutrition, photos & mensurations, objectifs, douleurs & blessures.
- **Coach / Assistant** : messagerie (photos, vidéos) · Novalyz IA · analyse morpho (3 photos).
- **Réglages** : profil (sexe, années, zones prioritaires), coach lié, e-mail et rapport par e-mail, appareils (connecter / changer de montre, import de fichiers), données (export, suppression), revoir la visite.
### Coach
- **Aujourd'hui** : briefing équipe · qui a répondu au questionnaire · à surveiller · entraînement à regarder · messages non lus.
- **Équipe** : tableau / cartes (état, niveau, assiduité, plan) · lier ou créer un athlète.
- **Fiche athlète** : Aperçu (état du jour, « À décider » avec piste trouvée + actions, alertes, entraînement, séries 7 j, prochaine séance, charge & assiduité) · Forme (mobile) · Analyses (diagnostic à droite sur ordi) · Séances (avec « remplace quelle séance ? ») · Programme (builder, agenda, Planifier la semaine, Novalyz propose / qui a la main, créer un exercice) · Conversation · saisir une séance en présentiel · contexte.
- **Analyses équipe** · **Messages** (filtres, à plusieurs) · **Profil** (notifications, groupes, export, retour).

## 4. Questions pour toi (avant maquettes)
1. **Code bêta** : on ferme le web pendant le test (code exigé, champ affiché) ou on le laisse ouvert (champ caché) ?
2. **Login 4 chiffres** : on garde (avec « disponible ? » en direct et proposition automatique), ou on passe à un identifiant libre / l'e-mail pour se connecter ? (Changer l'identifiant touche à la connexion : à faire avec précaution, sans casser le hachage.)
3. **Exercices coach** : privés au coach + validation par toi pour devenir communs — d'accord ?
4. **Partie 1 coach** : à créer (même principe que l'athlète : ce que fait l'app + comment démarrer) — d'accord ?
5. **Photo de profil** dans l'onboarding (étape facultative « ajoute ta photo ») — d'accord pour athlète et coach ?
