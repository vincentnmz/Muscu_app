-- Novalyz — native_push_tokens v2 (audit Notifications N1, 01/11/2026).
-- Un même téléphone peut recevoir les notifications ATHLÈTE et COACH : la clé
-- devient (token, athlete_id) au lieu de token seul. À appliquer APRÈS le
-- redéploiement d'index.ts (qui gère les deux clés).
alter table native_push_tokens drop constraint if exists native_push_tokens_pkey;
alter table native_push_tokens add primary key (token, athlete_id);
