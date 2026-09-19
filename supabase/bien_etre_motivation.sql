-- Novalyz — ajoute la "motivation" au questionnaire du matin (état du jour).
-- Échelle 1..5 (5 = très motivé). NULL = non renseigné.
-- À lancer UNE FOIS dans Supabase ▸ SQL Editor, puis redéployer index.ts.
ALTER TABLE bien_etre ADD COLUMN IF NOT EXISTS motivation smallint;
