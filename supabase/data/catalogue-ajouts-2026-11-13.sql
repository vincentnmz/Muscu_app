-- =============================================================================
-- Catalogue — 5 exercices demandés (retour client + porteur, 13/11/2026).
-- DONNÉES (pas une migration de schéma) : à lancer dans le SQL Editor, PRÉPROD d'abord, PROD avec accord.
-- Idempotent : n'insère que si ni l'id ni la clé anti-doublon (nom_cle, même calcul que _nomCle d'index.ts) n'existent.
-- « Leg curl unilatéral » était aussi demandé : il existe déjà (id 117), rien à ajouter.
-- « Développé militaire à la barre » : la version barre n'existait plus (l'ancien « Développé militaire » a été
-- renommé « … aux haltères » le 06/11, migration-catalogue-2026-11.sql) ; modèle = version à la Smith (id 23).
-- Modèle : fiches existantes du même type (Rowing machine, Tirage vertical prise large, Leg extension).
-- =============================================================================
insert into public.exercices (exercice_id, exercice, muscle, muscle_secondaire, increment_kg, materiel, disciplines, mesure, cree_par, statut, nom_cle)
select v.exercice_id, v.exercice, v.muscle, v.muscle_secondaire, v.increment_kg, v.materiel, 'muscu', 'charge_reps', 'novalyz', 'valide', v.nom_cle
from (values
  ('132', 'Tirage horizontal machine prise neutre',    'Dos',        'Biceps', '5',   'Machine', 'tirage horizontal machine prise neutre'),
  ('133', 'Tirage horizontal machine prise pronation', 'Dos',        'Epaule', '5',   'Machine', 'tirage horizontal machine prise pronation'),
  ('134', 'Tirage vertical machine',                   'Dos',        'Biceps', '5',   'Machine', 'tirage vertical machine'),
  ('135', 'Leg extension unilatéral',                  'Quadriceps', null,     '2.5', 'Machine', 'leg extension unilateral'),
  ('136', 'Développé militaire à la barre',            'Epaule',     'Triceps', '2.5', 'Barre',   'developpe militaire a la barre')
) as v(exercice_id, exercice, muscle, muscle_secondaire, increment_kg, materiel, nom_cle)
where not exists (select 1 from public.exercices e where e.exercice_id = v.exercice_id or e.nom_cle = v.nom_cle);
