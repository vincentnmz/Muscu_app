# Design — pages joueur / équipe (état des maquettes)

> Point de reprise pour la conception UI multisport (foot d'abord). Lire avec `catalogue-metriques.md`.

## Maquettes (artifacts HTML)
- **Page joueur (coach)** — 3 onglets : https://claude.ai/code/artifact/8a1e3adf-e6f7-4f2c-9bc7-266c8d2b13de
- **Dashboard coach (écran équipe, §13)** : https://claude.ai/code/artifact/5a1172c4-d341-4fa9-ad73-db6b1ed52664
- **Page athlète (vue perso, PWA mobile)** : https://claude.ai/code/artifact/c92738c6-5c68-4456-8ceb-0fae2a41d75b
- **Comparatif équipe (écran séparé)** : https://claude.ai/code/artifact/622634ef-040d-4ff9-b9c3-0d05635e1ec1

Source de référence = les artifacts ci-dessus. Copies de travail éphémères dans le scratchpad : `maquette-joueur.html`, `maquette-dashboard-coach.html`, `maquette-athlete.html`, `maquette-comparatif.html`.

## Décisions design (validées)
- **Dark**, cartes arrondies, bleu Novalyz (#3b82f6) + violet/cyan, statuts vert/orange/rouge.
- **Zéro emoji** dans l'UI (ça fait « template IA »). Repères = accents colorés, pas d'emoji.
- Inspirations : AMS de perf (radar + mini-courbes physiques) + esthétique SaaS dark.
- **Page joueur = 3 onglets** : « Profil », « Charge & physique », « Match & technique ». Ordre validé. *(Révisé : passage de 2 à 3 onglets — l'identité/Profil devient un onglet à part entière au lieu d'une bande au-dessus des onglets.)*
- **Comparatif d'équipe = écran séparé** (pas sur la page joueur), filtre par poste, tableau triable.
- Heatmap et sets de stats **par poste** : alimentés par les vraies données au fur et à mesure.
- **L'app constate, le coach prescrit** : la page athlète montre l'état et les données, sans prescription auto — les consignes passent par les objectifs et les messages du coach.

## Contenu page joueur (coach)
- Onglet **Profil** : identité (poste/n°, jambe dominante, taille/poids, naissance, club/catégorie, ancienneté), **antécédents**, **Objectifs** typés avec état décisionnel, **Blessures & réathlé** (type, localisation, gravité, durée, retour terrain / retour compétition, statut).
- Onglet **Charge & physique** : tuiles KPI (ACWR, charge 7j, fatigue, distance), graphe charge+ACWR (zone risque >1.5), GPS (sparklines), radar athlétique, bien-être, tests physiques.
- Onglet **Match & technique** : tuiles (note, buts/passes déc, xG+xA, minutes), **heatmap terrain**, stats de match /90 (par poste), derniers matchs, radar technique.

## Contenu dashboard coach (écran équipe, §13)
Bandeau disponibilité (disponibles / à surveiller / à risque / indisponibles, **dérivé** de l'effectif) · KPI équipe (charge moyenne, bien-être moyen, progression/régression, alertes actives) · **table effectif triable** (dispo, ACWR, bien-être, tendance 7j, dernière séance, lignes cliquables → page joueur) · alertes de la semaine (orientées décision) · **blessés & retours** (dates) · courbe charge équipe.

## Contenu page athlète (vue perso, PWA mobile)
Forme du jour (constat) · prochaine séance · bien-être (questionnaire + « faire le point ») · saison (totaux) · derniers matchs (avec résultat) · progression (tests VMA/sprint/CMJ) · **objectifs (fixés par le coach)** · message du coach.

## Mapping catalogue (13 sections) → écrans
Profil/Objectifs/Blessures → **onglet Profil** de la page joueur (fait) · Bien-être/Séance/Charge interne/GPS/Tests/Récup → onglet Charge · Exposition/Perf football → onglet Match · KPI → tuiles+graphes · Moteur (dispo/risques/reco) → badge joueur + dashboard coach · Dashboard coach (§13) → écran équipe (maquette faite ; « Suivi équipe » codé à enrichir) · Comparaison → écran séparé.

## Reste à faire
- **Maquettes faites** ✅ : page joueur 3 onglets (Profil / Objectifs / Blessures & réathlé), dashboard coach enrichi (§13), page athlète.
- **Coder dans l'app** (`index.html`) : intégrer ces écrans ; étendre les données démo (stats de match, heatmap, blessures/réathlé) via `seedDemoFoot()` ; croisement front↔backend.
- **Comparatif d'équipe** : enrichir avec les vraies données par poste (tableau triable).

## État du code (déjà en prod démo)
Vue Suivi équipe + détail joueur (charge/ACWR, bien-être, séances, tests) déjà codés et branchés sur l'onglet `Indicateurs`. Coach démo : `demofoot` / `demo1234`. Seed : `seedDemoFoot()`.
