-- Site vitrine (lot 4, 07/11/2026) : inscriptions « Rejoindre la bêta » (www.novalyz.com/beta).
-- Écrite uniquement par la fonction (clé service) : RLS activé, aucune policy → aucun accès public.
create table if not exists public.beta_inscriptions (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  prenom      text not null check (char_length(prenom) between 1 and 60),
  email       text not null check (char_length(email) between 5 and 200),
  profil      text not null check (profil in ('athlete','coach','structure')),
  appareil    text not null check (appareil in ('android','iphone','ordinateur')),
  message     text check (message is null or char_length(message) <= 1000),
  source      text check (source is null or char_length(source) <= 30),
  statut      text not null default 'nouveau' check (statut in ('nouveau','ajoute','refuse'))
);
create unique index if not exists beta_inscriptions_email_uniq on public.beta_inscriptions (lower(email));
alter table public.beta_inscriptions enable row level security;

-- Lecture (toi, dans l'éditeur SQL) :
--   select created_at, prenom, email, profil, appareil, source, statut from beta_inscriptions order by created_at desc;
-- Marquer ajouté au test Google Play :
--   update beta_inscriptions set statut = 'ajoute', updated_at = now() where lower(email) = lower('...');
revoke all on public.beta_inscriptions from anon, authenticated;
-- Appliqué en prod le 07/11/2026 (migrations beta_inscriptions_site + beta_inscriptions_revoke_public).
