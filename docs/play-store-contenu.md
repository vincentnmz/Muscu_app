# Novalyz — Contenu & réponses Play Store (prêt à copier)

> Textes de la fiche + réponses des déclarations Play Console, consolidés pour
> copier/coller et pour s'y retrouver. Màj : oct. 2026. Voir aussi
> [`publication-play-store.md`](./publication-play-store.md) (procédure pas à pas).

---

## Fiche Play Store

**Catégorie** : Appli · **Santé et remise en forme** · tags : entraînement / musculation, suivi d'activité, fitness.
**Contact** : e-mail `portefaixvincent@gmail.com` · tel : (facultatif, vide) · site : `https://vincentnmz.github.io/Muscu_app/` (facultatif).

### Nom de l'application (max 30)
```
Novalyz
```

### Description courte (max 80 — ici 76)
```
Transforme tes données et ton ressenti d'entraînement en décisions concrètes.
```

### Description complète (max 4000)
```
Novalyz transforme tes données d'entraînement ET ton ressenti en décisions claires : comment t'entraîner, si c'est bien fait, et comment progresser.

Pensé d'abord pour la musculation et le cardio, Novalyz t'aide à sortir du simple suivi de chiffres pour enfin les COMPRENDRE.

CE QUE NOVALYZ FAIT POUR TOI

• Analyse tes séances — tonnage, volume, progression, RPE, régularité, charge (ACWR) — et te les explique en langage clair, pas juste en graphiques.
• Suit ta forme — sommeil, fatigue, motivation, douleurs — et croise ce ressenti avec tes performances.
• Te prévient — des alertes repèrent une surcharge, une baisse de régime, une stagnation ou un retour après coupure, avec la preuve et l'action conseillée.
• Tient compte du contexte — retour de vacances, de blessure, semaine de décharge : l'analyse s'adapte au lieu de crier à la régression.
• Nutrition — objectifs de calories et macros (protéines, glucides, lipides) calculés depuis ton poids, ton objectif et ton niveau d'activité, avec suivi au quotidien.
• Cardio & Hyrox — saisie et analyse de tes sorties (course, vélo, rameur…) et de tes Hyrox.
• Programme — construis ou génère ton programme (jours, charges en % du 1RM, RPE cible) et compare prévu vs réalisé.
• Montre & capteurs — importe automatiquement tes séances, tes pas, ton sommeil et ta fréquence cardiaque via Health Connect (Fitbit, Garmin, Samsung, Polar, Coros…).

AVEC OU SANS COACH
En solo, Novalyz est ton analyste de performance. Si tu as un coach, tu partages ton suivi et tu échanges avec lui directement dans l'app (messages, photos et vidéos de ta technique).

POUR QUI
Pratiquants de musculation et de sport, du débutant sérieux à l'athlète, qui veulent s'entraîner plus intelligemment et suivre une vraie progression.

Novalyz est un outil d'aide à l'entraînement et au bien-être sportif. Il ne fournit pas d'avis médical et ne remplace pas un professionnel de santé.
```

> ⚠️ L'**IA** (assistant + analyse morpho) n'est PAS mentionnée (en veille). À ajouter au texte le jour de son activation.
> Assets encore à fournir (images) : icône 512×512, image de présentation 1024×500, captures d'écran (Aujourd'hui, Analyses, Forme).

---

## Accès à l'application (compte de test pour l'examen)
- Une partie limitée (connexion requise) → **Oui**.
- **Nom** : `Compte athlète` · **Nom d'utilisateur** : `0101` · **Mot de passe** : *(celui de John)*.
- **Instructions** : « App en français. Écran de connexion → saisir ces identifiants. Aucune fonctionnalité payante. Compte avec ~1 an de données. »

## Suppression de compte / données
- **URL suppression de compte** : `https://vincentnmz.github.io/Muscu_app/privacy.html#suppression-compte`
- Suppression partielle sans supprimer le compte ? → **Non**.

## Annonces
- Contient des annonces ? → **Non**.
- Identifiant publicitaire utilisé ? → **Non** (aucun SDK pub/analytics ; pas de permission AD_ID).

## Classification du contenu (IARC)
- Contenu sexe/violence/langage/drogues dans le package → **Non**.
- Interaction / partage entre utilisateurs → **Oui** (messagerie + photo/vidéo athlète↔coach).
- UGC = source principale → **Non** · nudité/violence publiques → **Non**.
- Bloquer / signaler / modérer → **Non** · limité aux invités uniquement → **Oui**.
- Emplacement partagé entre utilisateurs → **Non** · achats numériques → **Non** (jusqu'au premium) · crypto/NFT → **Non** · navigateur/moteur de recherche → **Non** · actualité/éducation → **Non**.

## Public cible
- Tranche d'âge : **18 ans et plus** uniquement (évite le programme « Familles »).

## Sécurité des données (data safety)
- Collecte/partage de données → **Oui** · chiffrées en transit → **Oui** · création de compte → **Nom d'utilisateur et mot de passe**.
- Règle par type : **Collectées = Oui · Partagées = Non · Éphémère = Non · Finalité = Fonctionnement de l'appli** (+ **Gestion des comptes** pour Nom / E-mail / ID).
- Types déclarés : Nom (requis), E-mail (optionnel), ID utilisateur (requis), Autres infos perso (DDN/sexe/club, optionnel), Infos santé, Activité physique, Messages in-app, Photos, Vidéos, ID appareil (push), Autre contenu généré (notes). Suppression des données à la demande → **Oui**.
- **Financier** : rien aujourd'hui — à mettre à jour à la sortie du premium.

## Fonctionnalités financières
- **Aucune fonctionnalité financière** (un abonnement premium n'en est pas une au sens de la liste).

## Applis de santé (Health Apps)
- Catégories : **Activité et remise en forme** · **Gestion du sommeil** · **Nutrition et gestion du poids**. Rien de médical/clinique.
- Permissions Health Connect déclarées = **7** (manifeste nettoyé) : READ_EXERCISE, READ_STEPS, READ_SLEEP, READ_HEART_RATE, READ_RESTING_HEART_RATE, READ_DISTANCE, READ_ACTIVE_CALORIES_BURNED. Toutes en **lecture seule**, pour l'analyse d'entraînement, **ni vendues ni partagées**.
```
READ_EXERCISE              → importer les séances de la montre pour les analyser
READ_STEPS                 → afficher les pas quotidiens et l'objectif d'activité
READ_SLEEP                 → suivre le sommeil et son effet sur la récupération
READ_HEART_RATE            → FC pendant les séances (analyse de l'effort)
READ_RESTING_HEART_RATE    → FC au repos (indicateur de récupération)
READ_DISTANCE              → distance des séances cardio
READ_ACTIVE_CALORIES_BURNED→ calories actives dépensées pendant les séances
```

---
_À tenir à jour (surtout : premium → financier + achats numériques ; IA activée → mention dans la description + déclaration contenu IA)._
