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

### 2. Montre qui se déconnecte tous les 7 jours
- **Cause** : PAS un bug de code (le refresh existe, `index.ts:2993`). L'écran
  de consentement **OAuth Google est en mode « Test »** → Google révoque le
  refresh token après 7 jours.
- **Fix** : passer la consent screen en **« Production »** (Google Cloud
  Console). Vérifier au passage que le flux demande bien `access_type=offline`
  + `prompt=consent` (pour toujours obtenir un refresh token).
- **Nuance** : scopes santé = sensibles → possible écran « app non vérifiée » et
  **vérification Google** requise au-delà de ~100 utilisateurs. À creuser selon
  les scopes exacts utilisés.
- **Effort** : config (pas de code) ; la vérification Google peut prendre du
  temps si nécessaire.

### 3. Distribution des mises à jour
- **État** : Play Store (test interne) en cours — compte dev en **validation
  d'identité Google**. Politique de confidentialité ✅ en ligne.
- **Suite** : générer l'**upload key** (secret, PAS committée), build **AAB**
  signé en CI, créer la fiche + test interne, lien testeurs.

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

1. **P0-1 (mails)** + **P0-2 (montre)** : les deux « services en mode test → en
   production ». Débloque l'accès réel pour des testeurs. *(Prérequis : un nom
   de domaine.)*
2. **P0-3 (Play Store)** : dès que Google valide l'identité.
3. **P1** : solidité + onboarding + accès testeur.
4. Puis **Produit** (réorg + IA-coach) en parallèle, une fois la base stable.

> Thème unificateur des P0 : **faire sortir les services externes du mode
> « test »** (Resend domaine vérifié · Google OAuth en Production · app publiée
> sur le Store).
