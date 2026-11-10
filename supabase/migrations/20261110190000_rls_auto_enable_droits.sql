-- =============================================================================
-- P0-3 de l'audit d'architecture (docs/audit-architecture-2026-11-09.md, S7) :
-- rls_auto_enable() est SECURITY DEFINER et était exécutable par PUBLIC, anon, authenticated
-- (et service_role). Elle n'a qu'un usage légitime : être la fonction du déclencheur d'événement
-- ensure_rls (CREATE TABLE → active RLS). Aucun rôle applicatif n'a besoin de l'appeler.
-- On retire EXECUTE à PUBLIC, anon, authenticated et service_role ; postgres (propriétaire) le garde.
-- Le déclencheur continue de fonctionner : PostgreSQL ne vérifie pas EXECUTE quand un déclencheur
-- d'événement se déclenche (vérifié sur Postgres 16 avec un rôle sans EXECUTE, cf. MIGRATIONS.md).
-- Une fonction « RETURNS event_trigger » ne peut de toute façon pas être appelée directement.
-- Idempotent. Ne modifie ni la fonction, ni le déclencheur, ni aucune donnée.
-- =============================================================================
revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon, authenticated, service_role;
