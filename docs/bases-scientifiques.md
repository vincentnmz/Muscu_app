# Novalyz — Bases scientifiques des calculs

> Référence de fiabilité (l'app sera publique → elle doit être crédible).
> Pour CHAQUE métrique affichée : la formule/le seuil **réellement dans le code**,
> la source, le niveau de preuve, les limites, et le wording recommandé.
> Règle : on n'affiche que ce qu'on peut assumer scientifiquement ; ce qui est
> débattu est présenté comme **indice**, pas comme verdict.
> (Le « ? » de chaque bloc dans l'app pointe vers ces explications — cf. `_MA_INFO` dans `js/app.js`.)

---

## Tonnage (charge externe)
- **Code** : `Σ (charge × répétitions)` sur les séries (par séance / semaine).
- **Statut** : ✅ mesure descriptive standard de charge externe.
- **Limite** : ce n'est pas l'intensité — un gros tonnage peut venir de beaucoup de reps légères.

## Volume = séries par semaine et par muscle
- **Code** : séries/sem par groupe, comparées à une cible modulée par l'expérience.
- **Source** : relation dose-réponse volume→hypertrophie.
  - Schoenfeld et al., *dose-response weekly volume & hypertrophy* — [PubMed 27433992](https://pubmed.ncbi.nlm.nih.gov/27433992/).
  - Pelland et al. (2024-25), *Resistance Training Dose Response (meta-regressions)* — [PubMed 41343037](https://pubmed.ncbi.nlm.nih.gov/41343037/).
- **Statut** : ✅ bien étayé (gains ↑ avec le volume, avec rendements décroissants).
- **Repère** : ~10 séries/sem/muscle est un point de départ raisonnable ; davantage selon le niveau.

## Volume indirect (muscles secondaires)
- **Code** : dans « Mes analyses ▸ Par groupe », le muscle **secondaire** d'un exercice
  (colonne `muscle_secondaire` du catalogue) reçoit **0,5 série** (et 0,5× tonnage),
  affiché « dont X indir. ». Le muscle **principal** reçoit 1 série (volume direct).
- **Source** : distinction **volume direct / indirect** en hypertrophie (ex. les triceps
  travaillent au développé couché). Le facteur ½ est une **convention** courante.
- **Statut** : 🟡 **convention, pas une constante** : la littérature ne fixe pas un
  coefficient universel (0, 0,5 ou 1 selon les auteurs). Présenté comme repère, clairement
  distingué du volume direct. (Aujourd'hui « Par groupe » ; le bloc résumé « Volume »
  reste en direct tant que le backend ne compte pas l'indirect.)

## RPE — effort perçu
- **Code** : échelle 1–10 saisie par l'athlète ; sert au ressenti + à la charge interne.
- **Source** : échelle de Borg (CR-10) ; RPE basé sur les répétitions en réserve (RIR) validé pour la muscu (Zourdos et al.).
- **Statut** : ✅ validé ; fiable avec un peu d'habitude à l'auto-évaluation.

## Charge interne = RPE × durée (session-RPE)
- **Code** : `RPE × durée` (utilisé côté cardio + croisé).
- **Source** : méthode *session-RPE* (Foster et al., 2001) pour quantifier la charge interne.
- **Statut** : ✅ méthode reconnue et simple.

## Calories (estimation)
- **Code** : selon le type — distance × poids (course/vélo), ou **durée via le MET** de
  l'activité (`kcal ≈ MET × poids(kg) × heures`) pour marche, natation (MET 8), **rameur
  (7), HIIT (8), elliptique (5), boxe (7)**. Vélo : puissance (W) si disponible.
- **Source** : *Compendium of Physical Activities* (Ainsworth et al.) pour les MET ;
  approximation `kcal/h ≈ MET × poids`.
- **Statut** : ✅ estimation reconnue **mais approximative** (affichée « ✦ estimé ») :
  les MET sont des moyennes de population, la dépense réelle varie avec l'intensité et
  l'individu. Toujours surchargeable manuellement par l'athlète.

## 1RM estimé (progression de force)
- **Code** : Epley `1RM ≈ charge × (1 + reps/30)`.
- **Source** : formule d'Epley (1985) ; alternative Brzycki. Corrélations élevées avec le 1RM réel.
- **Statut** : ✅ fiable surtout **< ~10 répétitions** ; l'erreur d'estimation grandit au-delà.

## ACWR — charge aiguë / chronique
- **Code** : charge 7 j / charge 28 j ; interprétable après ~28 j d'historique + ≥ 6 jours actifs ; zone repère 0,8–1,3, « élevé » > 1,5.
- **Source & critique** :
  - « Lessons Learned from the ACWR » — [PubMed 32125672](https://pubmed.ncbi.nlm.nih.gov/32125672/).
  - Revue systématique / méta-analyse — [PMC 12487117](https://pmc.ncbi.nlm.nih.gov/articles/PMC12487117/).
  - Analyse bayésienne (validité prédictive) — [PMC 9572878](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9572878/).
- **Statut** : ⚠️ **contesté**. Problèmes : couplage mathématique (l'aiguë est incluse dans la chronique), **jamais validé** comme intervention réduisant les blessures, seuils/temporalité hétérogènes.
- **Wording imposé** : présenter comme **un indice de variation de charge à interpréter avec prudence**, jamais comme un prédicteur de blessure ni un verdict. Novalyz ne l'utilise **pas** comme décision isolée (le moteur le confirme).

## Charge globale & répartition muscu/cardio (composites Novalyz)
- **Code** : charge globale/sem = tonnage muscu converti en UA (`tonnage / 50`) + charge cardio (`Σ RPE × durée`). Répartition = part muscu vs cardio de ce total.
- **Statut** : 🟡 la brique cardio (session-RPE) est validée ; la **mise à la même échelle que la muscu** repose sur un ratio approximatif (`/50`), donc c'est un **proxy de comparaison**, pas une mesure absolue.
- **Wording imposé** : parler de **tendance** (monte/descend, part relative), jamais du chiffre exact. Le « ? » du bloc le dit explicitement.

## Indice de forme (composite Novalyz)
- **Code** : `(sommeil + énergie + (6 − fatigue)) / 15 × 100`, moyenné par semaine (0–100).
- **Statut** : 🟡 **indicateur maison** dérivé du ressenti déclaré, non validé cliniquement. Utile par sa **tendance** (croisée à la charge), pas comme score médical.
- **Wording imposé** : « indice de forme » basé sur ton ressenti ; à croiser avec la charge (forme qui chute + charge qui monte = signal de lever le pied).

## Efficience cardio (FC à effort constant)
- **Code** : FC moyenne 1re vs 2de moitié de la fenêtre, **affirmée seulement si le RPE moyen des deux moitiés est proche (±1)**.
- **Source** : principe physiologique — meilleure condition aérobie → FC plus basse à charge donnée.
- **Statut** : ✅ **à condition de contrôler l'effort** (fait) ; sinon une FC plus basse peut venir de sorties plus faciles.

## Contexte de performance (déload / reprise / intensification / blessure)
- **Code** : `CORE_CONTEXTES` → effets sur le moteur (repos assumé, surcharge ±1, risque +1, niveau min, ACWR en pause reprise) ; la Lecture Novalyz en tient compte.
- **Statut** : ✅ principes de périodisation standards (deload, surcharge progressive, reprise progressive).

## Fiabilité / confiance
- **Code** : fonction du nombre de séances (28 j + 28 j préc.), du nombre de questionnaires bien-être, et de la présence d'une base de comparaison. Une évolution % n'est affirmée que sur une vraie base (≥ 3 séances muscu / ≥ 2 sorties cardio).
- **But** : ne jamais présenter comme sûr ce qui repose sur trop peu de données.

---

## Règle d'or (voir aussi CLAUDE.md 6bis)
Toute phrase affichée est tracée jusqu'au code qui la produit ; le wording doit décrire
**exactement** le calcul et sa fiabilité. « Tests verts » ≠ « affirmation vraie ».
