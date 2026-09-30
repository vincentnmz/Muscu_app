# Novalyz — Publier sur le Play Store (guide pas à pas)

> Objectif : passer de l'APK debug (installation manuelle) à une **distribution
> Play Store** avec **mises à jour automatiques** (piste de test interne d'abord).
> Ce guide couvre TOUT : clé d'upload, secrets GitHub, build AAB (CI), et le
> parcours Play Console. Fichier vivant — cocher au fur et à mesure.

---

## Vue d'ensemble (le chemin complet)

```
1. Compte Play Console (25 $ une fois) + vérification d'identité
2. Créer la clé d'UPLOAD (keytool)  ──►  garder le .jks en lieu sûr
3. Ajouter 4 secrets GitHub (clé + mots de passe)
4. Lancer le workflow "Build AAB" ──► artefact app-release.aab
5. Play Console : créer l'app, activer Play App Signing
6. Remplir les "déclarations de contenu" (confidentialité, données santé…)
7. Piste TEST INTERNE : uploader l'AAB, ajouter des testeurs ──► lien d'install
8. (Plus tard) test fermé → production
```

Légende : ☐ à faire · ✅ fait.

---

## Étape 1 — Compte Google Play Console

- ☐ Créer un compte développeur sur https://play.google.com/console (**frais
  uniques de 25 $**, pas d'abonnement — c'est Apple qui est à 99 $/an).
- ☐ **Vérification d'identité** Google (pièce d'identité + parfois adresse). Peut
  prendre de quelques heures à quelques jours. *(Statut actuel Novalyz : en cours.)*
- ⚠️ **Règle importante (comptes personnels créés après nov. 2023)** : avant de
  pouvoir demander l'accès **production**, Google impose un **test fermé avec au
  moins 12 testeurs pendant 14 jours**. La piste **test interne** (étape 7) n'a
  PAS cette contrainte et sert à valider tout de suite — on commence par elle.

---

## Étape 2 — Créer la clé d'UPLOAD (une seule fois, sur ton ordi)

Cette clé prouve que les mises à jour viennent bien de toi. Avec **Play App
Signing** (étape 5), Google gère la clé de signature *finale* de l'app ; toi tu
gardes la clé d'**upload** (celle-ci).

- ☐ Choisis **2 mots de passe** (store + clé) et note-les précieusement.
- ☐ Lance (JDK installé requis — `keytool` vient avec Java) :

```bash
keytool -genkeypair -v -keystore novalyz-upload.jks -alias novalyz-upload \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "MOT_DE_PASSE_STORE" -keypass "MOT_DE_PASSE_KEY" \
  -dname "CN=Novalyz, O=Novalyz, C=FR"
```

- ☐ **Sauvegarde `novalyz-upload.jks`** (cloud privé + copie hors ligne). Si tu la
  perds, tu peux demander une **réinitialisation de clé d'upload** à Google (Play
  App Signing le permet), mais mieux vaut ne pas la perdre.
- ⚠️ Ne **committe jamais** ce fichier ni les mots de passe dans le repo.

Encode la clé en base64 (pour la mettre en secret GitHub) :

```bash
base64 -w0 novalyz-upload.jks > keystore.b64     # Linux
# macOS :  base64 -i novalyz-upload.jks -o keystore.b64
```

---

## Étape 3 — Ajouter les secrets GitHub

Repo GitHub → **Settings → Secrets and variables → Actions → New repository
secret**. Crée ces 4 secrets :

| Secret | Valeur |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | tout le contenu du fichier `keystore.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | ton `MOT_DE_PASSE_STORE` |
| `ANDROID_KEY_ALIAS` | `novalyz-upload` |
| `ANDROID_KEY_PASSWORD` | ton `MOT_DE_PASSE_KEY` |

- ☐ Les 4 ajoutés. (`GOOGLE_SERVICES_JSON` existe déjà.)
- Astuce : un secret se **met à jour** (pas de lecture possible) ; en cas de doute
  sur une valeur, recrée-le.

---

## Étape 4 — Construire l'AAB (workflow CI)

Le workflow `.github/workflows/build-aab.yml` fait tout : build web → Capacitor →
`bundleRelease` **signé** avec ta clé d'upload (injectée depuis les secrets, sans
toucher `build.gradle`).

- ☐ Déclencher : Actions → **« Build AAB Android (Play Store) »** → *Run workflow*
  (ou demande-moi de le lancer par l'API). *Note : pour qu'il apparaisse dans le
  menu de l'onglet Actions, le workflow doit être sur la branche par défaut
  (`main`) ; en attendant on peut le lancer par l'API depuis `dev`.*
- ☐ Récupérer l'artefact **`novalyz-release-aab`** (`app-release.aab`) sur la page
  du run.
- Garde-fou : sans les secrets de signature, le build **s'arrête net** avec un
  message clair (rien de cassé).
- `versionCode` = numéro de run du workflow → **croît à chaque build** (Play refuse
  un upload dont le versionCode n'augmente pas).

---

## Étape 5 — Créer l'app dans le Play Console + Play App Signing

- ☐ Play Console → **Créer une application** : nom (« Novalyz »), langue, type
  (Application), gratuite.
- ☐ **Play App Signing** : laisser **activé** (par défaut). Au premier upload
  d'AAB, Google génère/gère la **clé de signature de l'app** ; ta `.jks` reste la
  **clé d'upload**. C'est le mode recommandé.
- ☐ Vérifier que le **package** de l'app est `com.novalyz.app` (identifiant de
  prod, celui compilé par le workflow AAB).

---

## Étape 6 — Déclarations de contenu (obligatoires avant diffusion)

Dans **Règles et programmes → Contenu de l'application** (et fiche du Store) :

- ☐ **Politique de confidentialité** : URL publique (Novalyz l'a déjà en ligne —
  `privacy.html`).
- ☐ **Sécurité des données** (Data safety) : déclarer les données collectées
  (compte/login, données d'entraînement, **données de santé** via la montre) et
  comment elles sont utilisées/protégées.
- ☐ **Données de santé / Health Connect** : déclarer l'usage de Health Connect
  (lecture séances, pas, sommeil, FC) et respecter la *Health Apps policy*. Un
  formulaire dédié peut demander une justification d'usage.
- ☐ **Classification du contenu** (questionnaire IARC) → obtient une classification
  d'âge.
- ☐ **Public cible et contenu** (âge), **publicités** (l'app n'en a pas → déclarer
  « pas de pub »).
- ☐ **Fiche Store** : titre, description courte/longue, icône 512×512, image de
  présentation (feature graphic 1024×500), captures d'écran téléphone.

---

## Étape 7 — Piste TEST INTERNE (la plus rapide)

- ☐ **Tests → Test interne** → **Créer une release**.
- ☐ **Importer** l'`app-release.aab` (celui de l'étape 4).
- ☐ Renseigner les **notes de version**.
- ☐ **Liste de testeurs** : créer une liste d'e-mails (comptes Google des testeurs).
  Jusqu'à 100. Pas de délai de revue notable pour le test interne.
- ☐ **Examiner et publier** la release → Google fournit un **lien d'opt-in** à
  partager aux testeurs. Ils l'ouvrent, acceptent, installent depuis le Play Store →
  **mises à jour automatiques** ensuite.

> À ce stade, l'objectif « MAJ auto » du bloquant beta P0-3 est atteint pour les
> testeurs.

---

## Étape 8 — (Plus tard) Test fermé → Production

- ☐ **Test fermé** avec **≥ 12 testeurs pendant 14 jours** (obligatoire pour les
  nouveaux comptes perso avant la production).
- ☐ Demander l'**accès production**, puis créer une release **Production**.
- ☐ Diffusion progressive (rollout %) recommandée.

---

## Mettre à jour l'app (à chaque nouvelle version)

1. Merge/branche à jour → lancer **« Build AAB »** (le `versionCode` s'incrémente
   tout seul).
2. Télécharger l'AAB → **nouvelle release** sur la piste voulue (interne, puis
   fermée/prod) → publier.
3. Les testeurs/utilisateurs reçoivent la MAJ **automatiquement** via le Play Store.

---

## Rappels / pièges

- **Ne jamais perdre** `novalyz-upload.jks` ni ses mots de passe (sauvegarde).
- **Ne jamais committer** la clé ni les mots de passe (ils vivent en **secrets GitHub**).
- `targetSdk` = **36** (conforme aux exigences Play Store actuelles).
- L'**AAB n'est pas installable** directement (uniquement via le Play Console) —
  pour un test « en main » rapide, continue d'utiliser l'**APK debug** (workflows
  `build-apk` / `build-apk-dev`).
- Le **google-services.json** injecté au build est celui de `com.novalyz.app`
  (Firebase) → push FCM opérationnel sur la version Store.
- Secrets `GOOGLE_CLIENT_ID/SECRET` (ancien OAuth Fit) devenus **inutiles**
  (montre = Health Connect) — peuvent être supprimés.

---
_Mettre à jour ce fichier au fur et à mesure (cocher les ☐)._
