# Audit Hyrox — 29 oct. 2026

> Méthode : lecture de tout le code Hyrox (saisie `_hyroxFormHtml` / `sauvegarderHyrox`, backend `handleSaveHyrox`,
> accueil `renderHyroxHome`, analyse `_hxAnalyseHtml` / `ouvrirHyroxDetail`) + rendu Playwright de l'écran d'analyse
> sur les Hyrox de démonstration en base (compte test « john », 10+ circuits complets) + 1 entraînement partiel fabriqué.
> **Aucune vraie Hyrox en base** : l'audit porte sur le code et sur ces données, pas sur un usage réel.
> Non couvert : chrono live (`ouvrirHyroxChrono`) et mode « Par atelier » (`ouvrirHyroxAtelier`) — à faire sur téléphone.

## Défauts trouvés

| # | Gravité | Où | Défaut | Statut |
|---|---|---|---|---|
| 1 | **Élevée** | Saisie (16 segments) | Les champs sont en clavier numérique (`inputmode=numeric`), qui n'a souvent **pas de « : »** sur Android. « 430 » valait 430 s (7:10) au lieu de 4:30, et « 4.30 » valait 4 s. | **Corrigé** : « 4:30 », « 4.30 », « 4,30 », « 4 30 » et « 430 » donnent tous 4:30. 1 ou 2 chiffres seuls = minutes. « 1:02:30 » = h:mm:ss. Aide mise à jour (13 cas testés). |
| 2 | **Élevée** (règle 6bis) | Analyse › « Point faible » | « Atelier le plus lent … à travailler en priorité » comparait des **ateliers de nature différente** (SkiErg 1000 m contre 100 Wall Balls) : le plus long n'est pas un point faible. | **Corrigé** : point faible = plus gros recul (≥ 5 %) **vs ta propre moyenne sur cet atelier** (2 à 5 Hyrox précédentes). Sans historique : « Atelier le plus long » + une phrase qui explique que ce n'est pas forcément un point faible. Badge « le + lent » renommé « le + long ». |
| 3 | **Élevée** | Analyse › « vs préc. », courbe de progression | La comparaison prenait **la Hyrox précédente, quelle qu'elle soit** : un entraînement de 3 ateliers comparé à un circuit complet donnait « ▼ −58:40 vs préc. » et cassait la courbe. | **Corrigé** : on ne compare et on ne trace que des Hyrox avec **le même ensemble de segments**. |
| 4 | Faible | Libellés | Le même mode s'appelle « Course / simulation » à la saisie, « Circuit » dans la liste et « Circuit officiel » dans l'analyse. | À harmoniser (choix du libellé). |
| 5 | Info | Données de démo | Sur les seeds, `hyrox_total` (4320 s) ≠ somme des splits (4284 s). L'app écrit `total = somme` → pas de défaut en usage réel. | Rien à faire. |

## Vérifié juste
- Poids par division (Open / Pro, H / F) : identiques aux standards officiels connus (sled push 152/102/202/152, sled pull 103/78/153/103, farmers 2×24/2×16/2×32/2×24, sandbag 20/10/30/20, wall ball 6/4/9/6 kg). Pas revérifié sur la saison 2025-26.
- Ordre et distances des 8 ateliers ; total = somme des segments ; durée stockée = total en minutes arrondies ; distance = nombre de runs (1 km chacun).
- Charge : la Hyrox est comptée à part dans le Croisé (3ᵉ catégorie, UA = RPE × durée).
- Calculs affichés, recalculés à la main sur la Hyrox du 19/09 :
  - course 38:55 / ateliers 32:29 ;
  - moyennes 4:52 et 4:04 ;
  - recul SkiErg +8 % (4:22 contre une moyenne de 4:02) ;
  - recul Sled Push de l'entraînement partiel +26 % (5:00 contre 3:57).
