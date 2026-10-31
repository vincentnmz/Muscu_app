# Audit — analyse de l'entraînement et du bien-être (31/10/2026)

Objectif (porteur) : de l'aide réelle à l'athlète et au coach, sur des **données réelles**, avec des recos **fiables, jamais inventées**. On garde l'existant, on l'améliore, on n'ajoute que ce qui est cohérent et utile.

Méthode : lecture du code (front `js/app.js`, backend `index.ts`) + passage des vraies fonctions sur la copie réelle de la base (`.work/audit/out11.json`, données de Vincent au 30/10).
Légende : ✅ vérifié contre le code et les données · 🟠 supposé / à confirmer.

---

## 1. Ce qu'on collecte réellement (données au 30/10)

| Donnée | Volume réel | Utilisée par… |
|---|---|---|
| Séries (charge, reps, **RPE**, **repos**) | 877 séries, **100 %** avec RPE et repos ✅ | classement des exercices (records / progresse / bloqué / recule / sous la fourchette), volume par muscle, Banister (tonnage) |
| Questionnaire du matin (Hooper : sommeil, fatigue, stress, courbatures, douleur + zone) | 35 jours ; stress et courbatures seulement 6 jours (questions récentes) ✅ | verdict du jour (Prêt / Vigilance / rouge), score de récup, règle « charge + ressenti » (référence perso sur 35 j) |
| RPE de séance (bilan de fin) | 5 séances ✅ | prévu pour la charge interne sRPE (Foster) |
| **Durée de séance** | **0** ✅ — voir bug B1 | sRPE impossible sans elle |
| Montre : FC repos, sommeil (min), pas | 55 jours ✅ | affichés (Forme, bilan e-mail) ; **pas utilisés par le verdict ni les recos** |
| Cardio (durée, distance, FC moy.) | 133 séances | lecture cardio (auditée le 29/10) |
| Poids / nutrition | 6 pesées / 2 jours | règle « déficit énergétique » (moteur front) |

## 2. Ce qui est solide (à garder tel quel) ✅

- **Verdict du jour** (`evaluerEtatAthlete`, backend) : douleur = dernière saisie ; rouge réservé à la douleur forte ou à la blessure ; causes affichées sous le verdict.
- **Règle « charge + ressenti »** : une alerte de charge n'apparaît que si la charge est élevée plusieurs jours **et** que le ressenti se dégrade par rapport à **ta propre référence** (35 j). Sur tes données : charge en hausse (5 jours hauts), ressenti normal → « Ta charge monte et tu encaisses bien », ce qui est cohérent.
- **Classement des exercices** partagé athlète / coach, sur les charges, reps et RPE réels (règles du 29-30/10).
- **Recos d'entraînement nommées** (sous la fourchette avec 3 options, cible de la prochaine séance, leviers « bloqué », volume au prorata).

## 3. Bugs trouvés sur données réelles

| # | Constat | Effet visible | Statut |
|---|---|---|---|
| **B1** | Le bilan de fin de séance est construit **avant** que la durée soit figée → durée toujours vide (0 durée pour 5 RPE de séance en base) ✅ | La charge interne sRPE (RPE × durée) n'a jamais pu se calculer : la fraîcheur repose uniquement sur le tonnage | **Corrigé** : durée calculée depuis le chrono ; non envoyée au-delà de 4 h (appli restée ouverte) |
| **B2** | Zone de douleur stockée « NaN » (anciennes saisies) recopiée telle quelle dans l'alerte ✅ | « Gêne légère signalée **(nan)** » dans ton centre d'alertes | **Corrigé** (backend) + test ajouté |

## 4. Parties peu fiables ou mortes

| # | Constat | Preuve | Proposition |
|---|---|---|---|
| **F1** | Le **moteur front** (`NovalyzEngine`), qui alimente « **Analyse Novalyz** » sur l'accueil coach et la carte Analyse, ne lit que le **dernier jour** de bien-être et dépend de champs qui n'existent plus : `energie` (retiré du questionnaire), `ressenti`, `dashboard.progression` (jamais fourni). | Sur tes données : **0 analyse produite**. 6 des 13 règles ne peuvent jamais se déclencher (fatigue générale, sous-entraînement, surmenage, bonne adaptation, très bonne adhérence, marge de progression). | Rebrancher ses entrées sur les vraies sources : Hooper (sommeil / fatigue / stress / courbatures), le classement des exercices (records + progresse vs recule), et une moyenne sur 3 jours plutôt qu'un seul jour. |
| **F2** | Ce moteur appelle « **force** » l'évolution du **tonnage sur 28 j** (`charge.evol_pct` = tonnage). | Valeur réelle « force +117 % » = tonnage. La règle « déficit énergétique » (poids en baisse + force en baisse) se déclencherait sur un simple mois plus léger. | Mesurer la force sur la charge des séries de travail (classement des exercices). Sinon, retirer le mot « force ». |
| **F3** | Fraîcheur (Banister) sur le tonnage juste après une pause de 12 j : la base chronique est basse, donc « charge élevée » (TSB −46 %). | La phrase reste juste (« tu encaisses bien »). Mais on ne dit pas que c'est une reprise. | Mentionner « reprise après X jours de pause » quand la référence contient une pause (la synthèse le détecte déjà). |

## 5. Ajouts cohérents, sur des données qu'on a déjà

Classés par utilité / fiabilité. Chaque ajout affiche ses chiffres réels et sa source. Aucun ajout sans assez de données : sinon rien n'est affiché.

1. **Repos réel dans les recos (« bloqué », « sous la fourchette »)**
   - Aujourd'hui, le levier dit « +30 s de repos » sans connaître ton repos. Or on l'a sur 100 % des séries.
   - Proposition : « tu prends **90 s** sur cet exercice ; sur un exercice lourd, 2-3 min aident à garder tes reps ».
   - Source : Schoenfeld et al. 2016, *J Strength Cond Res* 30(7):1805-1812 (3 min > 1 min pour la force et l'hypertrophie chez des pratiquants entraînés).
   - Seuils proposés (à valider) : lourd / moyen ≥ 2 min, léger ≥ 1 min.
2. **Bien-être « par rapport à ta normale »** (athlète + coach)
   - Proposition : « Sommeil 3/5 — **sous ta moyenne** (3,9 sur 28 j) » au lieu d'un seuil fixe.
   - On a 35 jours et la référence perso existe déjà côté backend.
   - Affiché seulement avec ≥ 7 jours de référence.
3. **FC de repos de la montre comme signal d'appoint**
   - Proposition : FC repos des 3 derniers jours nettement au-dessus de ta moyenne sur 28 j → signal de récup **concordant**. Il compte seulement en plus d'un autre signe (fatigue, sommeil, RPE), jamais seul.
   - Source : Buchheit 2014, *Front. Physiol.* (les mesures de FC sont utiles en complément des questionnaires et du carnet d'entraînement).
   - 🟠 L'écart en bpm qui compte « nettement » est un **seuil Novalyz à valider**, pas une valeur tirée de l'article. La FC de repos d'une montre est moins précise que les mesures de 5 min de l'étude.
4. **Dérive du RPE à charge égale, par exercice, visible du coach**
   - Le backend la calcule déjà (`rpe_exos` : RPE +1 à charge égale ou plus basse sur les 2 dernières séances), mais elle n'est affichée nulle part.
   - Proposition : « Développé couché : même charge, RPE +1 » dans la fiche athlète. C'est un signal précoce, avant que les reps baissent.
5. **Sommeil de la montre à côté du sommeil déclaré** (coach)
   - Proposition : afficher la durée réelle (ex. 7 h 40 en moyenne sur 7 j) à côté de la note /5.
   - Descriptif seulement, sans règle.

**Ce que je ne propose pas (pas fiable aujourd'hui)** :
- Corrélations « sommeil bas → perf en baisse » : trop peu de données par personne, risque de faux lien.
- Alerte nutrition : 2 jours saisis.
- ACWR muscu : reste désactivé.

## 6. Décisions pour le porteur

- Valider **F1 + F2** (rebrancher le moteur front pour que l'« Analyse Novalyz » du coach redevienne utile).
- Valider les ajouts **1 à 5** et l'ordre de réalisation, ainsi que les seuils marqués « à valider » (repos 2 min / 1 min, écart de FC repos).
- B1 et B2 sont corrigés (front + `index.ts` → **redéploiement Supabase nécessaire** pour B2).

## 7. Contre-vérification indépendante des calculs (31/10, demande porteur)

Méthode : recalcul en Python, **sans réutiliser le code du moteur**, à partir des tables brutes (`db_v5.json`), comparé à la sortie réelle du backend (`handleGetAppData`).

| Calcul | Résultat |
|---|---|
| Séances / séries / tonnage / RPE moyen sur 7 j et 28 j, totaux | ✅ identiques |
| Semaine calendaire (séances, volume par muscle) | ✅ identiques |
| Série de semaines | ✅ identique |
| ACWR (7 j / (28 j ÷ 4)) | ✅ identique (1,23) |
| Banister (CTL / ATL / TSB %) | ✅ identiques |
| Score de récupération (Hooper) / sommeil moyen | ✅ identiques |
| Records | ✅ (le moteur compte aussi les records au poids du corps, ex. Pompe 6 reps : choix voulu) |

**Défaut trouvé et corrigé — fenêtres « N jours » = N+1 jours.** Le backend filtrait `date ≥ aujourd'hui − 7` : la fenêtre « 7 j » couvrait **8 jours** (2 fois le même jour de la semaine), et la comparaison « 7 j vs 7 j précédents » opposait 8 jours à 7. Cas réel au 30/10 : « 5 séances sur 7 j » (jeudi 23 et jeudi 30) au lieu de 4. Ce chiffre alimente aussi « volume élevé » (≥ 5 séances), l'adhérence et le tonnage 7 j. Corrigé partout (23 fenêtres : 7 / 14 / 28 / 35 / 56 j, fenêtres de période) → **aujourd'hui + les N−1 jours précédents**, fenêtres précédentes symétriques. L'ACWR et Banister utilisaient déjà 7 jours exacts (inchangés).

## 8. Réalisé (31/10, maquette `mockups/novalyz-bienetre-normale.html` validée, seuil A)

- **Point 2** — bien-être « par rapport à ta normale » : Aujourd'hui (bloc Lecture Novalyz) + fiche coach. Normale = 5 semaines précédentes, ≥ 7 saisies (sinon « ta normale arrive après 7 saisies »), orange à ±1 point. Test `normale-bienetre`.
- **Point 3** — FC de repos (montre) ajoutée à la règle « charge + ressenti » : moyenne des 3 derniers jours (≥ 2 mesures) ≥ normale + 5 bpm (normale ≥ 14 mesures sur 4 semaines). Ne compte que si la charge est élevée en même temps. Tests dans `regle-charge-ressenti`.
- **Point 4** — fiche coach : « Effort à charge égale » (stable / en hausse avec les RPE avant → après et la charge). Sur tes données : stable, 18 exercices comparés.
- **Point 5** — sommeil réel de la montre (7 j vs 4 semaines d'avant) côté athlète et coach. Rien sans montre.
- Corrigé au passage : point orange sur « Fatigue musc. aucune » (fiche coach, la fatigue basse était colorée comme une mauvaise note).
