-- Audit connexion (02/11/2026) — C5 limite d'essais, C8 sessions révoquées, C9 e-mail confirmé.
-- Additif uniquement (aucune donnée modifiée).
create table if not exists public.login_echecs (
  id bigint generated always as identity primary key,
  cle text not null,                -- 'a:<login>' ou 'c:<login>'
  created_at timestamptz not null default now()
);
create index if not exists login_echecs_cle_date on public.login_echecs (cle, created_at);
alter table public.login_echecs enable row level security;   -- accès service_role seulement

-- C8 : toute session émise AVANT cet instant (secondes epoch) est refusée.
alter table public.athletes add column if not exists sess_depuis bigint;
alter table public.coachs   add column if not exists sess_depuis bigint;
-- C9 : adresse e-mail confirmée par le lien du mail de bienvenue.
alter table public.athletes add column if not exists email_verifie boolean not null default false;
alter table public.coachs   add column if not exists email_verifie boolean not null default false;
