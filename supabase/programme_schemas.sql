-- #4 — Schéma de séries par exercice (programme).
-- 'fixe' (défaut, = straight sets) | 'double' (double progression) |
-- 'topbackoff' (top-set + back-off) | 'pyramidal' (cible par série).
-- Non cassant : colonnes nullables ; NULL = 'fixe' (comportement actuel).
ALTER TABLE programme ADD COLUMN IF NOT EXISTS schema text;
-- Top-set + back-off : pourcentage de décharge des séries de volume (ex. 10 = −10 %).
ALTER TABLE programme ADD COLUMN IF NOT EXISTS backoff_pct smallint;
-- Pyramidal : cible par série, [{ "pct": <% 1RM|null>, "reps": <n|null>, "rpe": <n|null> }, ...].
ALTER TABLE programme ADD COLUMN IF NOT EXISTS series_json jsonb;
