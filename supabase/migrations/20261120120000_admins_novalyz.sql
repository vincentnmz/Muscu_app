-- =============================================================================
-- Écran admin « Écrire aux athlètes » (20/11/2026, demande du porteur : réservé à lui seul).
-- Une ligne = un compte autorisé (role 'c' = coach, compte_id = coachs.coach_id).
-- Lecture / écriture : serveur seul (service_role). RLS fermé, aucun droit pour anon / authenticated :
-- ni l'app ni un coach ne peut s'ajouter. Le serveur vérifie la ligne à CHAQUE appel adminNovalyz.
-- Le compte du porteur est ajouté à part (insert manuel, pas dans la migration : ids différents prod / préprod).
-- Idempotent. Aucun secret.
-- =============================================================================
create table if not exists public.admins_novalyz (
  role text not null check (role in ('c')),
  compte_id text not null check (char_length(compte_id) between 1 and 60),
  created_at timestamp with time zone not null default now(),
  primary key (role, compte_id)
);
alter table public.admins_novalyz enable row level security;
revoke all on table public.admins_novalyz from anon, authenticated;
comment on table public.admins_novalyz is 'Comptes autorisés à l''écran admin Novalyz (écrire aux athlètes). Écriture : service_role seul.';
