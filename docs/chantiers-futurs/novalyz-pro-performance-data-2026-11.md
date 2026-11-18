# NOVALYZ PRO — Performance Data & Match Analysis · Phase 1 : analyse de l'existant + architecture (16/11/2026)

> Statut : **proposition à valider** (aucune ligne de code, aucune migration). Brief porteur : prompt « Novalyz Pro » du 16/11 (66 points).
> Premier sport : football · premier rendez-vous : **Fédération française de hockey sur gazon (vendredi 20/11)** → le hockey sur gazon est le **2ᵉ sport de démonstration** dès le départ (preuve du multisport).

---

## 1. Ce qui existe déjà (vérifié dans le code et la base)

| Élément | État | Conséquence |
|---|---|---|
| **Modèle générique validé (juillet)** — `Docs/modelededonnees (1).md` | Écrit, **pas encore en base** : Club, Saison, Équipe, Séance (= créneau d'équipe), Participation, Indicateur, `Sport.config_json` | **On l'implémente** au lieu d'inventer un 2ᵉ modèle. Décisions figées respectées : *match = séance de type match*, *poste/catégorie sur le lien athlète-équipe*, *vocabulaire par sport dans la config*. |
| Comptes | `athletes` (avec `coach_id`, `sport`, `poste`, `club`, `categorie`), `coachs` (1 coach ↔ N athlètes). **Pas** d'organisation ni d'équipe en base (seulement des « groupes » dans les préférences coach) | Il faut créer Organisation / Équipe / membres **sans casser** le lien coach ↔ athlète actuel. |
| Foot actuel | Saisie d'un match **par joueur** (`saveMatch` → lignes dans `indicateurs`), suivi équipe/joueur (`getSuiviEquipe`, `getSuiviJoueur`), démo foot | Garde son rôle (charge interne, temps de jeu). Le module Pro ajoute **le match d'équipe + les événements**. |
| Auth | **Maison** (table `athletes`/`coachs`, sessions signées), base **fermée** (service_role dans la fonction seulement), droits dans `authCheck` + test permanent sur toutes les routes | ⚠️ Les **politiques RLS « par utilisateur »** demandées (point 52) **ne s'appliquent pas** : Supabase Auth n'est pas utilisé (et ne doit pas l'être, règle n° 3). L'isolation multi-tenant se fait **dans le serveur** (chaque requête filtrée par organisation + rôle) et la base reste fermée (RLS activé, aucun accès direct). C'est le modèle déjà en place et testé. |
| Moteur d'analyse | Déterministe, sport-agnostique (`evaluerEtatAthlete`, ACWR), IA = couche de langage qui n'invente pas de chiffre (garde-fou chiffres déjà codé) | Même principe pour l'IA match (point 26/59) : données → métriques → contexte → IA, avec citations. |
| Outillage | Tests (119 suites), parcours navigateur, banc de profils, préprod séparée | Chaque phase passe par ces filets. |

## 2. Architecture cible (alignée sur le modèle générique)

```
organisations ─┬─ membres (coach/athlète + rôle : admin · coach · analyste · prepa · athlete)
               ├─ saisons
               ├─ equipes ── equipe_athletes (poste, catégorie, n° maillot)
               ├─ competitions
               └─ seances (type = entrainement | match | test …)  ← « match = séance de type match »
                    └─ match_infos (adversaire, domicile, score, compétition)  [module sport]
                    └─ evenements (le cœur Pro) ── import_lignes (donnée brute d'origine)
sports (cle, config_json : types d'événements, zones, résultats, libellés, métriques par défaut)
imports (fichier, source, gabarit, statut, version, auteur) ── gabarits_import (mapping enregistré)
metriques_perso (nom, formule sûre, unité, sport, visibilité)
journal_audit (qui, quoi, quand)
```

**Événement générique** (point 11) : `evenements(id, organisation_id, seance_id, sport, type, athlete_id?, equipe_id, adversaire?, periode, minute, seconde?, zone?, resultat?, valeur_num? (ex. xG), attributs jsonb, source, import_id, import_ligne_id)`.
- Football : `type = tir`, `resultat = cadre`, `valeur_num = 0,12 (xG)`, `zone = surface`.
- Hockey sur gazon : `type = tir`, `zone = cercle`, `attributs = {pc: true}` (corner court).
- Basket : `type = tir`, `attributs = {points: 3}`.
- Le **sens** des types, zones et résultats vient de `sports.config_json` → **aucun sport codé en dur** dans le moteur.

**Brut vs calculé** (point 21) : `import_lignes` garde **chaque ligne d'origine telle quelle** (jamais modifiée) ; `evenements` = version structurée ; métriques = **calculées à la lecture** (pas stockées au départ — volumes modestes) ; métriques perso = formule appliquée aux mêmes comptages.

**Métriques perso — moteur de formule sûr** (point 20) : petite grammaire maison (nombres, variables = comptages d'événements filtrés, `+ − × ÷`, `somme/moyenne/min/max/médiane/ratio/%`). Parseur en lecture seule, **jamais** `eval`, testé. Ex. `Efficacité = tirs[resultat=cadre] / tirs`.

**Sécurité** (points 30-32, 58) : chaque route Pro vérifie *session → membre de l'organisation → rôle → équipe*. Un athlète ne voit **que ses propres événements** et les stats d'équipe autorisées. L'IA reçoit uniquement ce que la route a déjà filtré. Journal d'audit sur import, correction, mapping, métrique. Ajout au test permanent des droits (toutes les routes).

**Lien avec les comptes actuels** : à la création d'une organisation, le coach actuel en devient admin et **ses athlètes y sont rattachés** (lien existant `coach_id` conservé — rien ne casse côté muscu).

## 3. Import CSV/XLSX (cœur du workflow analyste, points 5-9, 38-40, 55-57)

1. **Dans le navigateur** : lecture du fichier (CSV natif ; XLSX via SheetJS, bibliothèque reconnue, version figée) → « Fichier détecté : 487 événements · 14 colonnes · 1 match ».
2. **Mapping** proposé automatiquement (noms de colonnes connus + gabarits enregistrés : *Nacsport Football*, *Dartfish*, *CSV Torcy*…), modifiable, **enregistrable comme gabarit**.
3. **Validation avant import** : joueurs reconnus / inconnus (proposition de rattachement), dates, minutes hors bornes, xG hors 0-1, types d'événements inconnus, doublons, valeurs manquantes → « 12 lignes à vérifier » ; **rien n'est supprimé en silence**.
4. **Import par lots** (≈ 500 lignes par envoi, barre de progression, reprise possible, identifiant d'import anti-doublon comme pour les séances).
5. **Historique des imports** + **versioning** : réimporter un match crée une **nouvelle version** ; l'ancienne reste consultable.

## 4. Écrans (point 48 — navigation « Performance », visible seulement pour une organisation Pro)

Overview club · Équipes · Matchs (fiche match : score, KPI, timeline, carte des zones) · Joueurs (fiche joueur + comparaison 4 derniers vs 4 précédents) · Imports (assistant + historique + qualité des données) · Métriques · Rapports (PDF via l'export existant). Identité visuelle Novalyz (mêmes tokens, clair/sombre).

## 5. IA (points 26-29, 58-60)

Question → contrôle des droits → requêtes → **métriques calculées par Novalyz** → contexte structuré (chiffres + dénominateurs, ex. « 19/50 pertes ») → modèle → réponse **citant ses chiffres**, distinguant observation / interprétation, signalant les données manquantes. Garde-fou chiffres existant réutilisé (tout nombre absent du contexte est refusé). Accès IA réservé, quotas, comme aujourd'hui.

## 6. Ce qui n'est PAS fait (point 46) — architecture prête seulement

Intégrations directes Hudl/Dartfish/Nacsport, GPS, tracking, vidéo (champ `horodatage_video` prévu sur l'événement), Google Sheets, fédération, marketplace.

## 7. Plan par phases

| Phase | Contenu | Livrable vérifiable |
|---|---|---|
| **0 — avant vendredi** | **Maquette interactive** du module (hockey sur gazon + foot), **données « Démo » clairement étiquetées** : assistant d'import (fichier → mapping → validation), fiche match, fiche joueur, métrique perso, analyse IA type | Lien à montrer à la fédération, sans rien promettre qui n'existe pas |
| 1 | Migrations (préprod d'abord) : organisations, membres, saisons, équipes, compétitions, séances/match, sports + config foot & hockey, imports, gabarits, événements, métriques perso, audit | Tables + tests de droits ; muscu inchangé (parcours navigateur vert) |
| 2 | Import CSV/XLSX + mapping + gabarits + validation | Import d'un vrai CSV Torcy en préprod |
| 3 | Match + événements + timeline | Fiche match juste au chiffre près (testée) |
| 4 | Dashboards équipe / joueur + comparaisons | Captures validées |
| 5 | Métriques perso (formule sûre) | Formules testées, aucune exécution de code |
| 6 | IA d'analyse (match, joueur, questions) | Réponses avec citations, garde-fou |
| 7 | Rôles fins, audit, performance, rapports | Test des droits étendu |

## 8. Décisions à prendre par le porteur

1. **Vendredi** : maquette interactive démo (recommandé) **ou** viser déjà un import réel (phases 1-3 en 4 jours = risqué, et rien ne doit partir en prod sans tests) ?
2. **Sport de la démo** : hockey sur gazon en premier (pour la fédération) + foot ? Il me faut les **types d'événements et zones hockey** que tu utiliserais (ou je propose une liste standard à valider).
3. **Un vrai CSV** (anonymisé) de ton analyse Torcy → base des gabarits et des tests.
4. ~~Rôle analyste / préparateur~~ → **tranché (16/11)** : le rôle **prépa** existe déjà (`STAFF_ROLES = ['coach','prepa']` dans `index.ts`). **Analyste, kiné, médecin…** viendront plus tard, en ajoutant des valeurs à ce même mécanisme de rôles staff (pas de nouveaux types de comptes).

## 9. Format réel d'un club (exports Nacsport Torcy, reçus le 16/11) — vérifié sur 5 fichiers

- **Une ligne = un clip vidéo** : `Nom` = catégorie + n° (« Possession (17) »), `Position` / `Durée:` = **millisecondes de vidéo**, `MT` = « 1er MT » / « 2éme MT », `Equipe`.
- **Pas de temps de jeu** (2e MT à 72:55 de vidéo) → calage par mi-temps (heure vidéo du coup d'envoi) pour la minute de jeu.
- **Pas de colonne joueur** (marquage collectif) → pas de stats individuelles avec ce marquage.
- **Descripteurs en colonnes** (`Entrée 30m`, `Résultat entrée 30 m`, `Situation dans les 30 m`, `Cadré`, `Finition`, `Zone`…) → rangés tels quels dans `attributs` ; leur sens vient du **gabarit**.
- `Panneau de score` à 0:0 même sur un but → non fiable, ignoré. Colonne `Position` parfois en double.
- **Exports filtrés du même match** : 76 lignes → 29 clips ; **désaccords** entre fichiers sur 4 clips (`Passe vers surface`) → l'import multi-fichiers fusionne par clip et fait trancher l'analyste.
- Intégré à la maquette (foot ▸ Import ▸ « exemple réel », équipes anonymisées). Les fichiers d'origine ne sont **pas** dans le dépôt.
