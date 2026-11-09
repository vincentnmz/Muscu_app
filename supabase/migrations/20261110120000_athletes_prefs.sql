-- =============================================================================
-- Préférences ATHLÈTE : colonne athletes.prefs (jsonb), comme coachs.prefs
-- (audit P1, étape 2). Avant : une ligne indicateurs par préférence
-- (seance_id = 'pref', valeur texte).
--
-- 6 préférences migrées, stockées TYPÉES (comme coachs.prefs) :
--   semaine_type     'calendaire' | 'glissant'      (texte)
--   onboarding_vu    booléen                         (ancien '1' / '0')
--   prog_auto_off    booléen                         (ancien '1' / '0')
--   novalyz_athlete  booléen (réglé par le coach)    (ancien '1' / '0')
--   zones_prio       tableau de textes (2 max)       (ancien JSON texte)
--   exo_categories   objet { exercice: 'gros'|'moyen'|'petit' } (ancien JSON texte)
-- NON migrées (ce ne sont pas des préférences, elles restent dans indicateurs) :
--   prog_maj (trace de la dernière modification du programme) ;
--   coach_demande (demande de suivi en attente).
--
-- Écriture : fonction athlete_prefs_merge = fusion ATOMIQUE (prefs || patch) en une
-- seule requête → deux préférences écrites en même temps ne s'écrasent pas.
-- Réservée au serveur (clé service_role) : aucun droit pour anon / authenticated.
--
-- Reprise : les anciennes lignes indicateurs sont recopiées SANS être supprimées.
-- Une valeur déjà présente dans athletes.prefs n'est jamais écrasée (rejouable).
-- =============================================================================
alter table public.athletes add column if not exists prefs jsonb not null default '{}'::jsonb;
comment on column public.athletes.prefs is 'Préférences de l''athlète (semaine_type, onboarding_vu, prog_auto_off, novalyz_athlete, zones_prio, exo_categories). Écriture : athlete_prefs_merge.';

create or replace function public.athlete_prefs_merge(p_athlete_id text, p_patch jsonb)
returns jsonb
language sql
security invoker
set search_path = public
as $$
  update public.athletes
     set prefs = coalesce(prefs, '{}'::jsonb) || coalesce(p_patch, '{}'::jsonb)
   where id = p_athlete_id
  returning prefs;
$$;
revoke all on function public.athlete_prefs_merge(text, jsonb) from public, anon, authenticated;
grant execute on function public.athlete_prefs_merge(text, jsonb) to service_role;

-- Reprise des préférences existantes (la plus récente par clé si jamais doublon).
do $reprise$
declare r record; v jsonb; n_ok int := 0; n_ignore int := 0;
begin
  for r in
    select distinct on (i.athlete_id, i.cle) i.athlete_id, i.cle, i.valeur
      from public.indicateurs i
      join public.athletes a on a.id = i.athlete_id
     where i.seance_id = 'pref'
       and i.cle in ('semaine_type', 'onboarding_vu', 'prog_auto_off', 'novalyz_athlete', 'zones_prio', 'exo_categories')
     order by i.athlete_id, i.cle, i.date desc nulls last, i.id desc
  loop
    begin
      v := case r.cle
        when 'semaine_type' then to_jsonb(case when r.valeur = 'glissant' then 'glissant' else 'calendaire' end)
        when 'onboarding_vu' then to_jsonb(r.valeur = '1')
        when 'prog_auto_off' then to_jsonb(r.valeur = '1')
        when 'novalyz_athlete' then to_jsonb(r.valeur = '1')
        when 'zones_prio' then case when jsonb_typeof(r.valeur::jsonb) = 'array' then r.valeur::jsonb else null end
        when 'exo_categories' then case when jsonb_typeof(r.valeur::jsonb) = 'object' then r.valeur::jsonb else null end
      end;
    exception when others then v := null;
    end;
    if v is null then
      n_ignore := n_ignore + 1;
      raise notice 'reprise prefs : valeur illisible ignorée (athlète %, clé %)', r.athlete_id, r.cle;
    else
      if exists (select 1 from public.athletes where id = r.athlete_id and prefs ? r.cle and prefs -> r.cle <> v) then
        raise notice 'reprise prefs : DIVERGENCE (athlète %, clé %) — valeur déjà présente dans prefs conservée', r.athlete_id, r.cle;
      end if;
      -- jsonb_build_object(clé, valeur) || prefs : la valeur DÉJÀ présente dans prefs gagne.
      update public.athletes set prefs = jsonb_build_object(r.cle, v) || prefs where id = r.athlete_id;
      n_ok := n_ok + 1;
    end if;
  end loop;
  raise notice 'reprise prefs : % valeur(s) reprise(s), % ignorée(s)', n_ok, n_ignore;
end $reprise$;
