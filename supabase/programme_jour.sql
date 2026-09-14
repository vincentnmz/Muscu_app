-- Programme athlète — jour conseillé par séance (#7, phase 1).
-- Le jour est INDICATIF : faire la séance un autre jour ne pénalise pas le suivi.
-- 1 = lundi … 7 = dimanche ; NULL = non planifié.
-- Le jour est stocké sur chaque ligne d'une séance (toutes les lignes d'une même
-- séance partagent la valeur ; l'action saveProgrammeJour les met à jour ensemble).
ALTER TABLE programme ADD COLUMN IF NOT EXISTS jour smallint;

-- Phase 2 (à venir) : charge cible (% du 1RM) + RPE cible par exercice.
-- ALTER TABLE programme ADD COLUMN IF NOT EXISTS charge_pct_1rm numeric;
-- ALTER TABLE programme ADD COLUMN IF NOT EXISTS rpe_cible numeric;
