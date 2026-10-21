# Générateur de programmes v2 — spec (en construction)

> Doc de spec vivant, rempli **par le porteur**, programme par programme.
> Objectif : remplacer `_genProgramme`/`_GEN_*` par un moteur piloté par des gabarits riches.

## Modèle figé (21 oct.) — DEUX PARCOURS selon le niveau
Maquette de référence : [`../mockups/novalyz-generateur-v2.html`](../mockups/novalyz-generateur-v2.html).

### 🟢 Débutant → galerie de programmes « tout faits » (il choisit, il ne configure pas)
Chaque carte a une **explication** (pour qui / combien de fois / pourquoi). Catalogue validé :
| Programme | Orga | Jours |
|---|---|---|
| Full Body découverte | fb | 2 |
| Full Body | fb | 3 |
| Push / Pull / Legs | ppl | 3 |
| Upper / Lower | ul | 4 |
| Split (1 muscle/jour) | split | 5 |
Reps modérées (10-12 / 12-15), 3 séries.

### 🔵 Intermédiaire / Avancé → configurateur
Questions : **Objectif** · **Organisation** · **Jours** · **Temps/séance**. Puis **l'athlète planifie lui-même** (quels jours, où placer les repos).
- **Organisation** = `Full Body` · `Upper/Lower` · `PPL` · `Split` · `Custom`. Une organisation = **une règle** qui répartit les blocs muscle sur N jours (plus de splits hard-codés par nombre de jours).
  - Jours logiques : fb `2·3·4` · ul `2·4·6` · ppl `3·4·5·6` (4-5 j = PPL + rappel Haut/Bas) · split `5·6` · custom `2→6`.
  - **Custom** = **squelette modifiable** : base équilibrée proposée, l'athlète ajoute/retire les muscles de chaque jour.
- **Temps/séance** — coupe la liste d'exos par priorité, en gardant d'abord **1 exo par muscle**. Plafond maquette : 45→5 · 60→7 · 75→8 · 90→10.
- Séries : interméd. 3 · avancé 4. **6 jours réservé interméd./avancé.**
- RPE par série : S1·S2 = 1 rép en réserve · dernière = 2-3. Repos composés 2-3 min / iso 90 s (modulable).
- Objectif **Force** = reps/charge différentes (poly 4-6) ; **exos & schéma dédiés Force à écrire** (séries montantes, %1RM).

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

## ✅ PROGRAMME 3 — Haut / Bas · 4 jours · HYPERTROPHIE  *(figé 21 oct.)*
Conventions : 3 séries · **bras (biceps+triceps) en superset** · exos = catalogue réel · groupé par muscle · barre/militaire en dernier choix · écarté en 1er (pecs).
**Repos** : composés (poly) = **2–3 min (120-180 s)** · isolation (iso) = **1 min 30 (90 s)** · superset bras = 90 s entre les tours.
→ *à moduler au ressenti : si fatigue, rallonger le repos pour garder assez d'intensité sur la série suivante.*
**RPE / RIR** : séries **1 et 2 = 1 rép en réserve (RPE 9)** · **dernière série = 2-3 réps en réserve (RPE 7-8)**.
Jours : Lun / Mar / Jeu / Ven.

### Haut A (pecs → dos → épaules → biceps+triceps)
| Prio | Muscle | Type | 3× | Principal → variantes |
|---|---|---|---|---|
| 1 | Pecs (incliné) | poly | 8-12 | Développé incliné Hammer → Développé incliné à la Smith · Développé couché incliné haltère |
| 2 | Pecs (écarté) | iso | 12-15 | Ecarté poulie haute → Ecarté machine |
| 3 | Dos (vertical) | poly | 8-12 | Traction → Tirage vertical prise large · prise serrée |
| 4 | Dos (horizontal) | poly | 8-12 | T-bar row prise basse → Rowing machine · Rowing bucheron · Rowing barre |
| 5 | Épaules (latéral) | iso | 12-15 | Élévation latérale haltère → Elévation latérale uni à la poulie |
| 6 | **Superset bras** (S1) | iso | 8-15 | Biceps : Curl incliné au banc → Curl incliné uni poignée à la poulie **+** Triceps : Extension poulie barre → Extension poulie corde |

### Bas A (quadri → ischios → fessiers → mollets → abdos)
| Prio | Muscle | Type | 3× | Principal → variantes |
|---|---|---|---|---|
| 1 | Quadriceps | poly | 6-8 | Squat → Hack squat · Belt squat |
| 2 | Quadriceps (presse) | poly | 8-12 | Presse inclinée → Presse horizontale · Pendulum |
| 3 | Ischios | poly | 8-12 | RDL barre → RDL haltère |
| 4 | Fessiers | poly | 8-12 | Hip thrust → Hip thrust machine · Abduction machine · Fente bulgare |
| 5 | Mollets | iso | 12-20 | Les extensions mollets debout → assis · à la presse |
| 6 | Abdos | iso | échec | Crunch à la poulie → Relevé de jambe · Roulette |

### Haut B (pecs → dos → épaules → biceps+triceps) — autres angles
| Prio | Muscle | Type | 3× | Principal → variantes |
|---|---|---|---|---|
| 1 | Pecs (horizontal) | poly | 8-10 | Développé couché haltère → Développé machine Hammer · Développé machine · Développé couché barre |
| 2 | Pecs (décliné) | poly | 10-12 | Développé décliné machine → Développé décliné à la Smith |
| 3 | Dos (épaisseur/trapèzes) | poly | 10-15 | Tirage trapèze machine → T-bar row prise haute · shrugs aux haltéres · shrugs barre |
| 4 | Dos (vertical serré) | poly | 8-12 | Tirage vertical prise serrée → Tirage vertical uni à la poulie · Traction |
| 5 | Épaules (développé) | poly | 8-12 | Développé militaire aux haltères → Développé militaire à la Smith |
| 6 | Épaules (arrière) | iso | 12-15 | Arrière épaule à la poulie → Arrière épaule haltère |
| 7 | **Superset bras** (S1) | iso | 10-15 | Biceps : Curl marteau aux haltéres → Curl marteau à la poulie **+** Triceps : Extension poulie corde → Extension triceps banc · Extension dos à la poulie corde |

### Bas B (quadri → ischios → fessiers → mollets → abdos) — autres angles
| Prio | Muscle | Type | 3× | Principal → variantes |
|---|---|---|---|---|
| 1 | Quadriceps | poly | 8-12 | Hack squat → Belt squat · Pendulum |
| 2 | Quadriceps (iso) | iso | 12-15 | Leg extension |
| 3 | Ischios | poly | 8-12 | RDL haltère → Relevé de bassin |
| 4 | Ischios (iso) | iso | 10-15 | Leg curl assis → Leg curl allongé · Leg curl debout |
| 5 | Fessiers | poly | 10-12 | Fente bulgare → Fente longue · Kick back · Abduction machine |
| 6 | Mollets | iso | 12-20 | Les extensions mollets assis → debout · à la presse |
| 7 | Abdos | iso | échec | Relevé de jambe → Roulette · Crunch à la poulie |

---

## ✅ PROGRAMME 4 — Split (1 muscle/jour) · 5 jours · HYPERTROPHIE  *(figé 21 oct.)*
L'un des **deux** programmes 5 jours (l'autre = PPL + Haut/Bas, cf. Programme 5).
Conventions : 3 séries · exos = catalogue réel · groupé par muscle · barre/militaire en dernier · écarté en 1er (pecs).
**Repos** : composés = 2-3 min · iso = 1 min 30 (rallongeable au ressenti).
**RPE / RIR** : S1 et S2 = 1 rép en réserve (RPE 9) · dernière série = 2-3 réps en réserve (RPE 7-8).
**Jour Bras = séries classiques (PAS de superset)** — journée dédiée, assez de temps. (Le superset bras reste sur Full Body / PPL / Haut-Bas.)
Jours : Lun / Mar / Mer / Jeu / Ven.

### J1 · Pectoraux
| Prio | Angle | Type | 3× | Principal → variantes |
|---|---|---|---|---|
| 1 | Écarté | iso | 12-15 | Ecarté poulie haute → Ecarté machine · Ecarté poulie basse |
| 2 | Incliné | poly | 8-12 | Développé incliné Hammer → Développé incliné à la Smith · Développé couché incliné haltère |
| 3 | Horizontal | poly | 8-10 | Développé couché haltère → Développé machine Hammer · Développé machine · Développé couché barre |
| 4 | Décliné | poly | 10-12 | Développé décliné machine → Développé décliné à la Smith |

### J2 · Dos
| Prio | Angle | Type | 3× | Principal → variantes |
|---|---|---|---|---|
| 1 | Vertical | poly | 8-12 | Traction → Tirage vertical prise large · prise serrée |
| 2 | Horizontal | poly | 8-12 | T-bar row prise basse → Rowing machine · Rowing bucheron · Rowing barre |
| 3 | Vertical serré | poly | 8-12 | Tirage vertical prise serrée → Tirage vertical uni à la poulie |
| 4 | Épaisseur/trapèzes | poly | 10-15 | Tirage trapèze machine → T-bar row prise haute · shrugs aux haltéres · shrugs barre |

### J3 · Jambes
| Prio | Muscle | Type | 3× | Principal → variantes |
|---|---|---|---|---|
| 1 | Quadriceps | poly | 6-8 | Squat → Hack squat · Belt squat |
| 2 | Quadriceps (presse) | poly | 8-12 | Presse inclinée → Presse horizontale · Pendulum |
| 3 | Quadriceps (iso) | iso | 12-15 | Leg extension |
| 4 | Ischios | poly | 8-12 | RDL barre → RDL haltère |
| 5 | Ischios (iso) | iso | 10-15 | Leg curl assis → allongé · debout |
| 6 | Fessiers | poly | 8-12 | Hip thrust → Hip thrust machine · Abduction machine · Fente bulgare · Fente longue |
| 7 | Mollets | iso | 12-20 | Les extensions mollets debout → assis · à la presse |

### J4 · Épaules
| Prio | Faisceau | Type | 3× | Principal → variantes |
|---|---|---|---|---|
| 1 | Latéral | iso | 12-15 | Élévation latérale haltère → Elévation latérale uni à la poulie |
| 2 | Développé | poly | 8-12 | Développé militaire aux haltères → Développé militaire à la Smith |
| 3 | Frontal | iso | 10-15 | Élévation frontale haltères → Élévation frontale poulie · Élévation frontale barre |
| 4 | Arrière | iso | 12-15 | Arrière épaule à la poulie → Arrière épaule haltère |
| 5 | Trapèzes | iso | 10-15 | shrugs aux haltéres → shrugs barre · Tirage trapèze machine |

### J5 · Bras (2 triceps + 3 biceps + abdos — séries classiques)
| Prio | Muscle | Type | 3× | Principal → variantes |
|---|---|---|---|---|
| 1 | Triceps | iso | 8-12 | Extension triceps banc → Dips triceps |
| 2 | Triceps | iso | 10-15 | Extension poulie barre → Extension poulie corde |
| 3 | Biceps | iso | 8-12 | Curl à la poulie → Curl haltères · Curl barre |
| 4 | Biceps | iso | 10-12 | Curl incliné au banc → Curl incliné uni poignée à la poulie |
| 5 | Biceps | iso | 10-15 | Curl marteau aux haltéres → Curl marteau à la poulie |
| 6 | Abdos | iso | échec | Crunch à la poulie → Relevé de jambe · Roulette |

---

## ✅ PROGRAMME 5 — PPL + Haut/Bas · 5 jours · HYPERTROPHIE  *(figé 21 oct.)*
Le **second** programme 5 jours (l'autre = Split, Programme 4). **Réutilise** les gabarits existants :
- **Push** = Programme 2 · Push
- **Pull** = Programme 2 · Pull
- **Legs** = Programme 2 · Legs
- **Haut** = Programme 3 · **Haut B** *(autres angles, pour ne pas redoubler la semaine)*
- **Bas** = Programme 3 · **Bas B** *(abdos inclus — seul jour avec abdos)*

Conventions héritées : 3 séries · RPE S1/S2 = RIR 1, dernière = RIR 2-3 · repos composés 2-3 min / iso 90 s · superset bras (Push triceps classiques ; superset bras sur le jour Haut) · exos = catalogue réel.
**Logique** : J1-J3 = volume par pattern (poussée/tirage/jambes) · J4-J5 = rappel Haut/Bas en fin de semaine pour les points faibles.
Ordre par défaut Push · Pull · Legs · Haut · Bas — **l'athlète place ses jours de repos** où il veut.

---

## ✅ FORCE / POWERLIFTING — 100 % custom (figé 21 oct.)
**Principe porteur** : la Force = les **3 lifts** (Squat · Développé couché barre · Soulevé de terre). Comme les pratiquants varient beaucoup (certains font du renfo, d'autres non), **tout est au choix via listes déroulantes** : on **pré-remplit un squelette** selon le nombre de jours, l'athlète **décide tout** (change l'exo, ＋ ajoute, ✕ retire, supprime le jour Renfo). Rien n'est imposé.
Les 3 lifts existent au catalogue (`Squat`, `Développé couché barre`, `Soulevé de terre`). Maquette : [`../mockups/novalyz-generateur-v2.html`](../mockups/novalyz-generateur-v2.html) (Objectif = Force).

**Schéma** : lifts = **séries montantes → séries de travail** au **% du 1RM** (estimé par l'app via `tests`/`_est1RM`) · 3-5 reps · **RPE 7-8 (pas d'échec)** · repos **3-5 min**. Accessoires (renfo) = hypertrophie 8-12 reps.

**Règles porteur** : **pas de notion de débutant** en Force (uniquement dans le configurateur). **À partir de 3 jours, les gros lifts sont SEULS** (pas de compléments collés) — juste un « ＋ ajouter un exercice » si l'athlète veut. **Les jours sont libres** (placement au choix, libellés indicatifs).

**Squelettes pré-remplis** (modifiables) :
| Jours | Squelette |
|---|---|
| 2 j | J1 les 3 lifts à la suite · J2 Renfo |
| 3 j | J1 **Squat + Dév. couché** · J2 **Soulevé** · J3 Renfo |
| 4 j | J1 Squat · J2 Soulevé · J3 Dév. couché · J4 Renfo |
| 5 j | J1 Squat · J2 Soulevé · J3 Dév. couché · J4 **Rappel** (2ᵉ lift léger) · J5 Renfo |
| 6 j | J1 Squat · J2 Soulevé · J3 Dév. couché · J4-J5 **Rappels** (2ᵉ Squat / 2ᵉ Dév.) · J6 Renfo |

> Motif : **3 lifts seuls** (groupés si 2-3 j). Sur **5-6 j**, les jours en plus = des **rappels** (2ᵉ séance d'un lift, plus léger) **que l'athlète peut doubler OU transformer en renfo** — au choix (chaque jour « au choix » est supprimable). Jours libres.

**Pools des listes déroulantes** (indicatifs, à affiner) : `lift` (3 lifts + variations lourdes) · `comp` (gros mouvements complémentaires, pour le « ＋ ajouter » des jours lift) · `acc` (isolation/accessoires, jour Renfo). Le **jour Renfo est optionnel** (bouton « retirer ce jour »).

---

## Règles transverses (porteur)
- **Groupé par muscle** dans chaque séance.
- **Barre = dernier choix** (couché, militaire).
- **≥1 variante par exercice** (liste de choix interchangeables) ; au démarrage = 1er dispo, les autres = remplaçants.
- **Coupe par le temps** : garder d'abord **1 exercice par muscle** (le prioritaire), puis les 2ᵉ/3ᵉ si le temps reste. ✅ validé
- **Jours de repos = libres** : le générateur propose un ordre de séances (ex. Lun/Mar/Mer/Jeu/Ven), mais **l'athlète choisit où placer ses jours de repos** dans la semaine.
- **RPE par série** : S1 et S2 = **1 rép en réserve** (RPE 9) · dernière série = **2-3 réps en réserve** (RPE 7-8).
- **Repos modulable au ressenti** : composés 2-3 min · iso 1 min 30 ; si fatigue, **rallonger** pour garder l'intensité sur la série suivante.
- **Superset bras** : actif sur Full Body / PPL / Haut-Bas ; **désactivé sur le jour Bras du Split** (journée dédiée).

## À faire ensuite
- [ ] Confirmer la règle **temps → nb d'exos**.
- [x] Programme 3 = **Haut/Bas 4 j Hypertrophie** figé (21 oct.).
- [x] Programme 4 = **Split 5 j** figé · Programme 5 = **PPL + Haut/Bas 5 j** figé (21 oct.).
- [x] **Modèle à 2 parcours figé** (débutant galerie / inter-avancé configurateur par organisation) + maquette `novalyz-generateur-v2.html` (21 oct.).
- [x] **Force / Powerlifting** figé (21 oct.) : 100 % custom, listes déroulantes, squelettes 2→6 j, jour Renfo optionnel. Intégré à la maquette.
- [ ] Figer la **liste des blocs muscle** (slots/angles définitifs) + **pools Force** → source du moteur.
- [ ] Construire le **moteur v2** dans l'app (2 parcours + Force custom + blocs/organisations + backend).
- [ ] Construire le moteur v2 (data model ci-dessus) + la 4e question + gestion supersets + variantes → « Remplacer » + **RPE par série** (S1/S2 = RIR 1 · dernière = RIR 2-3) + **repos modulables**.
