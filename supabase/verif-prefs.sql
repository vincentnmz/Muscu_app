-- Contrôle (lecture seule) : préférences ATHLÈTE, ancien stockage (indicateurs, seance_id='pref')
-- comparé au nouveau (athletes.prefs). Nécessite Postgres ≥ 16 (pg_input_is_valid). Voir supabase/migrations/20261110120000_athletes_prefs.sql.
-- Une ligne par écart. Juste après la reprise : AUCUNE ligne attendue.
-- Ensuite, les nouvelles écritures ne vont plus que dans athletes.prefs : un écart
-- « valeurs différentes » peut alors simplement signifier « modifié depuis la reprise ».
with ancien as (
  select distinct on (i.athlete_id, i.cle) i.athlete_id, i.cle, i.valeur,
    case i.cle
      when 'semaine_type' then to_jsonb(case when i.valeur = 'glissant' then 'glissant' else 'calendaire' end)
      when 'onboarding_vu' then to_jsonb(i.valeur = '1')
      when 'prog_auto_off' then to_jsonb(i.valeur = '1')
      when 'novalyz_athlete' then to_jsonb(i.valeur = '1')
      when 'zones_prio' then case when pg_input_is_valid(i.valeur, 'jsonb') and jsonb_typeof(i.valeur::jsonb) = 'array' then i.valeur::jsonb end
      when 'exo_categories' then case when pg_input_is_valid(i.valeur, 'jsonb') and jsonb_typeof(i.valeur::jsonb) = 'object' then i.valeur::jsonb end
    end as v
  from public.indicateurs i
  where i.seance_id = 'pref'
    and i.cle in ('semaine_type', 'onboarding_vu', 'prog_auto_off', 'novalyz_athlete', 'zones_prio', 'exo_categories')
  order by i.athlete_id, i.cle, i.date desc nulls last, i.id desc
)
select o.athlete_id, o.cle, o.valeur as ancienne_valeur, a.prefs -> o.cle as nouvelle_valeur,
  case when a.id is null then 'athlète inexistant'
       when not (a.prefs ? o.cle) then 'absente du nouveau stockage'
       when o.v is null then 'ancienne valeur illisible'
       else 'valeurs différentes' end as ecart
from ancien o left join public.athletes a on a.id = o.athlete_id
where a.id is null or not (a.prefs ? o.cle) or o.v is null or a.prefs -> o.cle <> o.v
order by o.athlete_id, o.cle;
