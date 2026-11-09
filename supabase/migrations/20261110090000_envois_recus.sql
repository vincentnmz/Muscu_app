-- =============================================================================
-- Anti-doublon des envois de séance : table dédiée envois_recus (audit P1, étape 1).
-- Avant : marqueur cle='envoi_id' dans indicateurs, vérifié AVANT l'écriture puis
-- écrit APRÈS → deux envois simultanés passaient tous les deux (doublon), et un
-- marqueur non écrit (erreur après la séance) laissait passer un renvoi.
-- Maintenant : le serveur RÉSERVE l'envoi (insert) avant d'écrire la séance ; la
-- contrainte UNIQUE (athlete_id, envoi_id) garantit qu'une seule requête gagne.
--   statut 'en_cours' = réservé, séance en cours d'écriture ; 'ok' = séance écrite.
--   seance_id / date = séance concernée (comme l'ancien marqueur : effacé avec la séance).
-- Reprise des anciens marqueurs d'indicateurs (statut 'ok'). Idempotent.
-- =============================================================================
create table if not exists public.envois_recus (
  id bigint generated always as identity primary key,
  athlete_id text not null references public.athletes(id) on delete cascade,
  envoi_id text not null check (char_length(envoi_id) between 1 and 100),
  seance_id text,
  date date,
  statut text not null default 'en_cours' check (statut in ('en_cours', 'ok')),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint envois_recus_athlete_envoi_key unique (athlete_id, envoi_id)
);
alter table public.envois_recus enable row level security;
revoke all on table public.envois_recus from anon, authenticated;
comment on table public.envois_recus is 'Anti-doublon des envois de séance (un envoi_id par athlète, unique). Seul le serveur y accède.';

-- Reprise des marqueurs existants (indicateurs, cle = 'envoi_id') — ne réécrit rien d'existant.
insert into public.envois_recus (athlete_id, envoi_id, seance_id, date, statut, created_at, updated_at)
select i.athlete_id, i.valeur, i.seance_id, i.date, 'ok', coalesce(i.created_at, now()), coalesce(i.created_at, now())
from public.indicateurs i
join public.athletes a on a.id = i.athlete_id
where i.cle = 'envoi_id' and coalesce(i.valeur, '') <> '' and char_length(i.valeur) <= 100
on conflict (athlete_id, envoi_id) do nothing;
