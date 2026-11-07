-- 07/11/2026 — Exercices créés par un coach : privés + en attente de validation + unicité.
-- APPLIQUÉE en prod le 07/11 (accord du porteur). Conservée comme référence.
alter table exercices add column if not exists statut text not null default 'valide';
alter table exercices add column if not exists nom_cle text;
update exercices set nom_cle = lower(translate(regexp_replace(trim(coalesce(exercice,'')), '\s+', ' ', 'g'),
  'àâäáãåçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝ',
  'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY'));
create unique index if not exists exercices_nom_cle_uniq on exercices (nom_cle);
alter table exercices add constraint exercices_statut_chk check (statut in ('valide','en_attente'));
-- (exercice_id était déjà la clé primaire : pas de collision d'identifiant possible.)

-- ── Validation par le porteur ──
-- Voir les exercices en attente :
--   select exercice_id, exercice, muscle, materiel, cree_par, created_at from exercices where statut = 'en_attente' order by created_at;
-- Valider (devient visible de tous) :
--   update exercices set statut = 'valide' where exercice_id = '<id>';
