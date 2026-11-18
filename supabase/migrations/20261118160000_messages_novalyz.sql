-- =============================================================================
-- Canal « Message de Novalyz » (18/11/2026, demande du porteur).
-- L'équipe Novalyz écrit à un athlète (ex. explication du RPE) : le message apparaît dans l'app
-- (fil « Novalyz · l'équipe » de l'onglet Coach + carte sur Aujourd'hui) avec une notification.
-- L'athlète peut répondre : sa réponse est rangée ici (auteur = 'athlete') et envoyée par e-mail à l'équipe.
-- Envoi : fonction novalyz_message(login, texte) (SQL Editor), puis la notification part via l'action
-- serveur pushMessagesNovalyz (idempotente : push_at posé avant l'envoi, 1 notification par message).
-- Écriture : serveur seul (service_role). RLS fermé, aucun droit pour anon / authenticated. Idempotent. Aucun secret.
-- =============================================================================
create table if not exists public.messages_novalyz (
  id bigint generated always as identity primary key,
  created_at timestamp with time zone not null default now(),
  athlete_id text not null check (char_length(athlete_id) between 1 and 60),
  auteur text not null default 'novalyz' check (auteur in ('novalyz', 'athlete')),
  message text not null check (char_length(message) between 3 and 3000),
  lu_at timestamp with time zone,
  push_at timestamp with time zone
);
create index if not exists messages_novalyz_athlete_idx on public.messages_novalyz (athlete_id, created_at desc);
create index if not exists messages_novalyz_push_idx on public.messages_novalyz (created_at) where push_at is null and auteur = 'novalyz';
alter table public.messages_novalyz enable row level security;
revoke all on table public.messages_novalyz from anon, authenticated;
comment on table public.messages_novalyz is 'Messages de l''équipe Novalyz à un athlète (et ses réponses). Écriture : serveur seul.';

-- Envoi depuis le SQL Editor : select novalyz_message('2814', 'Salut Célia ! …');  → id du message.
-- Refuse un login inconnu ou un compte démo. N'envoie PAS la notification (voir pushMessagesNovalyz).
create or replace function public.novalyz_message(p_login text, p_message text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare v_id text; v_msg bigint;
begin
  select id::text into v_id from public.athletes where login::text = trim(p_login) and coalesce(is_demo, false) = false limit 1;
  if v_id is null then raise exception 'Athlète introuvable (login %)', p_login; end if;
  insert into public.messages_novalyz (athlete_id, auteur, message) values (v_id, 'novalyz', trim(p_message)) returning id into v_msg;
  return v_msg;
end $$;
revoke all on function public.novalyz_message(text, text) from public, anon, authenticated;
