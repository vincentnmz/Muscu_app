-- =============================================================================
-- Comptes de DÉMO / TEST : colonne is_demo sur athletes et coachs (défaut false).
-- Utilisée par le serveur (index.ts, _comptesDemo) pour exclure ces comptes des
-- envois automatiques (alertes push du matin, résumés e-mail) et, plus tard,
-- des statistiques. Les comptes restent utilisables normalement dans l'app.
-- Le marquage des comptes (quelles lignes passent à true) est une opération de
-- DONNÉES, faite à part et notée dans supabase/MIGRATIONS.md.
-- Idempotent.
-- =============================================================================
alter table public.athletes add column if not exists is_demo boolean not null default false;
alter table public.coachs   add column if not exists is_demo boolean not null default false;
comment on column public.athletes.is_demo is 'Compte de démonstration ou de test : exclu des envois automatiques et des statistiques.';
comment on column public.coachs.is_demo   is 'Compte de démonstration ou de test : exclu des envois automatiques et des statistiques.';
