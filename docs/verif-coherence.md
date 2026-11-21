# Vérificateur de cohérence des calculs (18/11/2026)

**Objectif fixé par le porteur : un calcul fiable à 100 %.** Chaque chiffre que l'app affiche doit être juste, et le même d'un écran à l'autre.

## Principe
`scripts/verif-coherence/verif.cjs` recalcule chaque chiffre directement à partir des séries brutes. Son code est écrit à part : rien n'est repris du moteur (`index.ts`, `app.js`). Il compare ensuite :
- les données servies par le serveur (`getAppData`) à son propre recalcul ;
- le texte affiché à l'écran à son recalcul, en vérifiant aussi que la même mesure est identique sur tous les écrans.

Quand une erreur passe le filet, on corrige le code **et** on ajoute la règle ici, pour qu'elle ne revienne jamais.

## Où il tourne
- **À chaque `npm test` et en intégration continue**, sur les 16 profils fictifs du banc. C'est bloquant : un écart fait échouer les tests.
- **Test du vérificateur lui-même** (`tests/verif-coherence.test.js`) : on injecte chaque type d'erreur trouvé lors des audits et on vérifie qu'il est attrapé. Un vérificateur qui ne détecte rien ne prouverait rien.
- **Sur les vraies données**, avec la commande `node scripts/verif-coherence/verif.cjs <base.json> <appdata.json> [ecrans.txt] [AAAA-MM-JJ]`. Le 18/11, Vincent, Romain, Idris et Célia sont à **0 écart**. Le 20/11, les **9 athlètes actifs** (+ Max, les deux Sébastien, Alizé, Hugo) : 2 écarts trouvés et corrigés (voir plus bas), puis **0 écart** partout.
- **Preuve sur les anciens écrans** (avant les corrections du 18/11) : il retrouve les erreurs corrigées le jour même (records mal datés, force 12 contre 11, « 12.5 kg », « Objectif semaine 1/3 » à côté de « 2/3 »). L'erreur de séries par muscle n'a pas pu être rejouée faute d'ancien relevé, mais le test permanent l'injecte et elle est attrapée.

## Bugs trouvés par le vérificateur lui-même
- 18/11 : « Objectif semaine 1/3 » à côté de « 2/3 séances » (semaine glissante) → libellé « lun → dim ».
- 18/11 : formats « 87.5 kg », « 86.0 », « 8.1h ».
- 18/11 : **changement d'heure** — l'app comptait les jours en millisecondes ; après le 25/10, la nuit (ou le questionnaire) de J-34 sortait de la fenêtre : normale du sommeil sur 27 nuits au lieu de 28, différente du serveur. Même défaut corrigé dans « ta normale » du bien-être et dans le graphique de régularité (un lundi passait dans la semaine d'avant au printemps).
- 18/11 : cibles : « RPE 10 sur toutes tes séries » alors que des séries étaient à 9 (Célia ×6, Idris ×4) → plage réelle « RPE 9-10 ».
- 18/11 : « bloqué à 50 × 7 depuis 3 séances » (mail) alors qu'une des 3 séances avait fait 8 → le palier affiché est le meilleur nombre de reps du plateau (app et serveur).
- 18/11 : mail : « (au Sun N, fin de la période) » au lieu de la date → corrigé (« au 15/11 »).
- 18/11 : contexte IA : « RPE moyen 9.2 » (point décimal que l'IA pouvait recopier) → « 9,2 ».
- 18/11 : cardio : « 11.6 km », « 1.7 km · 1.5 km/h » → virgule ; fenêtres « 4 sem. » (29 j → 28 j) et « Charge 7 j » (8 j → 7 j) alignées sur le serveur.
- 19/11 (retour porteur) : plan : Tirage trapèze fait mardi dans « dos jambes » mais le plan renvoyait vers « dos jambe 2 » comme s'il restait à faire ; Quadriceps / Ischios renvoyaient vers « dos jambes », déjà faite → le plan dit « tenté mardi (50 kg × 8, RPE 9) » et indique la PROCHAINE séance pas encore faite (aucune s'il n'y en a plus) ; fiche coach : l'action s'affiche sur la séance où l'exercice a été réellement fait.
- 20/11 (point 2, cas limites — profils `premiere_seance`, `exo_remplace`, `series_inegales`, `sans_rpe`, `poids_du_corps`) :
  exercice remplacé dans le programme encore « bloqué » + « +3 séries » dessus → plus classé, exemple pris dans le programme actuel ;
  échauffement (40 × 12 avant 80 × 6) compté dans la décision → séries < 60 % de la plus lourde écartées (« sous ta fourchette » enfin vu) ;
  « 0 kg × 6 », « vise 0 kg × 13 », records « 0 kg » → « 6 reps au poids du corps » + conseil lest / variante au haut de la fourchette ;
  pas inconnu : 0 sur la carte, 2,5 dans le plan (carte « garde charge » / plan « 77,5 kg ») → 2,5 partout ; « RPE 8.5-9 » → « 8,5-9 » ;
  « RPE 9-10 gardées telles » avec une série à 8,5 → plage réelle.
- 20/11 (banc, profils `deux_seances_jour` et `seance_libre`) : 2 séances le même jour → « Full body A ✓ · 18 séries » (nom de la 1re, chiffres de la journée), exercices de la 2e invisibles, « 2/2 séances » pour 3 faites ; séance libre rattachée → la séance qu'elle remplace re-proposée. Corrigé ; une séance = date + nom partout (objectif, régularité, moyennes, points, bilan, mail).
- 20/11 (relance sur les 9 athlètes actifs, données du jour) : « Sous ta fourchette » à côté d'une cible inchangée (8 kg × 8) — seules les séries SOUS le minimum descendent, la série affichée (la plus lourde) restait identique sans que la phrase le dise → la phrase cite les séries concernées et leur cible (« sur 2 séries sur 3 : celles-ci passent à 7,5 kg × 8, ta série la plus lourde reste telle quelle »), sur la même série que la carte.
- 20/11 : petit pas hors grille (8 kg → 6,75 kg sur une poulie au pas de 1,25) et différent d'un écran à l'autre (« au choix » : 1 pas → 77,5 ; carte : −5 % → 75) → un seul calcul, multiple du pas juste sous −5 %. Règle `cible.petit_pas`.
- 20/11 : poids « 76.9 kg » et « ▼ 0kg » (onglet Forme) → « 76,9 », « = stable ».
- 18/11 : carte « Charge & fraîcheur » : « tonnage pondéré par l'effort » alors que la source est le tonnage brut (charge × reps) → « tonnage : charge × répétitions ».
- 21/11 (point 3, écran de saisie — capture de chaque exercice de chaque séance sur les 9 athlètes) : en-tête « Biceps · 8-12 reps » alors que la catégorie de l'exercice (Léger 8-20 / Lourd-moyen 6-12) s'appliquait partout ailleurs (Vincent ×4, Sébastien, Idris ×4) → même fourchette que cibles et lecture ; « Tu as déjà 1 série enregistrée… tout sera perdu » en changeant de séance alors qu'on avait seulement ouvert un exercice (le compte était celui des exercices ouverts) → séries réellement saisies, et plus d'alerte à 0 série.
  Faux positifs du vérificateur corrigés au passage : fourchette prise sur la 1re ligne du programme (au lieu de la ligne de la séance ouverte) ; superset (le clic ouvre le 1er exercice du groupe, l'exercice est maintenant lu sur la carte).
- 21/11 (point 3, Analyses ▸ Tendances — règle B12) : barres de Régularité en JOURS entraînés alors que les tuiles disent « séances/sem. » et qu'Aujourd'hui compte 2 séances le même jour (cas réel : « 1 » sur la barre, « 2 séances » sur Aujourd'hui) → séances (date + nom), et une séance au poids du corps (tonnage 0) compte aussi.
- 21/11 (point 3, Évolution — règle B13) : même exercice dans 2 séances le même jour → le point de la courbe prenait la journée, mais le tableau « Dernières séances » n'affichait que les séries d'UNE séance → toutes les séries du jour (profil banc `meme_exo_deux_seances`).
  **Corrigé le 21/11 (serveur)** : dans ce même cas avec des charges différentes (50 × 10 le matin, 60 × 6 le soir), la « dernière fois » et les cibles mélangeaient les 2 séances (« 60 × 6 → 50 kg × 10 ») → la DERNIÈRE séance du jour fait référence (saisie, cibles, point de la courbe, force) ; le volume du jour et le tableau gardent toute la journée. Jamais vu dans les données réelles.
- 21/11 (point 3, Forme ▸ poids — règle B14) : pesée enregistrée 2 fois le même jour → 2 points « 18/11 · 18/11 » → une pesée par jour.
- 21/11 (point 3, Cardio — règle B17, 1re capture des écrans cardio sur les données réelles : 3 athlètes) : chiffres justes (volume par sport, « +79 % sur 4 semaines » recalculé : 26 sorties contre 13 les 4 semaines d'avant). Écart de règle corrigé : les micro-sorties (< 5 min et < 0,3 km) étaient exclues du Résumé et des repères mais comptées dans « Volume par sport » et « Par sport » → exclues partout (aucun cas réel aujourd'hui).
- 21/11 (muscu à 100 % — règles B18 à B20 : bas du Résumé, Historique, force estimée 6 semaines, jusque-là non vérifiés) : tous les chiffres justes sur les 9 athlètes (tuiles de la période, volume musculaire, balance, historique séance par séance, force 6 semaines) ; seul défaut : tuile « —t / séance » sur une période vide → « — ».
- 21/11 (muscu à 100 % — règles B21 à B25) : Évolution ▸ vues Force / Volume / Par série (« 742.5 kg » et « 27.5 » avec un point → virgule), Par groupe (fréquence qui comptait encore les jours en muscle secondaire : « Trapèze 2×/sem » contre 0,3 dans Tendances → jours en principal, règle du 13/11), Par séance (RPE d'une autre séance du même jour affiché faute de bilan → seulement s'il n'y a qu'une séance ce jour-là), Entraînement (ligne cardio comptée comme exercice : « Karaté · 1 exo », « 39 exercices » → « 1 cardio », « 33 exercices · 6 cardio »), « Tes saisies » (« Questionnaire du jour (5/28 j) » alors que le score compare aux séances → « 5 jours remplis pour 9 séances »).
- 21/11 (fiabilité de l'ENREGISTREMENT — parcours navigateur, vraie app + vrai serveur) : nouveaux scénarios par l'écran : coupure réseau au clic « Valider » (séance en file puis arrivée), réponse perdue après écriture (renvoi → « déjà reçu », pas de doublon), double appui sur Valider (une seule séance), file d'attente qui survit à la fermeture de l'app. Défauts corrigés côté COACH en présentiel : (1) date de séance vide sur le téléphone d'un coach → chaque série refusée « Remplis tous les champs ! » ; (2) aucun brouillon → séance perdue si l'app du coach se fermait en pleine saisie (désormais reprise quand il rouvre la saisie pour cet athlète) ; (3) aucune file → séance perdue si le réseau coupait à la validation et que le coach quittait (désormais gardée sur son téléphone et envoyée par sa session au retour du réseau, sans doublon).
- 21/11 (PASSAGE D'ANNÉE — profil banc `passage_annee`, « aujourd'hui » = 07/01/2027, séances du 14/12 au 06/01 dont le 31/12 et le 1er janvier) : semaine en cours, régularité à cheval sur 2 années, périodes, records datés 01/01/2027, Évolution : justes. Défaut trouvé (pas propre au changement d'année) : en vue Mois, Tendances découpait le mois en tranches de 7 jours depuis le 1er et appelait « cette semaine » celle du jour (« Sur cette semaine : 6 exercices en progrès sur 9 » = 1er-7 janv., 3 séances ; la vraie semaine du lundi 4 n'en avait que 2) → semaines lundi → dimanche coupées au mois, « cette semaine » seulement si c'est la semaine en cours (sinon « la semaine du jj/mm »), un graphique à 1 point affiche sa date (plus « cette sem. » en dur).
- 21/11 (POINTS et récompenses — règle B26) : points gagnés, points de la semaine ligne par ligne et « N pts · +M cette semaine » recalculés sur les séries brutes : justes sur les 9 athlètes et les 25 profils. Défaut corrigé côté serveur (boutique) : deux achats simultanés lisaient le même solde et passaient tous les deux (solde −120 dans le test) → contrôle après écriture, l'achat en trop est annulé (`tests/boutique-solde.test.js`).
- 21/11 (AUTRES PÉRIODES — Semaine, Année, mois précédent capturés pour Résumé, Tendances, Évolution, Par groupe) : en vue ANNÉE, Vincent voyait 751 séries dans la répartition d'intensité au lieu de 1 017, Par groupe et le tableau Évolution faux sur les mois anciens, l'Historique bloqué à 40 séances : le serveur n'envoyait que les 40 dernières séances détaillées → toutes celles des 400 derniers jours (au moins 40), même fenêtre que les courbes. Recontrôlé : 0 écart sur les 9 athlètes, toutes périodes.
- 21/11 (NOTIFICATIONS — elles reprennent le titre et le texte des alertes ; règle B27) : « Aucune séance (muscu ou cardio) depuis 7 jours » écrit en dur, alors que 2 athlètes n'avaient rien fait depuis 9 jours (et le rappel part aussi à J10, J14, J21, J28 avec le même « 7 ») → vrai nombre de jours ; zone de douleur brute « (epaule) » dans l'alerte et la notification coach → « (épaule) ».
- 21/11 (POURQUOI ÇA BLOQUE et LEVIERS — demande porteur ; règle B28) : chaque phrase recalculée sur les séries brutes (charge vs fourchette, saut, RPE et réserve des séries de travail, repos raccourci, marche, échec, chiffres du levier). Défauts corrigés : « Basé sur 1 séance en 1 semaine » sous « sur les 3 dernières séances » (comptait seulement les 42 derniers jours) → séances réellement lues et écart réel, « fiable » seulement si ≤ 6 semaines ; « charge trop lourde, 27,5 kg » à côté de la cible « garde 30 × 5 » (1 série sur 3 sous la fourchette) → même règle que la cible (la majorité) ; « RPE 8-9 Option à tester » (point manquant) ; « à RPE 8.5 » (fiche coach, leviers, statut) → « 8,5 ».
- 21/11 (cohérence, décision « le plus cohérent et fiable ») : (1) « sous la fourchette » = la majorité des séries de travail, partout (cible et Pourquoi) ; (2) Évolution ▸ Par séance : un exercice meilleur que la fois d'avant mais encore sous le meilleur de son plateau n'est plus « progression » (il est « Bloqué » partout ailleurs) → « sous ton meilleur · meilleur récent 27,5 kg × 10 : toujours bloqué depuis 3 séances », compté « = ».
- 21/11 (COACH ▸ Analyses équipe, désormais capturé par le banc) : chiffres cohérents avec l'accueil et les fiches (même classement de progression, mêmes alertes). Corrigé : séances par semaine de l'équipe (régularité 4 sem., « faites cette semaine ») comptées en JOURS → séances (2 le même jour = 2, règle du 20/11) ; zone de douleur brute (« poignet », « epaule ») → libellé (« Poignet », « Épaule »). Le bloc « Progression & stagnations » (règle maison différente du classement) n'était plus affiché : code mort, sans effet.
- 21/11 (COACH ▸ onglet Programme, désormais capturé par le banc) : l'agenda « Cette semaine » écrivait « — repos » un jour où l'athlète s'était entraîné sans séance planifiée (les ✓ ne s'affichaient que sur les séances planifiées) → « ✓ Full body A faite ».

## Ce qu'il vérifie aujourd'hui
| Règle | Ce qui est recalculé |
|---|---|
| records | meilleure série à vie (charge, puis reps), datée de la **première** fois |
| séances | séances (date + nom : 2 le même jour = 2, décision porteur 20/11) depuis lundi, et sur 7 jours glissants |
| tonnage | 7 derniers jours et les 7 d'avant (t) |
| volume par muscle | séries sur la fenêtre du réglage « semaine » (muscle secondaire = 0,5) |
| totaux | séries, répétitions, tonnage et séances à vie |
| progression | meilleure série et nombre de séries de chaque exercice, jour par jour |
| objectif de points | séances depuis lundi (règle des récompenses, calendaire) |
| écran : format | aucun nombre décimal avec un point |
| écran : force estimée | la tuile et la ligne du tableau donnent le même chiffre |
| écran : records | charge et date affichées identiques au recalcul |
| écran : séances « cette semaine » | même nombre sur Aujourd'hui, Entraînement et Volume ; libellé « lun → dim » quand ce n'est pas la même fenêtre |
| ta normale (bien-être) | 3 dernières saisies sur 7 jours contre les autres saisies des 5 semaines (≥ 7) : moyennes, état (dans / au-dessus / sous), compteur « dans N questionnaires » |
| moteur ↔ normale | raisons « fatigue » et « sommeil » du moteur identiques à la normale recalculée |
| montre : sommeil | moyenne des nuits ≥ 3 h sur 7 jours, normale J-34 → J-7 dès 14 nuits |
| montre : FC au repos | récente J-2 → J (≥ 2 mesures), normale J-30 → J-3 (≥ 14), hausse ≥ 5 bpm |
| montre : pas | moyenne de la semaine sans la journée en cours de synchronisation |
| fraîcheur | forme de fond (EWMA 42 j, plancher = moyenne réelle des 28 j), fatigue récente (EWMA 7 j), %, source (tonnage ou note de séance × durée) et son libellé |
| ACWR | 7 derniers jours ÷ (28 derniers jours ÷ 4), sur le tonnage |
| cibles « Ce que Novalyz vise » | départ = meilleure série de la dernière séance ; raison vraie dans les séries (« RPE x sur toutes », « échec N séances de suite », « +1 rep sous N reps », « sous ta fourchette » — y compris « sur N séries sur M : celles-ci passent à … », « haut de fourchette → +N kg », « mêmes charges » si le moteur signale un ressenti en baisse) ; petit pas = multiple du pas de l'appareil juste sous −5 %, identique sur tous les écrans |
| effort à charge égale | exercices et RPE avant → après du moteur = recalcul (4 dernières séances, 1re série à la charge max) ; phrases « Effort en hausse à C kg : RPE a → b » partout (Aujourd'hui, Résumé, Évolution) |
| leviers : repos cité | « Repos : X, stable » et « tu prends X, essaie Y » = repos réel des séries de travail de la dernière séance |
| coach ▸ Équipe | pour chaque athlète, sur SES séries : RPE 7 j, tonnage 7 j, évolution et sa référence « vs 7 j d'avant » |
| volume / fréquence des leviers | « Volume X : N séries/sem », « Fréquence X : F×/sem », « Travaillé F×/sem », « (N → M séries/sem) », « (F×/sem aujourd'hui) » = 4 semaines terminées, divisées par les semaines réellement couvertes |
| journal des décisions | statut de chaque action (atteint / pas atteint / pas tenté / non évaluable : vacances ou blessure ≥ 3 j), « Réalisé : … », « N / M tentée(s) », jours de pause cités |
| plan de la semaine | actions affichées = actions enregistrées au journal, compte « N / M fait », « Semaine dernière : … », « Rien à changer : muscle X séries/sem » |
| fiche coach | Aperçu, Analyses et Forme d'un athlète : mêmes règles que ses propres écrans (dont « Records — … », « Progresse — a→b reps ») |
| mail récapitulatif | séances, séries, reps, tonnage, RPE, jours de vacances, volume moyen par muscle, équilibres, records de la période, « bloqué » et « sous la fourchette » à la fin de la période ; HTML sans texte cassé ni point décimal |
| texte cassé (partout) | jamais « undefined », « NaN », « Invalid Date » ni date brute « Sun Nov … » |
| contexte envoyé à l'IA | dernier questionnaire, dernière séance (séries, RPE), séances depuis lundi, records récents, bloqués, sous la fourchette, volume de la semaine (et sa fenêtre), poids ; aucun point décimal |
| cardio | « N sorties ces 4 semaines (X km) » (28 jours, micro-sorties exclues), tuiles Sorties / Distance 4 sem., Charge 7 j (RPE × durée, marche = 0), chaque ligne d'historique (distance, durée, vitesse) |
| Résumé ▸ période (B18) | tonnage moyen / séance, séances, séries, répétitions, RPE moyen des séries, records battus (meilleur précédent dépassé, 1re fois exclue), volume musculaire (secondaire = ½) et son statut Sous-MEV / Suffisant / Optimal / Au-delà (cibles × semaines couvertes), balance agoniste / antagoniste |
| Historique (B19) | « N exos · N séries · X t » de chaque séance (date + nom) |
| force estimée 6 semaines (B20) | exercices listés (≥ 4 séances sur 42 j, dernière ≤ 21 j), « sur N séances », % (2 dernières vs 2 premières, réserve 10 − RPE) |
| Tendances (B12), Évolution (B13), poids (B14), cardio tendances (B17), saisie (B11) | voir l'historique des bugs ci-dessus |
| Évolution : vues et modes (B21-B23) | Force / Volume / Par série (étiquettes, en-tête), Par groupe (séries/sem, indirect, fréquence en principal, tonnage), Par séance (tonnage, séries, meilleure série et « avant ») |
| Entraînement (B24) | séances et exercices du programme (cardio à part), « N exos » par séance, ✓ date / « à faire », agenda du mois |
| Tes saisies (B25) | les 5 critères et le total sur 100 |
| points (B26) | gagnés, semaine (total et lignes), « N pts · +M cette semaine » |
| alertes / notifications (B27) | nombre de jours d'absence, zone de douleur lisible |
| pourquoi ça bloque / leviers (B28) | chaque ligne ✗ / ✓ et les chiffres du levier, « Basé sur N séances en S semaines », contradiction cible ↔ pourquoi |
| plan : séance et tentative | « Séance « X » » jamais une séance déjà faite cette semaine ; « Tenté <jour> : C kg × R à RPE x » = meilleure série de l'exercice cette semaine |
| phrases du classement | « Record : C kg × R le … », « Records : … », « a → b reps », « C × R → C × R », « N séries à R reps au lieu de M », « même niveau à RPE x au lieu de y », « Sous ta fourchette … », « Bloqué … depuis N séances » : chaque chiffre est vérifié dans les séries brutes |

## Pas encore couvert
Tous les blocs listés le 18/11 sont couverts. Écran de saisie couvert le 21/11 (règle B11 : fourchette de la séance + catégorie, séries prévues, dernière fois série par série, résumé, cibles ↔ message). Tendances couvert le 21/11 (règle B12 : régularité, tonnage par tranche, exercices en progrès, fréquence par muscle, répartition d'intensité ; capturé aussi par le banc). Évolution ▸ Par exercice (B13 : séances suivies, étiquettes de la courbe, meilleure série, écart sur la période, record, tableau) et courbe du poids (B14) couverts le 21/11. Restent hors vérificateur : les écrans foot / multisport, le dessin des graphiques. À ajouter dès qu'ils portent un chiffre affiché.
