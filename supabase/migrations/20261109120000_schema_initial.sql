-- =============================================================================
-- Novalyz — schéma de référence (migration initiale), généré le 09/11/2026
-- par lecture du catalogue de la base de PROD (jhbrvgguybynzeceeceu), sans rien
-- y modifier. Sert à :
--   1. créer la base de PRÉPROD (projet Supabase séparé) à l'identique ;
--   2. démarrer l'historique des migrations (dossier supabase/migrations/).
-- Contenu : 28 tables public (colonnes, défauts, PK, UNIQUE, CHECK), clés
-- étrangères, index, RLS activé SANS policy (= fermé au public : seul le
-- serveur, via la clé service_role, lit/écrit), buckets Storage privés.
-- Non inclus volontairement : schéma `sauvegarde` (copies de prod), jobs
-- pg_cron (rappels/alertes : à ne PAS lancer en préprod), données.
-- Idempotent : peut être rejoué sans erreur.
-- =============================================================================

-- ── Tables ───────────────────────────────────────────────────────────────────
create table if not exists public.activites (
  id bigint generated always as identity not null,
  athlete_id text not null,
  seance_id text not null,
  type text,
  debut timestamp with time zone,
  fin timestamp with time zone,
  duree_s integer,
  distance_m numeric,
  source_primaire text,
  statut text default 'complete'::text,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint activites_athlete_id_seance_id_key UNIQUE (athlete_id, seance_id),
  constraint activites_pkey PRIMARY KEY (id)
);

create table if not exists public.activite_sources (
  id bigint generated always as identity not null,
  activity_id bigint not null,
  source text not null,
  source_ref text,
  imported_at timestamp with time zone default now(),
  fields_owned text[],
  constraint activite_sources_activity_id_source_key UNIQUE (activity_id, source),
  constraint activite_sources_pkey PRIMARY KEY (id)
);

create table if not exists public.alertes_historique (
  id bigint generated always as identity not null,
  athlete_id text,
  cle_alerte text,
  semaine text,
  created_at timestamp with time zone default now(),
  constraint alertes_historique_pkey PRIMARY KEY (id)
);

create table if not exists public.alertes_traitees (
  id bigint generated always as identity not null,
  coach_id text,
  cle text,
  semaine text,
  created_at timestamp with time zone default now(),
  constraint alertes_traitees_pkey PRIMARY KEY (id)
);

create table if not exists public.athletes (
  id text not null,
  login text not null,
  login_coach text,
  nom text,
  ddn date,
  taille numeric,
  annees integer,
  strategie text,
  coach_id text,
  password_hash text,
  sport text default 'muscu'::text,
  poste text,
  jambe_dominante text,
  poids numeric,
  antecedents text,
  heatmap text,
  sexe text,
  club text,
  categorie text,
  date_entree text,
  discipline text,
  created_at timestamp with time zone default now(),
  email text,
  recap_freq text,
  sess_depuis bigint,
  email_verifie boolean default false not null,
  constraint athletes_login_key UNIQUE (login),
  constraint athletes_pkey PRIMARY KEY (id)
);

create table if not exists public.beta_inscriptions (
  id bigint generated always as identity not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  prenom text not null,
  email text not null,
  profil text not null,
  appareil text not null,
  message text,
  source text,
  statut text default 'nouveau'::text not null,
  constraint beta_inscriptions_pkey PRIMARY KEY (id),
  constraint beta_inscriptions_appareil_check CHECK ((appareil = ANY (ARRAY['android'::text, 'iphone'::text, 'ordinateur'::text]))),
  constraint beta_inscriptions_email_check CHECK (((char_length(email) >= 5) AND (char_length(email) <= 200))),
  constraint beta_inscriptions_message_check CHECK (((message IS NULL) OR (char_length(message) <= 1000))),
  constraint beta_inscriptions_prenom_check CHECK (((char_length(prenom) >= 1) AND (char_length(prenom) <= 60))),
  constraint beta_inscriptions_profil_check CHECK ((profil = ANY (ARRAY['athlete'::text, 'coach'::text, 'structure'::text]))),
  constraint beta_inscriptions_source_check CHECK (((source IS NULL) OR (char_length(source) <= 30))),
  constraint beta_inscriptions_statut_check CHECK ((statut = ANY (ARRAY['nouveau'::text, 'ajoute'::text, 'refuse'::text])))
);

create table if not exists public.bien_etre (
  id bigint generated always as identity not null,
  date date,
  seance_id text,
  athlete_id text,
  sommeil numeric,
  energie numeric,
  fatigue_musculaire numeric,
  douleur numeric,
  zone_douloureuse text,
  ressenti_global text,
  note numeric,
  created_at timestamp with time zone default now(),
  motivation smallint,
  stress smallint,
  courbatures smallint,
  constraint bien_etre_pkey PRIMARY KEY (id)
);

create table if not exists public.blessures (
  id text not null,
  athlete_id text,
  date date,
  type text,
  localisation text,
  gravite text,
  duree text,
  retour_terrain date,
  retour_competition date,
  statut text,
  created_at timestamp with time zone default now(),
  constraint blessures_pkey PRIMARY KEY (id)
);

create table if not exists public.coachs (
  coach_id text not null,
  login text not null,
  nom text,
  password_hash text,
  sport text,
  created_at timestamp with time zone default now(),
  role text default 'coach'::text,
  email text,
  club text,
  categorie_defaut text,
  recap_freq text,
  sess_depuis bigint,
  email_verifie boolean default false not null,
  prefs jsonb default '{}'::jsonb not null,
  constraint coachs_login_key UNIQUE (login),
  constraint coachs_pkey PRIMARY KEY (coach_id)
);

create table if not exists public.commentaires (
  comment_id bigint not null,
  date text,
  coach_id text,
  coach_nom text,
  athlete_id text,
  message text,
  lu boolean default false,
  auteur text,
  auteur_nom text,
  created_at timestamp with time zone default now(),
  media_path text,
  media_type text,
  constraint commentaires_pkey PRIMARY KEY (comment_id)
);

create table if not exists public.contexte_athlete (
  id text not null,
  athlete_id text,
  etat text,
  date_debut date,
  date_fin date,
  source text,
  note text,
  created_at timestamp with time zone default now(),
  constraint contexte_athlete_pkey PRIMARY KEY (id)
);

create table if not exists public.exercices (
  exercice_id text not null,
  exercice text,
  muscle text,
  muscle_secondaire text,
  increment_kg text,
  created_at timestamp with time zone default now(),
  materiel text,
  disciplines text default 'muscu'::text,
  mesure text default 'charge_reps'::text,
  cree_par text,
  statut text default 'valide'::text not null,
  nom_cle text,
  constraint exercices_pkey PRIMARY KEY (exercice_id),
  constraint exercices_statut_chk CHECK ((statut = ANY (ARRAY['valide'::text, 'en_attente'::text])))
);

create table if not exists public.google_health_tokens (
  athlete_id text not null,
  access_token text,
  refresh_token text,
  expires_at timestamp with time zone,
  scope text,
  google_sub text,
  updated_at timestamp with time zone default now(),
  constraint google_health_tokens_pkey PRIMARY KEY (athlete_id)
);

create table if not exists public.indicateurs (
  id bigint generated always as identity not null,
  date date,
  athlete_id text,
  seance_id text,
  cle text,
  valeur text,
  unite text,
  source text,
  created_at timestamp with time zone default now(),
  constraint indicateurs_pkey PRIMARY KEY (id)
);

create table if not exists public.login_echecs (
  id bigint generated always as identity not null,
  cle text not null,
  created_at timestamp with time zone default now() not null,
  constraint login_echecs_pkey PRIMARY KEY (id)
);

create table if not exists public.native_push_tokens (
  token text not null,
  athlete_id text not null,
  platform text,
  created_at timestamp with time zone default now(),
  constraint native_push_tokens_pkey PRIMARY KEY (token, athlete_id)
);

create table if not exists public.notes (
  id bigint generated always as identity not null,
  date date,
  athlete_id text,
  athlete_nom text,
  seance_id text,
  note text,
  created_at timestamp with time zone default now(),
  constraint notes_pkey PRIMARY KEY (id)
);

create table if not exists public.objectif (
  id bigint generated always as identity not null,
  athlete_id text,
  nom text,
  poids_kg numeric,
  date_poids text,
  objectif text,
  seances_semaine integer,
  created_at timestamp with time zone default now(),
  constraint objectif_pkey PRIMARY KEY (id)
);

create table if not exists public.objectifs (
  id text not null,
  athlete_id text,
  categorie text,
  description text,
  statut text,
  date date,
  created_at timestamp with time zone default now(),
  constraint objectifs_pkey PRIMARY KEY (id)
);

create table if not exists public.password_reset_tokens (
  id uuid default gen_random_uuid() not null,
  athlete_id text not null,
  token_hash text not null,
  expires_at timestamp with time zone not null,
  used boolean default false not null,
  created_at timestamp with time zone default now() not null,
  constraint password_reset_tokens_pkey PRIMARY KEY (id)
);

create table if not exists public.pauses (
  id bigint generated always as identity not null,
  athlete_id text,
  debut date,
  fin date,
  created_at timestamp with time zone default now(),
  constraint pauses_athlete_id_key UNIQUE (athlete_id),
  constraint pauses_pkey PRIMARY KEY (id)
);

create table if not exists public.performances (
  id bigint generated always as identity not null,
  date date,
  semaine integer,
  seance_id text,
  nom text,
  athlete_id text,
  exercice text,
  muscle text,
  exercice_id text,
  serie integer,
  charge numeric,
  reps integer,
  rpe numeric,
  repos integer,
  volume numeric,
  created_at timestamp with time zone default now(),
  constraint performances_pkey PRIMARY KEY (id)
);

create table if not exists public.planning (
  id bigint generated always as identity not null,
  athlete_id text not null,
  date date not null,
  seance_id text not null,
  statut text default 'planifie'::text not null,
  source text default 'coach'::text not null,
  note text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint planning_pkey PRIMARY KEY (id)
);

create table if not exists public.poids_historique (
  id bigint generated always as identity not null,
  date date,
  athlete_id text,
  athlete_nom text,
  poids numeric,
  created_at timestamp with time zone default now(),
  constraint poids_historique_pkey PRIMARY KEY (id)
);

create table if not exists public.programme (
  id bigint generated always as identity not null,
  athlete_id text,
  athlete_nom text,
  seance_id text,
  exercice text,
  series_prevues integer,
  reps_mini integer,
  reps_max integer,
  repos_sec integer,
  groupe_id text,
  created_at timestamp with time zone default now(),
  jour smallint,
  charge_pct_1rm numeric,
  rpe_cible numeric,
  type text,
  cardio_cible numeric,
  cardio_unite text,
  schema text,
  backoff_pct smallint,
  series_json jsonb,
  constraint programme_pkey PRIMARY KEY (id)
);

create table if not exists public.push_subscriptions (
  id bigint generated always as identity not null,
  athlete_id text not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamp with time zone default now(),
  constraint push_subscriptions_endpoint_key UNIQUE (endpoint),
  constraint push_subscriptions_pkey PRIMARY KEY (id)
);

create table if not exists public.tests (
  id bigint generated always as identity not null,
  date date,
  athlete_id text,
  cle text,
  valeur text,
  unite text,
  created_at timestamp with time zone default now(),
  constraint tests_pkey PRIMARY KEY (id)
);

create table if not exists public.volume_obti (
  id bigint generated always as identity not null,
  muscle text,
  series_min_semaine numeric,
  series_opt_semaine numeric,
  series_max_semaine numeric,
  constraint volume_obti_pkey PRIMARY KEY (id)
);

-- ── Clés étrangères (ajoutées après les tables ; ignorées si déjà présentes) ──
do $$
declare fk record;
begin
  for fk in select * from (values
    ('performances',       'performances_athlete_id_fkey',       'FOREIGN KEY (athlete_id) REFERENCES public.athletes(id)'),
    ('indicateurs',        'indicateurs_athlete_id_fkey',        'FOREIGN KEY (athlete_id) REFERENCES public.athletes(id)'),
    ('bien_etre',          'bien_etre_athlete_id_fkey',          'FOREIGN KEY (athlete_id) REFERENCES public.athletes(id)'),
    ('tests',              'tests_athlete_id_fkey',              'FOREIGN KEY (athlete_id) REFERENCES public.athletes(id)'),
    ('objectifs',          'objectifs_athlete_id_fkey',          'FOREIGN KEY (athlete_id) REFERENCES public.athletes(id)'),
    ('blessures',          'blessures_athlete_id_fkey',          'FOREIGN KEY (athlete_id) REFERENCES public.athletes(id)'),
    ('programme',          'programme_athlete_id_fkey',          'FOREIGN KEY (athlete_id) REFERENCES public.athletes(id)'),
    ('commentaires',       'commentaires_athlete_id_fkey',       'FOREIGN KEY (athlete_id) REFERENCES public.athletes(id)'),
    ('poids_historique',   'poids_historique_athlete_id_fkey',   'FOREIGN KEY (athlete_id) REFERENCES public.athletes(id)'),
    ('pauses',             'pauses_athlete_id_fkey',             'FOREIGN KEY (athlete_id) REFERENCES public.athletes(id)'),
    ('contexte_athlete',   'contexte_athlete_athlete_id_fkey',   'FOREIGN KEY (athlete_id) REFERENCES public.athletes(id)'),
    ('alertes_historique', 'alertes_historique_athlete_id_fkey', 'FOREIGN KEY (athlete_id) REFERENCES public.athletes(id)'),
    ('notes',              'notes_athlete_id_fkey',              'FOREIGN KEY (athlete_id) REFERENCES public.athletes(id)'),
    ('activite_sources',   'activite_sources_activity_id_fkey',  'FOREIGN KEY (activity_id) REFERENCES public.activites(id) ON DELETE CASCADE')
  ) as v(tbl, nom, def)
  loop
    if not exists (select 1 from pg_constraint where conrelid = ('public.' || fk.tbl)::regclass and contype = 'f'
                   and pg_get_constraintdef(oid) like split_part(fk.def, ' REFERENCES', 1) || '%') then
      execute format('alter table public.%I add constraint %I %s', fk.tbl, fk.nom, fk.def);
    end if;
  end loop;
end $$;

-- ── Index (hors clés primaires / UNIQUE déjà créés ci-dessus) ────────────────
create unique index if not exists exercices_nom_cle_uniq on public.exercices using btree (nom_cle);
create index if not exists idx_activites_athlete on public.activites using btree (athlete_id, debut desc);
create unique index if not exists planning_uq on public.planning using btree (athlete_id, date, seance_id);
create index if not exists planning_ath_date on public.planning using btree (athlete_id, date);
create index if not exists native_push_tokens_athlete_id_idx on public.native_push_tokens using btree (athlete_id);
create unique index if not exists beta_inscriptions_email_uniq on public.beta_inscriptions using btree (lower(email));
create index if not exists prt_athlete_id_idx on public.password_reset_tokens using btree (athlete_id);
create index if not exists prt_expires_at_idx on public.password_reset_tokens using btree (expires_at);
create index if not exists login_echecs_cle_date on public.login_echecs using btree (cle, created_at);

-- ── RLS : activé partout, AUCUNE policy (= aucun accès anon/authenticated) ───
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Inscriptions bêta : en plus du RLS, aucun droit pour anon / authenticated.
revoke all on table public.beta_inscriptions from anon, authenticated;

-- ── Storage : buckets privés (accès uniquement par URL signée côté serveur) ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('coach-media',  'coach-media',  false, 78643200, array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm']),
  ('suivi-photos', 'suivi-photos', false, 26214400, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
