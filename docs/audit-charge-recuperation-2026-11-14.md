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
