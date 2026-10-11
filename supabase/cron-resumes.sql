-- Novalyz — Résumés e-mail automatiques : crons qui appellent l'action backend
-- `cronResumes`. À lancer UNE FOIS dans Supabase ▸ SQL Editor.
--
-- Ce que ça envoie (e-mail HTML riche, pas de PDF joint) :
--   • à chaque COACH ayant un e-mail → résumé de son équipe (effectif, statuts,
--     athlètes à surveiller, infirmerie) ;
--   • à chaque ATHLÈTE ayant un e-mail → bilan perso (séances, tonnage, RPE,
--     records, forme).
--
-- Prérequis (à faire d'abord) :
--   1) Déployer index.ts (contient l'action cronResumes).
--   2) Définir le secret Supabase  CRON_SECRET  (Settings ▸ Edge Functions ▸ Secrets)
--      — la MÊME valeur que pour cron-alertes.sql — ET remplacer
--      REMPLACE_PAR_TON_CRON_SECRET ci-dessous par cette valeur.
--   3) (Délivrabilité) Tant qu'aucun domaine n'est vérifié dans Resend
--      (from = onboarding@resend.dev), Resend ne délivre QU'À l'adresse du compte
--      propriétaire. Les autres destinataires ne reçoivent rien → cf. roadmap P0-1.
--      Option : définir le secret  RESEND_FROM = "Novalyz <noreply@ton-domaine>"
--      une fois le domaine vérifié.
--
-- Fréquence (UTC) : hebdo = lundi 7h UTC · mensuel = le 1er du mois 7h UTC.
--   Paris = UTC+1 (hiver) / UTC+2 (été) → ~8-9h à Paris.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- (Ré)installe les jobs. Si tu relances ce script, dé-commente les 2 unschedule.
-- select cron.unschedule('novalyz-resume-hebdo');
-- select cron.unschedule('novalyz-resume-mensuel');

-- Résumé HEBDOMADAIRE — tous les lundis à 7h UTC.
select cron.schedule(
  'novalyz-resume-hebdo',
  '0 7 * * 1',
  $$
  select net.http_post(
    url     := 'https://jhbrvgguybynzeceeceu.supabase.co/functions/v1/smooth-service',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body    := '{"action":"cronResumes","periode":"semaine","secret":"REMPLACE_PAR_TON_CRON_SECRET"}'::jsonb
  );
  $$
);

-- Résumé MENSUEL — le 1er de chaque mois à 7h UTC.
select cron.schedule(
  'novalyz-resume-mensuel',
  '0 7 1 * *',
  $$
  select net.http_post(
    url     := 'https://jhbrvgguybynzeceeceu.supabase.co/functions/v1/smooth-service',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body    := '{"action":"cronResumes","periode":"mois","secret":"REMPLACE_PAR_TON_CRON_SECRET"}'::jsonb
  );
  $$
);

-- Vérifier : select * from cron.job;
-- Historique : select * from cron.job_run_details order by start_time desc limit 10;
-- Test manuel immédiat (hors cron), depuis un terminal :
--   curl -s -X POST 'https://jhbrvgguybynzeceeceu.supabase.co/functions/v1/smooth-service' \
--     -H 'Content-Type: application/json' \
--     -d '{"action":"cronResumes","periode":"semaine","secret":"REMPLACE_PAR_TON_CRON_SECRET"}'
