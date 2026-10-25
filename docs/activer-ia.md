# Activer l'IA (morpho + chat) — guide pas à pas

> **But** : brancher l'IA quand tu seras prêt (analyse morpho par photo + chat « Demande à Novalyz »).
> **Statut au 25 oct. 2026** : tout le code est prêt et déployé sur `dev`. L'IA reste **désactivée proprement** tant que la clé n'est pas posée (message « pas encore activée »). Il ne reste que les 3 étapes payantes ci-dessous (≈ 5 min).

## Ce qui est déjà fait (rien à refaire)

- **Morpho** : prompt backend structuré (JSON + niveaux de confiance Visible / À confirmer / À mesurer + intégration des mensurations + interdiction d'inventer). Modèle **Claude Sonnet 5.5** (vision fine). Écran = protocole photo (face/profil/dos) + rendu en cartes (barres d'équilibre, priorités + exercices, bloc fiabilité).
- **Chat IA** : modèle **Claude Haiku 5.5** (éco).
- **Garde-fous coût** : quotas par athlète — **1 analyse morpho/jour**, **2 messages chat/jour** (`MORPHO_QUOTA_JOUR` / `IA_QUOTA_JOUR` dans `index.ts`).
- **Sécurité** : les photos morpho **ne sont jamais stockées** (analysées puis jetées).

## Combien ça coûte (rappel)

- **Paiement à l'usage** (pas d'abonnement) — tarifs : Sonnet 5.5 = 2 $ / 10 $ par M tokens (in/out) · Haiku 5.5 = 0,10 $ / 0,50 $.
- **≈ 0,02–0,05 $ par analyse morpho** · **fraction de centime par message** (Haiku).
- Par athlète actif : **~0,5–1,5 $/mois** au pire (tier Sonnet), borné par les quotas.
- ⚠️ Un abonnement **Claude Pro/Max (claude.ai) ne donne PAS l'accès API** : il faut un **compte API avec crédit**.

---

## Les 3 étapes (le jour J)

### 1) Créer le compte API + charger du crédit — console Anthropic
1. Aller sur **https://console.anthropic.com** (= platform.claude.com) → créer un compte (ou se connecter).
2. Menu **Billing** (Facturation) → **Add credits** / configurer le paiement. Mettre **5 à 10 $** pour commencer (suffit pour des centaines d'analyses de test).
   - Tant qu'il n'y a **pas de crédit**, les appels échouent (erreur de solde) → ne pas poser la clé avant d'avoir du crédit.

### 2) Générer la clé API
1. Menu **API Keys** → **Create Key**.
2. Lui donner un nom (ex. `novalyz-prod`), **copier la clé** (format `sk-ant-...`). ⚠️ Elle ne se réaffiche plus après : la coller directement à l'étape 3.
3. **Ne jamais** mettre cette clé dans le front, dans git, ni dans un message. Elle ne va QUE dans le secret Supabase (étape 3).

### 3) Poser la clé dans Supabase
1. **https://supabase.com** → projet Novalyz (`jhbrvgguybynzeceeceu`).
2. **Project Settings → Edge Functions → Secrets** (ou **Settings → Functions → Secrets**).
3. **Add secret** : nom exact **`ANTHROPIC_API_KEY`**, valeur = la clé `sk-ant-...`. Save.
4. (Si besoin) **redéployer** la fonction `smooth-service` pour qu'elle prenne le secret — coller le contenu de `supabase/functions/handler/index.ts` dans l'éditeur de la fonction → **Deploy**.

> **Ordre important** : crédit (1) **avant** de poser la clé (3). Une clé sans crédit = message d'erreur « réessaie » au lieu du propre « pas encore activée ».

---

## Vérifier que ça marche

1. Dans l'app (athlète) → **Assistant → Analyse morpho** → ajouter 1–3 photos (protocole) + cocher le consentement → **Analyser**.
   - ✅ Attendu : le résultat s'affiche en cartes (morphotype, équilibre, posture, priorités, fiabilité).
   - ❌ « pas encore activée » = clé absente. « souci, réessaie » = clé posée mais **sans crédit** (ou invalide).
2. Chat « Demande à Novalyz » → poser une question → réponse (Haiku 5.5).

## Couper l'IA / limiter la casse

- **Couper** : supprimer le secret `ANTHROPIC_API_KEY` (retour au mode « pas encore activée »).
- **Limiter la dépense** : laisser un **plafond de crédit** bas dans le Console (pas de recharge auto), garder les **quotas** (`MORPHO_QUOTA_JOUR` / `IA_QUOTA_JOUR`), et **réserver l'IA au Premium** (déjà balisé « Bientôt » dans l'onboarding).
- **Suivre la dépense réelle** : option à ajouter — logger `usage` (tokens in/out) par appel en base pour un coût estimé en direct (demander à l'assistant).

---

*Fichiers concernés : `supabase/functions/handler/index.ts` (`handleAnalyseMorpho`, `handleChatIA`), écran morpho dans `index.html` + `js/app.js` (`_morphoRender`).*
