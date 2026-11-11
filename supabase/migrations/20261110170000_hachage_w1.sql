-- =============================================================================
-- Hachage lent des mots de passe « w1 » (audit P1, dernier point — docs/note-hachage-mdp-2026-11-10.md,
-- option C validée par le porteur le 10/11 : « ok si ça ne casse rien »).
-- w1 = PBKDF2-SHA256(clé = hash s2 existant, sel aléatoire, 600 000 tours) — calculé par le SERVEUR
-- (index.ts), jamais en SQL ni dans l'app. Cette migration ne touche à AUCUN mot de passe : elle ajoute
--   1) password_hash_s2 (athletes, coachs) : copie de secours du hash s2 pour le RETOUR ARRIÈRE
--      (l'ancien serveur ne lit pas w1). Remplie par le serveur à chaque passage en w1. À supprimer
--      après l'observation (sinon la protection reste partielle tant que le s2 est conservé).
--   2) jetons_admin : jetons à durée limitée qui autorisent la tâche serveur de conversion des comptes
--      existants (action envelopperHachages). Créés en SQL (service_role), jamais affichés.
-- Sans cette migration, le serveur garde exactement le comportement d'avant (s2). Idempotent.
-- =============================================================================
alter table public.athletes add column if not exists password_hash_s2 text;
alter table public.coachs add column if not exists password_hash_s2 text;
comment on column public.athletes.password_hash_s2 is 'Copie de secours du hash s2 (retour arrière w1 → s2). Temporaire : à supprimer après observation.';
comment on column public.coachs.password_hash_s2 is 'Copie de secours du hash s2 (retour arrière w1 → s2). Temporaire : à supprimer après observation.';

create table if not exists public.jetons_admin (
  jeton uuid primary key default gen_random_uuid(),
  action text not null check (action in ('envelopperHachages')),
  expire timestamp with time zone not null default now() + interval '15 minutes',
  created_at timestamp with time zone not null default now()
);
alter table public.jetons_admin enable row level security;
revoke all on table public.jetons_admin from anon, authenticated;
comment on table public.jetons_admin is 'Jetons à durée limitée pour tâches serveur ponctuelles (ex. conversion des hachages). Serveur seul.';
