# Zones prioritaires + volume intermédiaire / avancé (option b) — 03/11/2026

Demande porteur : « il aurait fallu demander quelle partie souhaite développer le débutant — les femmes préfèrent souvent les fessiers aux pecs — il faut être cohérent ». Validé : zones prioritaires + option **b**.

## Constat (vérifié dans le code)
- L'assistant de programme demande niveau, objectif, organisation, jours, durée — **jamais les zones à développer**. Le sexe existe (Réglages ▸ Profil) mais n'est utilisé par aucun calcul.
- Choix retenu : **on demande** plutôt que de déduire du sexe (pas de présélection).
- Avec les nouvelles cibles, les programmes générés intermédiaire / avancé restent souvent sous le minimum (`.work/gen-mat.cjs`). L'aperçu le disait déjà (« Sous ton minimum : … plus de temps ou un jour de plus ») mais **comparait au niveau du profil au lieu du niveau choisi** → corrigé (03/11).

## Maquette (`mockups/zones-prioritaires.html`, chiffres du vrai générateur)
1. **Nouvelle étape** « Zones à développer en priorité » (2 max) : fessiers, jambes, pectoraux, dos, épaules, bras, abdos, ou « équilibré » ; rien de présélectionné. Une zone prioritaire **vise le haut de la fourchette** : minimum relevé au milieu (débutant 6-12 → 9-12 ; intermédiaire 10-16 → 13-16) + un exercice de plus. Alizé, Full Body 3 j, ★ fessiers : 9 séries (2 Hip thrust + RDL), tous les muscles ≥ minimum.
2. **Option b** : quand la durée / les jours ne suffisent pas, l'assistant le dit avec les chiffres et propose **la solution testée** en un clic. Intermédiaire Upper/Lower 4 j × 60 min, ★ pecs : 5 muscles sous la cible (pecs 9/13, dos 9/10, fessiers 7,5/10, épaules 6/8, mollets 6/8) → « Passer à 75 min → tout est atteint » (pecs 15, dos 12, fessiers 11, épaules 9, mollets 8) ou « Garder 60 min ». Si aucune durée / aucun jour ne suffit : proposer l'organisation qui convient.
3. **Ensuite** : zones modifiables dans Réglages ▸ Profil (et par le coach dans la fiche ▸ Programme) ; cibles relevées (★) dans les Analyses et le plan de la semaine ; « ★ Fessiers » dans l'en-tête de la fiche coach. Le programme n'est pas régénéré tout seul (bouton « Régénérer avec mes zones »).

## Technique prévue
- Zones stockées comme les autres préférences (`indicateurs` pref `zones_prio`), renvoyées par `getAppData` ; le serveur relève la cible des zones dans `volume_obti` → athlète, coach, mail, plan suivent (redéploiement `index.ts`).
- Générateur : blocs des zones prioritaires ajoutés comme pour l'option A, à tous les niveaux.

## Réalisé (03/11, validé porteur : maquette + règle)
- **Serveur** (`index.ts`) : `ZONES_PRIO` (fessiers, jambes = quadriceps + ischios, pectoraux, dos, épaules, bras = biceps + triceps, abdos) ; préférence `zones_prio` (2 max, action `saveZonesPrio`) ; `getAppData.volume_obti` relève le minimum des zones au milieu de la fourchette (`prio: true`) → Analyses, plan, mail, fiche coach suivent ; `getAppData.zones_prio`. **À redéployer.**
- **Assistant** : étape « Zones à développer en priorité » (débutant : après le choix du programme ; autres : après l'objectif), rien de présélectionné ; aperçu ★ avec la cible relevée ; zones enregistrées à la création du programme. Générateur : la zone est servie en premier (un exercice par séance où c'est logique, dans la durée choisie ; en débutant, dépassement autorisé comme l'option A).
- **Option b** : quand des muscles restent sous la cible, l'assistant teste +15 / +30 min, un jour de plus, puis d'autres organisations, et propose la première solution qui atteint tout (« Passer à 90 min → tout est atteint », avec les chiffres) ou « Garder ». Écart avec la maquette : pour intermédiaire Upper/Lower 4 j × 60 min ★ pecs, la solution réelle est **90 min** (à 75 min les quadriceps restent sous 10).
- **Réglages ▸ Profil** : zones modifiables (enregistrées à chaque choix, cibles recalculées) + lien « régénérer avec mes zones ». **Fiche coach** : « ★ Fessiers » dans l'en-tête, zones modifiables dans l'onglet Programme, ★ dans « Séries des 7 derniers jours ». **Analyses** : ★ sur le muscle. **Plan de la semaine** : « ★ Fessier : +3 séries… (ta zone prioritaire) ».
- Corrigé en route : l'aperçu de l'assistant comparait au niveau du profil au lieu du niveau choisi.
- Tests : `generateur-v2` 42 cas (+3 zones) ; 77 suites vertes. Captures relues : assistant débutant ★ fessiers, intermédiaire ★ pecs (option b + clic), Réglages, fiche coach.
