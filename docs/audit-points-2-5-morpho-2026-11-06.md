# Audit avant maquettes — catalogue, cohérence coach, montre, Ma semaine, morpho (06/11/2026)

Rien n'est codé. Base lue sans écriture (06/11 soir), code du repo, sources web citées pour Strava / Garmin.

## Point 2 — Catalogue d'exercices (table `exercices`, 91 exercices)

**État réel**
| Muscle | Nb | Remarque |
|---|---|---|
| Dos | 21 | contient aussi shrugs ×2, Rowing menton, Tirage trapèze machine (trapèzes) |
| Pectoraux | 18 | ok |
| Quadriceps | 11 | ok |
| Épaule | 9 | pas de développé assis machine, pas d'oiseau machine (reverse fly) |
| Biceps | 7 · Fessier 7 · Ischio 6 · Triceps 5 | triceps : pas de barre au front, pas de kickback |
| Abdominaux 3 · Mollets 3 · Adducteur 1 | **pauvres** ; aucun lombaire, aucun avant-bras, pas de groupe Trapèze |

- Colonnes : `exercice_id, exercice, muscle, muscle_secondaire, increment_kg`. **Aucune colonne matériel ni consignes.**
- Noms avec espace à la fin : « Dips pectoraux␣ », « Élévation frontale à la poulie␣ », « Hack squat␣ » (le programme de Vincent contient la version avec espace → risque de non-correspondance).
- Orthographe : « haltéres » (×5), « shrugs » en minuscule, « Les extensions mollets… ».
- `increment_kg` en texte libre : « 2 kg » et « 2kg », « 2.5 / 5 kg »… (5 vides).
- Séries en base sur des noms absents du catalogue : **« Leg curl » (45 séries)**, « hip thrust machine » (4, casse différente).
- **Muscles secondaires à revoir** (impactent le volume compté, ex. l'alerte « Fessier 1,5/10 ») :
  - squats / presses / hack / belt squat → secondaire **Ischio** ; dans la littérature, ces mouvements sollicitent surtout quadriceps + **fessiers**, peu les ischios. À trancher par toi.
  - Relevé de jambe (abdos) → secondaire Ischio : à revoir.
  - Hip thrust → Ischio (plutôt cohérent).

**Proposé (à valider avant maquette)**
1. Liste de muscles fermée : Pectoraux, Dos, Trapèzes, Épaules, Biceps, Triceps, Avant-bras, Abdominaux, Lombaires, Quadriceps, Ischios, Fessiers, Adducteurs, Mollets.
2. Nouveaux champs : **matériel** (barre, haltères, machine, poulie, poids du corps, Smith, autre) et **consignes** (texte court, sert aussi aux conseils débutant plus tard).
3. Nettoyage : espaces, orthographe, `increment_kg` → nombre (petit pas en kg), « Leg curl » rattaché à un exercice du catalogue.
4. Compléter les groupes pauvres : liste à valider par toi (je propose, tu coches).
5. Choix par muscle + filtre matériel partout où on choisit un exercice (ajout, remplacement, « Enchaîner avec… »).
6. Migration SQL + `index.ts` (à redéployer). Aucune donnée de séance perdue (renommage = mise à jour des noms dans `performances` / `programme`).

## Point 3 — Cohérence coach restante
Fait depuis l'audit du 05/11 : lots 1 à 4 (en-têtes, avatars, Aujourd'hui, Équipe, Analyses équipe, fiche mobile, Programme).
Reste :
- **S1 — Fiche ▸ Analyses sur ordi** : contenu sur ~460 px sur 730 disponibles, colonne de droite vide (sur la page athlète, cette colonne affiche « Demande à Novalyz » ; côté coach elle est masquée). Même chose en tablette paysage (~360 px).
  - Proposition : côté coach, mettre dans cette colonne « Ce que Novalyz propose » + « Pourquoi ça bloque » de l'exercice choisi (aujourd'hui sous le graphique), ou passer en pleine largeur.
  - ⚠️ C'est l'ordi : tu avais demandé de ne pas toucher l'ordi sans accord → maquette d'abord.
- Titre de page ordi « Analyses » alors que l'onglet s'appelle « Progression » (F2) — laissé tel quel à ta demande, à confirmer.
- S2 — Mobile : fond qui s'arrête avant le bas sur les pages courtes → à revérifier sur ton téléphone (pas vu dans les captures du jour).

## Point 4 — Montre
**Déjà là (vérifié dans le code)** : Health Connect (Android) via `capacitor-health` : pas, sommeil, FC repos, séances ; synchro à l'ouverture de l'app (confirmé aujourd'hui : pas du 06/11 passés de 3 133 à 6 840 dans la base) ; import .GPX/.TCX/.FIT.

**Corrections de mon audit précédent**
- Garmin **écrit maintenant dans Health Connect** (pas, sommeil, FC, calories, poids…), Android 14+, sens Garmin → Health Connect ([Android Central](https://www.androidcentral.com/wearables/garmin/heres-everything-garmin-will-and-wont-share-with-google-health-connect), [Tom's Guide](https://www.tomsguide.com/wellness/fitness-trackers/garmin-clarifies-what-data-its-sharing-with-google-health-connect-heres-the-full-list), [Notebookcheck](https://www.notebookcheck.net/Garmin-officially-reveals-Google-Health-Connect-support-for-wearables.1054577.0.html)). Plus besoin d'appli relais pour Garmin.
- **Strava : je déconseille.** Depuis nov. 2024, l'accord API Strava limite l'affichage des données d'un utilisateur **à cet utilisateur seul** (donc pas au coach) et **interdit de les utiliser dans une IA** ; mi-2026, nouvelles restrictions annoncées ([DC Rainmaker](https://dcrainmaker.com/2024/11/stravas-changes-to-kill-off-apps.html), [TechRadar](https://www.techradar.com/health-fitness/strava-could-soon-stop-working-with-some-of-your-third-party-apps-heres-what-you-need-to-know), [TechRepublic](https://techrepublic.com/article/news-strava-api-scraping-crackdown)). Novalyz montre les données au coach et a une IA → contraire à l'accord. Ce sont des articles de presse : le texte exact de l'accord est à relire avant toute décision, mais le risque est réel. Les sorties Strava passent souvent déjà par Health Connect (montre → Health Connect) : c'est la voie à privilégier.

**Proposé**
1. Écran guidé « Connecter ma montre » par marque (Samsung, Google/Fitbit, Garmin, Polar/Suunto/Coros/Amazfit) : 3 étapes par marque, avec ce qui remonte réellement (sans inventer : on n'affiche que ce que Health Connect donne).
2. « Dernière synchro : aujourd'hui 14:32 » visible + bouton « Actualiser ».
3. Pas de Strava (sauf si tu veux que je lise l'accord en entier avant de trancher).
4. iPhone : rien tant qu'il n'y a pas d'app iOS (Apple Santé = app native nécessaire).

## Point 5 — « Ma semaine » et séances Libre
Aujourd'hui : une séance « Libre » ne coche aucune séance prévue → jeudi « pec épaule 2 non faite », vendredi « dos jambe 2 non faite » alors que tu t'es entraîné.

Test d'une règle automatique sur tes vraies séances Libre (exercices en commun avec chaque séance prévue) :
| Séance Libre | Meilleure correspondance | Exos en commun |
|---|---|---|
| 05/10 | pec épaule 2 | 6 / 6 |
| 12/10 | pec épaule | 6 / 7 |
| 23/10 | dos jambe 2 | 2 / 8 |
| 05/11 | pec épaule 2 (ex æquo avec pec épaule, déjà faite le 02/11) | 3 / 6 |
| 06/11 | dos jambe 2 | 2 / 5 |

→ La règle auto marche quand la Libre recopie une séance (05/10, 12/10), mais elle **devine** pour les séances mélangées (05/11, 06/11). Pas assez fiable seule.

**Proposé**
- **A (recommandé)** : à la fin d'une séance Libre, une question « Cette séance remplace laquelle ? » avec la meilleure correspondance présélectionnée (et « Aucune, séance en plus »). Fiable, 1 tap.
- Pour l'historique et si l'athlète ne répond pas : rattachement auto seulement si ≥ 50 % des exercices sont en commun avec une séance prévue non faite de la semaine ; sinon « séance en plus » (compte pour la régularité, ne coche rien).
- Le coach voit la même chose.

## Morpho-anatomie — dans la discussion IA + mise en avant
**Existant (vérifié)** : analyse morpho par photo (face / profil / dos + questionnaire + mesures), IA vision, **1 analyse par jour**, photos **jamais stockées**, résultat envoyable par e-mail ; bouton « Analyse morpho par photo » sous les suggestions de la discussion IA ; mention dans l'onboarding (liste des fonctions).
**Manques**
- Le **résultat n'est pas gardé** : la discussion IA ne le connaît pas ensuite (on ne peut pas lui demander « avec ma morpho, que travailler ? »).
- Pas de mise en avant ailleurs (Aujourd'hui, Analyses, fin d'onboarding).
- À vérifier de ton côté : sur ton téléphone, la discussion IA est-elle active ou marquée « Bientôt » ? (Ça dépend de la clé côté Supabase, que je ne lis pas.)

**Proposé**
1. Garder le **résultat** (texte + points forts / à développer, pas les photos) et le donner à l'IA comme contexte → la discussion IA s'appuie dessus.
2. Dans la discussion IA : carte « Ta morpho » en tête (dernière analyse + « refaire » / « faire ma 1ʳᵉ analyse »).
3. Mise en avant (« à vendre ») : écran dédié en fin d'onboarding (« Découvre ta morpho en 3 photos »), encart discret sur Aujourd'hui tant qu'aucune analyse n'est faite, encart dans Analyses ▸ Résumé (« Muscles en retard selon ta morpho »). Texte et visuels à valider ; je propose 2-3 variantes en maquette.
4. Plus tard (offre payante) : quota, comparaison avant / après.

## Ordre proposé
5 (Ma semaine, petit) → 2 (catalogue, gros, avant test fermé) → morpho (vente) → 4 (montre) → 3 (fiche ordi).
Puis onboarding (où la morpho sera mise en avant).

## Point 5 — codé (06/11, maquette validée « oui pour tout »)
- Fin de séance libre : « Cette séance remplace laquelle ? » (proposé = séance prévue du jour avec ≥ 1 exercice commun, sinon le plus d'exercices communs ; « Aucune, séance en plus »).
- Sans choix : rattachement auto si ≥ 50 % des exercices en commun avec une séance prévue non faite de la semaine, sinon « en plus ». Une séance prévue n'est cochée qu'une fois par semaine.
- Ma semaine (« en séance libre », « ✓ en plus » en pointillé), Entraînement (« ✓ ven. · libre »), Historique (« → dos jambe 2 » + Changer), coach : agenda « ✓ libre », Séances « → … » + « ⇄ Remplace quelle séance ? » (le coach peut changer).
- Stockage : `indicateurs` cle `rattache` (seance_id = séance réelle, date, valeur = séance prévue ou `__plus__`, unite = athlete/coach). Action `setRattachement` (index.ts, à redéployer). Hors-ligne : choix gardé sur le téléphone 3 j et renvoyé.
- Base : 05/11 → pec epaule 2, 06/11 → dos jambe 2 (à la demande du porteur).
- Limite : l'automatique compare avec le programme **actuel** ; une ancienne séance libre peut être rattachée à une séance d'un programme qui a changé depuis (rien n'est écrit en base, c'est un calcul d'affichage).

## Point 2 — décisions du porteur (06/11)
- 14 muscles validés ; squats / presses / hack / belt squat / fente courte → secondaire **Fessiers** ; relevé de jambe → aucun.
- « Leg curl » (45 séries hors catalogue) : Vincent 05/08 → 17/08 = **Leg curl assis** ; le reste (Vincent juin + sept., Alizé) = **Leg curl allongé**.
- Un coach **peut créer** un exercice (muscle choisi dans la liste).
- Champs ajoutés : matériel, consignes, **disciplines** (muscu, hyrox, crossfit, street workout, hybride — plusieurs possibles) et **type de mesure** (charge × reps, reps, temps, distance, calories). Seule la muscu est remplie ; les autres disciplines = chantier à part.
- Consignes : premier jet Novalyz pour 24 exercices (`mockups/consignes-premier-jet.html`), à valider.
- 29 exercices à ajouter (choix du porteur) : Curl poignet barre, Curl poignet inversé, Curl inversé barre, Extension lombaire au banc 45°, Good morning, Crunch machine, Relevé de genoux suspendu, Crunch au sol, Pallof press, Adducteur à la poulie, Squat sumo haltère, Mollets à la Smith, Mollets unilatéral haltère, Développé épaules machine, Oiseau machine, Face pull, Développé Arnold, Barre au front, Kickback haltère, Extension nuque haltère, Dips machine, Curl pupitre, Curl machine, Nordic curl, Leg curl unilatéral, Pull-through à la poulie, Abduction à la poulie, Front squat, Sissy squat.
- Trouvé en plus : le programme de **John** (athlete 3) contient 15 noms absents du catalogue (« Développé couché », « Tractions », « Gainage »…), aucune série faite.

## Point 2 — migration exécutée (06/11, « OK migration » du porteur)
Essai à blanc d'abord (transaction annulée), puis exécution : 120 exercices (91 + 29), matériel rempli partout, 0 séance / 0 ligne de programme hors catalogue, « Leg curl » → 29 assis (Alizé 18 + Vincent août 11) / 16 allongé, 16 exercices avec Fessiers en secondaire, John rattaché au catalogue (« Gainage » supprimé). Script : `supabase/migration-catalogue-2026-11.sql` (+ `scripts/catalogue_migration.py`).
Effets vérifiés sur copie (Vincent) : ischios 6 → 4 séries cette semaine, fessiers 0 → 2, dos 15,3 → 12,5/sem (tirage trapèze → Trapèzes), records 5 → 4 (leg curl allongé 37,5 kg n'est plus un record : 40 kg le 18/09), −40 points.
Reste : libellés de muscles en minuscules dans certains textes d'analyse (« epaule ») ; disciplines = champs prêts, écrans à maquetter.

## Point 4 — Montre codée (06/11, maquette validée : 2 jours, « ancien » gardé)
- Parcours guidé « Connecter ma montre » : marque → aide (générique sauf Garmin, données citées d'après Garmin) → autorisations Health Connect → vérification réelle des 7 derniers jours (pas / sommeil / FC repos / séances trouvés ou « aucune donnée »).
- Dernière synchro gardée sur le serveur (`indicateurs` cle `montre_sync`, heure + marque) à chaque `saveSante` ; renvoyée par `getAppData` (`montre_sync`).
- « Ma montre » (Forme) : marque, « Synchronisée aujourd'hui à 14:32 », bouton Actualiser (synchro immédiate).
- Plus de 2 jours sans nouvelle donnée : « Montre · ancien » + « Pas de nouvelle donnée depuis N jours (dernière le jj/mm) » (Aujourd'hui, coach « État & récup » « · ancien (N j) », carte montre coach). Les valeurs restent affichées.
- Reste : chemins de menu exacts par marque à vérifier (aide générique en attendant). Pas de Strava. iPhone : message + import de fichiers.
