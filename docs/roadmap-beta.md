# Novalyz — Route vers un test à grande échelle (beta)

> Objectif : rendre l'app **testable par le plus grand nombre**, sans perdre de
> temps. Note de travail vivante — à cocher au fur et à mesure.

## Principe : 2 chantiers à ne PAS mélanger

- **🎨 Chantier PRODUIT** — rend l'app *désirable* (réorg, vision, IA-coach).
  Voir [`vision-produit.md`](./vision-produit.md).
- **🛠️ Chantier FIABILITÉ** — empêche l'app de *casser* quand beaucoup de gens
  l'utilisent. **C'est LUI qui débloque la beta** (ci-dessous).

> Règle : on n'ouvre pas à des testeurs tant que les **bloquants P0** ne sont pas
> réglés. Inutile d'ajouter des features si un testeur ne peut pas se connecter,
> récupérer son mot de passe, ou garder sa montre connectée.

---

## 🔴 P0 — Bloquants (un testeur est coincé sans ça)

### 1. Mails de reset de mot de passe (ne marchent que pour le porteur)
- **Cause** : `index.ts` envoie depuis `onboarding@resend.dev` (bac à sable
  Resend) → Resend n'autorise l'envoi **qu'à l'adresse du compte**. Les autres
  ne reçoivent RIEN.
- **Fix** : vérifier un **domaine d'envoi** dans Resend (DNS : SPF + DKIM, idéal
  DMARC) → changer le `from` en `noreply@<domaine>`. Tester la délivrabilité
  (spam). Nécessite un **nom de domaine** (à acheter si pas déjà).
- **Effort** : faible côté code (1 ligne + secret) ; le vrai travail = DNS.

### 2. Montre qui se déconnecte tous les 7 jours — ✅ OBSOLÈTE (migration Health Connect)
- **Mise à jour (30 sept. 2026, vérifié dans le code)** : l'app **ne passe plus par
  OAuth Google Fit** pour la montre. Tous les boutons montre appellent
  `ouvrirImportMontre()` → **Health Connect natif** (plugin `capacitor-health`).
  Les fonctions OAuth (`connecterGoogleHealth`…) subsistent dans `app.js` mais
  **aucune UI ne les appelle** (`connecterGoogleHealth` = 0 appelant) ; il reste un
  `autoSyncGoogleHealth` best-effort pour d'anciens comptes déjà liés, sans moyen de
  (re)connexion. → **Le problème du refresh token révoqué à 7 j ne s'applique plus**
  (Health Connect = permissions Android persistantes, pas d'expiration OAuth).
- **Reliquat réel (déplacé vers P0-3 Play Store)** : lire des données santé via
  Health Connect impose au moment de la **publication Play Store** une **déclaration
  d'usage des données de santé + revue Google** (Health Connect / Health Apps policy).
  À traiter avec la fiche Play Store, pas avant.
- **Nettoyage code OAuth Google Fit** — ✅ **fait (30 sept. 2026)** : suppression du
  code mort front (`connecterGoogleHealth` / `_traiterRetourGoogleHealth` /
  `majUiGoogleHealth` / `synchroniserGoogleHealth` / `deconnecterGoogleHealth` /
  `autoSyncGoogleHealth` + consts + appelants) et backend (`handleGoogleHealth*`,
  `_googleAccessToken`, `GOOGLE_TOKEN_URL`, 4 routes). **Conservés** : la table
  `google_health_tokens` (données legacy + nettoyage à la suppression de compte) et le
  label `source:'google_health'`. Vérifié : croisement front↔backend OK, tests 41/41.
  ⚠️ `index.ts` à **redéployer**. (Secrets `GOOGLE_CLIENT_ID/SECRET` devenus inutiles.)

### 3. Distribution des mises à jour — 🟡 pipeline prêt, reste la fiche Play
- ✅ **Compte dev Google validé** (identité OK).
- ✅ **Clé d'upload créée** (`novalyz-upload.jks`) + **4 secrets GitHub** posés
  (`ANDROID_KEYSTORE_BASE64` / `_PASSWORD` / `ANDROID_KEY_ALIAS` / `_PASSWORD`).
- ✅ **Pipeline AAB signé** — workflow `.github/workflows/build-aab.yml` (sur `main`,
  lançable) : build `bundleRelease` signé via `android.injected.signing.*` (sans
  toucher `build.gradle`), `versionCode` = n° de run (croissant). AAB publié en
  Release `novalyz-aab-latest`. **Testé 30 sept. 2026** : run vert, `jar verified`.
- ✅ Politique de confidentialité en ligne.
- ⏳ **Reste (côté Play Console)** : créer la fiche app (`com.novalyz.app`, Play App
  Signing), remplir les **déclarations** (sécurité des données + **données santé /
  Health Connect** + classification + « pas de pub » + assets fiche), créer la
  release **test interne** (upload de l'AAB), ajouter les testeurs → lien d'opt-in.
  Puis (comptes perso) **test fermé ≥12 testeurs / 14 j** avant la production.
- 📄 Guide complet pas à pas : [`publication-play-store.md`](./publication-play-store.md).

---

## 🟠 P1 — Solidité (avant d'ouvrir large)

- **Gestion des erreurs réseau** : messages clairs si le backend ne répond pas
  (pas d'écran blanc). Comportement hors-ligne raisonnable (PWA).
- **Onboarding premier lancement** : un nouvel utilisateur doit comprendre quoi
  faire (lié au chantier Produit : « 🏠 Aujourd'hui »).
- **Création de compte / accès testeur** : comment un testeur obtient un compte
  (auto-inscription ? code ? création par le coach ?). À décider.
- **Limites & abus** : rate-limit reset mail (déjà partiel), limites d'appels.
- **Monitoring minimal** : savoir quand ça casse (logs Supabase, erreurs front).

---

## 🟡 P2 — Confort / qualité perçue

- Backlog fonctionnel (voir historique) : cardio dans son onglet, messagerie
  coach (inbox), suppression multiple de messages, sommeil+BPM montre, iGPSport.
- Animations (voir [`animations.md`](./animations.md)).

---

## Ordre de bataille proposé

1. ~~**P0-2 (montre OAuth)**~~ → ✅ **obsolète** (montre = Health Connect natif ;
   plus de refresh token à 7 j).
2. **P0-1 (mails)** : Resend domaine vérifié. *(Prérequis : un nom de domaine.)*
3. **P0-3 (Play Store)** : dès que Google valide l'identité — inclut la **déclaration
   Health Connect** (données santé). Côté code : **build AAB release signé en CI**.
4. **P1** : solidité + onboarding + accès testeur.
5. Puis **Produit** (réorg + IA-coach) en parallèle, une fois la base stable.

> Thème unificateur des P0 restants : **faire sortir les services externes du mode
> « test »** (Resend domaine vérifié · app publiée sur le Store). *(Le volet OAuth
> Google est retombé avec la migration Health Connect.)*
