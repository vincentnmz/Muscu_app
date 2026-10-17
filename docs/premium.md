# Novalyz — Gratuit vs Premium (découpage de référence)

> Décision produit **validée** (oct. 2026). Ce fichier fige le découpage. Le premium
> n'est **pas encore construit** (ni paywall, ni badges). Quand on l'implémentera :
> badges « 💎 Premium » **contextuels** sur les vraies entrées de features + un écran
> premium + paywall au clic. **JAMAIS dans la visite guidée / l'onboarding** — l'onboarding
> sert à activer, pas à vendre. L'awareness premium se fait au contact de la feature.

## Principe

- **Gratuit = acquisition & activation** : tout le socle de suivi + analyses de base.
  Le gratuit doit *vraiment donner envie* (pas une démo bridée).
- **Premium = la couche IA** (le différenciateur Novalyz) + la **profondeur d'analyse**.
- **L'export n'est jamais le levier** : exporter ses données est gratuit (norme marché
  Garmin/Strava/Fitbit + **RGPD / portabilité des données**). Si le *contenu* exporté est
  premium (analyses avancées), c'est le contenu qui est derrière le paywall, pas l'action
  d'exporter.

## Athlète (B2C — muscu grand public)

| Fonction | Gratuit | Premium |
|---|:--:|:--:|
| Suivi des séances (muscu / cardio / Hyrox), saisie | ✅ | |
| Forme / ressenti / questionnaire bien-être | ✅ | |
| Montre & capteurs (Health Connect) · pas / sommeil / FC | ✅ | |
| Analyses de base (semaine en cours · tonnage · charge) | ✅ | |
| **1 programme** (créé soi-même) | ✅ | |
| Conversation avec un coach | ✅ | |
| Récompenses / objectifs / badges | ✅ | |
| Export de ses données (CSV) · **bilan PDF de base** | ✅ | |
| **Assistant Novalyz IA** (Demande à Novalyz) | ✅ **3 messages / jour** | 💎 illimité (ou quota élevé) |
| **Programme généré par l'IA** | ✅ **1 programme** offert | 💎 régénérations / multi-programmes |
| **Analyse morpho IA** (vision — coûteuse) | 💎 (ou **1 essai**) | 💎 |
| **Analyses avancées** (historique long 6-12 mois, monotonie / strain, comparaisons) | | 💎 |
| **Bilan PDF enrichi IA** / rapports e-mail auto (hebdo / mensuel) | | 💎 |

## Coach (B2B — axe séparé)

Le coaching est plutôt un **abonnement coach** (par nombre d'athlètes suivis).
L'**IA coach** (bloc « Analyse Novalyz · ce client », `#cd-ia-card`) relève de ce palier pro.

- **Modèle validé** : coach **gratuit au début** (amorcer l'acquisition) · **IA coach
  3 questions / jour** gratuit, 💎 au-delà · **tarification par nombre d'athlètes** suivis.
- ⏳ **À fixer** : les **paliers d'athlètes** et le **prix** (référence marché Ekklo ≈ 24-79 €/mois).

## Modèle IA & maîtrise des coûts (« ne pas perdre d'argent »)

L'IA coûte à l'appel → quota **différencié par type**, pas un quota unique :

| Type d'IA | Coût / appel | Gratuit |
|---|:--:|---|
| **Assistant texte** (Demande à Novalyz · IA coach) | faible | **3 messages / jour**, au-delà 💎 |
| **Programme généré IA** | ponctuel, moyen | **1 offert**, régénérations 💎 |
| **Morpho IA (vision)** | **élevé** | hors quota texte → 💎 (ou **1 essai**) |

**Règles anti-dérapage (obligatoires à l'implémentation) :**
1. **Quota compté côté serveur** (backend), jamais côté app → sinon contournable (facture qui explose).
2. **Cap aussi en premium** (fair-use) pour borner le coût d'un gros utilisateur.
3. **Modèle moins cher pour le gratuit** (ex. Haiku) vs modèle plus fort en premium.
4. **IA groundée sur le moteur déterministe** (prompts courts, moins chers) + **cache** des réponses répétées.

### Benchmark — Ekklo (oct. 2026)
Outil **pour coachs** (B2B) : essai 14 j gratuit puis abonnement (~24 / 49 / 79 €/mois selon
sources). IA « Pacco » (programmes + nutrition) incluse dans les offres, branchable sur
ChatGPT/Claude. **Pas de tier athlète gratuit avec IA** → le freemium B2C de Novalyz (IA en
quota) est plus généreux pour l'acquisition. Différenciateur Novalyz : Ekklo **n'ajuste pas la
séance selon l'état du jour** ; Novalyz, si (données + ressenti).

## Règles d'implémentation (pour plus tard)

1. **Jamais dans la visite guidée / l'onboarding.**
2. Badges **« 💎 Premium »** sur les entrées réelles des features premium
   (ex. *Novalyz me propose un programme*, *Analyse morpho*, *Demande à Novalyz*, *IA coach*).
3. **Paywall au clic** sur une feature premium (pas de blocage visuel avant le clic).
4. **Export de ses propres données = toujours gratuit** (RGPD).
5. Articulation possible avec le **système de récompenses / points** : débloquer
   temporairement une feature premium avec des points, ou via une collab.
6. Mettre à jour en parallèle : **Play Store** (déclaration financière + achats numériques)
   et **data-safety** à la sortie du premium (cf. `docs/play-store-contenu.md`).
