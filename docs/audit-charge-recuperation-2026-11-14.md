# Audit « charge ↔ récupération » (14/11/2026) — lecture seule, AUCUN CODE

> Légende : **[V]** vérifié contre le code (et sur copies de données) · **[D]** déduction · **[?]** à vérifier.
> Données : copies locales (John, Vincent, Lucas), jamais affichées en clair ; seuls les indicateurs sont cités.

## 1. Les mesures en jeu [V]

| Mesure | Calcul | Rôle |
|---|---|---|
| **Fraîcheur (TSB %)** `moteur.charge_fatigue.tsbPct` | fitness-fatigue (ctl/atl), sRPE ou tonnage | **mesure principale** de la charge : `surcharge` = Élevé si ≤ −30, Modéré si < −12 (`index.ts` ~3624) |
| **ACWR** `dashboard.acwr` | aiguë / chronique | **repli** seulement si la fraîcheur manque ; seuils 0,8 / 1,3 / 1,5 |
| **Récupération** `moteur.recup` | indice de Hooper sur 7 jours (sommeil moyen, fatigue/stress/courbatures) — ne regarde **pas** la charge | Excellent ≥ 75, Bon ≥ 60, Moyen ≥ 45, Faible |
| **Règle « charge + ressenti »** `charge_ressenti.evaluable / degrade` | — | le moteur ne dit « tu encaisses bien » **que si** le ressenti a pu être évalué (commentaire `index.ts` ~3750) |

## 2. Constats

### A. Croisé dit « tu encaisses bien ta charge » sans appliquer la règle du moteur — **[V] contradiction**
`buildSyntheseCroise` (`index.ts` ~2407) : si `recup` = Excellent/Bon → « Ta récupération est … — **tu encaisses bien ta charge actuelle** ».
Il ne regarde ni la charge, ni `charge_ressenti.evaluable`. Le moteur (reco) et Forme (`_frEtat`, `app.js` ~15375) appliquent, eux, la règle.
- Copie Vincent : fraîcheur −71 % (charge Élevé), ressenti **non évaluable** → reco « Ta charge monte — renseigne ton état… », Forme
  « ressenti non renseigné pour confirmer » ; **Croisé : « tu encaisses bien ta charge actuelle »**. Trois écrans, deux discours.
- Copies John (fraîcheur +82 %, sous-charge) et Lucas (+74 %) : « tu encaisses bien » alors qu'il n'y a **presque pas de charge à
  encaisser** — la phrase n'est pas fausse sur la récup, mais elle affirme un lien charge → récup que rien ne mesure.

### B. Fiche coach : tuile « ACWR 1,16 · zone optimale » en vert pendant que le moteur dit charge Élevé — **[V] contradiction**
`computeMarqueursCoach` / `renderCoachIndicateurs` (`app.js` ~7527 / ~7683) affichent l'ACWR (indice de **repli**) comme tuile principale,
avec sa propre zone de couleur, alors que la décision du moteur repose sur la fraîcheur. Copie Vincent : ACWR 1,16 « zone optimale »
(vert) / `surcharge` Élevé (fraîcheur −71 %). Le coach voit « optimal » d'un côté, « charge élevée » de l'autre.
De plus cette tuile **ne respecte pas `acwr_fiable`** : l'athlète (`app.js` ~1039, `acwr_fiable === true` exigé) et la fiche
ACWR détaillée (~8505) le respectent, pas la tuile coach (elle prend `dashboard.acwr` dès qu'il existe, sinon un calcul local
`computeACWR`).

### C. Deux calculs d'ACWR (serveur + `computeACWR` local) — **[V] existe, [?] écart réel**
Le local ne sert qu'en repli quand le serveur n'a pas de valeur. Écart entre les deux non mesuré ; à supprimer de préférence
(une seule source = le moteur) plutôt qu'à comparer.

### D. « Frais — Tu es reposé, bon moment pour pousser » en sous-charge / reprise — **[D]**
`_frEtat` ne regarde que la fraîcheur : un athlète qui ne s'entraîne presque plus (copie John, sous-charge) lit « bon moment pour
pousser ». Après une absence, c'est l'inverse de la prudence de reprise (R0). À confirmer sur le banc (profil `avance_pause`).

### Vérifié juste [V]
- Récupération = 7 derniers jours seulement (pas de vieux questionnaire qui traîne) ; douleur = dernière saisie.
- Reco moteur : les 4 cas charge × ressenti sont distincts et cohérents avec la règle.
- Tuile coach « Charge » (`app.js` ~1006) : applique la règle ressenti (« En hausse · encaissée » seulement si évaluable).

## 3. Corrections proposées [P] — à valider, rien n'est codé

| # | Proposition | Fichiers |
|---|---|---|
| A | Croisé : reprendre **la même règle** que le moteur — « tu encaisses bien » seulement si charge en hausse **et** ressenti évaluable non dégradé ; sinon une phrase sur la récup seule (« Ta récupération est bonne ces 7 derniers jours. ») | `index.ts` (backend → déploiement manuel prod) |
| B | Fiche coach : la tuile principale montre la **charge du moteur** (Habituelle / En hausse / Élevée), l'ACWR passe en indice secondaire et **seulement si `acwr_fiable`** | `js/app.js` |
| C | Retirer le repli `computeACWR` local (une seule source) | `js/app.js` |
| D | `_frEtat` « Frais » : ne pas dire « bon moment pour pousser » en sous-charge / reprise (« Tu es reposé. ») | `js/app.js` |

Chaque correction : banc de profils (ajouter un profil « charge en hausse sans questionnaire »), tests, préprod, validation.

---

## 4. Décisions du porteur (14/11)

| Point | Décision |
|---|---|
| A — Croisé utilise la règle du moteur | 🟢 |
| B — Coach : charge du moteur + ACWR complémentaire (jamais « ACWR → zone optimale ») | 🟢 |
| C — Une seule source ACWR (serveur), suppression du calcul local | 🟢 |
| D — « Frais » après pause / reprise → « Tu es reposé. » | 🟢 |
| Processus | banc de profils → comportement attendu écrit → test automatisé → préprod → vérification réelle → prod. Test clé : **pour les mêmes données, Aujourd'hui, Croisé, Forme et Coach ne se contredisent pas.** |

## 5. Correction de mon audit (vérifié en traçant le rendu, 14/11)

**A était mal localisé.** La phrase « Ta récupération est … — tu encaisses bien ta charge actuelle » est produite par le serveur
(`analyse_synthese.croise`) mais **n'est affichée nulle part** : l'écran Croisé de l'athlète recalcule sa lecture côté app
(`_maCroise`) et n'affiche que « Récupération : Excellent · disponibilité Prêt » [V]. Le banc l'a confirmé : sur le profil
« charge en hausse sans ressenti », aucun écran ne disait « tu encaisses bien ». La correction serveur reste faite (sortie honnête
si elle est réutilisée : IA, mail), et la même règle a été appliquée aux deux endroits **réellement affichés** qui l'enfreignaient
potentiellement : Croisé **coach** (« bonne assimilation pour l'instant ») et la règle « Bonne adaptation » du moteur front.

**B était aussi en partie mal localisé** (vérifié par capture, 390 et 1280 px) : la tuile « ACWR 0,97 · zone optimale »
(`renderCoachIndicateurs`, `#cd-indicateurs`) est **masquée à l'écran** sur mobile et sur ordi ; le banc l'avait rendue visible de
force. Ce qu'un coach **voyait vraiment** : la carte « Charge & assiduité » avec un ACWR (seulement s'il est fiable, sans zone) et
**aucun verdict de charge du moteur**. La correction B ajoute ce verdict (« Charge (moteur) ») sur la carte visible ; la tuile
masquée est corrigée aussi (au cas où elle réapparaîtrait) et reste contrôlée par le banc, sous un libellé explicite.
Les 12 contradictions R2/R3 comptées ci-dessous viennent de ce bloc masqué : **les contradictions réellement visibles avant
correction étaient les 4 R5** (« bon moment pour pousser » avec douleur ou après 10 jours sans séance).

## 6. Comportement attendu (écrit avant le code, vérifié par le banc)

Contrôle automatique `scripts/banc-profils/coherence.js` sur **tout** le texte affiché (Aujourd'hui, Analyses muscu,
Analyses ▸ Croisé, Forme ; fiche coach mobile + tuiles ordi + Croisé coach), comparé au moteur des **mêmes** données :

| Règle | Attendu |
|---|---|
| R1 (A) | « tu encaisses bien », « encaissée », « bonne assimilation » **seulement si** `charge_ressenti.evaluable` et non `degrade` |
| R2 (B) | aucune zone ACWR (« zone optimale / de risque », « charge élevée », « sous-charge » accolés à l'ACWR) |
| R3 (B/C) | aucune valeur ACWR affichée si `acwr_fiable ≠ true` |
| R4 (B) | jamais « Habituelle » si `moteur.surcharge` ≠ Faible |
| R5 (D) | « bon moment pour pousser » **seulement si** disponibilité Prêt, sans absence / sous-charge / douleur / contexte |

**Avant correction** (code de prod) : 16 contradictions sur 13 cas — R5 ×4 (douleur ×3, reprise ×1 : « Tu es reposé — bon moment
pour pousser » à un athlète en « À surveiller » pour douleur), R2 ×7 et R3 ×5 sur les tuiles coach (ex. « ACWR 1,49 · charge
élevée » alors que l'ACWR est non fiable et le moteur dit charge Faible ; « ACWR 0,97 · zone optimale »). **Après : 0.**

Nouveaux profils : `charge_hausse_sans_ressenti` (fraîcheur −93 %, 2 questionnaires récents), `reprise_apres_pause` (10 jours
sans séance), ajoutés aussi à l'équipe coach. Test unitaire : `tests/coherence-charge-recup.test.js` (règles R1-R5 + A serveur).

## 7. Ce qui a été changé

- **A** `index.ts` `buildSyntheseCroise` : « encaisses bien » seulement si charge en hausse + ressenti évalué non dégradé ; sinon
  récup seule (« ces 7 derniers jours »), ou « renseigne ton état », ou « ton ressenti baisse ». Croisé coach : « bonne
  assimilation » sous la même condition, sinon « ressenti récent insuffisant pour confirmer l'assimilation ». Règle front
  « Bonne adaptation » : la mention « tu encaisses bien la charge actuelle » retirée.
- **B** Fiche coach : tuile **Charge** = verdict du moteur (`_chargeMoteur`, même logique que la tuile cockpit : Habituelle /
  En hausse / En hausse · encaissée / Élevée), ACWR en sous-titre « indice complémentaire » seulement si fiable ; carte mobile
  « Charge & assiduité » : tuile « Charge (moteur) » + ACWR complémentaire seulement si fiable.
  Note : « Élevée » n'apparaît que si le ressenti se dégrade (règle audit #3 déjà validée : jamais d'alarme sur la charge seule) ;
  charge −93 % sans ressenti → « En hausse ».
- **C** `computeACWR`, `renderACWR`, `renderACWRChart` supprimés (la carte était masquée en permanence et portait des verdicts
  « Zone optimale / Zone danger ») ; plus de repli local dans `computeMarqueursCoach`.
- **D** `_peutPousser(m)` : Forme (`_frEtat`) et carte « Charge & fatigue » d'Aujourd'hui disent « Tu es reposé. » hors cas Prêt
  sans alerte.

## 8. Constat nouveau, NON corrigé (à décider) — E

Profil `charge_hausse_sans_ressenti` : sur **le même écran Aujourd'hui**, « Ta charge monte — renseigne ton état du jour » et
« Levier : **+4 séries de Squat** (4,5 → 10 séries/sem). Et sur ta dernière série, va jusqu'à **RPE 9-10** » [V, banc].
Le levier volume regarde la moyenne des **4 semaines terminées** (4,5 séries) alors que la semaine en cours en compte déjà 18 ;
et il pousse l'intensité pendant un pic de charge. Même chose côté coach (« Piste… »). Touche au moteur de décision (leviers) →
**pas de correction sans décision**. Piste : suspendre les leviers « + séries / RPE 9-10 » quand `moteur.surcharge` ≠ Faible
(comme pour une gêne), avec une phrase « on attend ton ressenti avant d'ajouter du volume ».

## 9. E — décision du porteur (14/11) et comportement attendu (écrit AVANT le code)

**Règle validée** : quand la charge est **inhabituelle** et que le ressenti nécessaire pour l'interpréter **n'est pas assez
renseigné**, Novalyz **ne propose pas d'augmenter** séries, charge ou effort. « Je ne sais pas encore si tu encaisses cette
charge, donc je ne vais pas te demander d'en rajouter » — **sans laisser l'athlète sans plan**.

**Condition (vérité = moteur)** : `moteur.surcharge` ≠ « Faible » (fraîcheur < −12 %, = « Charge en hausse ») **et** ressenti
**non évalué** (`charge_ressenti.evaluable` ≠ true). **Extension proposée** (même logique, à confirmer par le porteur) : ressenti
**dégradé** (`degrade` = true) — le moteur dit déjà « allège 1 séance » ; proposer +séries le contredirait.
Hors champ (question ouverte) : charge en hausse **bien encaissée** (ressenti évalué, stable) — le moteur dit « continue,
**sans empiler davantage de volume** » ; on ne suspend rien dans ce cas sans décision.

| Proposition | Pendant un pic non interprétable |
|---|---|
| ❌ Plan : « +N séries / muscle : N séries cette semaine » (volume) | **en pause**, affichée barrée avec la raison, hors compteur, **jamais enregistrée au journal** (même mécanique que la gêne) |
| ❌ Plan : cible « à pousser » (charge ou +1 rep de plus) | **en pause** (idem) |
| ❌ Levier d'un exercice : « +N séries de… », « va jusqu'à RPE 9-10 », « ajoute 1 série » | remplacé par : garde tes séries et ta charge prévues, sans aller à l'échec ; renseigne ton état |
| ❌ Mail récap : « il manque environ N séries » | remplacé par la même phrase de prudence |
| ✅ Maintien (« garde X kg, vise RPE 8 ») | reste |
| ✅ Allègement (revenir dans la fourchette avec une charge plus basse) | reste |
| ✅ Récupération / renseigner le ressenti | proposé (reco du moteur « renseigne ton état du jour ») |
| ✅ Garde-fous (gêne, reprise, déload) | **prioritaires** : une action en pause pour gêne garde la raison « gêne » |

**Contrôle permanent R6** (banc, `coherence.js`) : si la condition est vraie, aucun texte affiché ne contient « +N série(s) de »,
« jusqu'à RPE 9-10 », « ajoute 1 série » ni « il manque environ » (athlète, Analyses, Croisé, Forme, fiche coach).

### 9 bis. E — réalisé (14/11, en préprod)

- `_lv3PicCharge(data)` (app) = condition du §9 ; même condition côté serveur pour le mail récap.
- **Plan** : actions « séries » et « cible à pousser » **non encore faites** → en pause (« en pause (charge en hausse) »),
  hors compteur, jamais au journal ; compteur « en pause » au lieu de « 0 / 0 » quand tout est en pause (athlète et coach).
  Action **déjà faite** cette semaine : laissée faite (c'est un acquis, pas une proposition), explication « Objectif atteint
  cette semaine : n'en rajoute pas tant que ta charge est en hausse » au lieu de « ex. +4 séries ».
- **Leviers** (Analyses, fiche coach « Piste ») : volume / effort laissé en réserve / marche → « garde tes séries et ta charge
  prévues, sans aller à l'échec, et renseigne ton état du jour » ; la mention « va jusqu'à RPE 9-10 » est retirée des autres.
- **Cibles de séance** (saisie + Reco du jour) : mode **maintien** existant (« mêmes charges que la dernière fois, pas de
  progression aujourd'hui »), avec la raison « charge en hausse, ressenti pas encore renseigné » → plus de « N exercices à
  pousser ».
- **Recos de secours** (Analyses sans plan) et **mail récap** : « Charge en hausse : … garde tes séries et ta charge prévues… »
  au lieu de « à pousser » / « il manque environ N séries ».
- Gêne : reste prioritaire (une action déjà en pause pour gêne garde sa raison « gêne »).
- **Banc** : profil `pic_plan_a_faire` (pic la semaine dernière, plan pas fait) ; R6 étendu à « à pousser (charge ou +1 rep) »
  et « Prochaine fois : vise » ; une **erreur JavaScript fait désormais échouer le banc**, même en `--maj` (une erreur de syntaxe
  de ma part a été attrapée ainsi pendant ce lot, avant tout envoi). Tests : `tests/coherence-charge-recup.test.js` (26 vérifs).
- **Choix à confirmer** : ressenti **dégradé** inclus dans la règle (le moteur dit déjà « allège ») ; charge en hausse **bien
  encaissée** laissée hors règle (le moteur dit « sans empiler davantage de volume » — à trancher).

### 9 ter. Décision du porteur sur les deux choix (14/11)

| Situation | + séries | + RPE / pousser |
|---|---|---|
| Charge en hausse + ressenti insuffisant | ❌ | ❌ |
| Charge en hausse + ressenti **dégradé** | ❌ | ❌ (🟢 inclus) |
| Charge en hausse + **bien encaissée** | ⚠️ selon le diagnostic | ✅ si justifié |
| Charge normale + bien encaissée | ✅ | ✅ |
| Gêne | ❌ | ❌ |

🟠 Charge en hausse **bien encaissée** : **pas de pause** — le code actuel ne la met pas en pause (vérifié : `_lv3PicCharge`
renvoie null si ressenti évalué et non dégradé ; test « E app : Élevé + évalué stable → pas de pic »). Ne pas confondre volume et
progression. Piste produit notée (non codée) : « Ta charge monte et tu l'encaisses bien. Pas besoin d'ajouter du volume ; si le
critère de progression est atteint, tu peux progresser sur la performance. »
