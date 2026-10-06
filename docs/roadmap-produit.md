# NOVALYZ — ROADMAP PRODUIT & DÉVELOPPEMENT

> **Référence canonique** (dernière mise à jour : 2026-10-06). Vision produit long terme, pas une architecture technique imposée. Le code actuel reste la **source de vérité**.

## 0. Vision générale

Novalyz doit évoluer d'une application qui affiche principalement des données vers une véritable **cellule de performance personnelle et sportive**.

La promesse principale doit devenir :

### Novalyz Solo

> **« Je t'aide à mieux t'entraîner, à comprendre si tu progresses et à savoir quoi améliorer. »**

### Novalyz Coach

> **« Je t'aide à suivre tes athlètes, comprendre leur état et prendre de meilleures décisions de coaching. »**

Le cœur du produit n'est donc pas le programme, le GPS, les graphiques ou l'IA pris séparément.

Le cœur est :

**Objectif → Programme → Exécution → Données → Analyse → Contexte → Recommandation → Action → Progression**

L'application doit progressivement être capable de répondre à 3 questions :

1. **Comment dois-je m'entraîner ?**
2. **Est-ce que je m'entraîne correctement ?**
3. **Qu'est-ce que je dois améliorer maintenant ?**

---

# RÈGLE ABSOLUE DE DÉVELOPPEMENT

Le code actuel doit toujours être considéré comme la source de vérité.

La roadmap décrit une **direction produit**, pas une architecture technique imposée.

Avant chaque étape :

1. Auditer le code existant.
2. Identifier ce qui existe déjà.
3. Identifier ce qui peut être réutilisé.
4. Identifier les données déjà disponibles.
5. Identifier les routes/backend existants.
6. Identifier les tables et structures existantes.
7. Identifier les risques de régression.
8. Proposer l'implémentation minimale nécessaire.
9. Attendre validation si l'étape présente un choix architectural important.
10. Implémenter uniquement le périmètre de l'étape.

### Interdictions

Ne pas :

* refaire une fonctionnalité déjà fonctionnelle ;
* créer un deuxième moteur qui fait la même chose ;
* dupliquer les données ;
* modifier le moteur décisionnel sans nécessité ;
* créer une nouvelle architecture complète sans justification ;
* transformer une fonctionnalité future en fonctionnalité actuelle ;
* ajouter de l'IA là où une règle déterministe suffit ;
* modifier plusieurs domaines simultanément sans nécessité ;
* faire une refonte visuelle générale pendant une étape fonctionnelle.

Chaque étape doit rester **isolée, testable et réversible**.

---

# PHASE 1 — SOCLE : OBJECTIFS + ANALYSE + RECOMMANDATIONS

## 1. Objectifs sportifs comme colonne vertébrale

Les analyses de Novalyz doivent être contextualisées par l'objectif de l'athlète (prise de masse, perte de gras, recomposition, force, hypertrophie, endurance, cardio, Hyrox, qualité physique, objectif personnalisé).

**À auditer** : comment les objectifs sont stockés ; quelles données existent ; quelles pages les utilisent ; quelles analyses en sont indépendantes.

**Direction** : l'objectif devient une donnée centrale pour interpréter les performances (ex. une hausse de charge est positive en hypertrophie mais pas forcément suffisante pour conclure à une bonne progression).

**Livrable** : créer/consolider une structure d'objectif extensible. Ne pas encore créer toutes les analyses.

## 2. Transformer les données en ANALYSES

Novalyz ne doit plus seulement afficher (charge, volume, fréquence, RPE, poids, cardio, sommeil, fatigue, douleur, ACWR…) mais répondre : **« Qu'est-ce que ces données signifient ? »**

**Architecture cible** : Données → Indicateur → Analyse → Constat → Priorité → Recommandation. Les calculs restent **déterministes** ; l'IA n'invente pas les données, elle explique ensuite en langage naturel.

## 3. Système de recommandations

Moteur : **Analyse → Point fort / problème → Priorité → Recommandation**. Recommandations compréhensibles, courtes, contextualisées, actionnables, liées aux données et aux objectifs. Architecture extensible (`finding / priority / evidence / recommendation / confidence / context`). Pas un système d'IA autonome.

---

# PHASE 2 — SOLO : APPRENDRE À L'ATHLÈTE COMMENT S'ENTRAÎNER

## 4. Création de programme côté athlète

Pour Novalyz Solo, l'athlète doit pouvoir créer son programme (objectif, nb séances, groupes, exercices, séries, reps, charge/RPE cibles, jours). Le programme devient la référence **prévu vs réalisé**. **Réutiliser le builder existant**, ne pas créer un 2e système.

## 5. Programme proposé par Novalyz

Après stabilisation du builder manuel : proposer un programme (objectif, niveau, jours, durée, matériel, préférences, contraintes, historique), modifiable par l'athlète.

## 6. Programme adaptatif

À terme : Programme → Exécution → Analyse → État → Progression → ajustements (charge, volume, fréquence, deload, remplacement d'exercice…). Utilise les données réelles. **Pas avant que le moteur d'analyse soit assez fiable.**

---

# PHASE 3 — NOUVELLE EXPÉRIENCE ATHLÈTE

## 7. Écran « Aujourd'hui »

Porte d'entrée quotidienne : ma séance ? mon état ? m'entraîner normalement ? point d'attention ? Structure : Bonjour → État actuel → Séance du jour → Point d'attention → Action recommandée. Hiérarchie claire (ne pas juste déplacer les anciennes cartes).

## 8. Écran « Mon entraînement »

Regrouper programme, séances prévues/réalisées, historique, exercices, séries, reps, charges, RPE, progression. Comprendre : prévu → réalisé → effet produit.

## 9. Écran « Mes analyses »

Cœur analytique. Progression, performances, régularité, volume, charges, points forts/faibles, tendances, respect du programme, qualité. **Chiffres accompagnés d'une interprétation** (pas « Volume : 12 450 kg » tout seul).

## 10. Écran « Mon état »

Centraliser sommeil, énergie, fatigue, douleur, ressenti, récupération, charge, ACWR, contexte, fiabilité, recommandations. Distinguer **Donnée / Analyse / Recommandation**.

## 11. Contexte de performance

Contextualiser les analyses (retour vacances/blessure, reprise, deload, intensification, changement de programme, manque/faible fiabilité des données). L'utilisateur doit comprendre **« pourquoi Novalyz interprète différemment aujourd'hui ? »**. Afficher la fiabilité quand ça a du sens.

---

# PHASE 4 — CARDIO / GPS / ACTIVITÉS

## 12. Section « Cardio / Hyrox » dédiée
Course, marche, vélo, rando, Hyrox, natation, autres. Récupérer un maximum de données pertinentes par activité.

## 13. Enregistrement GPS type Strava
Démarrer une activité ; position GPS, parcours, distance, durée, vitesse, allure, vitesse max, dénivelé, altitude, cadence, FC, puissance, calories, pauses, segments, données temporelles. Conçu comme une **activité sportive structurée**, pas « une carte ».

## 14. Architecture multi-sources
Source possible : GPS téléphone, montre, capteur, compteur vélo, Bluetooth, ANT+, import FIT/TCX/GPX/CSV/JSON, saisie manuelle. **Une seule entité activité** : `activity / source / source_data / metrics / route / segments / timestamps / reliability`.

## 15. Déduplication
Éviter de compter 2× la même activité (montre + téléphone sur la même sortie ; pas montre + marche manuelle). Conserver les sources pour la traçabilité.

## 16. Données passives vs activités
Séparer passif (pas quotidiens, sommeil, FC, FC repos) et activités explicites (course, vélo, marche, Hyrox, natation…).

## 17. Montres / Health Connect / capteurs
Health Connect, montres Android, FC, sommeil, pas, activités, capteurs vélo, Bluetooth, ANT+. Archi permettant d'ajouter des sources sans réécrire le moteur.

## 18. Vélo
Distance, durée, vitesse moy/max, altitude, dénivelé, cadence, puissance, FC, calories, GPS, parcours + import compteurs.

## 19. Running / marche / Hyrox / natation
Métriques pertinentes par sport : **activité commune + métriques spécifiques** (pas de structure rigide identique).

## 20. Séances hybrides
Une séance peut contenir plusieurs blocs (muscu + vélo + course + cardio) tout en restant une seule séance.

---

# PHASE 5 — WATCH / DONNÉES QUOTIDIENNES

## 21. Connecter une montre
Parcours simple « Connecter ma montre » → sommeil, pas, FC, FC repos, activités, calories, HRV selon source.

## 22. Graphique quotidien minimal
Accueil/état : évolution pas, sommeil, FC. But : « voici comment ton état évolue », pas un dashboard géant.

---

# PHASE 6 — NUTRITION

## 23. Nutrition dans « Mon état »
Section nutrition liée aux objectifs (perte de gras, prise de masse, recomposition, perf, endurance). Données : poids, calories, P/G/L, hydratation, adhérence.

## 24. Analyse nutritionnelle
Pas une app nutrition générique. Répondre : **« mon alimentation est-elle cohérente avec mon objectif et mon entraînement ? »**. Croiser nutrition + entraînement + récupération + progression.

## 25. Nutrition côté Coach
Le coach consulte objectif nutritionnel, poids, évolution, adhérence, calories/macros, relation perf/récup → recommandations.

---

# PHASE 7 — INTELLIGENCE ARTIFICIELLE

## 26. Coach IA
Espace de conversation avec accès au contexte (objectif, programme, séances, analyses, état, cardio, nutrition, progression). **Architecture obligatoire** : Données → moteur déterministe → analyses → contexte → IA → explication/conversation. L'IA **n'est pas** le moteur de calcul et n'invente pas de valeurs.

## 27. Analyse morphologique par photos
Premium potentiel. Photos face/dos/profil → proportions, asymétries, zones à développer, axes esthétiques. **Aide visuelle/esthétique uniquement** : pas de diagnostic médical, pas de mesure inventée, pas d'estimation présentée comme mesure réelle. Après le cœur analytique.

---

# PHASE 8 — ALERTES ET NOTIFICATIONS

## 28. Centre d'alertes
`type / severity / source / evidence / context / reliability / created_at / read / action`. Ex. récup faible, douleur, charge inhabituelle, absence, progression positive, donnée anormale, régularité.

## 29. Notifications intelligentes
Ne pas tout notifier. Une notif = « assez important pour interrompre ? ». Le secondaire reste dans l'app.

## 30. Notifications Coach
« 3 athlètes nécessitent ton attention aujourd'hui. » → athlète, problème, priorité, contexte, recommandation.

---

# PHASE 9 — COACH

## 31. Home Coach
« Bonjour Coach » → nb athlètes, alertes, athlètes à surveiller, séances du jour, problèmes prioritaires.

## 32. Aujourd'hui Coach
Par athlète important : état, séance prévue, dernière séance, récup, alertes, recommandation. Comprendre sans ouvrir 10 écrans.

## 33. Analyse Coach
Analyse muscu/cardio, progression, charge, récup, régularité, objectifs, nutrition.

## 34. Programme Coach
Création, modification, affectation, suivi prévu/réalisé, adaptation. Ne pas remplacer l'existant s'il fonctionne.

## 35. Conversation Coach ↔ Athlète
Communication, contexte séance, recommandations, IA d'aide au coach, historique.

---

# PHASE 10 — MONÉTISATION

## 36. Version Premium
Seulement quand le cœur apporte de la valeur. Premium potentiel : analyses/reco avancées, Coach IA, programmes IA, morpho, cardio avancé, historiques longs, rapports. Ne pas verrouiller les fondamentaux.

## 37. Paiement
Abonnement, gestion utilisateur, état premium, renouvellement, annulation, restauration. Architecture indépendante.

---

# PHASE 11 — RAPPORTS ET RÉTENTION

## 38. Récapitulatif mensuel
Bilan auto. Athlète : entraînement, progression, cardio, récup, nutrition, points forts/à améliorer, reco du mois. Coach : évolution athlètes, alertes, progression, problèmes, recommandations.

## 39. Envoi par email
Envoi auto du bilan mensuel. Pas avant que les analyses soient fiables.

---

# PHASE 12 — QUALITÉ / UX / COHÉRENCE

## 40. Hiérarchie de l'application
Pas « plus joli » : l'utilisateur comprend immédiatement (1) ce qu'il doit faire (programme/séance), (2) comment il va (état/récup), (3) s'il progresse (analyses), (4) ce qu'il doit améliorer (recommandations), (5) pourquoi (données + explication).

### Navigation cible (direction, à ne pas coder sans audit de la nav actuelle)
```
AUJOURD'HUI · MON ENTRAÎNEMENT · CARDIO / HYROX · MES ANALYSES · MON ÉTAT · PROFIL
```
Navigation distincte et adaptée pour le Coach.

---

# ORDRE DE PRIORITÉ ABSOLU

**P0 — CERVEAU** : 1 Objectifs · 2 Analyse des données · 3 Recommandations · 4 Contexte · 5 Fiabilité · 6 Alertes
**P1 — SOLO** : 7 Programme athlète · 8 Aujourd'hui · 9 Mon entraînement · 10 Mes analyses · 11 Mon état · 12 Programme proposé · 13 Programme adaptatif
**P2 — DONNÉES SPORTIVES** : 14 Cardio · 15 GPS · 16 Activités structurées · 17 Multi-sources · 18 Déduplication · 19 Watch/Health Connect · 20 Vélo · 21 Running · 22 Hyrox · 23 Natation · 24 Séances hybrides
**P3 — NUTRITION** : 25 Nutrition Solo · 26 Analyse nutritionnelle · 27 Nutrition Coach
**P4 — IA** : 28 Coach IA · 29 IA reco/explication · 30 Morphologie IA
**P5 — COACH** : 31 Home · 32 Aujourd'hui · 33 Alertes · 34 Analyse · 35 Programme · 36 Conversation
**P6 — BUSINESS** : 37 Premium · 38 Paiement · 39 Rapports mensuels · 40 Emails automatiques

---

# MÉTHODE DE TRAVAIL (par numéro)

**A — AUDIT** (avant tout code) : fichiers, fonctions, routes, tables, données existantes, dépendances, réutilisable, risques.
**B — PLAN** : ce qui existe · ce qui manque · ce qui sera modifié · ce qui ne le sera pas · architecture proposée · tests prévus · risques.
**C — VALIDATION** : si décision architecturale importante → **STOP et demander validation**. Sinon, implémenter la solution minimale cohérente avec l'existant.
**D — TESTS** : unitaires, intégration, régression, front/mobile si besoin ; vérifier routes, données, pas de double calcul ni duplication.
**E — RAPPORT** : Étape / Statut / Audit / Modifications / Fichiers modifiés / Fichiers volontairement non modifiés / Tests X/X / Régressions / Risques restants / Décisions à prendre / Commit / Étape suivante.
**F — COMMIT** : un commit par étape fonctionnelle, message explicite, ne pas mélanger plusieurs fonctionnalités majeures. Puis **STOP**.

## Règle de priorité
- Fonctionnalité déjà à 80-100 % → **ne pas la refaire**.
- Existe mais architecture insuffisante → **améliorer seulement le nécessaire**.
- N'existe pas → **construire de façon compatible avec l'existant**.
- Dépendance importante manquante → **STOP** avant toute implémentation provisoire.

---

# ARCHITECTURE PRODUIT À CONSERVER EN TÊTE

```
OBJECTIF → PROGRAMME → SÉANCE → DONNÉES → MOTEUR NOVALYZ → ANALYSE → CONTEXTE
→ RECOMMANDATION → ACTION → PROGRESSION → NOUVELLE ANALYSE
```
L'IA intervient : **ANALYSE + CONTEXTE → IA → EXPLICATION / DIALOGUE**. Elle ne remplace pas le moteur de performance.

# OBJECTIF FINAL
Un athlète solo ouvre Novalyz et obtient : ce qu'il doit faire aujourd'hui → comment il va → ce que ses données montrent → ce qui fonctionne → ce qui le limite → ce qu'il doit améliorer → comment Novalyz l'aide à progresser. Pour le coach : quels athlètes nécessitent son attention → pourquoi → ce qu'ils ont fait → leur état → ce que Novalyz recommande. Le produit final = une **cellule de performance sportive**, pas une collection de tableaux.
