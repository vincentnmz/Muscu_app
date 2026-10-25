-- ============================================================================
-- Novalyz — Agenda daté (table `planning`)
-- ----------------------------------------------------------------------------
-- Séances du programme posées à des DATES réelles, à côté de `programme` :
--   • `programme`        = DÉFINITION des séances (exercices, séries) + `jour`
--                          (1=lun … 7=dim) = SEMAINE TYPE / modèle par défaut.
--   • `planning` (ici)   = séances POSÉES sur des dates concrètes (agenda).
--
-- Une ligne = une séance (`seance_id`) un jour donné (`date`).
-- « À planifier » = séances distinctes du programme absentes du planning de la
-- semaine affichée → CALCULÉ côté front, rien à stocker.
--
-- Décisions produit (validées) :
--   • Plusieurs séances par jour AUTORISÉES (unique sur athlete_id+date+seance_id,
--     pas sur athlete_id+date) → double séance matin/soir possible.
--   • `statut` existe dès maintenant (défaut 'planifie') ; le calcul 'fait/manqué'
--     (croisement avec `performances`) viendra plus tard.
--   • Bouton « Pré-remplir depuis la semaine type » : le front lit `programme.jour`
--     et appelle planSeance(... source='auto') pour chaque séance.
--
-- Routes backend (supabase/functions/handler/index.ts) :
--   getPlanning {athlete_id, from, to}        → {ok, rows:[{id,date,seance_id,statut,source,note}]}
--   planSeance  {athlete_id, date, seance_id, source?} → {ok, id}   (upsert)
--   movePlanning {id, date}                   → {ok}                (glisser-déposer)
--   unplanPlanning {id}                       → {ok}                (retirer)
-- Droits : mêmes que saveProgrammeJour (coach lié à l'athlète / l'athlète).
-- ============================================================================

create table if not exists public.planning (
  id          bigint generated always as identity primary key,
  athlete_id  text    not null,
  date        date    not null,              -- jour planifié (ISO AAAA-MM-JJ)
  seance_id   text    not null,              -- = programme.seance_id
  statut      text    not null default 'planifie',  -- planifie | fait | manque
  source      text    not null default 'coach',     -- coach | athlete | auto
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Un même créneau (séance) n'est pas posé deux fois le même jour.
create unique index if not exists planning_uq
  on public.planning (athlete_id, date, seance_id);

-- Lecture par plage de dates (navigation par semaine) = rapide.
create index if not exists planning_ath_date
  on public.planning (athlete_id, date);
