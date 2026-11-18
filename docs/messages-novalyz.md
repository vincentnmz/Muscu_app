# Canal « Message de Novalyz » (18/11/2026)

L'équipe Novalyz peut écrire à un athlète, par exemple pour lui expliquer le RPE.

## Ce que voit l'athlète
- **Une notification** « 💬 Message de Novalyz » avec le début du texte. Un appui ouvre le fil.
- **Sur Aujourd'hui**, la carte « Nouveau message de Novalyz · Lire › » reste affichée tant que le message n'est pas lu.
- **Dans l'onglet Coach**, le fil « Novalyz · l'équipe » apparaît en tête de liste, avec une pastille de messages non lus.
- **Il peut répondre** dans le fil. La réponse est enregistrée et t'arrive par e-mail (hello@novalyz.fr) avec son login. Il peut envoyer au plus 10 réponses par 24 h.
- Un coach ne voit jamais ces messages, même pour son propre athlète.

## Envoyer un message (Supabase ▸ projet PROD ▸ SQL Editor)
```sql
-- 1) Écrire le message (login de l'athlète, texte jusqu'à 3 000 caractères ; doubler les apostrophes : l''équipe)
select novalyz_message('2814', 'Salut Célia ! Petit point sur le RPE…');

-- 2) Envoyer la notification (aucun secret ; ne notifie qu'une fois chaque message pas encore notifié)
select net.http_post(
  url     := 'https://jhbrvgguybynzeceeceu.supabase.co/functions/v1/smooth-service',
  headers := '{"Content-Type":"application/json"}'::jsonb,
  body    := '{"action":"pushMessagesNovalyz"}'::jsonb
);
```
Si tu oublies l'étape 2, le cron de 7 h envoie quand même la notification le lendemain matin. Au-delà de 7 jours, un message n'est plus notifié, mais il reste visible dans l'app.

Tu peux aussi me demander d'envoyer un message : je le fais seulement avec ton accord explicite, message par message.

## Voir les réponses
Table Editor ▸ `messages_novalyz` : les réponses ont `auteur = athlete`. La colonne `lu_at` indique quand l'athlète a lu ton message, et `push_at` quand la notification est partie.

## À savoir
- **Android :** l'app installée embarque l'ancienne interface. La notification arrive tout de suite, mais le fil et la carte n'apparaîtront qu'avec le prochain build (AAB/APK). Sur le web (PWA), tout est visible dès la mise en prod.
- Les comptes démo sont refusés par `novalyz_message`.
- Côté technique, il y a une migration `20261118160000_messages_novalyz.sql`, trois routes (`lireMessagesNovalyz` et `repondreMessageNovalyz`, réservées à l'athlète, et `pushMessagesNovalyz`, publique et sans donnée renvoyée) et le module front `js/messages-novalyz.js`. Le test associé est `tests/messages-novalyz.test.js`.
