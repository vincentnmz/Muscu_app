-- =============================================================================
-- Retours utilisateurs (bouton « Signaler un problème / une idée », 11/11/2026, validé par le porteur).
-- Avant : formulaire coach → e-mail seulement ; athlète → simple lien mailto ; rien n'était gardé.
-- Maintenant : chaque retour (athlète OU coach) est enregistré ici par le serveur (action envoyerRetour),
-- avec l'écran d'où il vient, la version de l'app et la plateforme, PUIS envoyé par e-mail comme avant.
-- Lecture par le porteur : Supabase ▸ Table Editor ▸ retours (statut à passer de « nouveau » à « lu » / « traite »).
-- Écriture : serveur seul (service_role). RLS fermé, aucun droit pour anon / authenticated. Idempotent.
-- =============================================================================
create table if not exists public.retours (
  id bigint generated always as identity primary key,
  created_at timestamp with time zone not null default now(),
  role text not null check (role in ('a', 'c')),
  compte_id text not null check (char_length(compte_id) between 1 and 120),
  type text not null default 'autre' check (type in ('bug', 'idee', 'autre')),
  message text not null check (char_length(message) between 3 and 3000),
  ecran text check (ecran is null or char_length(ecran) <= 60),
  version text check (version is null or char_length(version) <= 60),
  plateforme text check (plateforme is null or plateforme in ('web', 'android', 'ios')),
  statut text not null default 'nouveau' check (statut in ('nouveau', 'lu', 'traite'))
);
create index if not exists retours_created_at_idx on public.retours (created_at desc);
create index if not exists retours_compte_idx on public.retours (compte_id, created_at desc);
alter table public.retours enable row level security;
revoke all on table public.retours from anon, authenticated;
comment on table public.retours is 'Retours utilisateurs (bug / idée / autre) envoyés depuis l''app. Écriture : serveur seul (envoyerRetour).';
