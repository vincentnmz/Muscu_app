# Données de TEST en préprod (14/11/2026) — vérification A–D + E sur /dev/

Projet **préprod uniquement** (`vqxkeqjaqkkmtzxvqvhi`). Aucune donnée de prod touchée, aucun code modifié pour ces scénarios.
Marqueur commun : `created_at = '2026-11-14 00:14:11+00'` (+ `ressenti_global = 'TEST-1411'` sur les questionnaires).

| Compte | Scénario | Lignes ajoutées |
|---|---|---|
| John (`0101`, id `3`) | Douleur : 2 séances cette semaine (copies des 03/11 et 05/11 → 10/11 et 12/11), questionnaire normal le 13/11, **douleur 4/5 épaule le 14/11** | 36 séries + 2 questionnaires |
| Lucas (`9035`, id `demo_4_lucas`) | Pic de charge : 5 séances du 09 au 13/11 (copies de séances récentes, **séries doublées**), aucun questionnaire depuis le 07/11 | 162 séries ajoutées, puis les 6 séries de mollets du 10/11 retirées (pour voir une action « en pause ») → 156 |

## Retirer toutes les données de test

```sql
delete from performances where created_at = '2026-11-14 00:14:11+00' and athlete_id in ('3', 'demo_4_lucas');
delete from bien_etre   where created_at = '2026-11-14 00:14:11+00' and athlete_id = '3' and ressenti_global = 'TEST-1411';
```
