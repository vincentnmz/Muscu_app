# Moteur d'analyse (`NovalyzEngine`)

> Le moteur d'analyse est le **cœur** de Novalyz. C'est lui qui transforme les données en décisions. Toutes les recommandations et alertes en proviennent. Il est **déjà sport-agnostique** et n'a pas à être reconstruit — seulement isolé et étendu.

Implémentation actuelle : `index.html`, module autonome `NovalyzEngine` `v1.0.0`.

## 1. Philosophie

- **L'app constate, le coach prescrit.** Le moteur produit des constats et suggestions, jamais des ordres à l'athlète.
- **Aucun faux positif.** Une donnée absente → signal `null` → la règle qui en dépend ne se déclenche pas. Le silence est préféré à une alerte fausse.
- **Extensible sans risque.** Ajouter une règle = ajouter un objet dans `REGLES`. Rien d'autre à modifier.

## 2. Chaîne de traitement

```
data (brut, hétérogène)
   │
   ▼  normaliser(data)
faits = { valeurs, signaux }          ← valeurs numériques + booléens seuillés
   │
   ▼  REGLES.map(evaluer)
analyses[]                            ← chaque règle renvoie une analyse ou null
   │
   ▼  tri par priorité
[analyses triées]  (critique → succès)
```

API publique :
```js
NovalyzEngine.analyser(data, options)   // -> [analyses triées]
NovalyzEngine.normaliser(data)          // -> { valeurs, signaux }  (debug/tests)
NovalyzEngine.REGLES                    // règles (extension/inspection)
NovalyzEngine.SEUILS                    // seuils réglables à chaud
```

## 3. Les trois étages

### Étage 1 — `SEUILS` (paramètres réglables, centralisés)
Tous les seuils sont dans un seul objet. Les modifier ne demande de toucher à rien d'autre.

| Domaine | Seuils |
|---|---|
| Bien-être (1..5) | `sommeilFaible/Bon`, `energieFaible/Bonne`, `fatigueElevee/Faible`, `douleurElevee`, `ressentiDur/Facile` |
| **ACWR** | `acwrEleve=1.5`, `acwrBas=0.8`, `acwrOptMin/Max` |
| Charge/volume | `tonnageHaussePct=15`, `tonnageBaissePct=-15`, `chargeVarPct=3` |
| Séances 7j | `seancesFaible=1`, `seancesEleve=5` |
| Poids | `poidsVar=0.3` |
| Progression | `progExcellenteUp=3`, `progExcellenteDownMax=1` |

### Étage 2 — `normaliser(data)` : le contrat d'entrée
C'est **le point d'abstraction clé de toute l'architecture multisport.** La fonction lit des données de forme variable (getAppData ou objet plat) et produit :
- `valeurs` : nombres bruts nullables (`acwr`, `rpe7j`, `tonnage7j`, `sommeil`, `douleur`…) ;
- `signaux` : booléens déjà seuillés (`fatigueElevee`, `acwrEleve`, `progressionBaisse`…).

> **Pour brancher un nouveau sport, on n'écrit pas de nouveau moteur : on alimente `normaliser()` avec les indicateurs du module.** Un module foot remplit `acwr`, `rpe7j`, `charge28EvolPct` depuis ses données GPS ; toutes les règles ci-dessous fonctionnent alors sans modification.

### Étage 3 — `REGLES` : règles autonomes
Chaque règle lit **uniquement `f.signaux`** (déjà seuillés) et renvoie une analyse ou `null`. Une règle qui plante n'interrompt jamais le moteur (try/catch par règle).

## 4. Règles actuelles (13)

| id | Catégorie | Priorité | Se déclenche si (signaux) |
|---|---|---|---|
| `fatigue_generale` | récupération | important | sommeil faible + énergie faible + fatigue élevée |
| `surcharge_locale` | blessure | important | douleur élevée + volume élevé |
| `sous_entrainement` | entraînement | important | progression baisse + volume faible |
| `surmenage` | récupération | **critique** | progression baisse + volume élevé + fatigue élevée |
| `deficit_energetique` | nutrition | important | poids baisse + force baisse |
| `risque_blessure` | blessure | **critique** | ACWR élevé + douleur élevée + fatigue élevée |
| `acwr_eleve_seul` | charge | info | ACWR élevé seul (hors risque combiné) |
| `bonne_adaptation` | entraînement | succès | progression hausse + bon sommeil + fatigue faible |
| `tres_bonne_adherence` | adhérence | succès | régularité + progression excellentes |
| `marge_progression` | entraînement | info | fatigue faible + volume faible + progression stable |
| `recuperation_optimale` | récupération | succès | fatigue faible + sommeil bon + douleur absente |
| `douleur_signalee` | blessure | important | douleur élevée (hors cas déjà couverts) |
| `irregularite` | adhérence | info | régularité faible |

Les règles sont conçues pour **ne pas se dupliquer** : une règle générale (ex : `risque_blessure`) désactive les règles partielles (`acwr_eleve_seul`, `douleur_signalee`) via des gardes explicites.

## 5. Priorités

Tri décroissant : `critique` → `important` → `info` → `succès`. Le classement (`RANG_PRIORITE`) sert aussi au score de surveillance côté coach.

## 6. Ce qui est déjà générique vs à généraliser

| Signal | Générique ? | Note |
|---|---|---|
| `sommeil/energie/fatigue/douleur/ressenti` | ✅ Oui | Bien-être universel |
| `acwr` | ✅ Oui | Métrique inter-sports de charge |
| `rpe7j` | ✅ Oui | sRPE universel |
| `poids` | ✅ Oui | Universel |
| `volumeEleve/Faible` | ⚠️ Semi | Aujourd'hui = tonnage muscu ; à alimenter par module |
| `progressionHausse/Baisse` | ⚠️ Semi | Aujourd'hui = charge/1RM muscu ; devient « performance » par module |
| `forceBaisse/Hausse` | ⚠️ Semi | Idem |

**Conséquence pour la migration** : la seule chose à faire pour rendre le moteur pleinement multisport est de **définir comment chaque module alimente `volume`, `progression`, `charge`** dans `normaliser()`. Les 13 règles restent inchangées.

## 7. Règle d'extension d'un module

Un module sport peut aussi **injecter ses propres règles** additionnelles dans `REGLES` (ex : une règle « sprint en régression » pour le foot), tant qu'elles ne lisent que des signaux et respectent la philosophie « constater, pas prescrire ». Le noyau ne change pas.
