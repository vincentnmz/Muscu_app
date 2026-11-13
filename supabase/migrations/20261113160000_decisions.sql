-- =============================================================================
-- Journal des décisions (P1-1, audit moteur 13/11/2026 — docs/audit-moteur-decision-2026-11-13.md, maquette
-- mockups/journal-decisions.html, validés par le porteur).
-- Le plan de la semaine est CALCULÉ PAR L'APP (js/lecture-v3.js _lv3Plan, moteur unique). Ce journal ne calcule rien :
-- il FIGE ce que le moteur a réellement produit, pour pouvoir comparer plus tard
--   décision → action réalisée → résultat observé après la recommandation → nouvelle décision,
-- sans réécrire le passé quand une règle change.
-- Garde-fous (porteur, 13/11) — appliqués par le serveur (action enregistrerPlan) ET par cette table :
--   1. athlète = celui de la SESSION (jamais l'identifiant envoyé) ; coach : lecture seule, jamais d'écriture ;
--   2. seulement la semaine COURANTE (pas d'historique fabriqué après coup) ;
--   3. une seule version du plan par athlète et par semaine (première version VALIDE enregistrée), une ligne par action
--      (contrainte UNIQUE ci-dessous) : renvoi, rafraîchissement, reconnexion → aucun doublon ;
--   4. l'app n'envoie rien si les données ne sont pas complètes (hors ligne, getAppData incomplet) ;
--   5. le serveur vérifie la FORME (types, tailles, semaine, session, version de règle), il ne refait pas le calcul.
-- Journal en AJOUT SEUL : aucune route de modification ni de suppression (hors suppression du compte de l'athlète).
-- Écriture / lecture : serveur seul (service_role). RLS fermé, aucun droit pour anon / authenticated. Idempotent.
-- =============================================================================
create table if not exists public.decisions (
  id bigint generated always as identity primary key,
  created_at timestamp with time zone not null default now(),
  athlete_id text not null check (char_length(athlete_id) between 1 and 120),
  semaine date not null check (extract(isodow from semaine) = 1),             -- lundi de la semaine du plan
  type_action text not null check (type_action in ('charge', 'series', 'rpe', 'cible', 'reprise')),
  cle text not null check (char_length(cle) between 1 and 160),                -- exercice, ou muscle, ou « reprise » (unicité)
  exercice text check (exercice is null or char_length(exercice) <= 120),
  muscle text check (muscle is null or char_length(muscle) <= 60),
  titre text not null check (char_length(titre) between 1 and 200),            -- texte proposé, tel qu'affiché
  raison text check (raison is null or char_length(raison) <= 600),
  critere jsonb not null default '{}'::jsonb,                                  -- critère de réussite fixé à l'avance
  donnees_entree jsonb not null default '{}'::jsonb,                           -- résumé des données qui ont conduit à la décision
  regle_version text not null check (regle_version ~ '^[a-z0-9._-]{3,40}$'),   -- version de la règle du plan
  constraint decisions_unique_action unique (athlete_id, semaine, type_action, cle)
);
create index if not exists decisions_athlete_semaine_idx on public.decisions (athlete_id, semaine desc);
alter table public.decisions enable row level security;
revoke all on table public.decisions from anon, authenticated;
comment on table public.decisions is 'Journal des décisions : plan de la semaine figé tel que calculé par l''app (1 version par athlète et par semaine). Écriture : serveur seul (enregistrerPlan), ajout seul.';
