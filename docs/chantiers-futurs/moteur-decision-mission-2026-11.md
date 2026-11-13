# Chantier futur — Moteur d'analyse et de décision (mission du porteur, 12/11/2026)

> **Statut (13/11) : LANCÉ — audit livré** → [`docs/audit-moteur-decision-2026-11-13.md`](../audit-moteur-decision-2026-11-13.md) (A→H, P0→P3). Aucun code avant validation du porteur.
>
> ~~**Statut : EN ATTENTE.**~~ (historique) Décision du porteur (12/11) : finir d'abord l'audit du code (fiabilisation,
> `docs/audit-architecture-2026-11-09.md` + `docs/audit-droits-routes-2026-11-10.md`), puis lancer ce chantier
> quand l'app est en meilleure santé. **Aucun code tant que l'audit décrit ci-dessous n'a pas été présenté et validé.**

## Cadrage du porteur (à respecter en priorité)

- **Ne pas remplacer le système de diagnostic actuel.** L'analyser comme le **noyau stratégique** de Novalyz et
  chercher comment le transformer **progressivement** en boucle :
  **diagnostic → hypothèse → décision → action → résultat → vérification.**
- Objectif : améliorer la **lecture Novalyz**, les **recommandations** et les **« pourquoi »** de toutes les données
  récupérées — pas ajouter des graphiques, des statistiques ou des cartes.
- Principe central : **Mesurer → Comprendre → Décider → Agir → Vérifier → Progresser.**

## Pourquoi après l'audit du code (avis Claude, 12/11, validé par le porteur)

1. Ce chantier touche le cœur du moteur (`index.ts` : `evaluerEtatAthlete`, ACWR, seuils, classement des exercices ;
   `app.js` : Lecture Novalyz, prescriptions). Le faire sur une base encore en fiabilisation multiplierait les risques
   de régression.
2. La « mémoire des décisions » (§9) demandera très probablement une **nouvelle table** : mieux vaut la créer une fois
   le circuit de migrations rodé et la table fourre-tout `indicateurs` assainie (chantier P1 en cours).
3. Les 70 routes 🟡 de l'audit des droits manquent surtout de **tests** : ce filet de tests sera aussi celui qui
   protégera le moteur pendant ce chantier (règle §15 : comparer avant / après).
4. Point d'appui déjà présent : il existe une prescription anti-stagnation, des niveaux de confiance, « Depuis ta
   dernière séance », « Ce qui bouge », des alertes coach avec « Pourquoi ? ». La boucle est à **brancher** sur
   l'existant, pas à reconstruire.

## Mission (texte du porteur, conservé tel quel)

**NOVALYZ — MISSION D'AMÉLIORATION DU MOTEUR D'ANALYSE ET DE DÉCISION**

Promesse : **Mesurer. Comprendre. Progresser.** Novalyz ne doit pas être une simple application de suivi.
Direction : **Données → Analyse → Compréhension → Décision → Action → Vérification du résultat.**
Le produit contient déjà beaucoup de logique métier : ne pas repartir de zéro ni remplacer arbitrairement ;
comprendre précisément le système, identifier ce qui peut être renforcé, améliorer progressivement sa capacité à
transformer les données en décisions utiles, explicables et vérifiables.

### 1. Avant tout : auditer ce qui existe (aucun code)
Analyser : moteur d'analyse, fonctions de calcul, règles métier, seuils, recommandations, données utilisées,
comparaisons historiques, progression, stagnation, RPE, fatigue / récupération, recommandations d'exercice,
logique « ta normale », analyses de Today et d'Analyses, logique coach, tests existants.
Cartographie attendue : **Données utilisées → Indicateurs calculés → Détections → Interprétations → Décisions →
Actions → Vérification** (Novalyz vérifie-t-il ensuite si la recommandation a fonctionné ?). Ne rien supposer :
si une information n'existe pas dans le code, le dire.

### 2. Ne pas confondre « plus de données » et « plus d'intelligence »
Pas plus de graphiques, statistiques, indicateurs, cartes, notifications. Améliorer la réponse à :
Que se passe-t-il ? → Pourquoi ? → Qu'est-ce que cela signifie ? → Que devrais-je faire ? → Est-ce que cette
décision a fonctionné ?

### 3. Renforcer le modèle de décision
Chaîne : DONNÉES → INDICATEURS → DÉTECTION → HYPOTHÈSE / INTERPRÉTATION → DÉCISION → ACTION → RÉSULTAT → RÉÉVALUATION.
Exemple déjà présent : élévation latérale 7,5 kg × 10 bloquée sur plusieurs séances, alors que la série à 5 kg est
passée de 16 à 19 reps → interprétation : la série légère fatigue avant les séries lourdes → décision : réduire
temporairement la série à 5 kg (≈ 16 reps sans aller au bout) → objectif : arriver plus frais sur 7,5 kg.

### 4. Améliorer le « pourquoi »
Pour chaque recommandation importante : **ce que Novalyz a observé** (charge, reps, RPE, fatigue, récupération,
historique, fréquence, volume, comparaison à la normale) · **ce qu'il en déduit** (séparé des données) · **ce qu'il
recommande** (action précise) · **pourquoi cette action**. Ne jamais présenter une hypothèse comme un fait :
« cause probable », « cause possible », « données insuffisantes ».

### 5. Notion de confiance
🟢 élevée (plusieurs séances comparables, données suffisantes) · 🟠 moyenne (tendance, historique limité) ·
🔴 données insuffisantes. Pas de score artificiel : définition **objective et documentée** obligatoire.
(Note Claude : `CORE_FIABILITE` et les libellés « Confiance haute / moyenne / faible / données insuffisantes »
existent déjà côté moteur — partir de là.)

### 6. « Ta normale »
Aujourd'hui : moyenne des 5 semaines précédentes (4 pour certaines données montre). Ne pas changer
automatiquement. Déterminer : ce qu'elle fait, ses limites, quand elle trompe, l'amélioration utile, comment
tester sans casser l'existant. Étudier : moyenne, médiane, tendance, variabilité, données récentes, nombre réel
de mesures, valeurs aberrantes, historique insuffisant.

### 7. Logique de détection
Recenser ce qui est déjà détecté, puis les catégories manquantes utiles : progression (charge ↑, reps ↑, charge
stable + reps ↑, RPE ↓ à performance égale, performance ↑ à RPE égal) · stagnation (même charge / reps, plafond,
stagnation malgré volume ↑) · fatigue (performance ↓ + RPE ↑, fatigue ↑, récupération ↓, sommeil ↓) · risque de
surcharge (volume ↑ rapide, fréquence ↑, RPE ↑, récupération insuffisante) · opportunité de progression ·
régularité (objectif, fréquence réelle, interruption, reprise). Chaque nouvelle détection : justification
sportive, données nécessaires, seuils documentés, tests, explication utilisateur. Pas de règle arbitraire.

### 8. Boucle « décision → résultat » (priorité stratégique)
Conserver chaque recommandation de façon structurée pour déterminer ensuite si elle a fonctionné.
Ex. : 06/11 « maintenir 75 kg au développé incliné, viser RPE 9 » → séance suivante 75 × 5 RPE 9 → objectif atteint
→ décision maintenue. Parler de **« résultat observé après la recommandation »**, jamais de causalité prouvée.

### 9. Mémoire des décisions
Historique : décision, date, données ayant conduit à la décision, action proposée, action réellement réalisée,
résultat observé, nouvelle décision. Logique **déterministe, traçable, explicable** — pas de machine learning.

### 10. « Ce qui a changé » (Today et Analyses)
📈 progression · ⚠️ récupération · ⏸ stagnation · 🎯 objectif → puis **ce que cela signifie** → puis **ce que
Novalyz recommande**. Comprendre sa situation en quelques secondes.

### 11. Vue coach
« À surveiller aujourd'hui » : 🔴 attention (baisse de performance, fatigue élevée, récupération dégradée,
douleur, stagnation importante) · 🟠 à vérifier · 🟢 tout va bien. Pour chaque athlète :
Situation → Pourquoi → Recommandation → Action possible.

### 12. L'IA ne devient pas le cerveau
**Le moteur Novalyz décide, l'IA explique.** DONNÉES → MOTEUR → DÉCISION STRUCTURÉE → IA → EXPLICATION.
L'IA ne doit jamais inventer une donnée, une tendance ou une recommandation, contredire silencieusement le
moteur, ou transformer une hypothèse en certitude.

### 13. Le « coup d'avance »
Pistes à évaluer (valeur utilisateur, différenciation, difficulté, fiabilité, données nécessaires, risque
d'erreur, coût de maintenance, intérêt commercial) : mémoire de l'athlète · personnalisation · explicabilité ·
traçabilité · vérification · détection précoce · aide au coach · capitalisation (base de connaissance propre).

### 14. Ne pas sur-interpréter (règle absolue)
Savoir dire « Je ne sais pas », « Données insuffisantes pour conclure », « Plusieurs facteurs peuvent expliquer
cette évolution », « Association observée, mais pas de preuve de causalité ».

### 15. Protéger le moteur existant
Avant chaque modification : identifier la logique existante et ses tests, ajouter les nouveaux cas, vérifier
les anciens résultats, comparer avant / après, préprod après validation, jamais la prod directement. Respecter
les migrations. Pas de logique parallèle ni de duplication de seuils et de calculs.

### 16. Livrable attendu avant tout code
A. Ce que Novalyz sait déjà faire · B. Ce qui est réellement différenciant · C. Faiblesses actuelles ·
D. Décisions actuellement prises · E. Décisions améliorables · F. Informations manquantes ·
G. Erreurs / risques d'interprétation · H. Améliorations classées P0 (impact très important / faible risque),
P1 (fort impact, plus de travail), P2 (intéressant, non urgent), P3 (idées futures) — chacune avec : problème,
valeur, données utilisées, logique, résultat attendu, difficulté, risques, tests nécessaires.

### 17. Règle de développement
Une amélioration n'est acceptée que si elle répond à au moins une question : Novalyz comprend-il mieux
l'athlète ? détecte-t-il mieux une situation ? explique-t-il mieux ? prend-il une meilleure décision ?
aide-t-il à agir ? vérifie-t-il si sa décision a fonctionné ? Sinon : ne pas développer.

**Objectif final** : un système qui transforme l'historique sportif d'un athlète en compréhension, puis en
décisions personnalisées et vérifiables — et non « ajouter toujours plus de fonctionnalités ».

## Points d'entrée dans le code (relevés le 12/11, à vérifier au démarrage du chantier)

- Moteur : `supabase/functions/handler/index.ts` — `CORE_SEUILS`, `CORE_NIVEAUX`, `CORE_FIABILITE`,
  `CORE_CONTEXTES`, `SEUILS`, `VOLUME_CIBLES_NIVEAU`, `evaluerEtatAthlete`, chaîne ACWR, `calculerPoints`.
- App : `js/app.js` — `_prescriptionStag` (anti-stagnation), `_chargeAViser`, Lecture Novalyz, « Depuis ta
  dernière séance », « Ce qui bouge », alertes coach (« Pourquoi ? »), `_ckConf` (libellés de confiance).
- Docs liées : `docs/bases-scientifiques.md`, `docs/audit-moteur-2026-10-26.md`,
  `docs/audit-lecture-novalyz-v3-2026-11-02.md`, `docs/backlog-app.md` §D (idées d'évolution du 11/11).
