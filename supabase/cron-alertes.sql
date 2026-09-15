-- Novalyz — Notifications intelligentes (#29) : cron quotidien qui appelle l'action
-- backend `cronPushAlertes`. À lancer UNE FOIS dans Supabase ▸ SQL Editor.
--
-- Prérequis (à faire d'abord) :
--   1) Déployer index.ts (contient l'action cronPushAlertes).
--   2) Définir le secret Supabase  CRON_SECRET  (Settings ▸ Edge Functions ▸ Secrets)
--      avec une valeur aléatoire, ET remplacer REMPLACE_PAR_TON_CRON_SECRET ci-dessous
--      par la MÊME valeur.
--
-- Fréquence : 1×/jour le matin. L'expression cron est en UTC.
--   Paris = UTC+1 (hiver) / UTC+2 (été). Pour ~9h à Paris : mettre 8 (hiver) ou 7 (été).
--   Ci-dessous : 8h UTC.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- (Ré)installe le job. Si tu relances ce script, dé-commente la ligne unschedule.
-- select cron.unschedule('novalyz-alertes-matin');

select cron.schedule(
  'novalyz-alertes-matin',
  '0 8 * * *',
  $$
  select net.http_post(
    url     := 'https://jhbrvgguybynzeceeceu.supabase.co/functions/v1/smooth-service',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body    := '{"action":"cronPushAlertes","secret":"REMPLACE_PAR_TON_CRON_SECRET"}'::jsonb
  );
  $$
);

-- Vérifier : select * from cron.job;
-- Historique : select * from cron.job_run_details order by start_time desc limit 10;
-- Test manuel immédiat (hors cron), depuis un terminal :
--   curl -s -X POST 'https://jhbrvgguybynzeceeceu.supabase.co/functions/v1/smooth-service' \
--     -H 'Content-Type: application/json' \
--     -d '{"action":"cronPushAlertes","secret":"REMPLACE_PAR_TON_CRON_SECRET"}'
