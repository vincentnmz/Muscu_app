-- =============================================================================
-- Quotas IA / morpho : compteurs atomiques (audit P1, étape 3, point 1).
-- Avant : une ligne indicateurs par jour (seance_id 'ia_quota' / 'morpho_quota', valeur = compteur),
-- lue AVANT l'appel IA puis réécrite APRÈS (plusieurs secondes plus tard) → deux questions envoyées
-- en même temps passaient toutes les deux et ne comptaient que pour une : quota dépassé = appels
-- payants en trop. Crédits achetés ('ia_bonus', 1 ligne par question) : même problème.
-- Maintenant : le serveur RÉSERVE une unité (quota_reserver) AVANT l'appel, en une seule requête :
-- impossible de dépasser le plafond, même en simultané. Si l'appel IA échoue, l'unité est rendue
-- (quota_rendre).
--   sujet  = id athlète, ou 'coach:<id>' (quota du coach qui interroge l'IA sur un athlète)
--   type   = 'ia' (questions du jour) | 'morpho' (analyses du jour) | 'ia_bonus' (crédits achetés
--            consommés, cumul : jour = 1970-01-01)
-- Reprise des anciennes lignes indicateurs SANS les supprimer. Idempotent.
-- =============================================================================
create table if not exists public.quotas_jour (
  sujet text not null check (char_length(sujet) between 1 and 120),
  type text not null check (type in ('ia', 'morpho', 'ia_bonus')),
  jour date not null,
  n integer not null default 0 check (n >= 0),
  updated_at timestamp with time zone not null default now(),
  primary key (sujet, type, jour)
);
alter table public.quotas_jour enable row level security;
revoke all on table public.quotas_jour from anon, authenticated;
comment on table public.quotas_jour is 'Compteurs de quotas (IA, morpho, crédits IA). Écriture : quota_reserver / quota_rendre (serveur seul).';

-- Réserve une unité si le compteur est sous p_max. Renvoie le nouveau compteur, ou NULL si le plafond
-- est atteint (rien n'est modifié). Une seule requête : sûr en simultané.
create or replace function public.quota_reserver(p_sujet text, p_type text, p_jour date, p_max integer)
returns integer
language sql
security invoker
set search_path = public
as $$
  insert into public.quotas_jour as q (sujet, type, jour, n, updated_at)
  select p_sujet, p_type, p_jour, 1, now() where coalesce(p_max, 0) >= 1
  on conflict (sujet, type, jour) do update
     set n = q.n + 1, updated_at = now()
   where q.n < p_max
  returning n;
$$;
-- Rend une unité (appel IA échoué). Jamais sous 0.
create or replace function public.quota_rendre(p_sujet text, p_type text, p_jour date)
returns integer
language sql
security invoker
set search_path = public
as $$
  update public.quotas_jour set n = greatest(n - 1, 0), updated_at = now()
   where sujet = p_sujet and type = p_type and jour = p_jour
  returning n;
$$;
revoke all on function public.quota_reserver(text, text, date, integer) from public, anon, authenticated;
revoke all on function public.quota_rendre(text, text, date) from public, anon, authenticated;
grant execute on function public.quota_reserver(text, text, date, integer) to service_role;
grant execute on function public.quota_rendre(text, text, date) to service_role;

-- Reprise (lignes existantes conservées). Valeur illisible → ignorée.
insert into public.quotas_jour (sujet, type, jour, n)
select i.athlete_id, case i.seance_id when 'ia_quota' then 'ia' else 'morpho' end, i.cle::date, max(i.valeur::integer)
from public.indicateurs i
where i.seance_id in ('ia_quota', 'morpho_quota') and i.cle ~ '^\d{4}-\d{2}-\d{2}$' and i.valeur ~ '^\d{1,6}$'
group by 1, 2, 3
on conflict (sujet, type, jour) do nothing;
insert into public.quotas_jour (sujet, type, jour, n)
select i.athlete_id, 'ia_bonus', date '1970-01-01', count(*)
from public.indicateurs i
where i.seance_id = 'ia_bonus'
group by 1
on conflict (sujet, type, jour) do nothing;
