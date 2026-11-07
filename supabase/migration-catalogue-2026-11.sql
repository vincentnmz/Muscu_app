-- Migration catalogue d'exercices — 06/11/2026 (scripts/catalogue_migration.py + .work). Tout ou rien.
do $mig$ declare r record; begin
  alter table exercices add column if not exists materiel text;
  alter table exercices add column if not exists disciplines text default 'muscu';
  alter table exercices add column if not exists mesure text default 'charge_reps';
  alter table exercices add column if not exists cree_par text;
  -- 1. Renommages (catalogue, séances, programmes, indicateurs « exercice », « exercices », catégories)
  for r in select * from (values
    ('Curl haltére','Curl haltère'),
    ('Curl marteau aux haltéres','Curl marteau aux haltères'),
    ('Ecarté haltéres','Écarté haltères'),
    ('Ecarté haltéres décliné','Écarté haltères décliné'),
    ('Ecarté haltéres incliné','Écarté haltères incliné'),
    ('Elevation frontale haltéres','Élévation frontale haltères'),
    ('Elevation frontale barre','Élévation frontale barre'),
    ('Elévation latérale haltère','Élévation latérale haltère'),
    ('Elévation latérale uni à la poulie','Élévation latérale uni à la poulie'),
    ('Élévation frontale à la poulie ','Élévation frontale à la poulie'),
    ('Ecarté machine','Écarté machine'),
    ('Ecarté machine uni','Écarté machine uni'),
    ('Ecarté poulie basse','Écarté poulie basse'),
    ('Ecarté poulie haute','Écarté poulie haute'),
    ('Dips pectoraux ','Dips pectoraux'),
    ('Hack squat ','Hack squat'),
    ('shrugs aux haltéres','Shrugs haltères'),
    ('shrugs barre','Shrugs barre'),
    ('Les extensions mollets debout','Mollets debout'),
    ('Les extensions mollets assis','Mollets assis'),
    ('Les extensions mollets à la presse','Mollets à la presse')
  ) t(a, b) loop
    update exercices set exercice = r.b where exercice = r.a;
    update performances set exercice = r.b where exercice = r.a;
    update programme set exercice = r.b where exercice = r.a;
    update indicateurs set valeur = r.b where cle = 'exercice' and valeur = r.a;
    update indicateurs set valeur = array_to_string(array(select case when x = r.a then r.b else x end from unnest(string_to_array(valeur, ',')) x), ',') where cle = 'exercices' and r.a = any(string_to_array(valeur, ','));
    update indicateurs set valeur = ((valeur::jsonb - r.a) || jsonb_build_object(r.b, valeur::jsonb -> r.a))::text where cle = 'exo_categories' and valeur::jsonb ? r.a;
  end loop;
  update performances set exercice = 'Hip thrust machine' where exercice = 'hip thrust machine';
  -- 2. Leg curl (hors catalogue) : Alizé (toutes) + Vincent 05/08 → 17/08 = assis ; le reste = allongé
  update performances set exercice = 'Leg curl assis', exercice_id = (select exercice_id from exercices where exercice = 'Leg curl assis') where exercice = 'Leg curl' and (athlete_id = '2' or (athlete_id = '1' and date between '2026-08-05' and '2026-08-17'));
  update performances set exercice = 'Leg curl allongé', exercice_id = (select exercice_id from exercices where exercice = 'Leg curl allongé') where exercice = 'Leg curl';
  -- 3. Muscles (clés internes) et secondaires
  update exercices set muscle = 'Trapèze' where exercice in ('Shrugs haltères', 'Shrugs barre', 'Tirage trapèze machine');
  update performances set muscle = 'Trapèze' where exercice in ('Shrugs haltères', 'Shrugs barre', 'Tirage trapèze machine');
  update exercices set muscle = 'Epaule', muscle_secondaire = 'Trapèze' where exercice = 'Rowing menton';
  update performances set muscle = 'Epaule' where exercice = 'Rowing menton';
  update exercices set muscle_secondaire = 'Fessier' where exercice in ('Squat', 'Squat gobelet', 'Hack squat', 'Belt squat', 'Presse horizontale', 'Presse inclinée', 'Presse circulaire', 'Presse unilatérale', 'Fente courte');
  update exercices set muscle_secondaire = null where exercice = 'Relevé de jambe';
  -- 4. Matériel + petit pas (un nombre) + discipline + mesure (exercices existants)
  for r in select * from (values
    ('Écarté machine','Machine','1.25'),
    ('Développé machine','Machine','2.5'),
    ('Développé décliné machine','Machine','2.5'),
    ('Développé incliné à la Smith','Smith','2.5'),
    ('Écarté poulie haute','Poulie','1.25'),
    ('Écarté poulie basse','Poulie','1.25'),
    ('T-bar row','Machine','2.5'),
    ('Tirage horizontal prise large','Poulie','2.5'),
    ('Tirage horizontal prise serrée','Poulie','2.5'),
    ('Tirage vertical prise large','Poulie','2.5'),
    ('Tirage vertical prise serrée','Poulie','2.5'),
    ('Tirage vertical uni à la poignée','Poulie','2.5'),
    ('Tirage trapèze machine','Machine','2.5'),
    ('Curl barre','Barre','2.5'),
    ('Curl barre poulie','Poulie','1.25'),
    ('Curl incliné uni poignée à la poulie','Poulie','1.25'),
    ('Curl incliné au banc','Haltères','2'),
    ('Extension poulie corde','Poulie','1.25'),
    ('Extension dos à la poulie corde','Poulie','1.25'),
    ('Extension poulie barre','Poulie','1.25'),
    ('Développé militaire à la Smith','Smith','2.5'),
    ('Développé militaire aux haltères','Haltères','2'),
    ('Arrière épaule à la poulie','Poulie','1.25'),
    ('Arrière épaule haltère','Haltères','2'),
    ('Leg extension','Machine','2.5'),
    ('Belt squat','Machine','5'),
    ('Presse unilatérale','Machine','5'),
    ('Presse inclinée','Machine','5'),
    ('Presse horizontale','Machine','5'),
    ('Presse circulaire','Machine','5'),
    ('Squat','Barre','5'),
    ('Squat gobelet','Haltères','2'),
    ('Abduction machine','Machine','2.5'),
    ('Adducteur machine','Machine','2.5'),
    ('Relevé de bassin','Poids du corps','5'),
    ('RDL haltère','Haltères','2'),
    ('RDL barre','Barre','5'),
    ('Presse sumo','Machine','2.5'),
    ('Hip thrust','Barre','5'),
    ('Kick back','Poulie','2.5'),
    ('Écarté machine uni','Machine','1.25'),
    ('Développé couché haltère','Haltères','2'),
    ('Développé couché incliné haltère','Haltères','2'),
    ('Fente bulgare','Haltères','2'),
    ('Relevé de jambe','Poids du corps','2.5'),
    ('Crunch à la poulie','Poulie','1.25'),
    ('Roulette','Poids du corps','2.5'),
    ('Fente courte','Haltères','2'),
    ('Fente longue','Haltères','2'),
    ('Curl marteau aux haltères','Haltères','2'),
    ('Curl marteau à la poulie','Poulie','1.25'),
    ('Curl haltère','Haltères','2'),
    ('Hack squat','Machine','5'),
    ('Rowing barre','Barre','5'),
    ('Rowing bucheron','Haltères','2'),
    ('Rowing machine','Machine','5'),
    ('Élévation frontale haltères','Haltères','2'),
    ('Écarté haltères','Haltères','2'),
    ('Extension triceps banc','Haltères','2'),
    ('Élévation frontale barre','Barre','2.5'),
    ('Développé couché barre','Barre','5'),
    ('Traction','Poids du corps','5'),
    ('Pompe','Poids du corps','2.5'),
    ('Soulevé de terre','Barre','5'),
    ('Tirage horizontal uni à la poulie','Poulie','1.25'),
    ('Tirage vertical uni à la poulie','Poulie','1.25'),
    ('Shrugs haltères','Haltères','2'),
    ('Shrugs barre','Barre','2.5'),
    ('Rowing menton','Barre','2.5'),
    ('Développé décliné à la Smith','Smith','2.5'),
    ('Élévation frontale à la poulie','Poulie','2.5'),
    ('Pendulum','Machine','5'),
    ('Dips pectoraux','Poids du corps','2.5'),
    ('Rowing banc','Haltères','2'),
    ('Développé machine Hammer','Machine','2.5'),
    ('Développé incliné Hammer','Machine','2.5'),
    ('Leg curl assis','Machine','2.5'),
    ('Leg curl debout','Machine','2.5'),
    ('Leg curl allongé','Machine','2.5'),
    ('T-bar row prise haute','Machine','2.5'),
    ('T-bar row prise basse','Machine','2.5'),
    ('Pull over','Haltères','2.5'),
    ('Écarté haltères incliné','Haltères','2'),
    ('Écarté haltères décliné','Haltères','2'),
    ('Mollets debout','Machine','2.5'),
    ('Mollets assis','Machine','2.5'),
    ('Mollets à la presse','Machine','5'),
    ('Dips triceps','Poids du corps','2.5'),
    ('Élévation latérale haltère','Haltères','2'),
    ('Élévation latérale uni à la poulie','Poulie','1.25'),
    ('Hip thrust machine','Machine','5')
  ) t(n, mat, pas) loop
    update exercices set materiel = r.mat, increment_kg = r.pas, disciplines = 'muscu', mesure = 'charge_reps' where exercice = r.n;
  end loop;
  -- 5. 29 nouveaux exercices (choix du porteur)
  for r in select * from (values
    ('Curl poignet barre','Avant-bras',NULL,'Barre','1.25'),
    ('Curl poignet inversé','Avant-bras',NULL,'Barre','1.25'),
    ('Curl inversé barre','Avant-bras','Biceps','Barre','1.25'),
    ('Extension lombaire au banc 45°','Lombaires','Fessier','Poids du corps','2.5'),
    ('Good morning','Lombaires','Ischio','Barre','2.5'),
    ('Crunch machine','Abdominaux',NULL,'Machine','2.5'),
    ('Relevé de genoux suspendu','Abdominaux',NULL,'Poids du corps','2.5'),
    ('Crunch au sol','Abdominaux',NULL,'Poids du corps','2.5'),
    ('Pallof press','Abdominaux',NULL,'Poulie','1.25'),
    ('Adducteur à la poulie','Adducteur',NULL,'Poulie','1.25'),
    ('Squat sumo haltère','Adducteur','Fessier','Haltères','2'),
    ('Mollets à la Smith','Mollets',NULL,'Smith','2.5'),
    ('Mollets unilatéral haltère','Mollets',NULL,'Haltères','2'),
    ('Développé épaules machine','Epaule','Triceps','Machine','2.5'),
    ('Oiseau machine','Epaule',NULL,'Machine','2.5'),
    ('Face pull','Epaule','Trapèze','Poulie','1.25'),
    ('Développé Arnold','Epaule','Triceps','Haltères','2'),
    ('Barre au front','Triceps',NULL,'Barre','1.25'),
    ('Kickback haltère','Triceps',NULL,'Haltères','1'),
    ('Extension nuque haltère','Triceps',NULL,'Haltères','2'),
    ('Dips machine','Triceps','Pectoraux','Machine','2.5'),
    ('Curl pupitre','Biceps',NULL,'Barre','1.25'),
    ('Curl machine','Biceps',NULL,'Machine','2.5'),
    ('Nordic curl','Ischio',NULL,'Poids du corps','2.5'),
    ('Leg curl unilatéral','Ischio',NULL,'Machine','2.5'),
    ('Pull-through à la poulie','Fessier','Ischio','Poulie','2.5'),
    ('Abduction à la poulie','Fessier',NULL,'Poulie','1.25'),
    ('Front squat','Quadriceps','Fessier','Barre','2.5'),
    ('Sissy squat','Quadriceps',NULL,'Poids du corps','2.5')
  ) t(n, m, s, mat, pas) loop
    if not exists (select 1 from exercices where exercice = r.n) then
      insert into exercices (exercice_id, exercice, muscle, muscle_secondaire, increment_kg, materiel, disciplines, mesure, cree_par)
      values ((select (max(exercice_id::int) + 1)::text from exercices), r.n, r.m, r.s, r.pas, r.mat, 'muscu', 'charge_reps', 'novalyz');
    end if;
  end loop;
  -- 6. Programme de test de John (athlete 3, aucune séance) : noms génériques → catalogue ; « Gainage » supprimé
  for r in select * from (values
    ('Crunch','Crunch au sol'),
    ('Curl biceps','Curl barre'),
    ('Curl marteau','Curl marteau aux haltères'),
    ('Développé couché','Développé couché barre'),
    ('Développé incliné haltères','Développé couché incliné haltère'),
    ('Développé militaire','Développé militaire aux haltères'),
    ('Dips','Dips triceps'),
    ('Élévations latérales','Élévation latérale haltère'),
    ('Extension triceps','Extension poulie corde'),
    ('Face pull','Face pull'),
    ('Mollets debout','Mollets debout'),
    ('Presse à cuisses','Presse inclinée'),
    ('Tirage horizontal','Tirage horizontal prise serrée'),
    ('Tractions','Traction')
  ) t(a, b) loop
    update programme set exercice = r.b where athlete_id = '3' and trim(exercice) = r.a;
  end loop;
  delete from programme where athlete_id = '3' and trim(exercice) = 'Gainage';
end $mig$;
