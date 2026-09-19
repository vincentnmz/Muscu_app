-- Novalyz — colonnes profil/équipe du coach (Réglages v3).
-- email : récupération de compte + futures notifs coach.
-- club / categorie_defaut : préférence d'équipe (pré-remplissage à venir).
-- Optionnelles (nullable). À exécuter dans l'éditeur SQL Supabase.

alter table coachs add column if not exists email text;
alter table coachs add column if not exists club text;
alter table coachs add column if not exists categorie_defaut text;
