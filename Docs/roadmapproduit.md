# Roadmap produit — migration vers la plateforme multisport

> Principe : **chaque phase est livrable, réversible, et ne casse jamais l'existant.** On ne lance jamais la phase N+1 avant que N soit validée en production.

Architecture cible retenue : **Hub plateforme** (voir [`architecture.md`](./architecture.md)).

## Vue d'ensemble

| Phase | Objectif | Risque | Casse ? | Statut |
|---|---|---|---|---|
| **0** | Documentation | Nul | Non | 🚧 En cours |
| **1** | Isoler le noyau | Faible | Non | 🔜 |
| **2** | Introduire l'entité `Sport` | Faible | Non | 🔜 |
| **3** | UI par profil (hub) | Moyen | Non (feature-flag) | 🔜 |
| **4** | Généraliser les indicateurs + modèle collectif | Moyen | Non (double-écriture) | 🔜 |
| **5** | Base relationnelle | Élevé | Non (parallèle) | 🔜 |
| **6** | 2ᵉ sport pilote | — | Non | 🔜 |

---

## Phase 0 — Documentation *(en cours)*
**But** : figer les concepts génériques avant d'écrire du code.
**Livrables** : ce dossier `/docs`.
**Critère de sortie** : cahier des charges, architecture, modèle de données, doc moteur validés.
**Pourquoi d'abord** : zéro risque, et c'est le livrable qui crédibilise le projet (DU, fédérations).

## Phase 1 — Isoler le noyau
**But** : rendre explicite la frontière noyau ↔ module musculation, déjà présente de fait.
**Actions** :
- Extraire `NovalyzEngine` et les entités génériques dans des sections/fichiers clairement nommés.
- Documenter le contrat `normaliser()` comme interface d'entrée du moteur.
- Marquer visiblement le code musculation-only (tonnage, 1RM, volume/muscle).
**Risque** : faible — refactoring pur, invisible pour l'utilisateur.
**Critère de sortie** : un développeur peut pointer « ça c'est le noyau, ça c'est le module muscu ».

## Phase 2 — Introduire l'entité `Sport`
**But** : la musculation devient *un* module, pas *le* produit.
**Actions** :
- Ajouter `Sport` et `AthleteSport` (muscu = défaut pour tout l'existant).
- Ajouter un sport actif sur `Equipe`.
**Risque** : faible — l'existant bascule en « sport = muscu » automatiquement.
**Critère de sortie** : un athlète peut théoriquement avoir 2 sports ; l'UI muscu inchangée.

## Phase 3 — UI par profil (le hub)
**But** : tableau de bord central + vues adaptées au profil (athlète, coach, prépa, analyste, club, fédération).
**Actions** :
- Construire le hub : profil transversal de l'athlète.
- Router l'affichage : le sport actif pilote les modules visibles ; le profil pilote le niveau de lecture.
- Tout derrière **feature-flag** : l'app actuelle reste le défaut.
**Risque** : moyen — nouvelle navigation. Mitigé par le flag.
**Critère de sortie** : basculer entre l'app actuelle et le hub sans perte de fonction.

## Phase 4 — Généraliser les indicateurs + modèle collectif
**But** : remplacer les colonnes muscu par `Seance` + `Participation` + `Indicateur` typé.
**Actions** :
- **Double écriture** : chaque saisie écrit dans `Performances` (ancien) ET le nouveau format.
- Introduire `Seance` (équipe) + `Participation` (athlète) ; muscu = équipe de 1.
- Vérifier la concordance, puis basculer la lecture sur `Indicateur`.
- Définir comment le module muscu alimente `volume` / `progression` / `charge` dans `normaliser()`.
**Risque** : moyen — mitigé par la double-écriture et le retour arrière permanent.
**Critère de sortie** : le moteur lit des indicateurs génériques ; les 13 règles inchangées.

## Phase 5 — Base relationnelle
**But** : Google Sheets → PostgreSQL / Supabase.
**Actions** :
- Créer le schéma relationnel (voir [`modele-de-donnees.md`](./modele-de-donnees.md)).
- Migrer en parallèle, tester, basculer la source de données.
- Le moteur ne lit que via `normaliser()` : il ne change pas.
**Risque** : élevé — migration de données. Mitigé par l'exécution en parallèle avant bascule.
**Critère de sortie** : l'app tourne sur Supabase, fonctions identiques, Sheets en secours.

## Phase 6 — 2ᵉ sport pilote *(la preuve)*
**But** : brancher un module sport (hockey ? à décider selon le stage) **sans toucher au noyau**.
**Actions** :
- Créer un module minimal : indicateurs GPS/charge, écrans de saisie et d'analyse.
- Alimenter `normaliser()` depuis ces indicateurs.
**Risque** : faible si les phases 1-4 sont faites — c'est justement leur test.
**Critère de sortie** : **un sport ajouté sans une seule ligne modifiée dans le noyau.** C'est la validation de toute l'architecture.

---

## Règle de décision avant toute fonctionnalité
1. Compatible avec la vision multisport ?
2. Réutilisable dans ≥ 2 sports ? (sinon → module)
3. Respecte l'architecture cible ?
4. Documentée ?
5. Ne crée pas de dette technique ?

Si une réponse est « non », on ne développe pas tel quel.
