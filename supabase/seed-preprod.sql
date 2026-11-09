-- =============================================================================
-- Novalyz — DONNÉES DE DÉMO pour la base de PRÉPROD (vqxkeqjaqkkmtzxvqvhi)
-- Généré par scripts/gen-seed-preprod.py — NE PAS lancer sur la PROD.
-- Contenu : catalogue d'exercices + volumes de référence, coach démo « jim »
-- (login 0202), athlètes fictifs John (0101) et Lucas Moreau (9035), avec un an
-- de séances, bien-être, cardio/Hyrox, programme, poids. AUCUNE donnée réelle.
-- Mot de passe de TEST des 3 comptes : voir MDP_TEST dans le script (stocké en
-- ancien format SHA-256 → converti au format salé à la 1re connexion).
-- Rejouable : efface puis recrée ces comptes démo.
-- =============================================================================
do $seed$
begin
  if exists (select 1 from public.athletes where id = '1' or login = '1234') then
    raise exception 'Refus : cette base ressemble à la PROD (compte réel présent).';
  end if;
end $seed$;

create temp table _seed_off on commit drop as select (7 * floor(((current_date - 1) - date '2026-11-07') / 7.0))::int as j;
-- Nettoyage des comptes démo (rejouable)
delete from public.activite_sources where activity_id in (select id from public.activites where athlete_id in ('3','demo_4_lucas'));
delete from public.activites where athlete_id in ('3','demo_4_lucas');
delete from public.performances where athlete_id in ('3','demo_4_lucas');
delete from public.indicateurs where athlete_id in ('3','demo_4_lucas');
delete from public.bien_etre where athlete_id in ('3','demo_4_lucas');
delete from public.programme where athlete_id in ('3','demo_4_lucas');
delete from public.poids_historique where athlete_id in ('3','demo_4_lucas');
delete from public.objectif where athlete_id in ('3','demo_4_lucas');
delete from public.contexte_athlete where athlete_id in ('3','demo_4_lucas');
delete from public.planning where athlete_id in ('3','demo_4_lucas');
delete from public.commentaires where athlete_id in ('3','demo_4_lucas');
delete from public.blessures where athlete_id in ('3','demo_4_lucas');
delete from public.objectifs where athlete_id in ('3','demo_4_lucas');
delete from public.tests where athlete_id in ('3','demo_4_lucas');
delete from public.pauses where athlete_id in ('3','demo_4_lucas');
delete from public.notes where athlete_id in ('3','demo_4_lucas');
delete from public.alertes_historique where athlete_id in ('3','demo_4_lucas');
delete from public.athletes where id in ('3','demo_4_lucas');
delete from public.coachs where coach_id = '4';

-- Catalogue d'exercices (identique à la prod au 09/11/2026)
insert into public.exercices (exercice_id,exercice,muscle,muscle_secondaire,increment_kg,materiel,disciplines,mesure,cree_par,statut,nom_cle) values
('1','Écarté machine','Pectoraux',null,'1.25','Machine','muscu','charge_reps',null,'valide','ecarte machine'),
('10','Tirage vertical prise large','Dos','Biceps','2.5','Poulie','muscu','charge_reps',null,'valide','tirage vertical prise large'),
('100','Crunch au sol','Abdominaux',null,'2.5','Poids du corps','muscu','charge_reps','novalyz','valide','crunch au sol'),
('101','Pallof press','Abdominaux',null,'1.25','Poulie','muscu','charge_reps','novalyz','valide','pallof press'),
('102','Adducteur à la poulie','Adducteur',null,'1.25','Poulie','muscu','charge_reps','novalyz','valide','adducteur a la poulie'),
('103','Squat sumo haltère','Adducteur','Fessier','2','Haltères','muscu','charge_reps','novalyz','valide','squat sumo haltere'),
('104','Mollets à la Smith','Mollets',null,'2.5','Smith','muscu','charge_reps','novalyz','valide','mollets a la smith'),
('105','Mollets unilatéral haltère','Mollets',null,'2','Haltères','muscu','charge_reps','novalyz','valide','mollets unilateral haltere'),
('106','Développé épaules machine','Epaule','Triceps','2.5','Machine','muscu','charge_reps','novalyz','valide','developpe epaules machine'),
('107','Oiseau machine','Epaule',null,'2.5','Machine','muscu','charge_reps','novalyz','valide','oiseau machine'),
('108','Face pull','Epaule','Trapèze','1.25','Poulie','muscu','charge_reps','novalyz','valide','face pull'),
('109','Développé Arnold','Epaule','Triceps','2','Haltères','muscu','charge_reps','novalyz','valide','developpe arnold'),
('11','Tirage vertical prise serrée','Dos','Biceps','2.5','Poulie','muscu','charge_reps',null,'valide','tirage vertical prise serree'),
('110','Barre au front','Triceps',null,'1.25','Barre','muscu','charge_reps','novalyz','valide','barre au front'),
('111','Kickback haltère','Triceps',null,'1','Haltères','muscu','charge_reps','novalyz','valide','kickback haltere'),
('112','Extension nuque haltère','Triceps',null,'2','Haltères','muscu','charge_reps','novalyz','valide','extension nuque haltere'),
('113','Dips machine','Triceps','Pectoraux','2.5','Machine','muscu','charge_reps','novalyz','valide','dips machine'),
('114','Curl pupitre','Biceps',null,'1.25','Barre','muscu','charge_reps','novalyz','valide','curl pupitre'),
('115','Curl machine','Biceps',null,'2.5','Machine','muscu','charge_reps','novalyz','valide','curl machine'),
('116','Nordic curl','Ischio',null,'2.5','Poids du corps','muscu','charge_reps','novalyz','valide','nordic curl'),
('117','Leg curl unilatéral','Ischio',null,'2.5','Machine','muscu','charge_reps','novalyz','valide','leg curl unilateral'),
('118','Pull-through à la poulie','Fessier','Ischio','2.5','Poulie','muscu','charge_reps','novalyz','valide','pull-through a la poulie'),
('119','Abduction à la poulie','Fessier',null,'1.25','Poulie','muscu','charge_reps','novalyz','valide','abduction a la poulie'),
('12','Tirage vertical uni à la poignée','Dos','Biceps','2.5','Poulie','muscu','charge_reps',null,'valide','tirage vertical uni a la poignee'),
('120','Front squat','Quadriceps','Fessier','2.5','Barre','muscu','charge_reps','novalyz','valide','front squat'),
('121','Sissy squat','Quadriceps',null,'2.5','Poids du corps','muscu','charge_reps','novalyz','valide','sissy squat'),
('122','Fentes marchées sac lesté','Quadriceps','Fessier','5','Sac lesté','muscu,fonctionnel','charge_reps','novalyz','valide','fentes marchees sac leste'),
('123','Squat sac lesté','Quadriceps','Fessier','5','Sac lesté','muscu,fonctionnel','charge_reps','novalyz','valide','squat sac leste'),
('124','Kettlebell swing','Fessier','Ischio','4','Kettlebell','muscu,fonctionnel','charge_reps','novalyz','valide','kettlebell swing'),
('125','Squat gobelet kettlebell','Quadriceps','Fessier','4','Kettlebell','muscu,fonctionnel','charge_reps','novalyz','valide','squat gobelet kettlebell'),
('126','Wall ball','Quadriceps','Epaule','2','Médecine-ball','muscu,fonctionnel','charge_reps','novalyz','valide','wall ball'),
('127','Slam ball','Corps entier',null,'2','Médecine-ball','muscu,fonctionnel','charge_reps','novalyz','valide','slam ball'),
('128','Burpees','Corps entier',null,'0','Poids du corps','muscu,fonctionnel','reps','novalyz','valide','burpees'),
('129','Box jump','Quadriceps',null,'0','Poids du corps','muscu,fonctionnel','reps','novalyz','valide','box jump'),
('13','Tirage trapèze machine','Trapèze',null,'2.5','Machine','muscu','charge_reps',null,'valide','tirage trapeze machine'),
('130','Retournement de pneu','Corps entier',null,'0','Pneu / masse','muscu,fonctionnel','reps','novalyz','valide','retournement de pneu'),
('131','Coups de masse sur pneu','Corps entier',null,'0','Pneu / masse','muscu,fonctionnel','reps','novalyz','valide','coups de masse sur pneu'),
('14','Curl barre','Biceps',null,'2.5','Barre','muscu','charge_reps',null,'valide','curl barre'),
('15','Curl barre poulie','Biceps',null,'1.25','Poulie','muscu','charge_reps',null,'valide','curl barre poulie'),
('16','Curl incliné uni poignée à la poulie','Biceps',null,'1.25','Poulie','muscu','charge_reps',null,'valide','curl incline uni poignee a la poulie'),
('17','Curl incliné au banc','Biceps',null,'2','Haltères','muscu','charge_reps',null,'valide','curl incline au banc'),
('18','Extension poulie corde','Triceps',null,'1.25','Poulie','muscu','charge_reps',null,'valide','extension poulie corde'),
('19','Extension dos à la poulie corde','Triceps',null,'1.25','Poulie','muscu','charge_reps',null,'valide','extension dos a la poulie corde'),
('2','Développé machine','Pectoraux','Triceps','2.5','Machine','muscu','charge_reps',null,'valide','developpe machine'),
('20','Extension poulie barre','Triceps',null,'1.25','Poulie','muscu','charge_reps',null,'valide','extension poulie barre'),
('21','Élévation latérale haltère','Epaule','Trapèze','2','Haltères','muscu','charge_reps',null,'valide','elevation laterale haltere'),
('22','Élévation latérale uni à la poulie','Epaule','Trapèze','1.25','Poulie','muscu','charge_reps',null,'valide','elevation laterale uni a la poulie'),
('23','Développé militaire à la Smith','Epaule','Triceps','2.5','Smith','muscu','charge_reps',null,'valide','developpe militaire a la smith'),
('24','Développé militaire aux haltères','Epaule','Triceps','2','Haltères','muscu','charge_reps',null,'valide','developpe militaire aux halteres'),
('25','Arrière épaule à la poulie','Epaule',null,'1.25','Poulie','muscu','charge_reps',null,'valide','arriere epaule a la poulie'),
('26','Arrière épaule haltère','Epaule',null,'2','Haltères','muscu','charge_reps',null,'valide','arriere epaule haltere'),
('27','Leg extension','Quadriceps',null,'2.5','Machine','muscu','charge_reps',null,'valide','leg extension'),
('28','Belt squat','Quadriceps','Fessier','5','Machine','muscu','charge_reps',null,'valide','belt squat'),
('29','Presse unilatérale','Quadriceps','Fessier','5','Machine','muscu','charge_reps',null,'valide','presse unilaterale'),
('3','Développé décliné machine','Pectoraux','Triceps','2.5','Machine','muscu','charge_reps',null,'valide','developpe decline machine'),
('30','Presse inclinée','Quadriceps','Fessier','5','Machine','muscu','charge_reps',null,'valide','presse inclinee'),
('31','Presse horizontale','Quadriceps','Fessier','5','Machine','muscu','charge_reps',null,'valide','presse horizontale'),
('32','Presse circulaire','Quadriceps','Fessier','5','Machine','muscu','charge_reps',null,'valide','presse circulaire'),
('34','Squat','Quadriceps','Fessier','5','Barre','muscu','charge_reps',null,'valide','squat'),
('35','Squat gobelet','Quadriceps','Fessier','2','Haltères','muscu','charge_reps',null,'valide','squat gobelet'),
('36','Abduction machine','Fessier',null,'2.5','Machine','muscu','charge_reps',null,'valide','abduction machine'),
('37','Adducteur machine','Adducteur',null,'2.5','Machine','muscu','charge_reps',null,'valide','adducteur machine'),
('38','Relevé de bassin','Ischio','Fessier','5','Poids du corps','muscu','charge_reps',null,'valide','releve de bassin'),
('39','RDL haltère','Ischio','Fessier','2','Haltères','muscu','charge_reps',null,'valide','rdl haltere'),
('4','Développé incliné à la Smith','Pectoraux','Triceps','2.5','Smith','muscu','charge_reps',null,'valide','developpe incline a la smith'),
('40','RDL barre','Ischio','Fessier','5','Barre','muscu','charge_reps',null,'valide','rdl barre'),
('41','Presse sumo','Fessier','Ischio','2.5','Machine','muscu','charge_reps',null,'valide','presse sumo'),
('42','Hip thrust','Fessier','Ischio','5','Barre','muscu','charge_reps',null,'valide','hip thrust'),
('43','Kick back','Fessier',null,'2.5','Poulie','muscu','charge_reps',null,'valide','kick back'),
('44','Écarté machine uni','Pectoraux',null,'1.25','Machine','muscu','charge_reps',null,'valide','ecarte machine uni'),
('45','Développé couché haltère','Pectoraux','Triceps','2','Haltères','muscu','charge_reps',null,'valide','developpe couche haltere'),
('46','Développé couché incliné haltère','Pectoraux','Triceps','2','Haltères','muscu','charge_reps',null,'valide','developpe couche incline haltere'),
('47','Fente bulgare','Fessier','Quadriceps','2','Haltères','muscu','charge_reps',null,'valide','fente bulgare'),
('48','Relevé de jambe','Abdominaux',null,'2.5','Poids du corps','muscu','charge_reps',null,'valide','releve de jambe'),
('49','Crunch à la poulie','Abdominaux',null,'1.25','Poulie','muscu','charge_reps',null,'valide','crunch a la poulie'),
('5','Écarté poulie haute','Pectoraux',null,'1.25','Poulie','muscu','charge_reps',null,'valide','ecarte poulie haute'),
('50','Roulette','Abdominaux',null,'2.5','Poids du corps','muscu','charge_reps',null,'valide','roulette'),
('51','Mollets debout','Mollets',null,'2.5','Machine','muscu','charge_reps',null,'valide','mollets debout'),
('52','Mollets assis','Mollets',null,'2.5','Machine','muscu','charge_reps',null,'valide','mollets assis'),
('53','Mollets à la presse','Mollets',null,'5','Machine','muscu','charge_reps',null,'valide','mollets a la presse'),
('54','Fente courte','Quadriceps','Fessier','2','Haltères','muscu','charge_reps',null,'valide','fente courte'),
('55','Fente longue','Fessier','Quadriceps','2','Haltères','muscu','charge_reps',null,'valide','fente longue'),
('56','Curl marteau aux haltères','Biceps',null,'2','Haltères','muscu','charge_reps',null,'valide','curl marteau aux halteres'),
('57','Curl marteau à la poulie','Biceps',null,'1.25','Poulie','muscu','charge_reps',null,'valide','curl marteau a la poulie'),
('58','Curl haltère','Biceps',null,'2','Haltères','muscu','charge_reps',null,'valide','curl haltere'),
('59','Hack squat','Quadriceps','Fessier','5','Machine','muscu','charge_reps',null,'valide','hack squat'),
('6','Écarté poulie basse','Pectoraux',null,'1.25','Poulie','muscu','charge_reps',null,'valide','ecarte poulie basse'),
('60','Rowing barre','Dos','Biceps','5','Barre','muscu','charge_reps',null,'valide','rowing barre'),
('61','Rowing bucheron','Dos','Biceps','2','Haltères','muscu','charge_reps',null,'valide','rowing bucheron'),
('62','Rowing machine','Dos','Biceps','5','Machine','muscu','charge_reps',null,'valide','rowing machine'),
('63','Élévation frontale haltères','Epaule',null,'2','Haltères','muscu','charge_reps',null,'valide','elevation frontale halteres'),
('64','Écarté haltères','Pectoraux',null,'2','Haltères','muscu','charge_reps',null,'valide','ecarte halteres'),
('65','Extension triceps banc','Triceps',null,'2','Haltères','muscu','charge_reps',null,'valide','extension triceps banc'),
('66','Élévation frontale barre','Epaule',null,'2.5','Barre','muscu','charge_reps',null,'valide','elevation frontale barre'),
('67','Développé couché barre','Pectoraux','Triceps','5','Barre','muscu','charge_reps',null,'valide','developpe couche barre'),
('68','Traction','Dos','Biceps','5','Poids du corps','muscu','charge_reps',null,'valide','traction'),
('69','Pompe','Pectoraux','Triceps','2.5','Poids du corps','muscu','charge_reps',null,'valide','pompe'),
('7','T-bar row','Dos','Biceps','2.5','Machine','muscu','charge_reps',null,'valide','t-bar row'),
('70','Soulevé de terre','Dos','Ischio','5','Barre','muscu','charge_reps',null,'valide','souleve de terre'),
('71','Tirage horizontal uni à la poulie','Dos','Biceps','1.25','Poulie','muscu','charge_reps',null,'valide','tirage horizontal uni a la poulie'),
('72','Tirage vertical uni à la poulie','Dos','Biceps','1.25','Poulie','muscu','charge_reps',null,'valide','tirage vertical uni a la poulie'),
('73','Shrugs haltères','Trapèze',null,'2','Haltères','muscu','charge_reps',null,'valide','shrugs halteres'),
('74','Shrugs barre','Trapèze',null,'2.5','Barre','muscu','charge_reps',null,'valide','shrugs barre'),
('75','Rowing menton','Epaule','Trapèze','2.5','Barre','muscu','charge_reps',null,'valide','rowing menton'),
('76','Hip thrust machine','Fessier','Ischio','5','Machine','muscu','charge_reps',null,'valide','hip thrust machine'),
('77','Élévation frontale à la poulie','Epaule',null,'2.5','Poulie','muscu','charge_reps',null,'valide','elevation frontale a la poulie'),
('78','Pendulum','Quadriceps','Fessier','5','Machine','muscu','charge_reps',null,'valide','pendulum'),
('79','Dips pectoraux','Pectoraux','Triceps','2.5','Poids du corps','muscu','charge_reps',null,'valide','dips pectoraux'),
('8','Tirage horizontal prise large','Dos','Biceps','2.5','Poulie','muscu','charge_reps',null,'valide','tirage horizontal prise large'),
('80','Dips triceps','Triceps','Pectoraux','2.5','Poids du corps','muscu','charge_reps',null,'valide','dips triceps'),
('81','Rowing banc','Dos','Biceps','2','Haltères','muscu','charge_reps',null,'valide','rowing banc'),
('82','Développé décliné à la Smith','Pectoraux','Triceps','2.5','Smith','muscu','charge_reps',null,'valide','developpe decline a la smith'),
('83','Développé machine Hammer','Pectoraux','Triceps','2.5','Machine','muscu','charge_reps',null,'valide','developpe machine hammer'),
('84','Développé incliné Hammer','Pectoraux','Triceps','2.5','Machine','muscu','charge_reps',null,'valide','developpe incline hammer'),
('85','Leg curl assis','Ischio',null,'2.5','Machine','muscu','charge_reps',null,'valide','leg curl assis'),
('86','Leg curl debout','Ischio',null,'2.5','Machine','muscu','charge_reps',null,'valide','leg curl debout'),
('87','Leg curl allongé','Ischio',null,'2.5','Machine','muscu','charge_reps',null,'valide','leg curl allonge'),
('88','T-bar row prise haute','Dos','Biceps','2.5','Machine','muscu','charge_reps',null,'valide','t-bar row prise haute'),
('89','T-bar row prise basse','Dos','Biceps','2.5','Machine','muscu','charge_reps',null,'valide','t-bar row prise basse'),
('9','Tirage horizontal prise serrée','Dos','Biceps','2.5','Poulie','muscu','charge_reps',null,'valide','tirage horizontal prise serree'),
('90','Pull over','Dos','Pectoraux','2.5','Haltères','muscu','charge_reps',null,'valide','pull over'),
('91','Écarté haltères incliné','Pectoraux',null,'2','Haltères','muscu','charge_reps',null,'valide','ecarte halteres incline'),
('92','Écarté haltères décliné','Pectoraux',null,'2','Haltères','muscu','charge_reps',null,'valide','ecarte halteres decline'),
('93','Curl poignet barre','Avant-bras',null,'1.25','Barre','muscu','charge_reps','novalyz','valide','curl poignet barre'),
('94','Curl poignet inversé','Avant-bras',null,'1.25','Barre','muscu','charge_reps','novalyz','valide','curl poignet inverse'),
('95','Curl inversé barre','Avant-bras','Biceps','1.25','Barre','muscu','charge_reps','novalyz','valide','curl inverse barre'),
('96','Extension lombaire au banc 45°','Lombaires','Fessier','2.5','Poids du corps','muscu','charge_reps','novalyz','valide','extension lombaire au banc 45°'),
('97','Good morning','Lombaires','Ischio','2.5','Barre','muscu','charge_reps','novalyz','valide','good morning'),
('98','Crunch machine','Abdominaux',null,'2.5','Machine','muscu','charge_reps','novalyz','valide','crunch machine'),
('99','Relevé de genoux suspendu','Abdominaux',null,'2.5','Poids du corps','muscu','charge_reps','novalyz','valide','releve de genoux suspendu')
on conflict (exercice_id) do nothing;
delete from public.volume_obti;
insert into public.volume_obti (muscle, series_min_semaine, series_opt_semaine, series_max_semaine) values
('Pectoraux',8,14,null),
('Dos',10,16,22),
('Epaule',8,14,20),
('Biceps',8,14,20),
('Triceps',6,12,18),
('Quadriceps',8,14,20),
('Ischio',6,12,18),
('Fessier',8,14,20),
('Mollets',8,14,20),
('Abdominaux',6,13,20);

-- Comptes démo (mot de passe de test, ancien format → salé à la 1re connexion)
insert into public.coachs (coach_id, login, nom, password_hash, sport, role, prefs) values ('4','0202','jim','43c27b4e263fa191a6a7ec198cd4d5b47d17413c49d77dc533a01720707e3202','muscu','coach','{}'::jsonb);
insert into public.athletes (id,login,login_coach,nom,ddn,taille,annees,strategie,coach_id,sport,poste,jambe_dominante,poids,antecedents,sexe,club,categorie,discipline, password_hash) values ('3','0101','4','John','2003-09-09',156,4,'Prise de masse','4',null,null,null,78,null,null,null,null,null, '43c27b4e263fa191a6a7ec198cd4d5b47d17413c49d77dc533a01720707e3202');
insert into public.athletes (id,login,login_coach,nom,ddn,taille,annees,strategie,coach_id,sport,poste,jambe_dominante,poids,antecedents,sexe,club,categorie,discipline, password_hash) values ('demo_4_lucas','9035','4','Lucas Moreau','2002-04-14',178,1,'Progression linéaire','4','muscu',null,null,74,null,'H',null,null,null, '43c27b4e263fa191a6a7ec198cd4d5b47d17413c49d77dc533a01720707e3202');

-- Séances : combinaisons (séance, exercice, muscle, id, repos) puis séries encodées
create temp table _combo (k int, seance_id text, nom text, exercice text, muscle text, exercice_id text, repos int) on commit drop;
insert into _combo values (0,'Full Body','Full Body','Curl barre','Biceps','14',90),(1,'Full Body','Full Body','Développé couché barre','Pectoraux','67',120),(2,'Full Body','Full Body','Développé militaire à la Smith','Epaule','23',120),(3,'Full Body','Full Body','Leg curl assis','Ischio','85',90),(4,'Full Body','Full Body','Squat','Quadriceps','34',150),(5,'Full Body','Full Body','Tirage vertical prise large','Dos','10',120),(6,'Legs','Legs','Leg curl assis','Ischio','85',90),(7,'Legs','Legs','Mollets debout','Mollets','51',60),(8,'Legs','Legs','Presse inclinée','Quadriceps','30',120),(9,'Legs','Legs','RDL barre','Ischio','40',150),(10,'Legs','Legs','Squat','Quadriceps','34',180),(11,'Pull','Pull','Curl barre','Biceps','14',90),(12,'Pull','Pull','Curl marteau aux haltères','Biceps','56',60),(13,'Pull','Pull','Face pull','Epaule','108',60),(14,'Pull','Pull','Rowing barre','Dos','60',120),(15,'Pull','Pull','Tirage vertical prise large','Dos','10',120),(16,'Push','Push','Développé couché barre','Pectoraux','67',150),(17,'Push','Push','Développé couché incliné haltère','Pectoraux','46',120),(18,'Push','Push','Développé militaire aux haltères','Epaule','24',120),(19,'Push','Push','Extension poulie corde','Triceps','18',60),(20,'Push','Push','Élévation latérale haltère','Epaule','21',60),(21,'Upper','Upper','Barre au front','Triceps','110',90),(22,'Upper','Upper','Développé couché haltère','Pectoraux','45',120),(23,'Upper','Upper','Développé militaire à la Smith','Epaule','23',120),(24,'Upper','Upper','Tirage horizontal prise serrée','Dos','9',120),(25,'Upper','Upper','Écarté poulie haute','Pectoraux','5',60);
create temp table _perf_txt (t text) on commit drop;
insert into _perf_txt values ($perf$
J251109=0:25:11/10/10 1:62.5:9/9/8 2:37.5:9/8/7 3:40:11/11/9 4:80:9/8/7 5:57.5:11/9/8
J251111=0:25:11/10/9 1:62.5:9/8/8 2:37.5:9/8/7 3:40:11/10/9 4:80:9/8/7 5:57.5:11/9/8
J251113=0:25:13/12/11 1:62.5:10/10/8 2:37.5:10/9/8 3:40:12/11/10 4:80:10/9/8 5:57.5:11/10/9
J251116=0:25:11/10/10 1:62.5:9/9/8 2:37.5:9/8/7 3:40:11/11/9 4:80:9/8/7 5:57.5:11/9/8
J251118=0:25:11/10/9 1:62.5:9/8/8 2:37.5:9/8/7 3:40:11/10/9 4:80:9/8/7 5:57.5:11/9/8
J251120=0:25:13/12/11 1:62.5:10/10/8 2:37.5:10/9/8 3:40:12/11/10 4:80:10/9/8 5:57.5:11/10/9
J251123=0:25:11/10/10 1:62.5:9/9/8 2:37.5:9/8/7 3:40:11/11/9 4:80:9/8/7 5:57.5:11/9/8
J251125=0:25:11/10/9 1:62.5:9/8/8 2:37.5:9/8/7 3:40:11/10/9 4:80:9/8/7 5:57.5:11/9/8
J251127=0:25:13/12/11 1:62.5:10/10/8 2:37.5:10/9/8 3:40:12/11/10 4:80:10/9/8 5:57.5:11/10/9
J251130=0:25:11/10/10 1:62.5:9/9/8 2:40:9/8/7 3:40:11/11/9 4:82.5:9/8/7 5:60:11/9/8
J251202=0:25:11/10/9 1:62.5:9/8/8 2:40:9/8/7 3:40:11/10/9 4:82.5:9/8/7 5:60:11/9/8
J251204=0:25:13/12/11 1:62.5:10/10/8 2:40:10/9/8 3:40:12/11/10 4:82.5:10/9/8 5:60:11/10/9
J251207=0:25:11/10/10 1:62.5:9/9/8 2:40:9/8/7 3:40:11/11/9 4:82.5:9/8/7 5:60:11/9/8
J251209=0:25:11/10/9 1:62.5:9/8/8 2:40:9/8/7 3:40:11/10/9 4:82.5:9/8/7 5:60:11/9/8
J251211=0:25:13/12/11 1:62.5:10/10/8 2:40:10/9/8 3:40:12/11/10 4:82.5:10/9/8 5:60:11/10/9
J251214=0:25:11/10/10 1:65:9/9/8 2:40:9/8/7 3:42.5:11/11/9 4:82.5:9/8/7 5:60:11/9/8
J251216=0:25:11/10/9 1:65:9/8/8 2:40:9/8/7 3:42.5:11/10/9 4:82.5:9/8/7 5:60:11/9/8
J251218=0:25:13/12/11 1:65:10/10/8 2:40:10/9/8 3:42.5:12/11/10 4:82.5:10/9/8 5:60:11/10/9
J251221=0:25:11/10/10 1:65:9/9/8 2:40:9/8/7 3:42.5:11/11/9 4:82.5:9/8/7 5:60:11/9/8
J251223=0:25:11/10/9 1:65:9/8/8 2:40:9/8/7 3:42.5:11/10/9 4:82.5:9/8/7 5:60:11/9/8
J251225=0:25:13/12/11 1:65:10/10/8 2:40:10/9/8 3:42.5:12/11/10 4:82.5:10/9/8 5:60:11/10/9
J251228=0:22.5:11/10/10:6/7/8 1:57.5:9/9/8:6/7/8 2:35:9/8/7:6/7/8 3:37.5:11/11/9:6/7/8 4:72.5:9/8/7:6/7/8 5:52.5:11/9/8:6/7/8
J251230=0:22.5:11/10/9:6/7/8 1:57.5:9/8/8:6/7/8 2:35:9/8/7:6/7/8 3:37.5:11/10/9:6/7/8 4:72.5:9/8/7:6/7/8 5:52.5:11/9/8:6/7/8
J260101=0:22.5:13/12/11:6/7/8 1:57.5:10/10/8:6/7/8 2:35:10/9/8:6/7/8 3:37.5:12/11/10:6/7/8 4:72.5:10/9/8:6/7/8 5:52.5:11/10/9:6/7/8
J260104=0:25:11/10/10 1:65:9/9/8 2:40:9/8/7 3:42.5:11/11/9 4:85:9/8/7 5:60:11/9/8
J260106=0:25:11/10/9 1:65:9/8/8 2:40:9/8/7 3:42.5:11/10/9 4:85:9/8/7 5:60:11/9/8
J260108=0:25:13/12/11 1:65:10/10/8 2:40:10/9/8 3:42.5:12/11/10 4:85:10/9/8 5:60:11/10/9
J260111=0:25:11/10/10 1:65:9/9/8 2:40:9/8/7 3:42.5:11/11/9 4:85:9/8/7 5:60:11/9/8
J260113=0:25:11/10/9 1:65:9/8/8 2:40:9/8/7 3:42.5:11/10/9 4:85:9/8/7 5:60:11/9/8
J260115=0:25:13/12/11 1:65:10/10/8 2:40:10/9/8 3:42.5:12/11/10 4:85:10/9/8 5:60:11/10/9
J260118=0:25:11/10/10 1:65:9/9/8 2:40:9/8/7 3:42.5:11/11/9 4:85:9/8/7 5:62.5:11/9/8
J260120=0:25:11/10/9 1:65:9/8/8 2:40:9/8/7 3:42.5:11/10/9 4:85:9/8/7 5:62.5:11/9/8
J260122=0:25:13/12/11 1:65:10/10/8 2:40:10/9/8 3:42.5:12/11/10 4:85:10/9/8 5:62.5:11/10/9
J260125=0:25:11/10/10 1:67.5:9/9/8 2:40:9/8/7 3:42.5:11/11/9 4:85:9/8/7 5:62.5:11/9/8
J260127=0:25:11/10/9 1:67.5:9/8/8 2:40:9/8/7 3:42.5:11/10/9 4:85:9/8/7 5:62.5:11/9/8
J260129=0:25:13/12/11 1:67.5:10/10/8 2:40:10/9/8 3:42.5:12/11/10 4:85:10/9/8 5:62.5:11/10/9
J260201=0:27.5:11/10/10 1:67.5:9/9/8 2:42.5:9/8/7 3:42.5:11/11/9 4:85:9/8/7 5:62.5:11/9/8
J260203=0:27.5:11/10/9 1:67.5:9/8/8 2:42.5:9/8/7 3:42.5:11/10/9 4:85:9/8/7 5:62.5:11/9/8
J260205=0:27.5:13/12/11 1:67.5:10/10/8 2:42.5:10/9/8 3:42.5:12/11/10 4:85:10/9/8 5:62.5:11/10/9
J260208=0:27.5:11/10/10 1:67.5:9/9/8 2:42.5:9/8/7 3:45:11/11/9 4:87.5:9/8/7 5:62.5:11/9/8
J260210=0:27.5:11/10/9 1:67.5:9/8/8 2:42.5:9/8/7 3:45:11/10/9 4:87.5:9/8/7 5:62.5:11/9/8
J260212=0:27.5:13/12/11 1:67.5:10/10/8 2:42.5:10/9/8 3:45:12/11/10 4:87.5:10/9/8 5:62.5:11/10/9
J260215=0:27.5:11/10/10 1:67.5:9/9/8 2:42.5:9/8/7 3:45:11/11/9 4:87.5:9/8/7 5:62.5:11/9/8
J260217=0:27.5:11/10/9 1:67.5:9/8/8 2:42.5:9/8/7 3:45:11/10/9 4:87.5:9/8/7 5:62.5:11/9/8
J260219=0:27.5:13/12/11 1:67.5:10/10/8 2:42.5:10/9/8 3:45:12/11/10 4:87.5:10/9/8 5:62.5:11/10/9
J260222=0:22.5:11/10/10:6/7/8 1:60:9/9/8:6/7/8 2:37.5:9/8/7:6/7/8 3:40:11/11/9:6/7/8 4:77.5:9/8/7:6/7/8 5:55:11/9/8:6/7/8
J260224=0:22.5:11/10/9:6/7/8 1:60:9/8/8:6/7/8 2:37.5:9/8/7:6/7/8 3:40:11/10/9:6/7/8 4:77.5:9/8/7:6/7/8 5:55:11/9/8:6/7/8
J260226=0:22.5:13/12/11:6/7/8 1:60:10/10/8:6/7/8 2:37.5:10/9/8:6/7/8 3:40:12/11/10:6/7/8 4:77.5:10/9/8:6/7/8 5:55:11/10/9:6/7/8
J260301=0:27.5:11/10/10 1:67.5:9/9/8 2:42.5:9/8/7 3:45:11/11/9 4:87.5:9/8/7 5:62.5:11/9/8
J260303=0:27.5:11/10/9 1:67.5:9/8/8 2:42.5:9/8/7 3:45:11/10/9 4:87.5:9/8/7 5:62.5:11/9/8
J260305=0:27.5:13/12/11 1:67.5:10/10/8 2:42.5:10/9/8 3:45:12/11/10 4:87.5:10/9/8 5:62.5:11/10/9
J260308=0:27.5:11/10/10 1:67.5:9/9/8 2:42.5:9/8/7 3:45:11/11/9 4:87.5:9/8/7 5:65:11/9/8
J260310=0:27.5:11/10/9 1:67.5:9/8/8 2:42.5:9/8/7 3:45:11/10/9 4:87.5:9/8/7 5:65:11/9/8
J260312=0:27.5:13/12/11 1:67.5:10/10/8 2:42.5:10/9/8 3:45:12/11/10 4:87.5:10/9/8 5:65:11/10/9
J260315=0:27.5:11/10/10 1:70:9/9/8 2:42.5:9/8/7 3:45:11/11/9 4:90:9/8/7 5:65:11/9/8
J260317=0:27.5:11/10/9 1:70:9/8/8 2:42.5:9/8/7 3:45:11/10/9 4:90:9/8/7 5:65:11/9/8
J260319=0:27.5:13/12/11 1:70:10/10/8 2:42.5:10/9/8 3:45:12/11/10 4:90:10/9/8 5:65:11/10/9
J260322=0:27.5:11/10/10 1:70:9/9/8 2:42.5:9/8/7 3:45:11/11/9 4:90:9/8/7 5:65:11/9/8
J260324=0:27.5:11/10/9 1:70:9/8/8 2:42.5:9/8/7 3:45:11/10/9 4:90:9/8/7 5:65:11/9/8
J260326=0:27.5:13/12/11 1:70:10/10/8 2:42.5:10/9/8 3:45:12/11/10 4:90:10/9/8 5:65:11/10/9
J260329=0:27.5:11/10/10 1:70:9/9/8 2:42.5:9/8/7 3:45:11/11/9 4:90:9/8/7 5:65:11/9/8
J260331=0:27.5:11/10/9 1:70:9/8/8 2:42.5:9/8/7 3:45:11/10/9 4:90:9/8/7 5:65:11/9/8
J260402=0:27.5:13/12/11 1:70:10/10/8 2:42.5:10/9/8 3:45:12/11/10 4:90:10/9/8 5:65:11/10/9
J260405=0:27.5:11/10/10 1:70:9/9/8 2:45:9/8/7 3:45:11/11/9 4:90:9/8/7 5:65:11/9/8
J260407=0:27.5:11/10/9 1:70:9/8/8 2:45:9/8/7 3:45:11/10/9 4:90:9/8/7 5:65:11/9/8
J260409=0:27.5:13/12/11 1:70:10/10/8 2:45:10/9/8 3:45:12/11/10 4:90:10/9/8 5:65:11/10/9
J260412=0:27.5:11/10/10 1:70:9/9/8 2:45:9/8/7 3:47.5:11/11/9 4:90:9/8/7 5:65:11/9/8
J260414=0:27.5:11/10/9 1:70:9/8/8 2:45:9/8/7 3:47.5:11/10/9 4:90:9/8/7 5:65:11/9/8
J260416=0:27.5:13/12/11 1:70:10/10/8 2:45:10/9/8 3:47.5:12/11/10 4:90:10/9/8 5:65:11/10/9
J260419=0:25:11/10/10:6/7/8 1:62.5:9/9/8:6/7/8 2:40:9/8/7:6/7/8 3:40:11/11/9:6/7/8 4:80:9/8/7:6/7/8 5:57.5:11/9/8:6/7/8
J260421=0:25:11/10/9:6/7/8 1:62.5:9/8/8:6/7/8 2:40:9/8/7:6/7/8 3:40:11/10/9:6/7/8 4:80:9/8/7:6/7/8 5:57.5:11/9/8:6/7/8
J260423=0:25:13/12/11:6/7/8 1:62.5:10/10/8:6/7/8 2:40:10/9/8:6/7/8 3:40:12/11/10:6/7/8 4:80:10/9/8:6/7/8 5:57.5:11/10/9:6/7/8
J260426=0:27.5:11/10/10 1:72.5:9/9/8 2:45:9/8/7 3:47.5:11/11/9 4:92.5:9/8/7 5:67.5:11/9/8
J260428=0:27.5:11/10/9 1:72.5:9/8/8 2:45:9/8/7 3:47.5:11/10/9 4:92.5:9/8/7 5:67.5:11/9/8
J260430=0:27.5:13/12/11 1:72.5:10/10/8 2:45:10/9/8 3:47.5:12/11/10 4:92.5:10/9/8 5:67.5:11/10/9
J260503=0:30:11/10/10 1:72.5:9/9/8 2:45:9/8/7 3:47.5:11/11/9 4:92.5:9/8/7 5:67.5:11/9/8
J260505=0:30:11/10/9 1:72.5:9/8/8 2:45:9/8/7 3:47.5:11/10/9 4:92.5:9/8/7 5:67.5:11/9/8
J260507=0:30:13/12/11 1:72.5:10/10/8 2:45:10/9/8 3:47.5:12/11/10 4:92.5:10/9/8 5:67.5:11/10/9
J260510=0:30:11/10/10 1:72.5:9/9/8 2:45:9/8/7 3:47.5:11/11/9 4:92.5:9/8/7 5:67.5:11/9/8
J260512=0:30:11/10/9 1:72.5:9/8/8 2:45:9/8/7 3:47.5:11/10/9 4:92.5:9/8/7 5:67.5:11/9/8
J260514=0:30:13/12/11 1:72.5:10/10/8 2:45:10/9/8 3:47.5:12/11/10 4:92.5:10/9/8 5:67.5:11/10/9
J260517=0:30:11/10/10 1:72.5:9/9/8 2:45:9/8/7 3:47.5:11/11/9 4:92.5:9/8/7 5:67.5:11/9/8
J260519=0:30:11/10/9 1:72.5:9/8/8 2:45:9/8/7 3:47.5:11/10/9 4:92.5:9/8/7 5:67.5:11/9/8
J260521=0:30:13/12/11 1:72.5:10/10/8 2:45:10/9/8 3:47.5:12/11/10 4:92.5:10/9/8 5:67.5:11/10/9
J260524=0:30:11/10/10 1:72.5:9/9/8 2:45:9/8/7 3:47.5:11/11/9 4:92.5:9/8/7 5:67.5:11/9/8
J260526=0:30:11/10/9 1:72.5:9/8/8 2:45:9/8/7 3:47.5:11/10/9 4:92.5:9/8/7 5:67.5:11/9/8
J260528=0:30:13/12/11 1:72.5:10/10/8 2:45:10/9/8 3:47.5:12/11/10 4:92.5:10/9/8 5:67.5:11/10/9
J260531=0:30:11/10/10 1:72.5:9/9/8 2:45:9/8/7 3:47.5:11/11/9 4:95:9/8/7 5:67.5:11/9/8
J260602=0:30:11/10/9 1:72.5:9/8/8 2:45:9/8/7 3:47.5:11/10/9 4:95:9/8/7 5:67.5:11/9/8
J260604=0:30:13/12/11 1:72.5:10/10/8 2:45:10/9/8 3:47.5:12/11/10 4:95:10/9/8 5:67.5:11/10/9
J260607=0:30:11/10/10 1:75:9/9/8 2:45:9/8/7 3:50:11/11/9 4:95:9/8/7 5:67.5:11/9/8
J260609=0:30:11/10/9 1:75:9/8/8 2:45:9/8/7 3:50:11/10/9 4:95:9/8/7 5:67.5:11/9/8
J260611=0:30:13/12/11 1:75:10/10/8 2:45:10/9/8 3:50:12/11/10 4:95:10/9/8 5:67.5:11/10/9
J260614=0:27.5:11/10/10:6/7/8 1:65:9/9/8:6/7/8 2:40:9/8/7:6/7/8 3:42.5:11/11/9:6/7/8 4:85:9/8/7:6/7/8 5:60:11/9/8:6/7/8
J260616=0:27.5:11/10/9:6/7/8 1:65:9/8/8:6/7/8 2:40:9/8/7:6/7/8 3:42.5:11/10/9:6/7/8 4:85:9/8/7:6/7/8 5:60:11/9/8:6/7/8
J260618=0:27.5:13/12/11:6/7/8 1:65:10/10/8:6/7/8 2:40:10/9/8:6/7/8 3:42.5:12/11/10:6/7/8 4:85:10/9/8:6/7/8 5:60:11/10/9:6/7/8
J260621=0:30:11/10/10 1:75:9/9/8 2:47.5:9/8/7 3:50:11/11/9 4:95:9/8/7 5:70:11/9/8
J260623=0:30:11/10/9 1:75:9/8/8 2:47.5:9/8/7 3:50:11/10/9 4:95:9/8/7 5:70:11/9/8
J260625=0:30:13/12/11 1:75:10/10/8 2:47.5:10/9/8 3:50:12/11/10 4:95:10/9/8 5:70:11/10/9
J260628=0:30:11/10/10 1:75:9/9/8 2:47.5:9/8/7 3:50:11/11/9 4:95:9/8/7 5:70:11/9/8
J260630=0:30:11/10/9 1:75:9/8/8 2:47.5:9/8/7 3:50:11/10/9 4:95:9/8/7 5:70:11/9/8
J260702=0:30:13/12/11 1:75:10/10/8 2:47.5:10/9/8 3:50:12/11/10 4:95:10/9/8 5:70:11/10/9
J260705=0:30:11/10/10 1:75:9/9/8 2:47.5:9/8/7 3:50:11/11/9 4:97.5:9/8/7 5:70:11/9/8
J260707=0:30:11/10/9 1:75:9/8/8 2:47.5:9/8/7 3:50:11/10/9 4:97.5:9/8/7 5:70:11/9/8
J260709=0:30:13/12/11 1:75:10/10/8 2:47.5:10/9/8 3:50:12/11/10 4:97.5:10/9/8 5:70:11/10/9
J260712=0:30:11/10/10 1:75:9/9/8 2:47.5:9/8/7 3:50:11/11/9 4:97.5:9/8/7 5:70:11/9/8
J260714=0:30:11/10/9 1:75:9/8/8 2:47.5:9/8/7 3:50:11/10/9 4:97.5:9/8/7 5:70:11/9/8
J260716=0:30:13/12/11 1:75:10/10/8 2:47.5:10/9/8 3:50:12/11/10 4:97.5:10/9/8 5:70:11/10/9
J260719=0:30:11/10/10 1:75:9/9/8 2:47.5:9/8/7 3:50:11/11/9 4:97.5:9/8/7 5:70:11/9/8
J260721=0:30:11/10/9 1:75:9/8/8 2:47.5:9/8/7 3:50:11/10/9 4:97.5:9/8/7 5:70:11/9/8
J260723=0:30:13/12/11 1:75:10/10/8 2:47.5:10/9/8 3:50:12/11/10 4:97.5:10/9/8 5:70:11/10/9
J260726=0:32.5:11/10/10 1:77.5:9/9/8 2:47.5:9/8/7 3:50:11/11/9 4:97.5:9/8/7 5:70:11/9/8
J260728=0:32.5:11/10/9 1:77.5:9/8/8 2:47.5:9/8/7 3:50:11/10/9 4:97.5:9/8/7 5:70:11/9/8
J260730=0:32.5:13/12/11 1:77.5:10/10/8 2:47.5:10/9/8 3:50:12/11/10 4:97.5:10/9/8 5:70:11/10/9
J260802=0:32.5:11/10/10 1:77.5:9/9/8 2:47.5:9/8/7 3:50:11/11/9 4:97.5:9/8/7 5:72.5:11/9/8
J260804=0:32.5:11/10/9 1:77.5:9/8/8 2:47.5:9/8/7 3:50:11/10/9 4:97.5:9/8/7 5:72.5:11/9/8
J260806=0:32.5:13/12/11 1:77.5:10/10/8 2:47.5:10/9/8 3:50:12/11/10 4:97.5:10/9/8 5:72.5:11/10/9
J260809=0:27.5:11/10/10:6/7/8 1:67.5:9/9/8:6/7/8 2:42.5:9/8/7:6/7/8 3:45:11/11/9:6/7/8 4:87.5:9/8/7:6/7/8 5:62.5:11/9/8:6/7/8
J260811=0:27.5:11/10/9:6/7/8 1:67.5:9/8/8:6/7/8 2:42.5:9/8/7:6/7/8 3:45:11/10/9:6/7/8 4:87.5:9/8/7:6/7/8 5:62.5:11/9/8:6/7/8
J260813=0:27.5:13/12/11:6/7/8 1:67.5:10/10/8:6/7/8 2:42.5:10/9/8:6/7/8 3:45:12/11/10:6/7/8 4:87.5:10/9/8:6/7/8 5:62.5:11/10/9:6/7/8
J260816=0:32.5:11/10/10 1:77.5:9/9/8 2:50:9/8/7 3:52.5:11/11/9 4:100:9/8/7 5:72.5:11/9/8
J260818=0:32.5:11/10/9 1:77.5:9/8/8 2:50:9/8/7 3:52.5:11/10/9 4:100:9/8/7 5:72.5:11/9/8
J260820=0:32.5:13/12/11 1:77.5:10/10/8 2:50:10/9/8 3:52.5:12/11/10 4:100:10/9/8 5:72.5:11/10/9
J260823=0:32.5:11/10/10 1:77.5:9/9/8 2:50:9/8/7 3:52.5:11/11/9 4:100:9/8/7 5:72.5:11/9/8
J260825=0:32.5:11/10/9 1:77.5:9/8/8 2:50:9/8/7 3:52.5:11/10/9 4:100:9/8/7 5:72.5:11/9/8
J260827=0:32.5:13/12/11 1:77.5:10/10/8 2:50:10/9/8 3:52.5:12/11/10 4:100:10/9/8 5:72.5:11/10/9
J260830=0:32.5:11/10/10 1:77.5:9/9/8 2:50:9/8/7 3:52.5:11/11/9 4:100:9/8/7 5:72.5:11/9/8
J260901=0:32.5:11/10/9 1:77.5:9/8/8 2:50:9/8/7 3:52.5:11/10/9 4:100:9/8/7 5:72.5:11/9/8
J260903=0:32.5:13/12/11 1:77.5:10/10/8 2:50:10/9/8 3:52.5:12/11/10 4:100:10/9/8 5:72.5:11/10/9
J260906=0:32.5:11/10/10 1:80:9/9/8 2:50:9/8/7 3:52.5:11/11/9 4:100:9/8/7 5:72.5:11/9/8
J260908=0:32.5:11/10/9 1:80:9/8/8 2:50:9/8/7 3:52.5:11/10/9 4:100:9/8/7 5:72.5:11/9/8
J260910=0:32.5:13/12/11 1:80:10/10/8 2:50:10/9/8 3:52.5:12/11/10 4:100:10/9/8 5:72.5:11/10/9
J260913=0:32.5:11/10/10 1:80:9/9/8 2:50:9/8/7 3:52.5:11/11/9 4:102.5:9/8/7 5:72.5:11/9/8
J260915=0:32.5:11/10/9 1:80:9/8/8 2:50:9/8/7 3:52.5:11/10/9 4:102.5:9/8/7 5:72.5:11/9/8
J260917=0:32.5:13/12/11 1:80:10/10/8 2:50:10/9/8 3:52.5:12/11/10 4:102.5:10/9/8 5:72.5:11/10/9
J260920=0:32.5:11/10/10 1:80:9/9/8 2:50:9/8/7 3:52.5:11/11/9 4:102.5:9/8/7 5:75:11/9/8
J260922=0:32.5:11/10/9 1:80:9/8/8 2:50:9/8/7 3:52.5:11/10/9 4:102.5:9/8/7 5:75:11/9/8
J260924=0:32.5:13/12/11 1:80:10/10/8 2:50:10/9/8 3:52.5:12/11/10 4:102.5:10/9/8 5:75:11/10/9
J260927=0:32.5:11/10/10 1:80:9/9/8 2:50:9/8/7 3:52.5:11/11/9 4:102.5:9/8/7 5:75:11/9/8
J260929=0:32.5:11/10/9 1:80:9/8/8 2:50:9/8/7 3:52.5:11/10/9 4:102.5:9/8/7 5:75:11/9/8
J261001=0:32.5:13/12/11 1:80:10/10/8 2:50:10/9/8 3:52.5:12/11/10 4:102.5:10/9/8 5:75:11/10/9
J261004=0:30:11/10/10:6/7/8 1:70:9/9/8:6/7/8 2:45:9/8/7:6/7/8 3:47.5:11/11/9:6/7/8 4:90:9/8/7:6/7/8 5:65:11/9/8:6/7/8
J261006=0:30:11/10/9:6/7/8 1:70:9/8/8:6/7/8 2:45:9/8/7:6/7/8 3:47.5:11/10/9:6/7/8 4:90:9/8/7:6/7/8 5:65:11/9/8:6/7/8
J261008=0:30:13/12/11:6/7/8 1:70:10/10/8:6/7/8 2:45:10/9/8:6/7/8 3:47.5:12/11/10:6/7/8 4:90:10/9/8:6/7/8 5:65:11/10/9:6/7/8
J261011=0:32.5:11/10/10 1:80:9/9/8 2:50:9/8/7 3:55:11/11/9 4:102.5:9/8/7 5:75:11/9/8
J261013=0:32.5:11/10/9 1:80:9/8/8 2:50:9/8/7 3:55:11/10/9 4:102.5:9/8/7 5:75:11/9/8
J261015=0:32.5:13/12/11 1:80:10/10/8 2:50:10/9/8 3:55:12/11/10 4:102.5:10/9/8 5:75:11/10/9
J261018=0:32.5:11/10/10 1:80:9/9/8 2:52.5:9/8/7 3:55:11/11/9 4:105:9/8/7 5:75:11/9/8
J261020=0:32.5:11/10/9 1:80:9/8/8 2:52.5:9/8/7 3:55:11/10/9 4:105:9/8/7 5:75:11/9/8
J261022=0:32.5:13/12/11 1:80:10/10/8 2:52.5:10/9/8 3:55:12/11/10 4:105:10/9/8 5:75:11/10/9
J261025=0:35:11/10/10 1:82.5:9/9/8 2:52.5:9/8/7 3:55:11/11/9 4:105:9/8/7 5:75:11/9/8
J261027=0:35:11/10/9 1:82.5:9/8/8 2:52.5:9/8/7 3:55:11/10/9 4:105:9/8/7 5:75:11/9/8
J261029=0:35:13/12/11 1:82.5:10/10/8 2:52.5:10/9/8 3:55:12/11/10 4:105:10/9/8 5:75:11/10/9
J261101=0:35:11/10/10 1:82.5:9/9/8 2:52.5:9/8/7 3:55:11/11/9 4:105:9/8/7 5:75:11/9/8
J261103=0:35:11/10/9 1:82.5:9/8/8 2:52.5:9/8/7 3:55:11/10/9 4:105:9/8/7 5:75:11/9/8
J261105=0:35:13/12/11 1:82.5:10/10/8 2:52.5:10/9/8 3:55:12/11/10 4:105:10/9/8 5:75:11/10/9
L260309=16:55:6/6/5/5:7/8/8/8.5 17:18:8/7/7:7.5/7.5/8 18:14:8/8/7:7/8/8 19:20:10/10/9:7/8/8 20:8:12/11/11:7.5/8/8
L260310=11:22.5:8/8/7:7/7.5/8.5 12:10:10/10/9:7/7.5/8 13:15:12/12/11:7/8/8 14:40:6/6/5/5:7/8/8.5/8.5 15:45:8/8/7/7:7/7.5/8/9
L260312=6:35:10/10/9:7/7.5/8 7:40:12/11/11:7/8/8.5 8:100:10/10/9:7.5/7.5/8 9:50:8/8/7:7/7.5/8 10:60:6/6/5/5:7/7.5/8.5/8.5
L260314=21:20:10/9/9:7.5/7.5/8 22:20:8/8/7:7/8/8.5 23:30:8/7/7:7/8/8.5 24:45:8/8/7:7/8/8.5 25:10:12/12/11:7.5/7.5/8
L260316=16:55:7/7/5/5:7/8/8/8.5 17:18:9/9/8:7/7.5/8 18:14:9/8/8:7/7.5/8.5 19:20:10/11/9:7/8/8.5 20:8:12/12/11:7.5/8/8
L260317=11:22.5:9/9/7:7.5/8/8.5 12:10:11/11/10:7/7.5/8.5 13:15:12/12/11:7/8/8 14:40:7/7/6/5:7.5/7.5/8.5/8.5 15:45:8/9/8/8:7/7.5/8/8.5
L260319=6:35:10/11/9:7/8/8 7:40:13/13/12:7/7.5/8 8:100:11/11/10:7/7.5/8 9:50:9/9/7:7/7.5/8 10:60:6/6/6/5:7.5/7.5/8/8.5
L260321=21:20:10/11/9:7/7.5/8 22:20:9/9/8:7/7.5/8.5 23:30:8/7/7:7.5/8/8.5 24:45:8/8/8:7.5/7.5/8 25:10:13/13/11:7.5/8/8
L260323=16:55:7/8/7/6:7.5/8/8/9 17:18:9/9/7:7/8/8 18:14:10/9/9:7/8/8 19:20:12/12/11:7.5/7.5/8 20:8:12/12/11:7/8/8
L260324=11:22.5:9/9/9:7/7.5/8 12:10:12/12/11:7/7.5/8 13:15:13/12/11:7/7.5/8 14:40:8/8/7/7:7.5/7.5/8/9 15:45:9/10/8/9:7.5/8/8.5/9
L260326=6:35:10/10/10:7/8/8 7:40:13/13/11:7/7.5/8 8:100:12/12/11:7/8/8.5 9:50:9/10/9:7.5/7.5/8 10:60:7/8/6/6:7/7.5/8/8.5
L260328=21:20:12/11/11:7/7.5/8 22:20:9/9/8:7.5/7.5/8 23:30:9/9/8:7/7.5/8 24:45:10/10/9:7/7.5/8 25:10:14/13/13:7.5/7.5/8
L260330=16:55:8/9/7/8:7.5/7.5/8/8.5 17:18:10/9/8:7.5/8/8.5 18:14:11/11/9:7/7.5/8 19:20:12/11/10:7/7.5/8 20:8:12/12/11:7/7.5/8
L260331=11:22.5:10/11/9:7/7.5/8 12:12:10/10/9:7/7.5/8 13:15:13/13/13:7/7.5/8.5 14:40:9/9/7/7:7/7.5/8/8.5 15:45:11/11/10/10:7.5/7.5/8/9
L260402=6:35:10/11/9:7.5/7.5/8.5 7:40:14/14/12:7.5/7.5/8 8:105:10/10/9:7/7.5/8 9:55:8/8/7:7/7.5/8.5 10:60:8/9/8/8:7.5/7.5/8/9
L260404=21:21.25:10/9/9:7.5/7.5/8 22:20:9/10/9:7/7.5/8.5 23:30:10/10/9:7.5/8/8 24:45:11/11/10:7/8/8 25:10:14/14/13:7.5/7.5/8
L260406=16:55:9/9/8/9:7.5/8/8/8.5 17:18:11/11/9:7/7.5/8.5 18:14:11/12/10:7/7.5/8.5 19:20:13/13/12:7/7.5/8 20:8:13/12/12:7.5/8/8
L260407=11:22.5:11/12/11:7/8/8 12:12:10/10/10:7.5/7.5/8 13:15:15/15/14:7.5/7.5/8 14:40:10/9/8/9:7/7.5/8/8.5 15:45:12/12/11/10:7/7.5/8/9
L260409=6:35:11/11/10:7/7.5/8.5 7:40:15/15/14:7.5/7.5/8.5 8:105:11/11/9:7.5/7.5/8.5 9:55:9/8/7:7.5/7.5/8 10:60:9/10/8/9:7/8/8.5/8.5
L260411=21:21.25:10/10/10:7/7.5/8 22:20:11/10/10:7.5/7.5/8 23:32.5:8/8/7:7/7.5/8 24:45:12/12/11:7/7.5/8.5 25:10:15/15/13:7/7.5/8.5
L260413=16:57.5:6/6/5/5:7.5/7.5/8/8.5 17:18:12/11/11:7/8/8 18:16:8/7/7:7/8/8 19:20:14/13/13:7.5/8/8 20:8:13/13/12:7/7.5/8.5
L260414=11:25:8/8/7:7/7.5/8 12:12:12/12/10:7/8/8.5 13:16.25:12/12/11:7/8/8 14:42.5:6/6/5/5:7/8/8.5/9 15:47.5:8/8/7/7:7/7.5/8/9
L260416=6:35:11/11/10:7.5/7.5/8 7:42.5:12/12/11:7/7.5/8.5 8:105:11/11/11:7/8/8 9:55:10/10/8:7/7.5/8 10:65:6/5/5/5:7/7.5/8.5/8.5
L260418=21:21.25:11/11/11:7/7.5/8.5 22:20:11/12/11:7/8/8 23:32.5:8/9/8:7/7.5/8 24:47.5:8/7/7:7.5/7.5/8 25:10:15/14/14:7.5/8/8
L260420=16:57.5:6/6/6/6:7/7.5/8/9 17:20:8/8/7:7.5/8/8.5 18:16:9/8/8:7/8/8 19:20:15/14/14:7/7.5/8 20:8:13/13/13:7/7.5/8
L260421=11:25:9/8/8:7/7.5/8 12:14:10/9/9:7/7.5/8.5 13:16.25:13/13/12:7.5/7.5/8 14:42.5:6/5/5/5:7.5/7.5/8/9 15:47.5:9/9/8/8:7/7.5/8/9
L260423=6:35:12/11/11:7/7.5/8 7:42.5:12/12/12:7.5/7.5/8 8:110:10/9/9:7.5/8/8 9:60:8/8/7:7/7.5/8.5 10:65:7/6/6/6:7/7.5/8.5/9
L260425=21:22.5:10/9/9:7/7.5/8.5 22:22:8/7/7:7/7.5/8 23:32.5:10/9/9:7/8/8 24:47.5:9/9/8:7/8/8.5 25:11.25:12/11/11:7.5/7.5/8
L260427=16:57.5:7/8/7/6:7.5/8/8/9 17:20:9/8/7:7.5/7.5/8 18:16:10/9/9:7.5/7.5/8.5 19:21.25:10/10/9:7/7.5/8 20:8:15/14/14:7.5/7.5/8
L260428=11:25:9/9/8:7.5/8/8.5 12:14:11/11/10:7/7.5/8 13:16.25:14/13/13:7/8/8 14:42.5:6/7/5/6:7/7.5/8/8.5 15:47.5:10/10/9/8:7/8/8.5/8.5
L260430=6:37.5:10/10/9:7.5/8/8.5 7:42.5:14/14/13:7/8/8.5 8:110:11/11/10:7.5/8/8.5 9:60:8/9/8:7.5/7.5/8.5 10:65:8/8/7/6:7.5/7.5/8.5/9
L260502=21:22.5:10/10/9:7/8/8.5 22:22:9/8/7:7/7.5/8.5 23:32.5:10/10/8:7/7.5/8.5 24:47.5:9/9/7:7/7.5/8 25:11.25:13/13/12:7.5/7.5/8
L260504=16:57.5:8/9/7/8:7/7.5/8.5/9 17:20:10/10/9:7.5/8/8.5 18:16:11/11/10:7/7.5/8 19:21.25:10/11/9:7.5/8/8.5 20:8:14/15/14:7/7.5/8.5
L260505=11:25:9/10/9:7.5/7.5/8 12:14:11/12/11:7/8/8.5 13:16.25:15/15/14:7/7.5/8.5 14:42.5:8/8/7/6:7/8/8.5/8.5 15:47.5:10/11/9/10:7/7.5/8/8.5
L260507=6:37.5:11/11/9:7/7.5/8.5 7:42.5:14/14/13:7/7.5/8.5 8:110:12/12/11:7/8/8.5 9:60:10/10/8:7/7.5/8 10:65:8/8/7/7:7/8/8/9
L260509=21:22.5:10/10/9:7/8/8.5 22:22:9/9/8:7/8/8 23:35:8/7/7:7.5/8/8.5 24:47.5:10/10/8:7/7.5/8 25:11.25:13/14/12:7.5/7.5/8.5
L260511=16:57.5:10/10/8/9:7/7.5/8/8.5 17:20:11/11/10:7/8/8 18:16:12/12/10:7/7.5/8.5 19:21.25:12/12/11:7/8/8.5 20:8:15/15/13:7.5/8/8.5
L260512=11:25:9/10/9:7.5/7.5/8 12:16:10/10/9:7/7.5/8 13:17.5:12/11/11:7.5/8/8 14:42.5:9/9/8/8:7.5/7.5/8.5/8.5 15:47.5:12/11/11/11:7.5/7.5/8.5/8.5
L260514=6:37.5:11/12/11:7/8/8 7:45:12/12/11:7/7.5/8 8:115:10/9/9:7/7.5/8 9:65:8/8/7:7.5/8/8 10:65:8/7/7/7:7.5/7.5/8/8.5
L260516=21:22.5:11/11/10:7/7.5/8 22:22:10/9/9:7/7.5/8 23:35:8/9/8:7/7.5/8.5 24:47.5:11/11/10:7/7.5/8 25:11.25:14/14/14:7.5/7.5/8
L260518=16:60:6/6/5/5:7/7.5/8.5/9 17:20:12/12/11:7/7.5/8.5 18:18:8/8/7:7/8/8 19:21.25:13/12/12:7/8/8 20:10:12/11/11:7/8/8.5
L260519=11:25:10/11/10:7/7.5/8 12:16:11/10/9:7/7.5/8.5 13:17.5:13/12/12:7/7.5/8.5 14:42.5:9/9/9/9:7.5/8/8.5/8.5 15:50:8/8/7/7:7/8/8/9
L260521=6:40:10/10/9:7/7.5/8 7:45:12/13/11:7.5/8/8 8:115:11/10/10:7/7.5/8.5 9:65:8/8/7:7/8/8.5 10:65:8/9/7/7:7.5/7.5/8/8.5
L260523=21:22.5:12/11/10:7.5/7.5/8 22:22:11/10/10:7.5/8/8 23:35:10/9/9:7.5/7.5/8.5 24:47.5:11/12/10:7/7.5/8.5 25:11.25:15/14/13:7/8/8.5
L260525=16:60:6/6/5/5:7/7.5/8/8.5 17:22:8/7/7:7.5/7.5/8 18:18:8/8/8:7/7.5/8 19:21.25:13/14/12:7.5/7.5/8 20:10:12/12/11:7.5/8/8
L260526=11:25:12/12/11:7/7.5/8.5 12:16:12/12/11:7/7.5/8 13:17.5:14/13/12:7/7.5/8.5 14:45:6/6/5/5:7.5/7.5/8.5/8.5 15:50:9/9/7/8:7/8/8/8.5
L260528=6:40:11/10/9:7/8/8.5 7:45:14/14/13:7/7.5/8 8:115:11/12/11:7/8/8 9:65:9/9/8:7/7.5/8.5 10:65:9/9/8/8:7/7.5/8/9
L260530=21:23.75:10/9/9:7/7.5/8 22:22:11/12/10:7.5/8/8.5 23:37.5:8/7/7:7/8/8.5 24:50:8/8/7:7/7.5/8 25:11.25:15/14/13:7.5/8/8.5
L260601=16:60:6/6/5/6:7.5/7.5/8.5/8.5 17:22:8/7/7:7/7.5/8 18:18:10/10/9:7.5/7.5/8.5 19:21.25:15/14/13:7/7.5/8 20:10:12/12/11:7/7.5/8
L260602=11:27.5:8/8/7:7.5/7.5/8 12:18:10/10/9:7/8/8 13:17.5:14/14/13:7.5/7.5/8.5 14:45:7/7/5/6:7/7.5/8/9 15:50:9/10/9/9:7/7.5/8/9
L260604=6:40:11/12/10:7/7.5/8 7:45:14/15/14:7/7.5/8 8:120:10/9/9:7.5/7.5/8 9:65:10/9/8:7/8/8 10:65:9/9/9/9:7/7.5/8.5/8.5
L260606=21:23.75:11/11/10:7.5/8/8.5 22:24:8/8/7:7/8/8 23:37.5:8/7/7:7/7.5/8 24:50:8/9/7:7/7.5/8 25:12.5:12/12/11:7/8/8
L260608=16:60:7/8/7/7:7/7.5/8/8.5 17:22:8/8/7:7/8/8.5 18:18:11/11/9:7/8/8 19:22.5:10/9/9:7.5/7.5/8.5 20:10:12/12/11:7.5/7.5/8.5
L260609=11:27.5:8/9/7:7/8/8.5 12:18:11/11/10:7.5/7.5/8 13:17.5:14/13/12:7.5/7.5/8.5 14:45:7/8/7/6:7/7.5/8.5/8.5 15:50:11/11/10/10:7.5/7.5/8/9
L260611=6:42.5:10/10/9:7/8/8.5 7:47.5:12/12/11:7/7.5/8.5 8:120:11/11/10:7/7.5/8 9:65:10/9/9:7/7.5/8 10:70:6/6/5/5:7.5/7.5/8.5/9
L260613=21:23.75:12/12/11:7.5/7.5/8 22:24:9/9/8:7/7.5/8 23:37.5:9/9/8:7/8/8 24:50:9/10/9:7/7.5/8.5 25:12.5:13/13/11:7/7.5/8
L260615=16:60:9/9/8/8:7/8/8/8.5 17:22:8/8/7:7.5/7.5/8 18:18:11/11/10:7/7.5/8.5 19:22.5:11/10/10:7/8/8.5 20:10:13/13/12:7/7.5/8.5
L260616=11:27.5:9/8/7:7/7.5/8.5 12:18:10/11/9:7/8/8.5 13:17.5:14/15/14:7.5/7.5/8 14:45:9/8/7/7:7.5/7.5/8/9 15:50:11/12/10/11:7/8/8/9
L260618=6:42.5:10/10/9:7.5/8/8.5 7:47.5:13/13/12:7.5/8/8 8:120:12/12/10:7.5/7.5/8.5 9:70:8/8/7:7/7.5/8 10:70:6/5/5/5:7.5/8/8/8.5
L260620=21:25:10/10/9:7.5/7.5/8 22:24:8/8/7:7.5/8/8 23:37.5:9/8/7:7/7.5/8.5 24:50:11/11/10:7/8/8 25:12.5:13/12/12:7/8/8
L260622=16:60:10/10/9/9:7.5/8/8/9 17:22:8/9/8:7.5/7.5/8.5 18:20:8/8/7:7/8/8 19:22.5:12/11/11:7/7.5/8.5 20:10:13/13/11:7/7.5/8
L260623=11:27.5:10/10/8:7/8/8.5 12:18:12/12/11:7.5/7.5/8 13:18.75:12/12/11:7/7.5/8.5 14:45:9/10/9/9:7/7.5/8/8.5 15:52.5:8/7/7/7:7/7.5/8.5/8.5
L260625=6:42.5:11/11/10:7/7.5/8 7:47.5:12/13/12:7/8/8.5 8:120:12/12/11:7/7.5/8 9:70:8/9/8:7/8/8 10:70:7/7/5/6:7.5/7.5/8.5/8.5
L260627=21:25:11/11/9:7.5/8/8 22:24:10/9/9:7.5/8/8.5 23:37.5:10/9/9:7.5/7.5/8.5 24:50:11/10/10:7/7.5/8 25:12.5:14/13/13:7.5/7.5/8.5
L260629=16:62.5:6/5/5/5:7/7.5/8.5/9 17:22:10/10/9:7.5/7.5/8 18:20:9/9/8:7.5/8/8.5 19:22.5:12/12/10:7/7.5/8 20:10:13/14/13:7/7.5/8.5
L260630=11:27.5:11/11/10:7/7.5/8.5 12:20:10/10/9:7.5/7.5/8 13:18.75:13/13/12:7/8/8.5 14:47.5:6/6/5/5:7/7.5/8.5/9 15:52.5:9/9/7/7:7/7.5/8.5/8.5
L260702=6:42.5:12/11/11:7/8/8.5 7:47.5:13/14/13:7/7.5/8.5 8:125:10/10/9:7/8/8 9:70:10/9/9:7.5/8/8 10:70:7/7/7/7:7/7.5/8/8.5
L260704=21:25:12/11/11:7/7.5/8.5 22:24:10/10/9:7.5/7.5/8.5 23:40:8/8/7:7.5/7.5/8 24:50:12/12/10:7/8/8 25:12.5:14/15/14:7/7.5/8.5
L260706=16:62.5:7/7/6/5:7.5/7.5/8/9 17:22:11/11/9:7/8/8.5 18:20:10/9/8:7/8/8.5 19:22.5:13/13/11:7.5/7.5/8.5 20:10:15/15/14:7/7.5/8
L260707=11:27.5:11/11/11:7.5/7.5/8 12:20:11/10/10:7/7.5/8.5 13:18.75:14/14/13:7.5/8/8 14:47.5:7/7/6/6:7/8/8/8.5 15:52.5:10/9/9/9:7/8/8/8.5
L260709=6:45:10/10/9:7/7.5/8 7:47.5:14/14/14:7.5/8/8.5 8:125:10/11/10:7/7.5/8.5 9:75:8/8/7:7.5/8/8 10:70:9/8/8/7:7/7.5/8/9
L260711=21:26.25:10/10/9:7/8/8.5 22:24:12/11/10:7.5/7.5/8 23:40:9/8/8:7/8/8 24:52.5:8/8/7:7.5/7.5/8 25:13.75:12/12/11:7/7.5/8.5
L260713=16:62.5:8/8/6/6:7.5/7.5/8/8.5 17:22:12/12/11:7.5/8/8.5 18:20:11/10/10:7/8/8 19:22.5:14/14/13:7/8/8.5 20:10:15/15/13:7.5/8/8.5
L260714=11:30:8/7/7:7/7.5/8 12:20:11/12/10:7/7.5/8.5 13:18.75:15/14/13:7/8/8 14:47.5:7/8/6/7:7.5/8/8/8.5 15:52.5:10/10/10/9:7/8/8/8.5
L260716=6:45:11/10/10:7.5/8/8 7:50:12/12/11:7.5/8/8 8:125:12/12/11:7/7.5/8 9:75:8/8/7:7/7.5/8 10:70:9/10/9/8:7/7.5/8/9
L260718=21:26.25:10/10/9:7/7.5/8 22:26:8/7/7:7.5/7.5/8.5 23:40:10/10/9:7/7.5/8 24:52.5:9/9/8:7/7.5/8 25:13.75:13/13/11:7/7.5/8.5
L260720=16:62.5:9/9/7/8:7/8/8/8.5 17:22:11/12/11:7/7.5/8 18:20:12/11/11:7.5/8/8.5 19:22.5:15/14/13:7.5/7.5/8.5 20:12:12/12/11:7/7.5/8
L260721=11:30:9/8/7:7/8/8.5 12:22:10/9/9:7/8/8 13:18.75:15/15/13:7.5/8/8.5 14:47.5:9/9/8/8:7.5/8/8/8.5 15:52.5:12/12/10/11:7.5/7.5/8/9
L260723=6:45:12/12/11:7/7.5/8 7:50:12/12/11:7/7.5/8 8:130:10/9/9:7.5/8/8 9:75:8/7/7:7.5/7.5/8 10:75:6/6/5/5:7/7.5/8/9
L260725=21:26.25:10/11/10:7.5/7.5/8.5 22:26:9/8/8:7.5/7.5/8 23:42.5:8/8/7:7.5/8/8.5 24:52.5:9/10/8:7/7.5/8 25:13.75:13/14/13:7/7.5/8.5
L260727=16:62.5:10/10/9/9:7.5/7.5/8.5/9 17:22:11/12/11:7/7.5/8 18:22:8/7/7:7/8/8.5 19:23.75:10/10/9:7.5/8/8 20:12:12/12/11:7.5/7.5/8
L260728=11:30:9/9/8:7.5/7.5/8 12:22:11/10/10:7.5/8/8 13:20:12/12/11:7.5/7.5/8 14:47.5:8/9/8/7:7/7.5/8.5/9 15:55:8/8/7/7:7/8/8.5/8.5
L260730=6:47.5:10/10/9:7.5/8/8 7:50:12/13/12:7/7.5/8 8:130:10/10/9:7.5/7.5/8 9:75:9/9/7:7/8/8 10:75:7/6/6/6:7/7.5/8/8.5
L260801=21:26.25:11/12/11:7/7.5/8 22:26:10/9/9:7.5/8/8.5 23:42.5:8/8/7:7/7.5/8.5 24:52.5:11/10/10:7/7.5/8 25:13.75:14/15/14:7/8/8.5
L260817=16:65:6/6/5/5:7.5/7.5/8/8.5 17:24:8/8/7:7.5/7.5/8 18:22:9/8/8:7/8/8.5 19:23.75:10/10/9:7/7.5/8.5 20:12:12/12/11:7/7.5/8
L260818=11:30:10/9/8:7/7.5/8 12:22:12/11/11:7/7.5/8 13:20:13/13/12:7/7.5/8 14:47.5:8/9/8/8:7/8/8/9 15:55:9/9/8/8:7/7.5/8/9
L260820=6:47.5:11/11/10:7/7.5/8.5 7:50:14/14/13:7/7.5/8 8:130:11/10/10:7/7.5/8 9:75:10/10/9:7/8/8.5 10:75:7/8/6/6:7.5/7.5/8/8.5
L260822=21:26.25:12/11/10:7/8/8.5 22:26:10/11/9:7.5/8/8 23:42.5:10/10/9:7/7.5/8 24:52.5:11/11/11:7/8/8 25:13.75:15/15/14:7/7.5/8
L260824=16:65:6/6/5/6:7.5/7.5/8/9 17:24:9/9/8:7/7.5/8 18:22:9/9/8:7.5/7.5/8 19:23.75:12/11/11:7/7.5/8 20:12:12/12/11:7/8/8
L260825=11:30:10/11/10:7/7.5/8 12:24:10/10/9:7.5/7.5/8.5 13:20:13/13/13:7.5/8/8 14:47.5:10/10/9/8:7/8/8/8.5 15:55:10/10/8/8:7.5/7.5/8.5/9
L260827=6:47.5:11/12/11:7.5/7.5/8.5 7:50:15/15/14:7.5/7.5/8 8:130:12/12/10:7/7.5/8 9:80:8/7/7:7/7.5/8 10:75:8/9/8/7:7/7.5/8.5/9
L260829=21:27.5:10/10/9:7/7.5/8 22:26:12/12/11:7/7.5/8 23:45:8/8/7:7/8/8 24:55:8/7/7:7/8/8.5 25:15:12/12/11:7/8/8
L260831=16:65:8/8/6/6:7/7.5/8/9 17:24:10/10/8:7.5/7.5/8.5 18:22:10/10/9:7/7.5/8 19:23.75:12/13/12:7.5/7.5/8.5 20:12:12/12/11:7.5/7.5/8.5
L260901=11:30:12/12/11:7/7.5/8.5 12:24:11/11/10:7/7.5/8 13:20:15/14/14:7.5/7.5/8.5 14:50:6/6/5/5:7.5/8/8.5/9 15:55:10/11/10/10:7/7.5/8.5/9
L260903=6:50:10/10/9:7/8/8 7:52.5:12/12/11:7.5/7.5/8 8:135:10/9/9:7/8/8 9:80:9/9/8:7/7.5/8 10:75:10/10/9/9:7/7.5/8/9
L260905=21:27.5:11/11/10:7/7.5/8 22:26:12/12/11:7/7.5/8 23:45:8/8/8:7/8/8 24:55:9/9/8:7/7.5/8.5 25:15:13/12/12:7/7.5/8
L260907=16:65:9/8/8/8:7/7.5/8/8.5 17:24:11/11/9:7/8/8.5 18:22:11/11/10:7/8/8 19:23.75:12/13/12:7/8/8 20:12:12/12/11:7/7.5/8.5
L260908=11:32.5:8/8/7:7/7.5/8.5 12:24:10/11/10:7.5/8/8.5 13:20:15/14/14:7.5/7.5/8.5 14:50:7/7/6/6:7.5/8/8/8.5 15:55:11/11/9/10:7/7.5/8/8.5
L260910=6:50:10/11/9:7.5/7.5/8 7:52.5:12/11/11:7.5/7.5/8 8:135:11/10/10:7/7.5/8 9:80:10/10/9:7.5/7.5/8.5 10:80:6/6/5/5:7/7.5/8/8.5
L260912=21:27.5:11/11/9:7.5/8/8 22:28:8/7/7:7/7.5/8.5 23:45:10/9/9:7/8/8 24:55:9/10/8:7.5/7.5/8.5 25:15:13/12/11:7.5/7.5/8
L260914=16:65:10/10/9/8:7/8/8.5/9 17:24:12/12/11:7/7.5/8 18:22:12/12/11:7/8/8 19:23.75:14/14/12:7/8/8.5 20:12:12/13/12:7/7.5/8
L260915=11:32.5:9/9/7:7/8/8.5 12:24:11/11/11:7/7.5/8 13:21.25:12/11/11:7/7.5/8 14:50:8/8/6/7:7.5/7.5/8.5/9 15:55:12/12/11/11:7/7.5/8/8.5
L260917=6:50:10/11/9:7/8/8 7:52.5:13/13/12:7/7.5/8 8:135:12/12/11:7/7.5/8 9:85:8/8/7:7/7.5/8.5 10:80:7/7/6/5:7/7.5/8/9
L260919=21:27.5:10/10/10:7.5/8/8 22:28:8/7/7:7.5/7.5/8.5 23:47.5:8/7/7:7/8/8.5 24:55:10/10/9:7/7.5/8 25:15:14/14/12:7/7.5/8
L260921=16:67.5:6/6/5/5:7/7.5/8.5/8.5 17:26:8/7/7:7/7.5/8.5 18:24:8/8/7:7/8/8.5 19:23.75:15/15/14:7/7.5/8.5 20:12:13/13/11:7.5/7.5/8.5
L260922=11:32.5:9/9/8:7/7.5/8 12:26:10/9/9:7.5/7.5/8 13:21.25:13/13/12:7/8/8 14:50:9/9/8/7:7/7.5/8.5/9 15:57.5:8/8/7/7:7/7.5/8.5/9
L260924=6:50:12/12/11:7/7.5/8 7:52.5:13/14/13:7/7.5/8.5 8:140:10/10/9:7/8/8 9:85:8/9/8:7/8/8 10:80:7/8/7/7:7.5/7.5/8/9
L260926=21:27.5:11/11/10:7.5/7.5/8.5 22:28:9/8/8:7/7.5/8 23:47.5:8/8/7:7/7.5/8 24:55:12/12/10:7/7.5/8.5 25:15:14/14/14:7/7.5/8.5
L260928=16:67.5:6/5/5/5:7.5/7.5/8/8.5 17:26:8/7/7:7/8/8 18:24:9/8/7:7.5/7.5/8.5 19:25:10/10/9:7.5/7.5/8.5 20:12:13/12/12:7/7.5/8
L260929=11:32.5:9/9/8:7/7.5/8 12:26:10/11/10:7.5/7.5/8 13:21.25:13/14/12:7/8/8 14:50:10/10/9/8:7/7.5/8/8.5 15:57.5:9/9/8/8:7.5/8/8.5/9
L261001=6:50:12/12/11:7.5/8/8.5 7:52.5:15/15/14:7/7.5/8 8:140:11/10/9:7/8/8.5 9:85:10/10/9:7/8/8 10:80:8/9/8/8:7/7.5/8.5/8.5
L261003=21:27.5:12/12/11:7/8/8 22:28:10/10/9:7/8/8 23:47.5:8/8/7:7/8/8.5 24:57.5:8/8/7:7/7.5/8.5 25:16.25:12/12/11:7/7.5/8.5
L261005=16:67.5:6/6/6/6:8.5/8.5/9/9 17:26:9/9/7:7/8/8 18:24:10/10/8:7/7.5/8.5 19:25:11/11/10:7/7.5/8 20:12:14/13/13:7/7.5/8
L261006=11:32.5:10/11/9:7/8/8.5 12:26:12/12/10:7.5/8/8 13:21.25:15/15/14:7/7.5/8.5 14:52.5:6/5/5/5:7/7.5/8/8.5 15:57.5:10/9/9/8:7/8/8/8.5
L261008=6:52.5:10/10/9:7/8/8 7:52.5:15/15/13:7.5/8/8 8:140:12/11/11:7/7.5/8 9:85:10/9/9:7/7.5/8 10:80:10/10/9/9:7/7.5/8.5/8.5
L261010=21:28.75:10/10/9:7/7.5/8 22:28:11/11/10:7/7.5/8 23:47.5:9/9/7:7/8/8 24:57.5:8/9/8:7/8/8 25:16.25:13/13/12:7.5/8/8
L261012=16:67.5:6/6/6/6:8.5/8.5/9/9 17:26:10/9/9:7.5/7.5/8 18:24:10/10/10:7/8/8 19:25:12/12/11:7/7.5/8 20:12:14/14/12:7.5/8/8
L261013=11:32.5:12/12/11:7/7.5/8 12:28:10/9/9:7/7.5/8.5 13:22.5:12/12/11:7/8/8.5 14:52.5:7/6/5/6:7/8/8/9 15:57.5:10/10/9/10:7.5/8/8/9
L261015=6:52.5:10/11/10:7.5/7.5/8 7:52.5:15/14/13:7/8/8 8:145:10/9/9:7.5/8/8.5 9:90:8/8/7:7/7.5/8.5 10:85:6/6/5/5:7/7.5/8/8.5
L261017=21:28.75:11/11/10:7.5/7.5/8 22:28:12/12/11:7.5/7.5/8 23:47.5:10/10/8:7/8/8.5 24:57.5:9/8/7:7.5/7.5/8 25:16.25:14/14/13:7.5/7.5/8
L261019=16:67.5:6/6/6/6:8.5/8.5/9/9 17:26:11/10/10:7/8/8.5 18:24:11/11/10:7/7.5/8.5 19:25:12/13/11:7/8/8 20:12:14/14/12:7/8/8.5
L261020=11:35:8/7/7:7.5/8/8 12:28:11/11/9:7.5/8/8.5 13:22.5:13/13/12:7.5/8/8.5 14:52.5:7/6/5/6:7.5/8/8/8.5 15:57.5:12/11/10/11:7/8/8.5/9
L261022=6:52.5:11/11/10:7.5/7.5/8.5 7:55:12/11/11:7.5/7.5/8.5 8:145:11/10/10:7/7.5/8 9:90:9/8/8:7/7.5/8 10:85:7/7/5/6:7/7.5/8/8.5
L261024=21:28.75:10/11/10:7.5/7.5/8 22:30:8/8/7:7/8/8 23:50:8/7/7:7.5/8/8.5 24:57.5:10/9/8:7/8/8.5 25:16.25:15/15/14:7/8/8
L261026=16:67.5:6/6/6/6:9/9/9.5/9.5 17:26:11/11/10:7/8/8 18:26:8/8/7:7.5/8/8.5 19:25:14/14/13:7.5/8/8 20:12:13/14/12:7.5/7.5/8
L261027=11:35:9/9/7:7/8/8 12:28:11/11/11:7/8/8 13:22.5:13/14/12:7.5/7.5/8 14:52.5:7/8/6/7:7.5/7.5/8/8.5 15:60:8/8/7/7:7.5/7.5/8/9
L261029=6:55:10/10/9:7.5/7.5/8 7:55:13/13/12:7.5/8/8 8:145:11/11/10:7/7.5/8.5 9:90:10/10/9:7.5/7.5/8.5 10:85:8/7/6/7:7.5/7.5/8/9
L261031=21:28.75:12/12/10:7.5/7.5/8 22:30:9/9/8:7/8/8.5 23:50:8/7/7:7/7.5/8.5 24:57.5:10/11/9:7.5/8/8 25:16.25:15/15/14:7/7.5/8.5
L261102=16:67.5:6/6/6/6:9/9/9.5/9.5 17:26:11/11/11:7.5/7.5/8.5 18:26:9/9/7:7/7.5/8.5 19:25:15/15/13:7/8/8 20:12:13/14/12:7/7.5/8.5
L261103=11:35:9/10/9:7/7.5/8 12:30:10/9/9:7/8/8.5 13:22.5:15/15/13:7/8/8 14:52.5:8/8/7/6:7.5/7.5/8/9 15:60:9/8/8/8:7/8/8.5/9
L261105=6:55:11/10/10:7/7.5/8.5 7:55:14/14/12:7.5/7.5/8.5 8:150:10/9/9:7/7.5/8.5 9:95:8/7/7:7.5/7.5/8 10:85:9/9/7/8:7/8/8.5/8.5
L261107=21:30:10/9/9:7.5/8/8.5 22:30:9/9/9:7/8/8.5 23:50:8/9/8:7.5/7.5/8.5 24:57.5:12/12/10:7/8/8 25:17.5:12/11/11:7.5/7.5/8
$perf$);
with l as (select regexp_split_to_table(t, E'\n') s from _perf_txt), s as (
  select case left(s,1) when 'J' then '3' else 'demo_4_lucas' end aid,
         to_date('20' || substr(s,2,6), 'YYYYMMDD') d, split_part(s,'=',2) body from l where s like '_%=%'),
e as (select aid, d, regexp_split_to_table(body, ' ') ex from s),
p as (select aid, d, split_part(ex,':',1)::int k, nullif(split_part(ex,':',2),'')::numeric charge,
             string_to_array(split_part(ex,':',3), '/') reps,
             string_to_array(coalesce(nullif(split_part(ex,':',4),''), '7/8/9'), '/') rpe from e)
insert into public.performances (date, semaine, seance_id, nom, athlete_id, exercice, muscle, exercice_id, serie, charge, reps, rpe, repos, volume)
select p.d + (select j from _seed_off), extract(week from p.d + (select j from _seed_off))::int, c.seance_id, c.nom, p.aid, c.exercice, c.muscle, c.exercice_id,
       i, p.charge, p.reps[i]::int, p.rpe[i]::numeric, c.repos, round(coalesce(p.charge,0) * p.reps[i]::int)
from p join _combo c on c.k = p.k, generate_subscripts(p.reps, 1) i;

-- Bien-être (sommeil,energie,fatigue,douleur,zone,ressenti,note,motivation,stress,courbatures)
create temp table _be_txt (t text) on commit drop;
insert into _be_txt values ($be$
J251109=4,4,4,,,,,4,,
J251111=3,3,4,,,,,4,,
J251113=3,5,2,,,,,5,,
J251116=5,5,3,,,,,3,,
J251118=3,5,4,,,,,5,,
J251120=4,4,3,,,,,4,,
J251123=3,4,3,,,,,4,,
J251125=5,5,3,,,,,5,,
J251127=3,4,3,,,,,3,,
J251130=4,3,4,,,,,3,,
J251202=4,5,3,,,,,5,,
J251204=4,4,3,,,,,4,,
J251207=3,4,4,,,,,3,,
J251209=4,3,3,,,,,4,,
J251211=5,4,3,,,,,5,,
J251214=5,5,3,,,,,4,,
J251216=4,4,2,,,,,5,,
J251218=4,5,2,,,,,3,,
J251221=4,5,4,,,,,4,,
J251223=5,4,4,,,,,4,,
J251225=3,5,4,,,,,4,,
J251228=3,5,2,,,,,4,,
J251230=4,4,1,,,,,5,,
J260101=4,3,2,,,,,3,,
J260104=5,4,3,,,,,4,,
J260106=4,3,2,,,,,4,,
J260108=3,3,3,,,,,3,,
J260111=5,4,3,,,,,4,,
J260113=5,3,3,,,,,5,,
J260115=3,4,4,,,,,5,,
J260118=4,5,3,,,,,4,,
J260120=4,5,2,,,,,5,,
J260122=4,5,3,,,,,3,,
J260125=4,3,3,,,,,4,,
J260127=5,3,3,,,,,3,,
J260129=4,4,2,,,,,4,,
J260201=4,5,4,,,,,4,,
J260203=4,5,4,,,,,3,,
J260205=3,4,3,,,,,3,,
J260208=5,3,3,,,,,4,,
J260210=3,4,3,,,,,4,,
J260212=4,4,3,,,,,5,,
J260215=4,4,2,,,,,5,,
J260217=4,4,4,,,,,4,,
J260219=5,4,3,,,,,3,,
J260222=5,4,2,,,,,5,,
J260224=3,4,2,,,,,3,,
J260226=5,4,2,,,,,5,,
J260301=3,4,3,,,,,5,,
J260303=5,4,3,,,,,5,,
J260305=5,5,3,,,,,3,,
J260308=4,3,2,,,,,4,,
J260310=4,4,3,,,,,4,,
J260312=5,4,3,,,,,3,,
J260315=3,4,2,,,,,3,,
J260317=3,4,4,,,,,4,,
J260319=5,4,3,,,,,5,,
J260322=4,4,3,,,,,4,,
J260324=4,5,3,,,,,4,,
J260326=4,5,3,,,,,3,,
J260329=3,4,3,,,,,5,,
J260331=3,4,3,,,,,5,,
J260402=3,4,4,,,,,4,,
J260405=4,3,3,,,,,4,,
J260407=5,4,4,,,,,3,,
J260409=4,5,4,,,,,3,,
J260412=4,5,2,,,,,4,,
J260414=3,3,2,,,,,3,,
J260416=4,4,3,,,,,5,,
J260419=4,3,2,,,,,4,,
J260421=5,4,2,,,,,5,,
J260423=4,3,2,,,,,3,,
J260426=4,5,3,,,,,4,,
J260428=4,5,2,,,,,4,,
J260430=3,5,3,,,,,5,,
J260503=4,5,3,,,,,4,,
J260505=3,3,2,,,,,4,,
J260507=4,5,3,,,,,5,,
J260510=5,5,3,,,,,4,,
J260512=4,5,4,,,,,5,,
J260514=3,5,3,,,,,5,,
J260517=4,5,3,,,,,3,,
J260519=5,3,3,,,,,3,,
J260521=4,4,2,,,,,3,,
J260524=4,4,2,,,,,4,,
J260526=4,4,3,,,,,3,,
J260528=4,4,3,,,,,4,,
J260531=5,5,4,,,,,4,,
J260602=4,3,3,,,,,4,,
J260604=4,3,2,,,,,3,,
J260607=5,4,4,,,,,5,,
J260609=4,4,4,,,,,4,,
J260611=4,4,4,,,,,5,,
J260614=5,4,2,,,,,4,,
J260616=5,5,1,,,,,3,,
J260618=3,4,1,,,,,4,,
J260621=5,4,4,,,,,5,,
J260623=4,5,2,,,,,3,,
J260625=3,4,4,,,,,3,,
J260628=4,4,4,,,,,4,,
J260630=4,3,3,,,,,4,,
J260702=5,5,2,,,,,4,,
J260705=5,4,3,,,,,4,,
J260707=3,4,4,,,,,3,,
J260709=3,4,4,,,,,4,,
J260712=5,5,3,,,,,4,,
J260714=3,5,3,,,,,4,,
J260716=4,4,3,,,,,4,,
J260719=3,5,2,,,,,4,,
J260721=4,4,3,,,,,4,,
J260723=5,5,3,,,,,4,,
J260726=4,5,3,,,,,4,,
J260728=4,4,2,,,,,5,,
J260730=4,4,4,,,,,4,,
J260802=3,4,2,,,,,4,,
J260804=3,3,3,,,,,4,,
J260806=5,4,4,,,,,4,,
J260809=5,4,1,,,,,4,,
J260811=5,4,1,,,,,4,,
J260813=3,3,2,,,,,3,,
J260816=4,5,3,,,,,5,,
J260818=4,4,2,,,,,4,,
J260820=4,4,2,,,,,4,,
J260823=3,3,3,,,,,4,,
J260825=5,5,3,,,,,4,,
J260827=5,4,4,,,,,5,,
J260830=4,3,2,,,,,5,,
J260901=3,5,3,,,,,3,,
J260903=3,4,3,,,,,3,,
J260906=5,5,4,,,,,3,,
J260908=3,4,3,,,,,5,,
J260910=3,3,2,,,,,5,,
J260913=5,4,2,,,,,4,,
J260915=4,3,2,,,,,4,,
J260917=4,4,4,,,,,5,,
J260920=4,4,3,,,,,5,,
J260922=5,4,2,,,,,4,,
J260924=4,4,4,,,,,3,,
J260927=4,4,4,,,,,4,,
J260929=4,4,3,,,,,5,,
J261001=4,3,3,,,,,3,,
J261004=5,4,2,,,,,3,,
J261006=3,5,1,,,,,3,,
J261008=5,5,2,,,,,3,,
J261011=5,5,4,,,,,3,,
J261013=5,3,4,,,,,4,,
J261015=3,4,2,,,,,4,,
J261018=4,3,4,,,,,4,,
J261020=5,4,3,,,,,5,,
J261022=4,4,3,,,,,4,,
J261025=4,3,3,,,,,5,,
J261027=4,3,3,,,,,4,,
J261029=4,5,4,,,,,5,,
J261101=4,4,3,,,,,5,,
J261103=3,3,3,,,,,4,,
J261105=4,4,4,,,,,4,,
L260309=4,,2,1,,4,,,1,1
L260310=3,,2,1,,3,,,1,1
L260312=4,,1,1,,4,,,2,1
L260314=3,,2,1,,3,,,2,1
L260316=4,,2,1,,4,,,2,2
L260317=5,,2,1,,4,,,2,1
L260319=3,,1,1,,3,,,2,1
L260321=4,,2,1,,4,,,1,1
L260323=4,,2,1,,4,,,1,2
L260324=4,,1,1,,4,,,2,2
L260326=5,,2,1,,4,,,1,2
L260328=4,,2,1,,4,,,2,2
L260330=5,,2,1,,4,,,1,2
L260331=3,,2,1,,3,,,2,1
L260402=4,,2,1,,4,,,2,2
L260404=4,,2,1,,4,,,2,2
L260406=5,,2,1,,4,,,2,2
L260407=3,,2,1,,3,,,2,2
L260409=4,,2,1,,4,,,2,2
L260411=5,,2,1,,4,,,1,2
L260413=5,,2,1,,4,,,2,1
L260414=4,,2,1,,4,,,2,1
L260416=3,,1,1,,3,,,2,2
L260418=5,,1,1,,4,,,1,2
L260420=5,,2,1,,4,,,2,1
L260421=5,,1,1,,4,,,1,1
L260423=4,,2,1,,4,,,2,2
L260425=3,,2,1,,3,,,2,2
L260427=4,,1,1,,4,,,2,1
L260428=4,,2,1,,4,,,2,2
L260430=4,,2,1,,4,,,2,1
L260502=5,,2,1,,4,,,2,1
L260504=5,,2,1,,4,,,1,2
L260505=4,,2,1,,4,,,1,1
L260507=5,,2,1,,4,,,1,1
L260509=5,,2,1,,4,,,1,2
L260511=4,,2,1,,4,,,2,2
L260512=5,,1,1,,4,,,1,1
L260514=5,,2,1,,4,,,2,1
L260516=5,,2,1,,4,,,2,2
L260518=4,,1,1,,4,,,1,1
L260519=5,,2,1,,4,,,1,2
L260521=3,,2,1,,3,,,2,2
L260523=4,,1,1,,4,,,1,2
L260525=5,,1,1,,4,,,1,2
L260526=5,,2,1,,4,,,2,1
L260528=5,,1,1,,4,,,1,2
L260530=4,,1,1,,4,,,2,1
L260601=4,,2,1,,4,,,2,1
L260602=5,,2,1,,4,,,2,1
L260604=4,,2,1,,4,,,2,2
L260606=4,,1,1,,4,,,1,2
L260608=4,,1,1,,4,,,2,1
L260609=4,,2,1,,4,,,1,2
L260611=4,,2,1,,4,,,1,2
L260613=5,,2,1,,4,,,1,1
L260615=3,,1,1,,3,,,2,2
L260616=3,,2,1,,3,,,2,1
L260618=5,,2,1,,4,,,2,2
L260620=4,,2,1,,4,,,1,2
L260622=5,,2,1,,4,,,1,2
L260623=5,,2,1,,4,,,2,1
L260625=3,,2,1,,3,,,2,1
L260627=3,,1,1,,3,,,1,1
L260629=3,,1,1,,3,,,2,1
L260630=4,,1,1,,4,,,1,1
L260702=5,,2,1,,4,,,2,1
L260704=5,,1,1,,4,,,2,1
L260706=5,,1,1,,4,,,2,2
L260707=4,,2,1,,4,,,2,2
L260709=3,,2,1,,3,,,2,1
L260711=3,,1,1,,3,,,2,2
L260713=3,,2,1,,3,,,1,1
L260714=3,,2,1,,3,,,2,1
L260716=3,,2,1,,3,,,2,2
L260718=5,,2,1,,4,,,2,2
L260720=5,,2,1,,4,,,1,2
L260721=3,,2,1,,3,,,2,2
L260723=5,,2,1,,4,,,2,1
L260725=4,,2,1,,4,,,2,2
L260727=4,,1,1,,4,,,1,2
L260728=5,,2,1,,4,,,2,2
L260730=3,,2,1,,3,,,1,1
L260801=4,,2,1,,4,,,1,1
L260817=3,,2,1,,3,,,2,1
L260818=4,,1,1,,4,,,2,2
L260820=4,,2,1,,4,,,1,1
L260822=3,,2,1,,3,,,2,1
L260824=3,,2,1,,3,,,2,2
L260825=4,,1,1,,4,,,1,1
L260827=3,,1,1,,3,,,1,1
L260829=4,,2,1,,4,,,1,2
L260831=5,,2,1,,4,,,1,1
L260901=4,,2,1,,4,,,1,1
L260903=5,,2,1,,4,,,1,1
L260905=5,,2,1,,4,,,2,2
L260907=5,,2,1,,4,,,2,2
L260908=4,,2,1,,4,,,1,2
L260910=4,,1,1,,4,,,1,2
L260912=4,,2,1,,4,,,1,1
L260914=5,,1,1,,4,,,1,2
L260915=5,,2,1,,4,,,2,1
L260917=4,,1,1,,4,,,2,1
L260919=5,,1,1,,4,,,1,1
L260921=3,,1,1,,3,,,1,2
L260922=5,,2,1,,4,,,2,2
L260924=3,,2,1,,3,,,1,1
L260926=3,,1,1,,3,,,2,2
L260928=4,,1,1,,4,,,1,1
L260929=4,,2,1,,4,,,1,2
L261001=5,,1,1,,4,,,2,1
L261003=4,,1,1,,4,,,2,2
L261005=4,,1,1,,4,,,1,1
L261006=4,,2,1,,4,,,1,1
L261008=4,,2,1,,4,,,2,2
L261010=5,,2,1,,4,,,1,1
L261012=4,,1,1,,4,,,1,2
L261013=4,,1,1,,4,,,2,2
L261015=4,,2,1,,4,,,2,1
L261017=3,,2,1,,3,,,2,1
L261019=4,,2,1,,4,,,2,1
L261020=4,,2,1,,4,,,1,1
L261022=5,,2,1,,4,,,2,2
L261024=4,,1,2,Epaule,4,,,1,2
L261026=3,,3,2,Epaule,3,,,3,2
L261027=2,,3,3,Epaule,3,,,3,2
L261029=3,,4,3,Epaule,3,,,3,3
L261031=3,,4,3,Epaule,3,,,3,3
L261102=2,,4,3,Epaule,3,,,3,2
L261103=3,,3,3,Epaule,3,,,3,2
L261105=3,,4,3,Epaule,3,,,3,2
L261107=3,,3,3,Epaule,3,,,3,3
$be$);
with l as (select regexp_split_to_table(t, E'\n') s from _be_txt), s as (
  select case left(s,1) when 'J' then '3' else 'demo_4_lucas' end aid, to_date('20' || substr(s,2,6), 'YYYYMMDD') d,
         string_to_array(split_part(s,'=',2), ',') v from l where s like '_%=%')
insert into public.bien_etre (date, athlete_id, sommeil, energie, fatigue_musculaire, douleur, zone_douloureuse, ressenti_global, note, motivation, stress, courbatures)
select d + (select j from _seed_off), aid, nullif(v[1],'')::numeric, nullif(v[2],'')::numeric, nullif(v[3],'')::numeric, nullif(v[4],'')::numeric,
       nullif(v[5],''), nullif(v[6],''), nullif(v[7],'')::numeric, nullif(v[8],'')::smallint, nullif(v[9],'')::smallint, nullif(v[10],'')::smallint from s;

-- Indicateurs (cardio, Hyrox, préférences) : séance|source=cle:valeur,…  (unités par clé)
create temp table _unite (cle text primary key, unite text) on commit drop;
insert into _unite values ('calories','kcal'),('distance','km'),('duree','min'),('fc_moy','bpm'),('hyrox_burpees','s'),('hyrox_division',''),('hyrox_farmers','s'),('hyrox_lunges','s'),('hyrox_mode',''),('hyrox_poids_farm','kg'),('hyrox_poids_pull','kg'),('hyrox_poids_push','kg'),('hyrox_poids_sand','kg'),('hyrox_poids_wall','kg'),('hyrox_row','s'),('hyrox_run1','s'),('hyrox_run2','s'),('hyrox_run3','s'),('hyrox_run4','s'),('hyrox_run5','s'),('hyrox_run6','s'),('hyrox_run7','s'),('hyrox_run8','s'),('hyrox_skierg','s'),('hyrox_sledpull','s'),('hyrox_sledpush','s'),('hyrox_total','s'),('hyrox_wallballs','s'),('onboarding_vu',''),('puissance_moy','W'),('ressenti_cardio',''),('rpe',''),('type_cardio',''),('vitesse_moy','km/h');
create temp table _ind_txt (t text) on commit drop;
insert into _ind_txt values ($ind$
J251112|cardio_johnseed_2|saisie=calories:416,distance:6.0,duree:42,fc_moy:166,ressenti_cardio:2,rpe:6,type_cardio:footing,vitesse_moy:8.6
J251114|cardio_johnseed_3|saisie=calories:405,distance:20.0,duree:50,fc_moy:146,puissance_moy:150,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:24.0
J251115|cardio_hyrox_johnseed_1|saisie=distance:8,duree:90,hyrox_burpees:280,hyrox_division:mo,hyrox_farmers:305,hyrox_lunges:308,hyrox_mode:course,hyrox_poids_farm:24,hyrox_poids_pull:103,hyrox_poids_push:152,hyrox_poids_sand:20,hyrox_poids_wall:6,hyrox_row:333,hyrox_run1:356,hyrox_run2:364,hyrox_run3:353,hyrox_run4:394,hyrox_run5:338,hyrox_run6:395,hyrox_run7:342,hyrox_run8:380,hyrox_skierg:315,hyrox_sledpull:279,hyrox_sledpush:316,hyrox_total:5400,hyrox_wallballs:303,rpe:8,type_cardio:hyrox
J251119|cardio_johnseed_5|saisie=calories:416,distance:6.1,duree:42,fc_moy:166,ressenti_cardio:3,rpe:7,type_cardio:footing,vitesse_moy:8.7
J251121|cardio_johnseed_6|saisie=calories:405,distance:20.3,duree:50,fc_moy:146,puissance_moy:151,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:24.4
J251126|cardio_johnseed_8|saisie=calories:416,distance:6.2,duree:42,fc_moy:165,ressenti_cardio:2,rpe:7,type_cardio:footing,vitesse_moy:8.9
J251128|cardio_johnseed_9|saisie=calories:413,distance:20.5,duree:51,fc_moy:146,puissance_moy:152,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:24.1
J251203|cardio_johnseed_11|saisie=calories:426,distance:6.2,duree:43,fc_moy:165,ressenti_cardio:2,rpe:7,type_cardio:footing,vitesse_moy:8.7
J251205|cardio_johnseed_12|saisie=calories:413,distance:20.8,duree:51,fc_moy:145,puissance_moy:153,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:24.5
J251206|cardio_hyrox_johnseed_4|saisie=distance:8,duree:89,hyrox_burpees:279,hyrox_division:mo,hyrox_farmers:301,hyrox_lunges:275,hyrox_mode:course,hyrox_poids_farm:24,hyrox_poids_pull:103,hyrox_poids_push:152,hyrox_poids_sand:20,hyrox_poids_wall:6,hyrox_row:286,hyrox_run1:354,hyrox_run2:389,hyrox_run3:350,hyrox_run4:347,hyrox_run5:346,hyrox_run6:364,hyrox_run7:336,hyrox_run8:343,hyrox_skierg:306,hyrox_sledpull:285,hyrox_sledpush:295,hyrox_total:5340,hyrox_wallballs:276,rpe:8,type_cardio:hyrox
J251210|cardio_johnseed_14|saisie=calories:426,distance:6.3,duree:43,fc_moy:165,ressenti_cardio:3,rpe:7,type_cardio:footing,vitesse_moy:8.8
J251212|cardio_johnseed_15|saisie=calories:413,distance:21.1,duree:51,fc_moy:145,puissance_moy:154,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:24.8
J251217|cardio_johnseed_17|saisie=calories:426,distance:6.4,duree:43,fc_moy:165,ressenti_cardio:2,rpe:6,type_cardio:footing,vitesse_moy:8.9
J251219|cardio_johnseed_18|saisie=calories:421,distance:21.4,duree:52,fc_moy:145,puissance_moy:154,ressenti_cardio:2,rpe:7,type_cardio:velo,vitesse_moy:24.7
J251224|cardio_johnseed_20|saisie=calories:426,distance:6.5,duree:43,fc_moy:164,ressenti_cardio:2,rpe:6,type_cardio:footing,vitesse_moy:9.1
J251226|cardio_johnseed_21|saisie=calories:421,distance:21.6,duree:52,fc_moy:145,puissance_moy:155,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:24.9
J251231|cardio_johnseed_23|saisie=calories:436,distance:6.5,duree:44,fc_moy:164,ressenti_cardio:3,rpe:6,type_cardio:footing,vitesse_moy:8.9
J260102|cardio_johnseed_24|saisie=calories:421,distance:21.9,duree:52,fc_moy:144,puissance_moy:156,ressenti_cardio:2,rpe:7,type_cardio:velo,vitesse_moy:25.3
J260103|cardio_hyrox_johnseed_8|saisie=distance:8,duree:88,hyrox_burpees:292,hyrox_division:mo,hyrox_farmers:282,hyrox_lunges:279,hyrox_mode:course,hyrox_poids_farm:24,hyrox_poids_pull:103,hyrox_poids_push:152,hyrox_poids_sand:20,hyrox_poids_wall:6,hyrox_row:284,hyrox_run1:364,hyrox_run2:368,hyrox_run3:328,hyrox_run4:348,hyrox_run5:377,hyrox_run6:396,hyrox_run7:379,hyrox_run8:346,hyrox_skierg:315,hyrox_sledpull:308,hyrox_sledpush:292,hyrox_total:5280,hyrox_wallballs:323,rpe:9,type_cardio:hyrox
J260107|cardio_johnseed_26|saisie=calories:436,distance:6.6,duree:44,fc_moy:164,ressenti_cardio:3,rpe:6,type_cardio:footing,vitesse_moy:9.0
J260109|cardio_johnseed_27|saisie=calories:429,distance:22.2,duree:53,fc_moy:144,puissance_moy:157,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:25.1
J260114|cardio_johnseed_29|saisie=calories:436,distance:6.7,duree:44,fc_moy:164,ressenti_cardio:3,rpe:7,type_cardio:footing,vitesse_moy:9.1
J260116|cardio_johnseed_30|saisie=calories:429,distance:22.5,duree:53,fc_moy:144,puissance_moy:158,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:25.5
J260121|cardio_johnseed_32|saisie=calories:436,distance:6.8,duree:44,fc_moy:163,ressenti_cardio:3,rpe:7,type_cardio:footing,vitesse_moy:9.3
J260123|cardio_johnseed_33|saisie=calories:437,distance:22.7,duree:54,fc_moy:144,puissance_moy:159,ressenti_cardio:2,rpe:7,type_cardio:velo,vitesse_moy:25.2
J260128|cardio_johnseed_35|saisie=calories:446,distance:6.9,duree:45,fc_moy:163,ressenti_cardio:2,rpe:7,type_cardio:footing,vitesse_moy:9.2
J260130|cardio_johnseed_36|saisie=calories:437,distance:23.0,duree:54,fc_moy:143,puissance_moy:160,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:25.6
J260204|cardio_johnseed_38|saisie=calories:446,distance:6.9,duree:45,fc_moy:163,ressenti_cardio:2,rpe:8,type_cardio:footing,vitesse_moy:9.2
J260206|cardio_johnseed_39|saisie=calories:437,distance:23.3,duree:54,fc_moy:143,puissance_moy:161,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:25.9
J260207|cardio_hyrox_johnseed_13|saisie=distance:8,duree:86,hyrox_burpees:277,hyrox_division:mo,hyrox_farmers:297,hyrox_lunges:282,hyrox_mode:course,hyrox_poids_farm:24,hyrox_poids_pull:103,hyrox_poids_push:152,hyrox_poids_sand:20,hyrox_poids_wall:6,hyrox_row:264,hyrox_run1:342,hyrox_run2:388,hyrox_run3:331,hyrox_run4:351,hyrox_run5:383,hyrox_run6:390,hyrox_run7:338,hyrox_run8:335,hyrox_skierg:279,hyrox_sledpull:297,hyrox_sledpush:313,hyrox_total:5160,hyrox_wallballs:264,rpe:9,type_cardio:hyrox
J260211|cardio_johnseed_41|saisie=calories:446,distance:7.0,duree:45,fc_moy:162,ressenti_cardio:3,rpe:7,type_cardio:footing,vitesse_moy:9.3
J260213|cardio_johnseed_42|saisie=calories:446,distance:23.6,duree:55,fc_moy:143,puissance_moy:161,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:25.7
J260218|cardio_johnseed_44|saisie=calories:446,distance:7.1,duree:45,fc_moy:162,ressenti_cardio:2,rpe:7,type_cardio:footing,vitesse_moy:9.5
J260220|cardio_johnseed_45|saisie=calories:446,distance:23.8,duree:55,fc_moy:143,puissance_moy:162,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:26.0
J260225|cardio_johnseed_47|saisie=calories:455,distance:7.2,duree:46,fc_moy:162,ressenti_cardio:2,rpe:7,type_cardio:footing,vitesse_moy:9.4
J260227|cardio_johnseed_48|saisie=calories:446,distance:24.1,duree:55,fc_moy:142,puissance_moy:163,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:26.3
J260304|cardio_johnseed_50|saisie=calories:455,distance:7.3,duree:46,fc_moy:162,ressenti_cardio:3,rpe:6,type_cardio:footing,vitesse_moy:9.5
J260306|cardio_johnseed_51|saisie=calories:454,distance:24.4,duree:56,fc_moy:142,puissance_moy:164,ressenti_cardio:2,rpe:5,type_cardio:velo,vitesse_moy:26.1
J260307|cardio_hyrox_johnseed_17|saisie=distance:8,duree:84,hyrox_burpees:262,hyrox_division:mo,hyrox_farmers:297,hyrox_lunges:289,hyrox_mode:course,hyrox_poids_farm:24,hyrox_poids_pull:103,hyrox_poids_push:152,hyrox_poids_sand:20,hyrox_poids_wall:6,hyrox_row:303,hyrox_run1:365,hyrox_run2:336,hyrox_run3:317,hyrox_run4:319,hyrox_run5:328,hyrox_run6:381,hyrox_run7:367,hyrox_run8:340,hyrox_skierg:307,hyrox_sledpull:311,hyrox_sledpush:261,hyrox_total:5040,hyrox_wallballs:263,rpe:9,type_cardio:hyrox
J260311|cardio_johnseed_53|saisie=calories:455,distance:7.3,duree:46,fc_moy:161,ressenti_cardio:3,rpe:7,type_cardio:footing,vitesse_moy:9.5
J260313|cardio_johnseed_54|saisie=calories:454,distance:24.7,duree:56,fc_moy:142,puissance_moy:165,ressenti_cardio:2,rpe:5,type_cardio:velo,vitesse_moy:26.5
J260318|cardio_johnseed_56|saisie=calories:455,distance:7.4,duree:46,fc_moy:161,ressenti_cardio:2,rpe:6,type_cardio:footing,vitesse_moy:9.7
J260320|cardio_johnseed_57|saisie=calories:454,distance:24.9,duree:56,fc_moy:142,puissance_moy:166,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:26.7
J260325|cardio_johnseed_59|saisie=calories:455,distance:7.5,duree:46,fc_moy:161,ressenti_cardio:3,rpe:7,type_cardio:footing,vitesse_moy:9.8
J260327|cardio_johnseed_60|saisie=calories:462,distance:25.2,duree:57,fc_moy:142,puissance_moy:167,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:26.5
J260401|cardio_johnseed_62|saisie=calories:465,distance:7.6,duree:47,fc_moy:161,ressenti_cardio:2,rpe:6,type_cardio:footing,vitesse_moy:9.7
J260403|cardio_johnseed_63|saisie=calories:462,distance:25.5,duree:57,fc_moy:141,puissance_moy:168,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:26.8
J260404|cardio_hyrox_johnseed_21|saisie=distance:8,duree:83,hyrox_burpees:292,hyrox_division:mo,hyrox_farmers:292,hyrox_lunges:305,hyrox_mode:course,hyrox_poids_farm:24,hyrox_poids_pull:103,hyrox_poids_push:152,hyrox_poids_sand:20,hyrox_poids_wall:6,hyrox_row:287,hyrox_run1:343,hyrox_run2:336,hyrox_run3:324,hyrox_run4:351,hyrox_run5:315,hyrox_run6:343,hyrox_run7:348,hyrox_run8:343,hyrox_skierg:307,hyrox_sledpull:298,hyrox_sledpush:284,hyrox_total:4980,hyrox_wallballs:278,rpe:9,type_cardio:hyrox
J260408|cardio_johnseed_65|saisie=calories:465,distance:7.6,duree:47,fc_moy:160,ressenti_cardio:2,rpe:7,type_cardio:footing,vitesse_moy:9.7
J260410|cardio_johnseed_66|saisie=calories:462,distance:25.8,duree:57,fc_moy:141,puissance_moy:169,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:27.2
J260415|cardio_johnseed_68|saisie=calories:465,distance:7.7,duree:47,fc_moy:160,ressenti_cardio:2,rpe:7,type_cardio:footing,vitesse_moy:9.8
J260417|cardio_johnseed_69|saisie=calories:470,distance:26.0,duree:58,fc_moy:141,puissance_moy:169,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:26.9
J260422|cardio_johnseed_71|saisie=calories:465,distance:7.8,duree:47,fc_moy:160,ressenti_cardio:3,rpe:8,type_cardio:footing,vitesse_moy:10.0
J260424|cardio_johnseed_72|saisie=calories:470,distance:26.3,duree:58,fc_moy:141,puissance_moy:170,ressenti_cardio:2,rpe:7,type_cardio:velo,vitesse_moy:27.2
J260429|cardio_johnseed_74|saisie=calories:475,distance:7.9,duree:48,fc_moy:159,ressenti_cardio:3,rpe:7,type_cardio:footing,vitesse_moy:9.9
J260501|cardio_johnseed_75|saisie=calories:470,distance:26.6,duree:58,fc_moy:140,puissance_moy:171,ressenti_cardio:2,rpe:7,type_cardio:velo,vitesse_moy:27.5
J260502|cardio_hyrox_johnseed_25|saisie=distance:8,duree:82,hyrox_burpees:279,hyrox_division:mo,hyrox_farmers:296,hyrox_lunges:258,hyrox_mode:course,hyrox_poids_farm:24,hyrox_poids_pull:103,hyrox_poids_push:152,hyrox_poids_sand:20,hyrox_poids_wall:6,hyrox_row:267,hyrox_run1:349,hyrox_run2:305,hyrox_run3:354,hyrox_run4:357,hyrox_run5:327,hyrox_run6:326,hyrox_run7:310,hyrox_run8:346,hyrox_skierg:269,hyrox_sledpull:276,hyrox_sledpush:257,hyrox_total:4920,hyrox_wallballs:263,rpe:9,type_cardio:hyrox
J260506|cardio_johnseed_77|saisie=calories:475,distance:8.0,duree:48,fc_moy:159,ressenti_cardio:3,rpe:7,type_cardio:footing,vitesse_moy:10.0
J260508|cardio_johnseed_78|saisie=calories:478,distance:26.9,duree:59,fc_moy:140,puissance_moy:172,ressenti_cardio:2,rpe:7,type_cardio:velo,vitesse_moy:27.4
J260513|cardio_johnseed_80|saisie=calories:475,distance:8.0,duree:48,fc_moy:159,ressenti_cardio:2,rpe:7,type_cardio:footing,vitesse_moy:10.0
J260515|cardio_johnseed_81|saisie=calories:478,distance:27.1,duree:59,fc_moy:140,puissance_moy:173,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:27.6
J260520|cardio_johnseed_83|saisie=calories:475,distance:8.1,duree:48,fc_moy:159,ressenti_cardio:2,rpe:7,type_cardio:footing,vitesse_moy:10.1
J260522|cardio_johnseed_84|saisie=calories:486,distance:27.4,duree:60,fc_moy:140,puissance_moy:174,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:27.4
J260527|cardio_johnseed_86|saisie=calories:485,distance:8.2,duree:49,fc_moy:158,ressenti_cardio:2,rpe:7,type_cardio:footing,vitesse_moy:10.0
J260529|cardio_johnseed_87|saisie=calories:486,distance:27.7,duree:60,fc_moy:139,puissance_moy:175,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:27.7
J260603|cardio_johnseed_89|saisie=calories:485,distance:8.3,duree:49,fc_moy:158,ressenti_cardio:2,rpe:6,type_cardio:footing,vitesse_moy:10.2
J260605|cardio_johnseed_90|saisie=calories:486,distance:28.0,duree:60,fc_moy:139,puissance_moy:176,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:28.0
J260606|cardio_hyrox_johnseed_30|saisie=distance:8,duree:80,hyrox_burpees:255,hyrox_division:mo,hyrox_farmers:268,hyrox_lunges:293,hyrox_mode:course,hyrox_poids_farm:24,hyrox_poids_pull:103,hyrox_poids_push:152,hyrox_poids_sand:20,hyrox_poids_wall:6,hyrox_row:275,hyrox_run1:313,hyrox_run2:359,hyrox_run3:305,hyrox_run4:358,hyrox_run5:350,hyrox_run6:341,hyrox_run7:331,hyrox_run8:337,hyrox_skierg:264,hyrox_sledpull:291,hyrox_sledpush:256,hyrox_total:4800,hyrox_wallballs:265,rpe:8,type_cardio:hyrox
J260610|cardio_johnseed_92|saisie=calories:485,distance:8.4,duree:49,fc_moy:158,ressenti_cardio:2,rpe:6,type_cardio:footing,vitesse_moy:10.3
J260612|cardio_johnseed_93|saisie=calories:494,distance:28.2,duree:61,fc_moy:139,puissance_moy:176,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:27.7
J260617|cardio_johnseed_95|saisie=calories:485,distance:8.4,duree:49,fc_moy:157,ressenti_cardio:2,rpe:7,type_cardio:footing,vitesse_moy:10.3
J260619|cardio_johnseed_96|saisie=calories:494,distance:28.5,duree:61,fc_moy:139,puissance_moy:177,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:28.0
J260624|cardio_johnseed_98|saisie=calories:495,distance:8.5,duree:50,fc_moy:157,ressenti_cardio:2,rpe:7,type_cardio:footing,vitesse_moy:10.2
J260626|cardio_johnseed_99|saisie=calories:494,distance:28.8,duree:61,fc_moy:138,puissance_moy:178,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:28.3
J260701|cardio_johnseed_101|saisie=calories:495,distance:8.6,duree:50,fc_moy:157,ressenti_cardio:2,rpe:8,type_cardio:footing,vitesse_moy:10.3
J260703|cardio_johnseed_102|saisie=calories:502,distance:29.1,duree:62,fc_moy:138,puissance_moy:179,ressenti_cardio:2,rpe:5,type_cardio:velo,vitesse_moy:28.2
J260704|cardio_hyrox_johnseed_34|saisie=distance:8,duree:78,hyrox_burpees:268,hyrox_division:mo,hyrox_farmers:274,hyrox_lunges:246,hyrox_mode:course,hyrox_poids_farm:24,hyrox_poids_pull:103,hyrox_poids_push:152,hyrox_poids_sand:20,hyrox_poids_wall:6,hyrox_row:264,hyrox_run1:337,hyrox_run2:317,hyrox_run3:320,hyrox_run4:330,hyrox_run5:345,hyrox_run6:310,hyrox_run7:333,hyrox_run8:343,hyrox_skierg:287,hyrox_sledpull:276,hyrox_sledpush:288,hyrox_total:4680,hyrox_wallballs:268,rpe:8,type_cardio:hyrox
J260708|cardio_johnseed_104|saisie=calories:495,distance:8.7,duree:50,fc_moy:157,ressenti_cardio:2,rpe:6,type_cardio:footing,vitesse_moy:10.4
J260710|cardio_johnseed_105|saisie=calories:502,distance:29.3,duree:62,fc_moy:138,puissance_moy:180,ressenti_cardio:2,rpe:7,type_cardio:velo,vitesse_moy:28.4
J260715|cardio_johnseed_107|saisie=calories:495,distance:8.7,duree:50,fc_moy:156,ressenti_cardio:3,rpe:7,type_cardio:footing,vitesse_moy:10.4
J260717|cardio_johnseed_108|saisie=calories:502,distance:29.6,duree:62,fc_moy:138,puissance_moy:181,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:28.6
J260722|cardio_johnseed_110|saisie=calories:495,distance:8.8,duree:50,fc_moy:156,ressenti_cardio:3,rpe:6,type_cardio:footing,vitesse_moy:10.6
J260724|cardio_johnseed_111|saisie=calories:510,distance:29.9,duree:63,fc_moy:138,puissance_moy:182,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:28.5
J260729|cardio_johnseed_113|saisie=calories:505,distance:8.9,duree:51,fc_moy:156,ressenti_cardio:3,rpe:6,type_cardio:footing,vitesse_moy:10.5
J260731|cardio_johnseed_114|saisie=calories:510,distance:30.2,duree:63,fc_moy:137,puissance_moy:183,ressenti_cardio:2,rpe:7,type_cardio:velo,vitesse_moy:28.8
J260801|cardio_hyrox_johnseed_38|saisie=distance:8,duree:77,hyrox_burpees:261,hyrox_division:mo,hyrox_farmers:244,hyrox_lunges:261,hyrox_mode:course,hyrox_poids_farm:24,hyrox_poids_pull:103,hyrox_poids_push:152,hyrox_poids_sand:20,hyrox_poids_wall:6,hyrox_row:268,hyrox_run1:308,hyrox_run2:348,hyrox_run3:316,hyrox_run4:288,hyrox_run5:320,hyrox_run6:329,hyrox_run7:287,hyrox_run8:302,hyrox_skierg:244,hyrox_sledpull:283,hyrox_sledpush:260,hyrox_total:4620,hyrox_wallballs:266,rpe:9,type_cardio:hyrox
J260805|cardio_johnseed_116|saisie=calories:505,distance:9.0,duree:51,fc_moy:156,ressenti_cardio:3,rpe:7,type_cardio:footing,vitesse_moy:10.6
J260807|cardio_johnseed_117|saisie=calories:510,distance:30.4,duree:63,fc_moy:137,puissance_moy:184,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:29.0
J260812|cardio_johnseed_119|saisie=calories:505,distance:9.1,duree:51,fc_moy:155,ressenti_cardio:2,rpe:7,type_cardio:footing,vitesse_moy:10.7
J260814|cardio_johnseed_120|saisie=calories:518,distance:30.7,duree:64,fc_moy:137,puissance_moy:184,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:28.8
J260819|cardio_johnseed_122|saisie=calories:505,distance:9.1,duree:51,fc_moy:155,ressenti_cardio:3,rpe:6,type_cardio:footing,vitesse_moy:10.7
J260821|cardio_johnseed_123|saisie=calories:518,distance:31.0,duree:64,fc_moy:137,puissance_moy:185,ressenti_cardio:2,rpe:7,type_cardio:velo,vitesse_moy:29.1
J260826|cardio_johnseed_125|saisie=calories:515,distance:9.2,duree:52,fc_moy:155,ressenti_cardio:3,rpe:8,type_cardio:footing,vitesse_moy:10.6
J260828|cardio_johnseed_126|saisie=calories:518,distance:31.3,duree:64,fc_moy:136,puissance_moy:186,ressenti_cardio:2,rpe:5,type_cardio:velo,vitesse_moy:29.3
J260902|cardio_johnseed_128|saisie=calories:515,distance:9.3,duree:52,fc_moy:154,ressenti_cardio:3,rpe:8,type_cardio:footing,vitesse_moy:10.7
J260904|cardio_johnseed_129|saisie=calories:527,distance:31.5,duree:65,fc_moy:136,puissance_moy:187,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:29.1
J260905|cardio_hyrox_johnseed_43|saisie=distance:8,duree:75,hyrox_burpees:245,hyrox_division:mo,hyrox_farmers:268,hyrox_lunges:238,hyrox_mode:course,hyrox_poids_farm:24,hyrox_poids_pull:103,hyrox_poids_push:152,hyrox_poids_sand:20,hyrox_poids_wall:6,hyrox_row:260,hyrox_run1:323,hyrox_run2:302,hyrox_run3:338,hyrox_run4:302,hyrox_run5:325,hyrox_run6:280,hyrox_run7:284,hyrox_run8:286,hyrox_skierg:272,hyrox_sledpull:255,hyrox_sledpush:260,hyrox_total:4500,hyrox_wallballs:271,rpe:9,type_cardio:hyrox
J260909|cardio_johnseed_131|saisie=calories:515,distance:9.4,duree:52,fc_moy:154,ressenti_cardio:3,rpe:8,type_cardio:footing,vitesse_moy:10.8
J260911|cardio_johnseed_132|saisie=calories:527,distance:31.8,duree:65,fc_moy:136,puissance_moy:188,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:29.4
J260916|cardio_johnseed_134|saisie=calories:515,distance:9.5,duree:52,fc_moy:154,ressenti_cardio:2,rpe:6,type_cardio:footing,vitesse_moy:11.0
J260918|cardio_johnseed_135|saisie=calories:535,distance:32.1,duree:66,fc_moy:136,puissance_moy:189,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:29.2
J260919|pref|app=onboarding_vu:1
J260923|cardio_johnseed_137|saisie=calories:525,distance:9.5,duree:53,fc_moy:154,ressenti_cardio:3,rpe:8,type_cardio:footing,vitesse_moy:10.8
J260925|cardio_johnseed_138|saisie=calories:535,distance:32.4,duree:66,fc_moy:135,puissance_moy:190,ressenti_cardio:2,rpe:7,type_cardio:velo,vitesse_moy:29.5
J260930|cardio_johnseed_140|saisie=calories:525,distance:9.6,duree:53,fc_moy:153,ressenti_cardio:3,rpe:7,type_cardio:footing,vitesse_moy:10.9
J261002|cardio_johnseed_141|saisie=calories:535,distance:32.6,duree:66,fc_moy:135,puissance_moy:191,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:29.6
J261003|cardio_hyrox_johnseed_47|saisie=distance:8,duree:74,hyrox_burpees:240,hyrox_division:mo,hyrox_farmers:266,hyrox_lunges:242,hyrox_mode:course,hyrox_poids_farm:24,hyrox_poids_pull:103,hyrox_poids_push:152,hyrox_poids_sand:20,hyrox_poids_wall:6,hyrox_row:273,hyrox_run1:318,hyrox_run2:298,hyrox_run3:276,hyrox_run4:289,hyrox_run5:334,hyrox_run6:280,hyrox_run7:298,hyrox_run8:296,hyrox_skierg:243,hyrox_sledpull:255,hyrox_sledpush:227,hyrox_total:4440,hyrox_wallballs:258,rpe:8,type_cardio:hyrox
J261007|cardio_johnseed_143|saisie=calories:525,distance:9.7,duree:53,fc_moy:153,ressenti_cardio:3,rpe:7,type_cardio:footing,vitesse_moy:11.0
J261009|cardio_johnseed_144|saisie=calories:543,distance:32.9,duree:67,fc_moy:135,puissance_moy:191,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:29.5
J261014|cardio_johnseed_146|saisie=calories:525,distance:9.8,duree:53,fc_moy:153,ressenti_cardio:3,rpe:8,type_cardio:footing,vitesse_moy:11.1
J261016|cardio_johnseed_147|saisie=calories:543,distance:33.2,duree:67,fc_moy:135,puissance_moy:192,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:29.7
J261021|cardio_johnseed_149|saisie=calories:535,distance:9.8,duree:54,fc_moy:153,ressenti_cardio:3,rpe:6,type_cardio:footing,vitesse_moy:10.9
J261023|cardio_johnseed_150|saisie=calories:543,distance:33.5,duree:67,fc_moy:134,puissance_moy:193,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:30.0
J261028|cardio_johnseed_152|saisie=calories:535,distance:9.9,duree:54,fc_moy:152,ressenti_cardio:3,rpe:6,type_cardio:footing,vitesse_moy:11.0
J261030|cardio_johnseed_153|saisie=calories:551,distance:33.7,duree:68,fc_moy:134,puissance_moy:194,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:29.7
J261104|cardio_johnseed_155|saisie=calories:535,distance:10.0,duree:54,fc_moy:152,ressenti_cardio:2,rpe:7,type_cardio:footing,vitesse_moy:11.1
J261106|cardio_johnseed_156|saisie=calories:551,distance:34.0,duree:68,fc_moy:134,puissance_moy:195,ressenti_cardio:2,rpe:6,type_cardio:velo,vitesse_moy:30.0
J261107|cardio_hyrox_johnseed_52|saisie=distance:8,duree:72,hyrox_burpees:221,hyrox_division:mo,hyrox_farmers:230,hyrox_lunges:266,hyrox_mode:course,hyrox_poids_farm:24,hyrox_poids_pull:103,hyrox_poids_push:152,hyrox_poids_sand:20,hyrox_poids_wall:6,hyrox_row:247,hyrox_run1:293,hyrox_run2:273,hyrox_run3:300,hyrox_run4:278,hyrox_run5:313,hyrox_run6:323,hyrox_run7:271,hyrox_run8:284,hyrox_skierg:262,hyrox_sledpull:258,hyrox_sledpush:242,hyrox_total:4320,hyrox_wallballs:223,rpe:9,type_cardio:hyrox
$ind$);
with l as (select regexp_split_to_table(t, E'\n') s from _ind_txt), s as (
  select case left(s,1) when 'J' then '3' else 'demo_4_lucas' end aid, to_date('20' || substr(s,2,6), 'YYYYMMDD') d,
         split_part(split_part(s,'=',1),'|',2) sid, split_part(split_part(s,'=',1),'|',3) src, split_part(s,'=',2) body from l where s like '_%=%'),
kv as (select aid, d, sid, src, regexp_split_to_table(body, ',') x from s)
insert into public.indicateurs (date, athlete_id, seance_id, cle, valeur, unite, source)
select d + (select j from _seed_off), aid, sid, split_part(x,':',1), substr(x, length(split_part(x,':',1)) + 2), u.unite, src
from kv join _unite u on u.cle = split_part(x,':',1);
-- Activités (journal unifié) dérivées des séances cardio, comme à la saisie
insert into public.activites (athlete_id, seance_id, type, debut, duree_s, distance_m, source_primaire, statut)
select athlete_id, seance_id, max(valeur) filter (where cle = 'type_cardio'), min(date)::timestamptz,
       round(max(valeur) filter (where cle = 'duree')::numeric * 60)::int,
       round(max(valeur) filter (where cle = 'distance')::numeric * 1000),
       'manual', 'complete'
from public.indicateurs where athlete_id in ('3','demo_4_lucas') and seance_id like 'cardio%' group by athlete_id, seance_id;
insert into public.activite_sources (activity_id, source, source_ref)
select id, 'manual', seance_id from public.activites where athlete_id in ('3','demo_4_lucas');

-- Programme
insert into public.programme (athlete_id,athlete_nom,seance_id,exercice,series_prevues,reps_mini,reps_max,repos_sec,groupe_id,jour,charge_pct_1rm,rpe_cible,type,cardio_cible,cardio_unite,schema,backoff_pct,series_json) values
('3','John','Full Body A','Squat',4,6,10,120,'1',null,null,null,null,null,null,null,null,null),
('3','John','Full Body A','Développé couché barre',4,6,10,120,'2',null,null,null,null,null,null,null,null,null),
('3','John','Full Body A','Rowing barre',4,8,12,90,'3',null,null,null,null,null,null,null,null,null),
('3','John','Full Body A','Développé militaire aux haltères',3,8,12,90,'4',null,null,null,null,null,null,null,null,null),
('3','John','Full Body A','Curl barre',3,10,15,60,'5',null,null,null,null,null,null,null,null,null),
('3','John','Full Body B','Soulevé de terre',4,5,8,150,'1',null,null,null,null,null,null,null,null,null),
('3','John','Full Body B','Développé couché incliné haltère',4,8,12,90,'2',null,null,null,null,null,null,null,null,null),
('3','John','Full Body B','Traction',4,6,10,120,'3',null,null,null,null,null,null,null,null,null),
('3','John','Full Body B','Élévation latérale haltère',3,12,15,60,'4',null,null,null,null,null,null,null,null,null),
('3','John','Full Body B','Extension poulie corde',3,10,15,60,'5',null,null,null,null,null,null,null,null,null),
('3','John','Full Body B','Mollets debout',4,12,20,60,'6',null,null,null,null,null,null,null,null,null),
('3','John','Full Body C','Presse inclinée',4,10,15,120,'1',null,null,null,null,null,null,null,null,null),
('3','John','Full Body C','Dips triceps',4,8,12,90,'2',null,null,null,null,null,null,null,null,null),
('3','John','Full Body C','Tirage horizontal prise serrée',4,10,12,90,'3',null,null,null,null,null,null,null,null,null),
('3','John','Full Body C','Face pull',3,15,20,60,'4',null,null,null,null,null,null,null,null,null),
('3','John','Full Body C','Curl marteau aux haltères',3,10,12,60,'5',null,null,null,null,null,null,null,null,null),
('3','John','Full Body C','Crunch au sol',3,15,25,45,'6',null,null,null,null,null,null,null,null,null),
('demo_4_lucas','Lucas Moreau','Push','Développé couché barre',4,6,10,150,null,null,null,null,null,null,null,null,null,null),
('demo_4_lucas','Lucas Moreau','Push','Développé couché incliné haltère',3,8,12,120,null,null,null,null,null,null,null,null,null,null),
('demo_4_lucas','Lucas Moreau','Push','Développé militaire aux haltères',3,8,12,120,null,null,null,null,null,null,null,null,null,null),
('demo_4_lucas','Lucas Moreau','Push','Élévation latérale haltère',3,12,15,60,null,null,null,null,null,null,null,null,null,null),
('demo_4_lucas','Lucas Moreau','Push','Extension poulie corde',3,10,15,60,null,null,null,null,null,null,null,null,null,null),
('demo_4_lucas','Lucas Moreau','Pull','Tirage vertical prise large',4,8,12,120,null,null,null,null,null,null,null,null,null,null),
('demo_4_lucas','Lucas Moreau','Pull','Rowing barre',4,6,10,120,null,null,null,null,null,null,null,null,null,null),
('demo_4_lucas','Lucas Moreau','Pull','Face pull',3,12,15,60,null,null,null,null,null,null,null,null,null,null),
('demo_4_lucas','Lucas Moreau','Pull','Curl barre',3,8,12,90,null,null,null,null,null,null,null,null,null,null),
('demo_4_lucas','Lucas Moreau','Pull','Curl marteau aux haltères',3,10,12,60,null,null,null,null,null,null,null,null,null,null),
('demo_4_lucas','Lucas Moreau','Legs','Squat',4,6,10,180,null,null,null,null,null,null,null,null,null,null),
('demo_4_lucas','Lucas Moreau','Legs','RDL barre',3,8,10,150,null,null,null,null,null,null,null,null,null,null),
('demo_4_lucas','Lucas Moreau','Legs','Presse inclinée',3,10,12,120,null,null,null,null,null,null,null,null,null,null),
('demo_4_lucas','Lucas Moreau','Legs','Leg curl assis',3,10,12,90,null,null,null,null,null,null,null,null,null,null),
('demo_4_lucas','Lucas Moreau','Legs','Mollets debout',3,12,15,60,null,null,null,null,null,null,null,null,null,null),
('demo_4_lucas','Lucas Moreau','Upper','Développé couché haltère',3,8,12,120,null,null,null,null,null,null,null,null,null,null),
('demo_4_lucas','Lucas Moreau','Upper','Tirage horizontal prise serrée',3,8,12,120,null,null,null,null,null,null,null,null,null,null),
('demo_4_lucas','Lucas Moreau','Upper','Développé militaire à la Smith',3,8,10,120,null,null,null,null,null,null,null,null,null,null),
('demo_4_lucas','Lucas Moreau','Upper','Écarté poulie haute',3,12,15,60,null,null,null,null,null,null,null,null,null,null),
('demo_4_lucas','Lucas Moreau','Upper','Barre au front',3,10,12,90,null,null,null,null,null,null,null,null,null,null);

-- Poids (John + Lucas) et objectif
insert into public.poids_historique (date, athlete_id, poids) values
(('2026-08-02'::date + (select j from _seed_off)), '3', 81),
(('2026-08-08'::date + (select j from _seed_off)), '3', 80.8),
(('2026-08-14'::date + (select j from _seed_off)), '3', 80.6),
(('2026-08-20'::date + (select j from _seed_off)), '3', 80.5),
(('2026-08-26'::date + (select j from _seed_off)), '3', 80.3),
(('2026-09-01'::date + (select j from _seed_off)), '3', 80.1),
(('2026-09-07'::date + (select j from _seed_off)), '3', 79.9),
(('2026-09-13'::date + (select j from _seed_off)), '3', 79.7),
(('2026-09-19'::date + (select j from _seed_off)), '3', 79.6),
(('2026-09-25'::date + (select j from _seed_off)), '3', 79.4),
(('2026-10-01'::date + (select j from _seed_off)), '3', 79.2),
(('2026-10-07'::date + (select j from _seed_off)), '3', 79),
(('2026-10-13'::date + (select j from _seed_off)), '3', 78.8),
(('2026-10-19'::date + (select j from _seed_off)), '3', 78.7),
(('2026-10-25'::date + (select j from _seed_off)), '3', 78.5),
(('2026-10-31'::date + (select j from _seed_off)), '3', 78.3),
(('2026-03-08'::date + (select j from _seed_off)), 'demo_4_lucas', 71),
(('2026-03-22'::date + (select j from _seed_off)), 'demo_4_lucas', 71.6),
(('2026-04-05'::date + (select j from _seed_off)), 'demo_4_lucas', 71.3),
(('2026-04-19'::date + (select j from _seed_off)), 'demo_4_lucas', 71.8),
(('2026-05-03'::date + (select j from _seed_off)), 'demo_4_lucas', 72.3),
(('2026-05-17'::date + (select j from _seed_off)), 'demo_4_lucas', 72.1),
(('2026-05-31'::date + (select j from _seed_off)), 'demo_4_lucas', 72.5),
(('2026-06-14'::date + (select j from _seed_off)), 'demo_4_lucas', 73.1),
(('2026-06-28'::date + (select j from _seed_off)), 'demo_4_lucas', 72.8),
(('2026-07-12'::date + (select j from _seed_off)), 'demo_4_lucas', 73.3),
(('2026-07-26'::date + (select j from _seed_off)), 'demo_4_lucas', 73.8),
(('2026-08-09'::date + (select j from _seed_off)), 'demo_4_lucas', 73.6),
(('2026-08-23'::date + (select j from _seed_off)), 'demo_4_lucas', 74),
(('2026-09-06'::date + (select j from _seed_off)), 'demo_4_lucas', 74.6),
(('2026-09-20'::date + (select j from _seed_off)), 'demo_4_lucas', 74.3),
(('2026-10-04'::date + (select j from _seed_off)), 'demo_4_lucas', 74.8),
(('2026-10-18'::date + (select j from _seed_off)), 'demo_4_lucas', 75.3),
(('2026-11-01'::date + (select j from _seed_off)), 'demo_4_lucas', 75.1);
insert into public.objectif (athlete_id, nom, poids_kg, date_poids, objectif, seances_semaine) values ('3',null,null,null,'Prise de masse',4);

-- Préprod = 100 % démo : tous les comptes marqués is_demo (si la colonne existe)
do $demo$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='athletes' and column_name='is_demo') then
    update public.athletes set is_demo = true; update public.coachs set is_demo = true;
  end if;
end $demo$;

-- Contrôle final
do $chk$
declare np int; nb int; ni int;
begin
  select count(*) into np from public.performances where athlete_id in ('3','demo_4_lucas');
  select count(*) into nb from public.bien_etre where athlete_id in ('3','demo_4_lucas');
  select count(*) into ni from public.indicateurs where athlete_id in ('3','demo_4_lucas');
  if np <> 4920 or nb <> 288 or ni <> 1249 then raise exception 'Seed incomplet : perf %, bien-être %, indicateurs %', np, nb, ni; end if;
end $chk$;
