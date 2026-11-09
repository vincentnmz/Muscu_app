-- Empreinte du schéma public (lecture seule) — à lancer sur PROD et sur PRÉPROD :
-- si les 3 empreintes sont identiques, les deux bases ont exactement les mêmes
-- colonnes (types, nullabilité, défauts), contraintes et index.
-- Voir supabase/MIGRATIONS.md §1.
select
  md5(string_agg(table_name || '.' || column_name || ':' || data_type || ':' || is_nullable || ':' || coalesce(column_default, ''), '|' order by table_name, column_name)) as colonnes,
  (select md5(string_agg(conrelid::regclass::text || ':' || pg_get_constraintdef(oid), '|' order by conrelid::regclass::text, pg_get_constraintdef(oid)))
     from pg_constraint where connamespace = 'public'::regnamespace) as contraintes,
  (select md5(string_agg(indexdef, '|' order by indexdef)) from pg_indexes where schemaname = 'public') as index,
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity) as tables_sans_rls
from information_schema.columns where table_schema = 'public';
