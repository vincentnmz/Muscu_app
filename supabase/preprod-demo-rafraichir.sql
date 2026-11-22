-- =============================================================================
-- PRÉPROD UNIQUEMENT (vqxkeqjaqkkmtzxvqvhi) — NE JAMAIS LANCER SUR LA PROD.
-- Rafraîchissement automatique des comptes DÉMO (John « 3 », Lucas « demo_4_lucas », coach jim 0202) :
-- chaque nuit, si la dernière séance démo date de plus d'une semaine, toutes leurs dates sont avancées d'un
-- nombre entier de SEMAINES (mêmes jours de la semaine), pour que la démo ait toujours l'air active
-- (sinon l'app affiche « absence », puis le mode « reprise » après 21 jours).
-- Même principe que le décalage au chargement de supabase/seed-preprod.sql. Appliqué le 22/11/2026.
-- =============================================================================
create extension if not exists pg_cron;

create or replace function public.demo_rafraichir_dates() returns int
language plpgsql security definer set search_path = public as $$
declare j int;
begin
  -- garde-fou : refus sur toute base qui ressemble à la prod
  if exists (select 1 from public.athletes where id = '1' or login = '1234') then raise exception 'Refus : base qui ressemble à la PROD'; end if;
  select (7 * floor(((current_date - 1) - max(date)) / 7.0))::int into j from public.performances where athlete_id in ('3','demo_4_lucas');
  if j is null or j <= 0 then return 0; end if;
  update public.performances set date = date + j where athlete_id in ('3','demo_4_lucas');
  update public.bien_etre set date = date + j where athlete_id in ('3','demo_4_lucas');
  update public.indicateurs set date = date + j where athlete_id in ('3','demo_4_lucas');
  update public.poids_historique set date = date + j where athlete_id in ('3','demo_4_lucas');
  update public.planning set date = date + j where athlete_id in ('3','demo_4_lucas');
  update public.contexte_athlete set date_debut = date_debut + j, date_fin = case when date_fin is null then null else date_fin + j end where athlete_id in ('3','demo_4_lucas');
  update public.activites set debut = debut + make_interval(days => j), fin = case when fin is null then null else fin + make_interval(days => j) end where athlete_id in ('3','demo_4_lucas');
  return j;
end $$;
revoke all on function public.demo_rafraichir_dates() from public, anon, authenticated;

-- chaque nuit à 03:17 UTC
select cron.schedule('demo-rafraichir-dates', '17 3 * * *', $$select public.demo_rafraichir_dates()$$);
