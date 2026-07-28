# Design — pages joueur / équipe (état des maquettes)

> Point de reprise pour la conception UI multisport (foot d'abord). Lire avec `catalogue-metriques.md`.

## Maquettes en cours (artifacts HTML)
- **Page joueur (coach)** : https://claude.ai/code/artifact/8a1e3adf-e6f7-4f2c-9bc7-266c8d2b13de
- **Comparatif équipe (écran séparé)** : https://claude.ai/code/artifact/622634ef-040d-4ff9-b9c3-0d05635e1ec1

Fichiers source dans le scratchpad : `maquette-joueur.html`, `maquette-comparatif.html`.

## Décisions design (validées)
- **Dark**, cartes arrondies, bleu Novalyz (#3b82f6) + violet/cyan, statuts vert/orange/rouge.
- **Zéro emoji** dans l'UI (ça fait « template IA »). Repères = accents colorés, pas d'emoji.
- Inspirations : AMS de perf (radar + mini-courbes physiques) + esthétique SaaS dark.
- **Page joueur = 2 onglets** : « Charge & physique » et « Match & technique ». Ordre validé.
- **Comparatif d'équipe = écran séparé** (pas sur la page joueur), filtre par poste, tableau triable.
- Heatmap et sets de stats **par poste** : alimentés par les vraies données au fur et à mesure.

## Contenu page joueur
- Onglet **Charge & physique** : tuiles KPI (ACWR, charge 7j, fatigue, distance), graphe charge+ACWR (zone risque >1.5), GPS (sparklines), radar athlétique, bien-être, tests physiques.
- Onglet **Match & technique** : tuiles (note, buts/passes déc, xG+xA, minutes), **heatmap terrain**, stats de match /90 (par poste), derniers matchs, radar technique.

## Mapping catalogue (13 sections) → écrans
Profil/Objectifs/Blessures → page joueur (blocs à AJOUTER) · Bien-être/Séance/Charge interne/GPS/Tests/Récup → onglet Charge · Exposition/Perf football → onglet Match · KPI → tuiles+graphes · Moteur (dispo/risques/reco) → badge joueur + dashboard coach · Dashboard coach (section 13) → écran équipe (Suivi équipe déjà codé, à enrichir) · Comparaison → écran séparé.

## Reste à faire (maquettes)
1. Ajouter à la page joueur : **Profil complet** (jambe dominante, antécédents), **Objectifs**, **Blessures / réathlé**.
2. Maquette **Dashboard coach enrichi** (section 13 : à risque/surveiller/dispo, charge équipe, bien-être moyen, blessés, retours…).
3. Maquette **page athlète** (récap perso : ses stats match + indicateurs perf + bien-être).
4. Puis **coder** dans l'app (données démo à étendre : stats de match, heatmap, blessures).

## État du code (déjà en prod démo)
Vue Suivi équipe + détail joueur (charge/ACWR, bien-être, séances, tests) déjà codés et branchés sur l'onglet `Indicateurs`. Coach démo : `demofoot` / `demo1234`. Seed : `seedDemoFoot()`.
