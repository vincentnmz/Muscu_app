# IA — Coûts & rentabilité

> Suivi de la dépense IA (API Anthropic) et de la rentabilité.
> Paiement **à l'usage** (par token). Pas d'abonnement API. Un abonnement Claude Pro/Max ≠ accès API.
> Dernière mise à jour : 25 oct. 2026 (avant activation réelle — chiffres = **estimations** à remplacer par le réel via `usage`).

## Modèles & tarifs (par million de tokens)

| Usage | Modèle | Input | Output |
|---|---|---|---|
| **Morpho** (vision) | `claude-sonnet-5-5` | 2,00 $ | 10,00 $ |
| **Chat** « Demande à Novalyz » | `claude-haiku-5-5` | 0,10 $ | 0,50 $ |

## Coût unitaire estimé

| Opération | Tokens entrée (est.) | Tokens sortie (est.) | **Coût / appel (est.)** |
|---|---|---|---|
| 1 analyse morpho (3 photos ~1024px + prompt) | ~5 500–6 500 | ~700–1 500 (+ thinking) | **~0,02–0,05 $** |
| 1 message chat (contexte + historique) | ~3 000–8 000 | ~400–700 | **~0,001–0,005 $** |

> Hypothèse image : ~largeur×hauteur/750 tokens (formule Anthropic). À **confirmer en réel**.

## Coût par athlète actif / mois

Quotas en place : **1 morpho/jour**, **2 chats/jour** (`MORPHO_QUOTA_JOUR` / `IA_QUOTA_JOUR`).

| Scénario | Morpho/mois | Chats/mois | **Coût/mois (est.)** |
|---|---|---|---|
| Léger (réaliste) | 1–3 | ~15 | **~0,10–0,25 $** |
| Intensif (proche quota) | ~10 | ~60 | **~0,60–1,50 $** |

## Rentabilité (seuil)

Hypothèse : **l'IA est réservée au Premium**.

| Prix Premium / mois | Coût IA/user (pire cas ~1,5 $) | **Marge brute IA** |
|---|---|---|
| 4,99 € | ~1,5 $ (~1,4 €) | ~70 % |
| 7,99 € | ~1,5 $ | ~82 % |
| 9,99 € | ~1,5 $ | ~86 % |

> Même au pire cas (usage proche des quotas), l'IA reste **une petite fraction** du prix Premium → rentable. Le gros poste = le **chat quotidien** (d'où Haiku) ; la morpho est rare et peu coûteuse.

## Leviers pour rester rentable

- **Quotas** par athlète (déjà en place) — bornent le pire cas.
- **Haiku** pour le chat (10–20× moins cher que Sonnet) ; **Sonnet** réservé à la morpho (vision).
- **IA = Premium uniquement** (déjà balisé « Bientôt » dans l'onboarding).
- **Plafond de crédit** bas côté Console Anthropic (pas de recharge auto) au début.
- **Mesurer** : logger `usage` (voir ci-dessous) → remplacer les estimations par du réel.

## Suivi réel de la dépense (à remplir chaque mois)

> À alimenter dès l'activation. Idéalement auto-rempli par un log `usage` en base (à brancher).

| Mois | Analyses morpho | Messages chat | Tokens in | Tokens out | **Coût réel $** | Users Premium | **Revenu €** | **Marge** |
|------|-----------------|---------------|-----------|------------|-----------------|---------------|--------------|-----------|
| 2026-11 | | | | | | | | |
| 2026-12 | | | | | | | | |
| 2027-01 | | | | | | | | |

## À faire (option)

- [ ] Brancher un **log `usage`** : à chaque appel IA, stocker `input_tokens` / `output_tokens` (+ coût estimé) en base (ex. `indicateurs` seance_id `ia_usage`) → agrégation mensuelle automatique dans ce tableau.
- [ ] Afficher un **compteur de dépense** côté admin (facultatif).

*Référence code : `supabase/functions/handler/index.ts` → `handleAnalyseMorpho` (Sonnet), `handleChatIA` (Haiku). Guide d'activation : `docs/activer-ia.md`.*
