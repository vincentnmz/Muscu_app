-- P0.2 — Entité Activité canonique (socle multi-source pour GPS / Health Connect).
-- Additive et non-bloquante : ne touche à aucune table existante, le moteur est
-- inchangé (activity_id = seance_id existant au départ). Déjà appliquée en prod le
-- 22 sept. 2026 (migration Supabase `p0_2_entite_activite`).
--
-- Peuplée par le backend `rebuildActivites(athlete_id)` (index.ts), appelé après
-- chaque saveCardio / saveHyrox, et disponible en action `rebuildActivites` (POST)
-- pour un backfill. Lecture via l'action GET `getActivites`.

create table if not exists activites (
  id           bigint generated always as identity primary key,
  athlete_id   text not null,
  seance_id    text not null,           -- clé naturelle : le seance_id existant (indicateurs)
  type         text,                     -- footing / velo / hyrox / ...
  debut        timestamptz,
  fin          timestamptz,
  duree_s      integer,
  distance_m   numeric,
  source_primaire text,                  -- manual / google_health / phone_gps / ...
  statut       text default 'complete',
  notes        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique (athlete_id, seance_id)
);
create index if not exists idx_activites_athlete on activites(athlete_id, debut desc);

-- Traçabilité : quelles sources ont alimenté une activité (fusion multi-source à venir).
create table if not exists activite_sources (
  id           bigint generated always as identity primary key,
  activity_id  bigint not null references activites(id) on delete cascade,
  source       text not null,
  source_ref   text,
  imported_at  timestamptz default now(),
  fields_owned text[],
  unique (activity_id, source)
);
