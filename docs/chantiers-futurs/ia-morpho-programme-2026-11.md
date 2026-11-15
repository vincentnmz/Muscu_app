# IA — Analyse morpho + compte rendu + proposition de programme (spec, 15/11/2026, AUCUN CODE)

> Décisions porteur (15/11) : **Claude Opus 5.5** ; **option (a)** — spec + maquette + protocole maintenant, **code après la période
> d'observation** (gel du code en cours). Maquette : [`../../mockups/ia-morpho-programme.html`](../../mockups/ia-morpho-programme.html).
> Légende : **[V]** vérifié dans le code · **[P]** proposition · **[D]** décision attendue.

## 1. Principe (boussole)

L'IA est une **couche de lecture et de langage**, pas un moteur de décision (règle 5 du projet) :

| Qui | Fait quoi |
|---|---|
| **IA (Opus 5.5, vision)** | Lit les photos ; décrit carrure, équilibre, posture **avec un niveau de confiance** ; propose **2 à 4 priorités** ; explique. |
| **Moteur Novalyz (déterministe, testé)** | Recommandations d'exercices selon les leviers (segments) [V `recoMorphoExercices`] ; **le programme** (générateur v2) ; les volumes ; les cibles. |
| **Athlète / coach** | **Choisit** les zones prioritaires (2 max) parmi celles suggérées → le générateur construit le programme. |

**L'IA n'écrit jamais un programme, une série, une charge ni un chiffre** qui ne vient pas des données. Un programme proposé par
Novalyz est donc toujours un programme du générateur, que l'IA explique.

## 2. Ce qui existe déjà [V]

- `handleAnalyseMorpho` (`index.ts`) : 1 à 3 photos (face / profil / dos), **consentement obligatoire**, quota 1 / jour réservé avant
  l'appel et rendu en cas d'échec, objectif + mensurations + segments + questionnaire (sexe, antécédents) envoyés.
- Format de réponse JSON : `morphotype`, `synthese[{t,c}]`, `equilibre[{g,n,ton}]`, `posture[{t,c}]`, `priorites[{t,d,ex}]`, `reco`,
  `mesures` ; confiance `visible | probable | mesure` ; **interdits** : % de masse grasse, longueurs estimées, jugement esthétique,
  diagnostic médical.
- Exercices « leviers » calculés **hors IA** (`recoMorphoExercices`, déterministe). Envoi du compte rendu par e-mail.
- Modèle actuel : `claude-sonnet-5-5`, `max_tokens` 1800, appel HTTP brut, réponse « JSON seulement » demandée dans le texte.
- Zones prioritaires (2 max) → minimum de volume relevé au milieu de la fourchette ; utilisées par le générateur (`_zIni`).
- Clé `ANTHROPIC_API_KEY` **absente** → l'analyse répond « pas encore activée » (`disabled`). Chat IA séparé (Haiku 5.5, quota 2/jour).

## 3. Évolutions proposées [P]

### 3.1 Analyse morpho « niveau maximal »
1. **Modèle** : `claude-opus-5-5`, raisonnement adaptatif, **effort `high`** (thinking toujours actif sur ce modèle).
2. **Sortie garantie** : sorties structurées (`output_config.format` avec schéma JSON strict) au lieu de « réponds en JSON » —
   plus de JSON cassé, plus de champ manquant.
3. **Contrôle qualité des photos AVANT l'analyse** (nouveau champ `qualite_photos` : par vue `ok | insuffisante` + raison : flou,
   contre-jour, vêtements amples, cadrage, posture). Si une vue est insuffisante → **pas d'analyse de cette vue**, message clair
   (« reprends la photo de profil : contre-jour »), aucun constat inventé. Le quota n'est pas consommé si rien n'est analysable.
4. **Priorités reliées aux zones de l'app** : chaque priorité porte `zone` ∈ {fessiers, jambes, pectoraux, dos, epaules, bras,
   abdos} (mêmes clés que `ZONES_PRIO`) — c'est ce qui permet de passer au programme sans interprétation libre.
5. **Refus de sécurité** : reprise serveur automatique (`fallbacks`), et message neutre si tout refuse.
6. **Traçabilité** : chaque analyse stocke modèle, version de consigne (`MORPHO_PROMPT_VERSION`), date, coût (tokens), vues
   utilisées — pour comparer et rejouer.

### 3.2 Compte rendu
- Sections : **vue d'ensemble** · **constats** (badge de confiance sur chaque ligne) · **équilibre par groupe** · **posture** (toujours
  « à confirmer par un bilan de mouvement » si doute) · **ce qu'il faut mesurer** pour fiabiliser · **priorités suggérées**.
- **« Ce que Novalyz sait déjà »** : bloc séparé alimenté par les **données** (volume par muscle des 4 dernières semaines, force
  estimée, mensurations) — chiffres du moteur, jamais de l'IA. Si la photo dit « dos en retard » et que le volume dos est déjà
  au-dessus de l'optimum, le compte rendu le dit (« volume déjà élevé : la priorité serait la qualité d'exécution, pas plus de
  séries ») — cohérence photo ↔ données.
- Mention permanente : « Lecture de photos, pas une mesure. »

### 3.3 Proposition de programme
1. L'athlète voit les priorités suggérées, **coche 2 zones maximum** (pré-cochées : les 2 premières, modifiables).
2. **Le générateur v2 existant** construit le programme (niveau, objectif, jours, temps/séance, zones prioritaires, muscles exclus,
   antécédents → exercices évités).
3. L'IA rédige **l'explication** (« pourquoi ce programme pour toi ») à partir du programme généré et du compte rendu, avec la
   même règle : aucun chiffre qui ne vient pas du programme.
4. L'athlète **valide** (devient son programme) ou ajuste dans l'éditeur habituel. Rien n'est appliqué sans validation.
5. **Athlète suivi par un coach** : propositions coupées par défaut → le compte rendu et la proposition vont **au coach** (« tu as la
   main »), comme le reste de l'app.

## 4. Coût (estimation, à mesurer au premier essai réel)

| Étape (Opus 5.5 : 4 $ / 20 $ par million de tokens) | Entrée | Sortie (raisonnement compris) | ≈ coût |
|---|---|---|---|
| Analyse morpho (3 photos + contexte) | ~13 000 | ~10 000 | **0,25 $** |
| Explication du programme | ~8 000 | ~6 000 | **0,15 $** |
| **Par athlète** | | | **≈ 0,40 $** |

Garde-fous : quota 1 analyse / jour (existant), plafond de dépense mensuel côté Anthropic, coût réel enregistré par analyse.

## 5. Données personnelles (prérequis, non négociable)

- **Consentement explicite** (existant) complété : ce qui est envoyé (photos, sexe, mensurations), à qui (Anthropic, traitement de
  l'analyse), combien de temps.
- **Photos non stockées par Novalyz** après l'analyse (sauf si l'athlète choisit de les garder dans « Photos & mensurations »).
- Mise à jour de `privacy.html` (sous-traitant IA, finalité, durée, droit de suppression) **avant** toute activation en prod.
- Mineurs : pas d'analyse morpho (contrôle de la date de naissance). **[D]**

## 6. Protocole de validation (FIXÉ AVANT les essais, même méthode que sommeil / boucle / Sèche)

Jeu de test : 15 à 20 cas (testeurs volontaires, consentement écrit), variété (homme / femme, niveaux, morphologies), + 6 photos
volontairement mauvaises (flou, contre-jour, vêtements amples, cadrage, vue manquante, miroir).

| Critère | Mesure | Seuil |
|---|---|---|
| **M1 Constance** | mêmes photos analysées 3 fois : mêmes 2 premières zones prioritaires | ≥ 85 % des cas |
| **M2 Accord humain** | zones prioritaires IA vs avis d'un coach qui n'a pas vu le résultat IA (au moins 1 zone commune sur 2) | ≥ 75 % |
| **M3 Photos mauvaises** | « photo insuffisante » au lieu d'une analyse | 6 / 6 |
| **M4 Zéro chiffre non tracé** | tout chiffre du compte rendu / de l'explication existe dans les données ou le programme | 100 % |
| **M5 Interdits** | aucun % de gras, aucun diagnostic, aucun jugement esthétique | 100 % |
| **M6 Cohérence photo ↔ données** | aucune priorité « + volume » sur un muscle déjà au-dessus de l'optimum | 100 % |
| **M7 Compréhension (testeurs)** | « j'ai compris » et « ça me semble juste » ≥ 4/5 | ≥ 80 % |

Rapportés sans critère : coût réel moyen, durée, nombre de refus. **Si un critère échoue : on le dit, pas d'ajustement silencieux.**
Ordre : préprod (comptes de démo + photos de testeurs) → critères → prod pour quelques testeurs → retours.

## 7. Décisions attendues [D]

1. Mineurs exclus de l'analyse morpho ?
2. Photos : jamais conservées par défaut (proposé) ?
3. Le coach d'un athlète suivi voit-il les photos, ou seulement le compte rendu ? (proposé : compte rendu seul, photos sur accord
   explicite de l'athlète).
4. Nombre de testeurs et calendrier (après la période d'observation).

## 8. Plan de mise en place de la clé (à faire par le porteur, après la période d'observation)

> La clé ne transite **jamais** par le chat, le code, git ou les tests. Elle vit uniquement dans les secrets Supabase.

1. **Compte Anthropic** : console Claude Platform (platform.claude.com) → créer l'organisation Novalyz, renseigner le paiement.
2. **Deux workspaces** : « Novalyz Préprod » et « Novalyz Prod » (factures et plafonds séparés, une fuite en préprod ne touche pas la prod).
3. **Plafond de dépense** par workspace (ex. préprod 20 $/mois, prod 50 $/mois au départ) + alerte e-mail à 50 % / 80 %.
4. **Une clé API par workspace** (nommée `novalyz-preprod`, `novalyz-prod`). Copier la clé une seule fois au moment de sa création.
5. **Préprod d'abord** : Supabase → projet « Novalyz Preprod » (`vqxkeqjaqkkmtzxvqvhi`) → Edge Functions → Secrets → `ANTHROPIC_API_KEY`
   = clé préprod. Aucun redéploiement nécessaire (la fonction lit le secret à chaque appel).
6. **Vérification** (par Claude, sans voir la clé) : `ia_active: true` renvoyé par l'app préprod ; une analyse morpho de test avec des
   photos de testeur consentant ; coût réel lu dans la console Anthropic.
7. **Protocole §6** sur la préprod → résultats → décision du porteur.
8. **Prod** seulement après validation **et** mise à jour de `privacy.html` : même opération sur le projet prod (`jhbrvgguybynzeceeceu`)
   avec la clé prod.
9. **Rotation** : si une clé est exposée (capture d'écran, message), la révoquer dans la console et en recréer une ; tous les 6 mois sinon.
10. **Couper l'IA** à tout moment : supprimer le secret → l'app repasse en « pas encore activée » sans erreur (comportement existant).

Note : le chat IA existant (Haiku 5.5, quota 2/jour) s'activera **en même temps** que la clé (même secret). S'il ne doit pas être ouvert
aux testeurs en même temps, le dire avant l'étape 5 (le couper demande une petite modification de code, à faire après le gel). **[D]**

## 9. Décisions du porteur (15/11)

| Point | Décision |
|---|---|
| Mineurs | 🟢 **Exclus** de l'analyse morpho (contrôle de la date de naissance avant l'envoi des photos). |
| Photos | 🟢 **Jamais conservées** par Novalyz après l'analyse (pas d'option « garder », retirée de la maquette). |
| Coach | 🟢 **Compte rendu seul** ; les photos seulement si l'athlète y consent explicitement. |
| Testeurs | 🟢 **1 ou 2.** |

**Conséquence sur le protocole §6 (dit tel quel, pas d'ajustement silencieux)** : avec 1 ou 2 testeurs, M2 (accord avec un coach sur
15-20 cas) et M7 (≥ 80 % de testeurs) ne sont **pas mesurables** statistiquement. Le test devient un **pilote**, pas une validation :
- mesurables quand même : **M1** constance (3 analyses des mêmes photos), **M3** 6 photos volontairement mauvaises, **M4** zéro chiffre
  non tracé, **M5** interdits, **M6** cohérence photo ↔ données — sur plusieurs séries de photos par testeur (jours et lumières
  différents) ;
- M2 / M7 : **rapportés** (avis du coach et des testeurs, cas par cas), sans conclusion générale ;
- la prod reste limitée aux testeurs tant qu'un échantillon plus large n'a pas validé M2 / M7.

## 10. Mise en place de la clé — état (15/11)

- Console Anthropic : compte individuel (renommage = conversion en organisation d'équipe, non nécessaire) ; espaces **Novalyz Préprod**
  et **Novalyz Prod** créés ; pas de plafond en argent par espace sur ce type de compte → protection = **crédit prépayé sans recharge
  automatique** (+ limites de tokens en préprod).
- Clé `ANTHROPIC_API_KEY` **en préprod** : vérifiée par Claude sans voir la clé — `ia_active: true`, chat IA (Haiku 5.5) répond en ~4 s,
  réponse exacte au contrôle (0 séance cette semaine, objectif 4, dernière séance 05/11 — conforme à la base préprod).
- La clé avait d'abord été mise **en prod par erreur** → à supprimer du projet prod (demandé au porteur). Aucune utilisation de l'IA en
  prod constatée (table `quotas_jour` vide depuis le 14/11).
- L'analyse morpho reste sur le code actuel (Sonnet 5.5) jusqu'au code de la spec, après la période d'observation.
