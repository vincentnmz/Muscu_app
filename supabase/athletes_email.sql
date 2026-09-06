-- Novalyz — colonne email (optionnelle) sur les athlètes — P1 reset par email.
-- Fondation du reset de mot de passe par email : on stocke un email par compte.
-- L'email reste OPTIONNEL (nullable). Aucune autre table à ce stade.
-- À exécuter une fois dans l'éditeur SQL Supabase (SQL Editor → New query → Run).

alter table athletes add column if not exists email text;
