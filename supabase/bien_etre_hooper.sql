-- Novalyz — questionnaire « état du jour » passé à l'indice de Hooper (readiness).
-- Ajoute STRESS et COURBATURES (DOMS) à bien_etre. Échelle 1..5 où 5 = mauvais
--   (stress fort / courbatures importantes) — même convention « invert » que
--   fatigue/douleur. NULL = non renseigné.
-- Le moteur lit ces colonnes dans le score de récupération (sommeil + fatigue +
--   stress + courbatures = Hooper-Mackinnon).
-- À lancer UNE FOIS dans Supabase ▸ SQL Editor, puis redéployer index.ts.
ALTER TABLE bien_etre ADD COLUMN IF NOT EXISTS stress smallint;
ALTER TABLE bien_etre ADD COLUMN IF NOT EXISTS courbatures smallint;
