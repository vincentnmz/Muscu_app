# Générateur de programmes v2 — spec (en construction)

> Doc de spec vivant, rempli **par le porteur**, programme par programme.
> Objectif : remplacer `_genProgramme`/`_GEN_*` par un moteur piloté par des gabarits riches.

## Questions à la création (4)
1. **Objectif** — Hypertrophie · Force · Tonification · Remise en forme *(Force = programme & exos à part)*
2. **Jours / semaine** — 2 · 3 · 4 · 5
3. **Niveau** — Débutant · Intermédiaire · Avancé
4. **Temps par séance** *(NOUVEAU)* — coupe la liste d'exos par ordre de priorité.
   Règle proposée (À CONFIRMER) : 30→3 exos · 45→4 · 60→5-6 · 75→6-7 · 90→8.

## Modèle de données (par slot d'exercice)
```
slot = {
  muscle, type: 'poly' | 'iso',
  sets,                     // nb de séries
  reps: [min, max] | 'echec',
  rpe,                      // cible d'effort (défaut 8 ; 'echec' → 10)
  repos_sec,                // composés (poly) 180 s · isolation (iso) 90 s
  charge_pct_1rm: null,     // pas de % imposé (hypertrophie) sauf indication
  exos: [principal, variante1, variante2, ...],   // interchangeables (le 1er dispo au catalogue = principal, le reste = remplaçants)
  superset_id?              // slots partageant le même id = superset enchaîné
}
```
Le **temps** garde les slots par **priorité croissante** (1 d'abord).

---

## ✅ PROGRAMME 1 — Full Body · 2 jours · HYPERTROPHIE  *(figé 20 oct.)*
Défauts appliqués : **3 séries**, **RPE 8** (abdos = échec), **pas de % 1RM** (charge libre).
Repos (porteur) : **composés = 3 min (180 s)** · **isolation = 1 min 30 (90 s)** · superset bras = 90 s entre les tours.

### Jour A
| Prio | Muscle | Type | Séries×Reps | Exos (principal → variantes) |
|---|---|---|---|---|
| 1 | Quadriceps | poly | 3 × 6-8 | Squat → Hack squat · Belt squat · Presse |
| 2 | Pecs | poly | 3 × 8-12 | Développé haltères → Développé machine (plaque/poids) · Développé barre |
| 3 | Dos | poly | 3 × 8-12 | Tirage vertical prise serrée → prise large · Traction |
| 4 | Épaules | iso | 3 × 8-15 | Élévation latérale poulie → haltères · Élévation frontale (poulie/haltère/barre) |
| 5 | **Superset bras** (S1) | iso | 3 × 8-15 | Triceps : Extension poulie corde → barre **+** Biceps : Curl barre → poulie |
| 6 | Abdos | iso | 3 × échec | Crunch → Relevé de jambes |

### Jour B
| Prio | Muscle | Type | Séries×Reps | Exos (principal → variantes) |
|---|---|---|---|---|
| 1 | Fessiers | poly | 3 × 6-10 | Hip thrust → Fente bulgare |
| 2 | Ischios | iso | 3 × 8-15 | Leg curl assis → couché · debout |
| 3 | Pecs | poly | 3 × 6-12 | Développé incliné haltères → incliné machine/poulie · décliné |
| 4 | Dos | poly | 3 × 8-12 | T-bar row → Rowing banc · Rowing bûcheron |
| 5 | **Superset bras** (S1) | iso | 3 × 8-15 | idem Jour A (triceps + biceps enchaînés) |

> Note : Jour A = quadri/pecs/dos/épaules/bras/abdos · Jour B = fessiers/ischios/pecs/dos/bras (pas d'épaules ni abdos en B — tel que fourni par le porteur).

---

## ✅ PROGRAMME 2 — PPL · 3 jours · HYPERTROPHIE  *(figé 20 oct.)*
Conventions : 3 séries · repos composés 180 s / iso 90 s · RPE 8 · pas de % 1RM.
Règles porteur : **groupé par muscle**, **barre en dernier choix**, **écarté en 1er** (pecs),
angles variés. (Incliné **vs** décliné précis = plus tard via morpho-anat ; ici les deux en options.)
Exos = catalogue réel de l'app.

### Push (pecs → épaules → triceps)
| Prio | Muscle | Type | 3× | Principal → variantes |
|---|---|---|---|---|
| 1 | Pecs (écarté) | iso | 12-15 | Ecarté poulie haute → Ecarté machine · Ecarté poulie basse |
| 2 | Pecs (incliné/décliné) | poly | 8-12 | Développé incliné Hammer → Développé décliné machine · Développé incliné à la Smith · Développé couché incliné haltère |
| 3 | Pecs (horizontal) | poly | 8-10 | Développé couché haltère → Développé machine Hammer · Développé machine · Développé couché barre |
| 4 | Épaules (latéral) | iso | 12-15 | Élévation latérale haltère → Elévation latérale uni à la poulie |
| 5 | Épaules (développé) | poly | 8-12 | Développé militaire aux haltères → Développé militaire à la Smith |
| 6 | Triceps | iso | 8-12 | Extension poulie barre → Dips triceps · Extension poulie corde |
| 7 | Triceps | iso | 10-15 | Extension poulie corde → Extension triceps banc · Extension dos à la poulie corde |

### Pull (dos → arrière-épaule → biceps)
| Prio | Muscle | Type | 3× | Principal → variantes |
|---|---|---|---|---|
| 1 | Dos (vertical) | poly | 8-12 | Traction → Tirage vertical prise large · Tirage vertical prise serrée |
| 2 | Dos (horizontal) | poly | 8-12 | T-bar row prise basse → Rowing machine · Rowing bucheron · Rowing barre |
| 3 | Dos (épaisseur) | poly | 10-15 | Tirage trapèze machine → T-bar row prise haute · shrugs aux haltéres · shrugs barre |
| 4 | Arrière-épaule | iso | 12-15 | Arrière épaule à la poulie → Arrière épaule haltère |
| 5 | Biceps (incliné) | iso | 8-12 | Curl incliné au banc → Curl incliné uni poignée à la poulie |
| 6 | Biceps (marteau) | iso | 10-15 | Curl marteau aux haltéres → Curl marteau à la poulie |

### Legs (quadriceps → ischios → fessiers → mollets)
| Prio | Muscle | Type | 3× | Principal → variantes |
|---|---|---|---|---|
| 1 | Quadriceps | poly | 6-8 | Squat → Hack squat · Belt squat |
| 2 | Quadriceps (presse) | poly | 8-12 | Presse inclinée → Presse horizontale · Pendulum |
| 3 | Quadriceps (iso) | iso | 12-15 | Leg extension |
| 4 | Ischios | poly | 8-12 | RDL barre → RDL haltère |
| 5 | Ischios (iso) | iso | 10-15 | Leg curl assis → Leg curl allongé · Leg curl debout |
| 6 | Fessiers | poly | 8-12 | Hip thrust → Hip thrust machine · Abduction machine · Fente bulgare · Fente longue |
| 7 | Mollets | iso | 12-20 | Les extensions mollets debout → assis · à la presse |

---

## Règles transverses (porteur)
- **Groupé par muscle** dans chaque séance.
- **Barre = dernier choix** (couché, militaire).
- **≥1 variante par exercice** (liste de choix interchangeables) ; au démarrage = 1er dispo, les autres = remplaçants.
- **Coupe par le temps** : garder d'abord **1 exercice par muscle** (le prioritaire), puis les 2ᵉ/3ᵉ si le temps reste. ✅ validé

## À faire ensuite
- [ ] Confirmer la règle **temps → nb d'exos**.
- [ ] Programmes suivants : Full Body autres objectifs ? puis 3 j / 4 j / 5 j, puis **Force** (exos dédiés).
- [ ] Construire le moteur v2 (data model ci-dessus) + la 4e question + gestion supersets + variantes → « Remplacer ».
