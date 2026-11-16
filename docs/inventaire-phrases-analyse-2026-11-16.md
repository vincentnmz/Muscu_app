# Inventaire des phrases d'analyse — Novalyz (16/11/2026)

> Extrait **automatiquement du code** (commit af3a955), pour relecture. « … » = valeur calculée insérée par le moteur (charge, reps, muscle, date…).
> Une ligne peut contenir 2 variantes collées (ex. « … ton minimum. » / « … ta zone prioritaire. ») : c'est une phrase à choix selon le cas. Les numéros « L » renvoient à la ligne du fichier source.

Sommaire : 1. Diagnostic d'un exercice (pourquoi ça bloque · levier · action) · 2. Plan de la semaine · 3. Encarts « Pourquoi » / apprentissage / effort · 4. Journal des décisions · 5. Lecture Novalyz muscu · 6. Lecture Novalyz cardio · 7. Lecture croisée · 8. Centre d'alertes · 9. Morpho : leviers et garde-fous

## 1. Diagnostic d'un exercice — pourquoi ça bloque, levier, action
_Source : `js/lecture-v3.js` lignes 170–374_

- L185 — hors zone douloureuse : garde tes charges prévues. Pas besoin de forcer ni d'aller à l'échec.
- L187 — douleur forte… charge en haussegêne …
- L189 — Douleur forte signalée… (… ) : hors zone, garde tes charges et tes séries prévues. Pas besoin de forcer ni d'aller à l'échec. L'action revient d'elle-même quand la douleur est levée.
- L191 — Ta charge est en hausse et ton ressenti baisse : on n'ajoute rien cette semaine, priorité à la récupération. L'action revient d'elle-même quand ta charge redevient habituelle.
- L192 — Ta charge est en hausse et ton ressenti n'est pas assez renseigné pour savoir si tu l'encaisses : on n'ajoute rien tant qu'on ne sait pas. Renseigne ton état du jour ; l'action revient d'elle-même.
- L193 — Gêne … /5 signalée le … : n'ajoute ni charge ni séries sur cette zone tant qu'elle revient (avis kiné si ça persiste). L'action revient d'elle-même quand ton questionnaire ne signale plus la gêne.
- L229 — ko… Charge : … kg pour … rep… s, ta fourchette est … -
- L232 — au choix — … kg (petit pas… , attends-toi à ≈ … reps au début)
- L233 — ou … kg (pour assurer … reps à RPE 9, d'après ta meilleure série récente), puis +1 rep par séance jusqu'à … . C'est toi qui choisis.
- L235 — Pour revenir dans ta fourchette … -… . Petit pas de ≈ 5 %… ; … kg si tu veux être sûr de faire … reps (force estimée ≈ … kg).
- L239 — ko… 3 séances d'affilée à RPE 10 (à l'échec)
- L243 — ko… Volume … : … séries/sem (minimum … )
- L246 — volume… +… série… s de … (… → … séries/sem).
- L247 — series… ★ … : +… série… s de … → … séries/sem, … ta zone prioritaire.ton minimum.
- L249 — ok… Volume … : … séries/sem — pas en cause
- L258 — effort… garde … kg et vise RPE 8 ; si le RPE monte encore la prochaine fois, allège cette semaine (−10 %).
- L259 — rpe… : garde … kg, vise RPE 8… RPE … → … à charge égale : signe de fatigue sur ce mouvement.
- L264 — ko… Travaillé … ×/sem… frequence… répartis … sur 2 séances dans la semaine.
- L265 — ok… Fréquence : … ×/sem — pas en cause
- L281 — ko… Repos raccourci : … → … à la dernière séance
- L282 — repos… reviens à … de repos entre tes séries (… la dernière fois).
- L283 — ok… Repos : … , stable — pas en cause
- L288 — ko… Séries arrêtées à RPE … (≈ … rep… s en réserve) sur les … dernières séances
- L289 — reserve… le blocage peut venir de l'arrêt de tes séries : tu t'arrêtes avec ≈ … rep… s en réserve. Sur ta dernière série, va jusqu'à RPE 9-10 (0 à 1 rep en réserve) à … kg.
- L290 — Et sur ta dernière série, va jusqu'à RPE 9-10 : tu t'arrêtes avec ≈ … rep… s en réserve.
- L291 — ok… Effort : RPE … sur tes séries de travail — tu pousses déjà, pas en cause
- L305 — ko… Possible : gêne … /5 signalée le … , … (zone sollicitée par cet exercice)
- L306 — gene… surveille la zone : tant que la gêne revient, garde ta charge (avis kiné si ça persiste).
- L320 — ko… Possible : ta série à … kg est passée de … à … reps pendant que tes séries à … kg … sont redescendues de … à … stagnent à
- L322 — avant… garde ta série à … kg au niveau d'avant (≈ … reps, sans aller au bout) pour arriver plus frais sur … kg.
- L323 — Et garde ta série à … kg au niveau d'avant (≈ … reps, sans aller au bout).
- L333 — marche… la marche suivante (+… kg) fait +… % : trop gros pour cet exercice. Passe-la au plus petit cran possible (micro-disque, cran intermédiaire de poulie) ou ajoute 1 série à … kg en attendant de faire … reps.
- L334 — Et la marche suivante (+… kg) fait +… % : monte seulement quand tu fais … reps sur toutes tes séries.
- L341 — ko… Gêne … /5 signalée le … (zone sollicitée par cet exercice)
- L343 — gêne … signalée le … : n'ajoute ni charge ni séries sur cet exercice tant qu'elle revient ; garde ta charge ou allège (avis kiné si ça persiste).
- L355 — ta charge est en hausse … et ton ressenti baisseet ton ressenti n'est pas assez renseigné pour savoir si tu l'encaisses
- L356 — garde tes séries et ta charge prévues, sans aller à l'échec… , et priorise la récupération., et renseigne ton état du jour.
- L365 — debutantaucune cause visible dans tes données — à ton niveau, garde cet exercice et ta régularité avant de changer quoi que ce soit, en visant RPE 8-9.
- L366 — avance… expertaucune cause visible dans tes données — à ton niveau, un plateau est fréquent : change de fourchette (ex. 6-8 ↔ 10-12) ou de variante pendant 3-4 semaines.
- L368 — aucune cause visible dans tes données : repos stable, tu pousses déjà tes séries (RPE … ). Garde ta charge ; si ça dure encore 2 séances, change de fourchette de reps pendant 3-4 semaines.
- L369 — aucune cause visible dans tes données — persiste en visant RPE 8-9 ; si ça dure encore 2 séances, change de fourchette de reps pendant 3-4 semaines.

## 2. Plan de la semaine (Résumé / Aujourd'hui)
_Source : `js/lecture-v3.js` lignes 375–520_

- L433 — reprise… Reprendre : 1 séance de muscu cette semaine… Dernière séance le … /… . On reprend à ton rythme ; le plan habituel revient la semaine suivante.
- L450 — series… ★ … : +… série… s de … → … séries/sem, … ta zone prioritaire.ton minimum.
- L464 — cible… : vise … kg × … En progrès… (+… % en … sem.) — même cible que ta saisie.
- L488 — Moyenne … séries/sem sur … 4 semaines, ton minimum … .
- L489 — Tous tes exercices … d'de … comptent (ex. +… série… s de … , idéalement sur 2 séances).
- L500 — series… cible… series… Objectif atteint cette semaine : n'en rajoute pas tant que ta charge est en hausse.

## 3. Encarts Pourquoi, apprentissage, info progression, effort
_Source : `js/lecture-v3.js` lignes 521–702_

- L541 — Force estimée = charge × reps + les reps qu'il te restait (10 − RPE). Un même 80 kg × 8 compte plus à RPE 7 qu'à RPE 9. Repère, pas un test de 1RM.
- L542 — debutant À ton niveau, la force monte souvent d'une séance à l'autre.… avance… expert À ton niveau, la progression est lente : quelques % sur plusieurs semaines, c'est déjà bien.
- L550 — Ton plan de la semaine… / … en pause
- L558 — Ton plan de la semaine… / … fait… sen pause
- L565 — … Rien à changer : … · séries/sem, dans ta zone. Ce sont des propositions : c'est toi qui choisis. Calculées sur tes séances jusqu'à dimanche ; chacune se coche toute seule quand ta séance la réalise.…
- L570 — Pourquoi… (… ) : … aucune cause visible dans tes données… function… Levier : …
- L576 — … effortPourquoi l'effort monte… reculePourquoi ça reculePourquoi ça bloque
- L577 — … Aucune cause visible dans tes données.
- L579 — Basé sur … séance… s en … semaine… s… · fiable · à confirmer. C'est toi qui décides.
- L585 — … / … séances avec nuit mesurée
- L586 — Novalyz ne tirera de conclusion qu'à partir de … séances. D'ici là, rien n'est affirmé.
- L623 — toutes tes séries au haut de ta fourchette une fois, à RPE 8 ou moins → la charge monte d'un petit pas et tu repars au bas de la fourchette
- L624 — toutes tes séries au haut de ta fourchette 2 séances de suite à RPE 8 ou moins (ou une seule fois à RPE 7 ou moins) → la charge monte d'un petit pas et tu repars au bas de la fourchette
- L626 — Ton niveau : … , d'après tes années de pratique.
- L627 — Série par série, à partir de ton RPE
- L628 — RPE 9 ou 10 (1 rep en réserve ou moins) → on garde la charge et les reps : on consolide jusqu'à ce que ça devienne plus facile.
- L629 — RPE 8 ou moins → +1 rep la prochaine fois, jusqu'au haut de ta fourchette.
- L630 — Charge en plus : … . Jamais juste après une séance à l'échec (RPE 10).
- L631 — avance… expert… À ton niveau, quand la charge peut monter, tu choisis le levier du jour : charge, charge + 30 s de repos, +1 rep avec +30 s de repos, ou repos −30 s.
- L632 — Sous ta fourchette à l'effort maximal → au choix : un petit pas en dessous (≈ −5 %) ou une charge sûre calculée sur ta force estimée (jamais plus de −12,5 %).
- L634 — 2 séances de suite à l'échec, jour de vigilance, déload ou reprise après 3 semaines sans séance → pas de progression ce jour-là.
- L635 — Exercice dit « bloqué » après … séances identiques (à ton niveau) : Novalyz cherche la cause dans tes données (charge, volume du muscle, effort qui monte, fréquence) et te propose un levier.
- L637 — Celle de ton programme, sinon celle du type d'exercice : lourd / moyen 6-12, léger 8-20.
- L638 — Ce sont des propositions : c'est toi qui choisis à chaque séance.
- L653 — Note de séance = ce que tu indiques dans le bilan (0-10, toute la séance). RPE des séries = ce que tu notes à chaque série.
- L660 — Une seule séance sur la période : le graphique apparaît dès 2 séances.…
- L681 — Tes séances sont notées … à … /10
- L682 — tes séries sont à … /10 en moyenne… : chaque série va près de l'échec, la séance dans son ensemble te paraît moins dure...
- L685 — … note moyenne de tes séances… RPE moyen de tes séries
- L687 — Note de ta séance (bilan)RPE moyen de tes séries
- L700 — Objectif atteint#E3F7EC#00813F… Pas atteint#FFF1E0#B35F00… Pas tentévar(--surface2,#EEF1F7)var(--text-muted,#55627E)… Non évaluablevar(--surface2,#F2F2F2)var(--text-subtle,#777)

## 4. Journal des décisions (suite donnée)
_Source : `js/lecture-v3.js` lignes 703–894_

- L711 — charge… charge… alt… reps
- L756 — non_evaluable… Données de séances indisponibles.
- L760 — charge… cible… rpe… non_evaluable… Critère incomplet.
- L763 — series… Réalisé : … série… s (objectif … ).Aucune série de ce muscle cette semaine-là.
- L764 — reprise… Séance faite cette semaine-là.Pas de séance cette semaine-là.
- L768 — Exercice pas refait cette semaine-là.
- L769 — atteint… pas_atteintpas_tente
- L786 — series… charge… cible… rpe
- L790 — trop_tot… semaine suivante en cours, trop tôt pour conclure.
- L791 — reprise… confirme… régularité reprise la semaine suivante (… séance… s).… non_confirme… pas de séance la semaine suivante.
- L792 — confirme… minimum tenu la semaine suivante (… séries).
- L793 — non_confirme… semaine suivante : … série… s (minimum … ).
- L799 — pas_refait… exercice pas refait dans les 2 semaines suivantes.… trop_tot… pas encore refait depuis, trop tôt pour conclure.
- L806 — confirme… kg × … le … — revenu dans ta fourchette.
- L807 — non_confirme… toujours sous … reps sur … séances.… trop_tot… une seule séance depuis, trop tôt pour conclure.
- L812 — non_confirme… cible pas atteinte sur … séances.… trop_tot… une seule séance depuis, trop tôt pour conclure.
- L818 — non_confirme… RPE toujours au-dessus de 8 à … kg (… séances).
- L819 — trop_tot… une seule séance à cette charge depuis, trop tôt pour conclure.pas refait à cette charge depuis, trop tôt pour conclure.
- L837 — atteint… pas_atteint… atteint
- L848 — Semaine dernière… action… s proposée… s · … réalisée… s · … objectif… s atteint… s.
- L849 — Voir le détail · Tes décisions ›
- L854 — Pas encore de décision passée : ton premier plan enregistré apparaîtra ici la semaine prochaine, avec ce qui s'est passé ensuite.
- L860 — … Proposé car : … atteint… pas_atteint…
- L862 — Statut : d'après tes séances de la semaine concernée (même critère que la coche du plan). « Résultat observé ensuite » : les 1 à 2 semaines suivantes, conclu seulement avec assez de séances. Résultat observé après la recommandation. Association observée, pas une preuve de cause.
- L878 — Tes décisionsCe que Novalyz t'a proposé · et ce qui s'est passé.
- L884 — Déjà proposé · semaine du … : « … » → … atteint… pas_atteint…
- L890 — atteint… pas_atteint… non_evaluable
- L892 — Sur … semaine… s : … action… s proposée… s · … réalisée… s · … objectif… s atteint… s · … pas atteint… s… · … non évaluable… s
- L893 — Résultat observé après la recommandation. Association observée, pas une preuve de cause : d'autres facteurs (sommeil, programme, contexte) peuvent jouer.

## 5. Lecture Novalyz — muscu (constats + recommandations)
_Source : `supabase/functions/handler/index.ts` lignes 2119–2324_

- L2122 — number… Trop peu de séances pour juger l'évolution de ton volume${typeof nCur === 'number' ? … : ''} : il en faut au moins 3 sur chaque période.
- L2123 — Ta période de comparaison (les 4 semaines précédentes) contient une pause de … jours : l'évolution de ton volume n'est pas comparable pour l'instant.
- L2124 — Pas encore assez de recul pour juger l'évolution de ton volume (période précédente trop courte).
- L2168 — sur les 7 derniers jourscette semaine
- L2174 — positif… Ton volume progresse (+… % sur 4 semaines) sans hausse marquée de l'effort perçu — progression cohérente… .
- L2176 — neutre… Volume réduit (… % sur 4 semaines) — normal pendant ton déload, tu récupères.
- L2177 — neutre… Volume plus bas (… % sur 4 semaines) — cohérent avec ta reprise, remonte progressivement.
- L2178 — attention… Ton volume a baissé (… % sur 4 semaines)… .
- L2180 — neutre… Volume stable sur 4 semaines (… %).
- L2191 — positif… Tu respectes ton programme : dans la cible sur … /… exercice… suivi… (charge / RPE).
- L2192 — attention… Respect du programme : … /… exercice… dans la cible — ajuste tes charges ou revois tes cibles.
- L2194 — neutre… Tu as défini des cibles mais pas encore réalisé ces exercices — fais-les pour suivre ton respect du programme.
- L2201 — attention… Ton effort perçu (RPE) monte (+… ) alors que le volume stagne — tu forces plus pour le même travail.
- L2203 — attention… Ta récupération est dégradée ces jours-ci.
- L2205 — attention… Ton état du jour appelle à la vigilance (récupération / fatigue) — à prendre en compte avant d'intensifier.
- L2210 — attention… Régularité sous ton objectif (… /… séances … ).
- L2212 — positif… Régularité au rendez-vous (… /… séances … ).
- L2215 — neutre… Régularité : … /… séances cette semaine.
- L2221 — Allège temporairement le volume ou l'intensité 1 à 2 séances pour laisser la récupération remonter.… haute
- L2222 — Vise … séances/semaine : la régularité est le 1er moteur de progression.… moyenne
- L2224 — Ta progression est cohérente, mais ton état du jour appelle à la vigilance : garde la charge sans l'augmenter aujourd'hui et priorise la récupération ; tu relanceras la surcharge une fois au vert.… moyenne
- L2225 — Priorise la récupération aujourd'hui (état en vigilance) avant d'augmenter la charge.… moyenne
- L2226 — Reviens à tes charges habituelles pour préserver tes acquis (recomposition).… Reviens à ta charge habituelle : elle suffit à maintenir tes acquis.… Remonte progressivement le volume par muscle vers ta cible pour relancer la prise de masse.Remonte progressivement ton volume vers ta cible.… moyenne
- L2227 — Tu es même au-dessus d'un simple maintien : garde cette charge, inutile de forcer la surcharge.Conserve la structure actuelle et poursuis la surcharge progressive (petites hausses de charge ou de reps).… info
- L2228 — Continue et enregistre régulièrement tes séances : les analyses s'affinent avec les données.… info
- L2247 — Sommeil et stress pèsent sur ta récupération en ce moment : vise 7-9 h de sommeil régulier et un temps calme avant de dormir — c'est là que ton corps encaisse la charge d'entraînement.moyenne
- L2249 — Ton sommeil est en dessous ces jours-ci : vise 7-9 h et des horaires réguliers — c'est le 1er facteur de récupération et de progression.moyenne
- L2251 — Ton stress est élevé ces jours-ci : il freine la récupération. Garde l'entraînement (il aide à décompresser), mais baisse l'intensité si besoin et ménage-toi des temps de pause.moyenne
- L2254 — Courbatures marquées : échauffe-toi bien, garde une amplitude contrôlée, et laisse ~48 h à un muscle très courbaturé avant de le recharger fort.moyenne
- L2263 — Tu es bien récupéré : ta fraîcheur est au vert (peu de fatigue résiduelle). C'est le bon moment pour une séance un peu plus intense ou pour tenter une charge au-dessus de ton habituel sur un exercice clé.moyenne
- L2272 — Tes temps de repos sont courts en moyenne (~… s entre séries). Pour la force et la masse, vise plutôt 2-3 min sur tes exercices lourds — tu pousseras plus fort sur les séries suivantes.moyenne
- L2274 — Tu progresses : pour continuer, ajoute une petite surcharge (+1 rep, ou +2,5 kg) sur un exercice clé dès que ta dernière série passe bien.moyenne
- L2275 — Ton volume est stable : relance la progression en visant +1 rep sur tes exos principaux, puis +2,5 kg une fois le haut de ta fourchette atteint.moyenne
- L2276 — Cible un muscle en retard : ajoute 1 à 2 séries par semaine là où ton volume est sous ta cible, pour équilibrer ton développement.moyenne
- L2283 — Mets de l'intensité : tes séries finissent en moyenne à RPE … . Les dernières doivent finir proches de l'échec (1-2 reps en réserve) — c'est le signal qui déclenche la progression.info
- L2284 — Progresse une variable à la fois et garde les mêmes exercices : d'abord les reps jusqu'au haut de ta fourchette, puis la charge — c'est comme ça qu'on mesure vraiment les progrès.info
- L2285 — Soigne ta récupération : vise 7-9 h de sommeil et un repos suffisant entre séries (2-3 min sur les gros exercices) pour pousser fort la séance d'après.info
- L2286 — Assure l'apport : assez de protéines (~1,6 à 2 g/kg/jour) et évite un déficit calorique prolongé si ton objectif est de gagner force et muscle.info
- L2287 — Soigne l'exécution avant la charge : tempo contrôlé et amplitude complète rendent chaque série plus efficace.info
- L2288 — Enregistre ton RPE à chaque série : plus tes données sont complètes, plus les analyses et les cibles de charge sont justes.info
- L2299 — number… trop peu de séances (… sur les 4 semaines précédentes)… pause de … jours dans la période précédentepériode précédente trop courte

## 6. Lecture Novalyz — cardio
_Source : `supabase/functions/handler/index.ts` lignes 2325–2394_

- L2328 — neutre… Pas encore de cardio enregistré.… Ajoute une sortie cardio pour suivre ton endurance.… info… faible
- L2356 — attention… Ta charge cardio a fortement augmenté (+… % sur 4 semaines) — hausse rapide.
- L2357 — attention… Forte baisse de ton activité cardio (… % de temps sur 4 semaines) — si l'endurance est un objectif, reprends progressivement.
- L2358 — neutre… Ton activité cardio a baissé (… % de temps sur 4 semaines).
- L2373 — positif… À effort comparable, ta FC moyenne baisse (… →… bpm) — bon signe pour ton endurance.
- L2379 — Ton état du jour appelle à la vigilance : garde un cardio facile aujourd'hui et priorise la récupération.… moyenne
- L2380 — Fais monter ta charge cardio plus graduellement (≈ +10 % par semaine max) pour limiter le risque de surmenage.… moyenne
- L2381 — Reprends 1 à 2 sorties cardio par semaine pour bâtir ta base d'endurance.… info
- L2383 — Reprends progressivement : 1 à 2 sorties faciles par semaine pour reconstruire ta base d'endurance.… info
- L2384 — Continue sur ce rythme et varie les intensités (facile / modéré) pour progresser sans t'épuiser.… info

## 7. Lecture croisée muscu × cardio
_Source : `supabase/functions/handler/index.ts` lignes 2395–2437_

- L2407 — neutre… Pas encore assez de séances muscu + cardio pour croiser tes données.… Enregistre tes séances des deux côtés : Novalyz croisera charge et récupération.… info… faible
- L2411 — neutre… Ta charge est quasi 100 % musculation (… %). Un peu de cardio renforcerait ta base d'endurance.
- L2412 — neutre… Ta charge est quasi 100 % cardio (… %). La musculation entretient force et masse.
- L2419 — positif… Ta récupération est … ces 7 derniers jours.
- L2420 — attention… Ta charge monte et ton ressenti baisse — soigne ta récupération.
- L2421 — positif… Ta récupération est … et ta charge monte : tu encaisses bien pour l'instant.
- L2422 — neutre… Ta charge monte — renseigne ton état du jour pour qu'on vérifie ta récupération.
- L2424 — Faible… attention… Ta récupération est basse — allège ta charge globale (muscu + cardio) le temps qu'elle remonte.
- L2427 — Ta charge globale pèse sur ta récupération : prévois une semaine un peu plus légère ou une journée de repos.… moyenne
- L2428 — Ajoute 1 séance de cardio facile par semaine pour équilibrer et soutenir ta récupération.… info
- L2429 — Ajoute 1 à 2 séances de musculation par semaine pour préserver force et masse.… info
- L2430 — Bon équilibre : conserve ce ratio muscu / cardio et veille à ce que la récupération suive la charge.… info

## 8. Centre d'alertes
_Source : `supabase/functions/handler/index.ts` lignes 2438–2470_

- L2441 — Absence prolongée… Charge en hausse… Charge récente élevée
- L2442 — Sous-charge… Douleur signalée… Fatigue élevée
- L2446 — Reprends une séance cette semaine pour relancer la régularité.
- L2447 — Surveille tes sensations, évite d'augmenter la charge cette semaine.
- L2448 — Allège la charge 1 à 2 séances pour récupérer.
- L2449 — Tu peux augmenter progressivement ton volume.
- L2450 — Adapte la charge sur la zone et surveille ; avis kiné si ça persiste.
- L2451 — Priorise le sommeil et la récupération ; évite d'intensifier.
- L2452 — Améliore ton sommeil ; séance normale mais pas d'intensification.
- L2465 — basse… Rien d'alarmant : surveille-la, et note-la si elle revient ou augmente.
- L2466 — haute… Évite de charger la zone et fais-la évaluer (médecin / kiné) avant de reprendre fort.

## 9. Morpho — leviers et garde-fous (règles fixes, pas l'IA)
_Source : `supabase/functions/handler/index.ts` lignes 7649–7746_

- L7659 — Fémurs longs vs tronc… En squat, ton buste penchera davantage vers l'avant : privilégie des variantes qui gardent le dos sûr et le genou libre.… Squat gobeletHack squatSquat barre haute + talons surélevésPresse à cuisses… Good morning lourdSquat barre basse très large au départ… mesure
- L7660 — Tronc long / fémurs courts… Tes leviers autorisent un squat plus vertical, dos droit.… Back squat barre basseFront squatSquat barre haute… mesure
- L7661 — Leviers de squat équilibrés… Pas de contrainte marquée : les variantes de squat te conviennent.… Back squatFront squat… mesure
- L7663 — Fémurs longs (vs tibias)… Buste plus penché en squat : garde le dos neutre.… Squat gobeletHack squatTalons surélevés… Good morning lourd… mesure
- L7671 — Bras longs… À l'aise sur les tirages/tractions (allonge) ; amplitude plus longue au développé couché.… TractionsRowingDéveloppé couché prise modérée… Développé couché prise très large… mesure
- L7672 — Bras courts… Développé couché favorisé ; tirages sur une course un peu plus longue.… Développé couchéDips… mesure
- L7677 — Carrure large (épaules ≫ hanches)… Atout pour un visuel en V : entretiens dos et épaules.… TractionsDéveloppé épaulesRowing… mesure
- L7678 — Bassin large vs épaules… Élargir les épaules équilibre la silhouette ; au squat, un stance un peu plus large peut être plus naturel.… Développé épaulesÉlévations latéralesTirage… mesure
- L7686 — Soulevé de terre : conventionnel ou trap-bar… Pas de contrainte forte : choisis selon le confort lombaire.… Soulevé de terre conventionnelTrap-bar deadlift… mesure
- L7692 — Squat : appui large, pointes ouvertes… Hanches plus larges que les épaules : un stance large et des pointes de pied ouvertes libèrent la hanche.… Squat stance largeBox squatSumo squat… Stance très serré, pieds droits… mesure
- L7693 — Squat : appui plus serré possible… Bassin étroit : un stance modéré, pieds peu ouverts, peut suffire.… Squat stance modéréFront squat… mesure
- L7698 — Développé couché : longue amplitude… Humérus long : grande course, point faible en bas. Travaille la portion basse et le volume pectoral.… Floor press / board pressÉcarté (volume pec)Développé prise modérée… Prise très large à froid… mesure
- L7704 — Tibias courts (vs fémurs)… Avis indicatif, à nuancer : buste un peu plus penché au squat → talons surélevés souvent utiles. Dépend aussi de ta mobilité de cheville.… Talons surélevés au squatMobilité chevilleMollets debout… piste
- L7705 — Tibias longs (vs fémurs)… Avis indicatif, à nuancer : squat plus vertical possible ; pense aux mollets. À ajuster selon ton ressenti.… Squat barre hauteMollets assis + debout… piste
- L7711 — Avant-bras longs… Avis indicatif, à nuancer : au biceps, le curl pupitre / incliné donne une meilleure tension ; au rowing, une prise un peu plus large. À tester.… Curl pupitreCurl inclinéRowing prise large… piste
- L7712 — Avant-bras courts… Avis indicatif, à nuancer : bon levier au curl debout ; le tirage reste confortable.… Curl barre deboutTirage classique… piste
- L7719 — hernie… disque… sciatique… Garde-fou — dos / colonne… On écarte la flexion lombaire chargée et l’hyperpression ; variantes appui et dos neutre. Avis médical si douleur.… Hip thrustPresse à cuissesSquat gobeletTirage poitrine appuyéGainage anti-extension… Soulevé de terre lourd dos rondGood morningSquat très lourd à froid… antecedent
- L7720 — epaule… tendinite… Garde-fou — épaule / tendons… Amplitude maîtrisée, prise neutre, pas de charge max sur l’articulation douloureuse ; excentrique léger et progressif.… Développé haltères prise neutreFace pullÉlévations légèresExcentrique léger… Développé nuqueDips profondsDéveloppé très largeCharges max en douleur… antecedent
- L7723 — hanche… Garde-fou — hanche… Reste dans l'amplitude sans douleur : en cas de conflit de hanche, la flexion profonde sous charge (cuisse vers la poitrine), surtout genou qui rentre vers l'intérieur, est souvent mal tolérée. Limite la profondeur, écarte un peu les pieds, pointes légèrement ouvertes. À valider avec ton médecin ou ton kiné.… Hip thrustPont fessierSquat sur box (hauteur confortable)Leg curlAbduction de hanche… Squat profond sous la parallèlePresse amplitude complète (genoux vers la poitrine)Fentes profondes… antecedent
- L7724 — genou… Garde-fou — genou… Amplitudes sans douleur, pas de choc ; renforce quadriceps et ischios en contrôle.… Presse amplitude confortableLeg curl / extension légersVélo… Fentes profondes lourdesSauts / pliométrieSquat complet douloureux… antecedent
- L7725 — poignet… Garde-fou — poignet… Poignet neutre (pas cassé en arrière) ; sangles pour soulager la prise.… Prise neutre / marteauSangles de tirageMachines… Poignet en hyperextension chargéDéveloppé poignet cassé… antecedent
- L7726 — cheville… Garde-fou — cheville… Travail de proprioception, pas d’instabilité en charge.… Renfo mollets contrôléProprioception / équilibrePresse… Sauts / réception instableCharges lourdes en déséquilibre… antecedent
- L7727 — cardiaque… hta… asthme… Garde-fou — cœur / tension / respiration… Éviter l’hyperpression (blocage respiratoire) : respire, séries modérées, récup suffisante. Avis médical recommandé.… Séries 8–15 repsRécupération suffisanteCardio progressif… Charges maximales en apnée (Valsalva)Isométries longues maximales… antecedent
- L7728 — prothese… Garde-fou — arthrose / prothèse… Travail sans douleur, amplitudes maîtrisées, machines guidées.… Machines guidéesAmplitudes confortables… Chocs / sautsAmplitudes extrêmes douloureuses… antecedent
- L7729 — chirurgie… blessure… Garde-fou — zone en récupération… Reprise progressive sur la zone concernée, sans douleur ; suis les consignes du pro qui te suit.… Charges légères progressivesAmplitude indoloreRenforcement contrôlé… Charges lourdes sur la zoneMouvements douloureux… antecedent
- L7740 — Mis de côté tant que ton dos n'est pas validé par un professionnel (voir garde-fou dos / colonne) : … , .
- L7743 — grossesse… postpartum… Garde-fou — grossesse / post-partum… Priorité sécurité : avis médical / sage-femme requis (rien de médical ici).… Renforcement douxPlancher pelvienTravail debout… Décubitus dorsal prolongéHyperpression abdominaleCharges maximales… antecedent
