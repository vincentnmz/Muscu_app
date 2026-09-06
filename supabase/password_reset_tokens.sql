-- Novalyz — table des jetons de réinitialisation de mot de passe (P2).
-- On ne stocke JAMAIS le token en clair : seulement son hash (SHA-256).
-- Le token brut n'existe que dans le lien envoyé par email.
-- À exécuter une fois dans l'éditeur SQL Supabase.

create table if not exists password_reset_tokens (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  text not null,               -- = athletes.id
  token_hash  text not null,               -- SHA-256 du token brut (jamais le token en clair)
  expires_at  timestamptz not null,        -- création + 1 heure
  used        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists prt_athlete_id_idx on password_reset_tokens (athlete_id);
create index if not exists prt_expires_at_idx on password_reset_tokens (expires_at);

-- (Optionnel) Clé étrangère vers les athlètes — à activer seulement si le type
-- de athletes.id le permet, sinon laisser l'index ci-dessus suffire :
-- alter table password_reset_tokens
--   add constraint prt_athlete_fk foreign key (athlete_id) references athletes(id) on delete cascade;
