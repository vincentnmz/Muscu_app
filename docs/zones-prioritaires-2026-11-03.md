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
