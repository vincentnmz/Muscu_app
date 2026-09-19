-- Novalyz — table des tokens push natifs (FCM / Android) — Étape 3-backend.
-- Stockage SÉPARÉ des abonnements Web Push (table push_subscriptions) : un token
-- FCM est une chaîne opaque, sans endpoint/p256dh/auth. À exécuter une fois dans
-- l'éditeur SQL Supabase (Dashboard → SQL Editor → New query → Run).

create table if not exists native_push_tokens (
  token       text primary key,           -- jeton FCM (unique) → upsert onConflict token
  athlete_id  text not null,               -- même identifiant que partout dans Novalyz
  platform    text,                        -- 'android' | 'ios'
  created_at  timestamptz default now()
);

create index if not exists native_push_tokens_athlete_id_idx
  on native_push_tokens (athlete_id);
