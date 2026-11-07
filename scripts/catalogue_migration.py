"""Catalogue d'exercices — migration du 06/11/2026 (décisions du porteur, docs/audit-points-2-5-morpho-2026-11-06.md).
Génère supabase/migration-catalogue-2026-11.sql. Les noms de muscles restent les clés internes du moteur
(Epaule, Ischio, Fessier, Adducteur, Trapèze…) ; l'app affiche les libellés validés (Épaules, Ischios…)."""
import json, sys
SQ = lambda s: "NULL" if s is None else "'" + str(s).replace("'", "''") + "'"

RENOMMAGES = {  # ancien nom exact (base) → nouveau nom
    'Curl haltére': 'Curl haltère', 'Curl marteau aux haltéres': 'Curl marteau aux haltères',
    'Ecarté haltéres': 'Écarté haltères', 'Ecarté haltéres décliné': 'Écarté haltères décliné', 'Ecarté haltéres incliné': 'Écarté haltères incliné',
    'Elevation frontale haltéres': 'Élévation frontale haltères', 'Elevation frontale barre': 'Élévation frontale barre',
    'Elévation latérale haltère': 'Élévation latérale haltère', 'Elévation latérale uni à la poulie': 'Élévation latérale uni à la poulie',
    'Élévation frontale à la poulie ': 'Élévation frontale à la poulie',
    'Ecarté machine': 'Écarté machine', 'Ecarté machine uni': 'Écarté machine uni', 'Ecarté poulie basse': 'Écarté poulie basse', 'Ecarté poulie haute': 'Écarté poulie haute',
    'Dips pectoraux ': 'Dips pectoraux', 'Hack squat ': 'Hack squat',
    'shrugs aux haltéres': 'Shrugs haltères', 'shrugs barre': 'Shrugs barre',
    'Les extensions mollets debout': 'Mollets debout', 'Les extensions mollets assis': 'Mollets assis', 'Les extensions mollets à la presse': 'Mollets à la presse',
}
RENOMMAGES_HORS_CATALOGUE = {'hip thrust machine': 'Hip thrust machine'}  # séances seulement
# Programme de test de John (athlete 3, aucune séance) : noms génériques → catalogue. « Gainage » (mesure en temps) supprimé.
JOHN = {'Crunch': 'Crunch au sol', 'Curl biceps': 'Curl barre', 'Curl marteau': 'Curl marteau aux haltères', 'Développé couché': 'Développé couché barre',
        'Développé incliné haltères': 'Développé couché incliné haltère', 'Développé militaire': 'Développé militaire aux haltères', 'Dips': 'Dips triceps',
        'Élévations latérales': 'Élévation latérale haltère', 'Extension triceps': 'Extension poulie corde', 'Face pull': 'Face pull',
        'Mollets debout': 'Mollets debout', 'Presse à cuisses': 'Presse inclinée', 'Tirage horizontal': 'Tirage horizontal prise serrée', 'Tractions': 'Traction'}
MUSCLE = {'Shrugs haltères': 'Trapèze', 'Shrugs barre': 'Trapèze', 'Tirage trapèze machine': 'Trapèze', 'Rowing menton': 'Epaule'}  # nom (après renommage) → muscle
SECONDAIRE = {**{n: 'Fessier' for n in ['Squat', 'Squat gobelet', 'Hack squat', 'Belt squat', 'Presse horizontale', 'Presse inclinée', 'Presse circulaire', 'Presse unilatérale', 'Fente courte']},
              'Relevé de jambe': None, 'Rowing menton': 'Trapèze'}
MATERIEL_FORCE = {'Curl incliné au banc': 'Haltères', 'Rowing banc': 'Haltères', 'Pull over': 'Haltères', 'Extension triceps banc': 'Haltères', 'Hip thrust': 'Barre',
                  'Tirage vertical uni à la poignée': 'Poulie', 'Tirage horizontal prise large': 'Poulie', 'Tirage horizontal prise serrée': 'Poulie',
                  'Tirage vertical prise large': 'Poulie', 'Tirage vertical prise serrée': 'Poulie'}
def materiel(n):
    if n in MATERIEL_FORCE: return MATERIEL_FORCE[n]
    l = n.lower()
    if 'smith' in l: return 'Smith'
    if 'haltère' in l or 'gobelet' in l or 'bucheron' in l or 'fente' in l: return 'Haltères'
    if 'poulie' in l or 'corde' in l or 'kick back' in l: return 'Poulie'
    if 'barre' in l or l in ('squat', 'soulevé de terre', 'rowing menton'): return 'Barre'
    if l in ('traction', 'pompe', 'dips pectoraux', 'dips triceps', 'relevé de jambe', 'roulette', 'relevé de bassin'): return 'Poids du corps'
    return 'Machine'
def petit_pas(txt):
    import re
    nums = [float(x) for x in re.findall(r'[0-9]+(?:[.,][0-9]+)?', str(txt or '').replace(',', '.'))]
    v = min(nums) if nums else 2.5
    return ('%g' % v)
NOUVEAUX = [  # (nom, muscle interne, secondaire, matériel, petit pas)
    ('Curl poignet barre', 'Avant-bras', None, 'Barre', 1.25), ('Curl poignet inversé', 'Avant-bras', None, 'Barre', 1.25), ('Curl inversé barre', 'Avant-bras', 'Biceps', 'Barre', 1.25),
    ('Extension lombaire au banc 45°', 'Lombaires', 'Fessier', 'Poids du corps', 2.5), ('Good morning', 'Lombaires', 'Ischio', 'Barre', 2.5),
    ('Crunch machine', 'Abdominaux', None, 'Machine', 2.5), ('Relevé de genoux suspendu', 'Abdominaux', None, 'Poids du corps', 2.5), ('Crunch au sol', 'Abdominaux', None, 'Poids du corps', 2.5), ('Pallof press', 'Abdominaux', None, 'Poulie', 1.25),
    ('Adducteur à la poulie', 'Adducteur', None, 'Poulie', 1.25), ('Squat sumo haltère', 'Adducteur', 'Fessier', 'Haltères', 2),
    ('Mollets à la Smith', 'Mollets', None, 'Smith', 2.5), ('Mollets unilatéral haltère', 'Mollets', None, 'Haltères', 2),
    ('Développé épaules machine', 'Epaule', 'Triceps', 'Machine', 2.5), ('Oiseau machine', 'Epaule', None, 'Machine', 2.5), ('Face pull', 'Epaule', 'Trapèze', 'Poulie', 1.25), ('Développé Arnold', 'Epaule', 'Triceps', 'Haltères', 2),
    ('Barre au front', 'Triceps', None, 'Barre', 1.25), ('Kickback haltère', 'Triceps', None, 'Haltères', 1), ('Extension nuque haltère', 'Triceps', None, 'Haltères', 2), ('Dips machine', 'Triceps', 'Pectoraux', 'Machine', 2.5),
    ('Curl pupitre', 'Biceps', None, 'Barre', 1.25), ('Curl machine', 'Biceps', None, 'Machine', 2.5),
    ('Nordic curl', 'Ischio', None, 'Poids du corps', 2.5), ('Leg curl unilatéral', 'Ischio', None, 'Machine', 2.5),
    ('Pull-through à la poulie', 'Fessier', 'Ischio', 'Poulie', 2.5), ('Abduction à la poulie', 'Fessier', None, 'Poulie', 1.25),
    ('Front squat', 'Quadriceps', 'Fessier', 'Barre', 2.5), ('Sissy squat', 'Quadriceps', None, 'Poids du corps', 2.5),
]
# Leg curl (45 séries hors catalogue) : Vincent 05/08 → 17/08 et Alizé (toutes) = assis ; le reste (Vincent) = allongé.
LEGCURL_ASSIS = "(athlete_id = '2' or (athlete_id = '1' and date between '2026-08-05' and '2026-08-17'))"

def apply_to_dump(d):
    """Même transformation sur une copie locale (avant/après), sans toucher la base."""
    ex = d['exercices']; noms = {e['exercice']: e for e in ex}
    for e in ex:
        n = RENOMMAGES.get(e['exercice'], e['exercice']); e['exercice'] = n
        if n in MUSCLE: e['muscle'] = MUSCLE[n]
        if n in SECONDAIRE: e['muscle_secondaire'] = SECONDAIRE[n]
        e['materiel'] = materiel(n); e['increment_kg'] = petit_pas(e.get('increment_kg')); e['disciplines'] = 'muscu'; e['mesure'] = 'charge_reps'
    nid = max(int(e['exercice_id']) for e in ex)
    for (n, m, s, mt, pp) in NOUVEAUX:
        nid += 1; ex.append({'exercice_id': str(nid), 'exercice': n, 'muscle': m, 'muscle_secondaire': s, 'increment_kg': '%g' % pp, 'materiel': mt, 'disciplines': 'muscu', 'mesure': 'charge_reps'})
    byn = {e['exercice']: e for e in ex}
    for p in d['performances']:
        n = RENOMMAGES.get(p['exercice'], RENOMMAGES_HORS_CATALOGUE.get(p['exercice'], p['exercice']))
        if n == 'Leg curl': n = 'Leg curl assis' if (p['athlete_id'] == '2' or (p['athlete_id'] == '1' and '2026-08-05' <= p['date'] <= '2026-08-17')) else 'Leg curl allongé'
        p['exercice'] = n
        if n in MUSCLE: p['muscle'] = MUSCLE[n]
        if n in byn and n in ('Leg curl assis', 'Leg curl allongé'): p['exercice_id'] = byn[n]['exercice_id']
    for l in d['programme']:
        l['exercice'] = RENOMMAGES.get(l['exercice'], l['exercice'])
    for i in d.get('indicateurs', []):
        if i.get('cle') == 'exo_categories':
            try:
                c = json.loads(i['valeur']); i['valeur'] = json.dumps({RENOMMAGES.get(k, k): v for k, v in c.items()}, ensure_ascii=False)
            except Exception: pass
        elif i.get('cle') == 'exercices' and i.get('valeur'):
            i['valeur'] = ','.join(RENOMMAGES.get(x, x) for x in str(i['valeur']).split(','))
        elif i.get('cle') == 'exercice' and i.get('valeur') in RENOMMAGES:
            i['valeur'] = RENOMMAGES[i['valeur']]
    return d

def sql(cat_rows):
    o = ["-- Migration catalogue d'exercices — 06/11/2026 (générée par scripts/catalogue_migration.py). Une transaction : tout ou rien.", 'begin;', '']
    o += ["alter table exercices add column if not exists materiel text;", "alter table exercices add column if not exists disciplines text default 'muscu';",
          "alter table exercices add column if not exists mesure text default 'charge_reps';", "alter table exercices add column if not exists cree_par text;", '']
    o.append('-- 1. Renommages : catalogue, séances, programmes, indicateurs (exercice, liste d\'exercices, catégories)')
    for a, b in RENOMMAGES.items():
        for t in ('exercices', 'performances', 'programme'):
            o.append(f"update {t} set exercice = {SQ(b)} where exercice = {SQ(a)};")
        o.append(f"update indicateurs set valeur = {SQ(b)} where cle = 'exercice' and valeur = {SQ(a)};")
        o.append(f"update indicateurs set valeur = array_to_string(array(select case when x = {SQ(a)} then {SQ(b)} else x end from unnest(string_to_array(valeur, ',')) x), ',') where cle = 'exercices' and {SQ(a)} = any(string_to_array(valeur, ','));")
        o.append(f"update indicateurs set valeur = ((valeur::jsonb - {SQ(a)}) || jsonb_build_object({SQ(b)}, valeur::jsonb -> {SQ(a)}))::text where cle = 'exo_categories' and valeur::jsonb ? {SQ(a)};")
    for a, b in RENOMMAGES_HORS_CATALOGUE.items():
        o.append(f"update performances set exercice = {SQ(b)} where exercice = {SQ(a)};")
    o += ['', '-- 2. Leg curl (hors catalogue) → assis / allongé (décision du porteur)',
          f"update performances set exercice = 'Leg curl assis', exercice_id = (select exercice_id from exercices where exercice = 'Leg curl assis') where exercice = 'Leg curl' and {LEGCURL_ASSIS};",
          "update performances set exercice = 'Leg curl allongé', exercice_id = (select exercice_id from exercices where exercice = 'Leg curl allongé') where exercice = 'Leg curl';", '']
    o.append('-- 3. Muscles (clés internes du moteur) et secondaires')
    for n, m in MUSCLE.items():
        o.append(f"update exercices set muscle = {SQ(m)} where exercice = {SQ(n)};"); o.append(f"update performances set muscle = {SQ(m)} where exercice = {SQ(n)};")
    for n, s in SECONDAIRE.items():
        o.append(f"update exercices set muscle_secondaire = {SQ(s)} where exercice = {SQ(n)};")
    o += ['', '-- 4. Matériel, petit pas (un nombre), discipline, type de mesure — exercices existants']
    for e in cat_rows:
        n = RENOMMAGES.get(e['exercice'], e['exercice'])
        o.append(f"update exercices set materiel = {SQ(materiel(n))}, increment_kg = {SQ(petit_pas(e.get('increment_kg')))}, disciplines = 'muscu', mesure = 'charge_reps' where exercice = {SQ(n)};")
    o += ['', '-- 5. 29 nouveaux exercices (choix du porteur)']
    for (n, m, s, mt, pp) in NOUVEAUX:
        o.append(f"insert into exercices (exercice_id, exercice, muscle, muscle_secondaire, increment_kg, materiel, disciplines, mesure, cree_par) select (select (max(exercice_id::int) + 1)::text from exercices), {SQ(n)}, {SQ(m)}, {SQ(s)}, {SQ('%g' % pp)}, {SQ(mt)}, 'muscu', 'charge_reps', 'novalyz' where not exists (select 1 from exercices where exercice = {SQ(n)});")
    o += ['', "-- 6. Programme de test de John (athlete 3) : noms génériques → catalogue ; « Gainage » supprimé (mesure en temps)"]
    for a, b in JOHN.items():
        o.append(f"update programme set exercice = {SQ(b)} where athlete_id = '3' and trim(exercice) = {SQ(a)};")
    o.append("delete from programme where athlete_id = '3' and trim(exercice) = 'Gainage';")
    o += ['', 'commit;']
    return '\n'.join(o) + '\n'

if __name__ == '__main__':
    cat = json.load(open(sys.argv[1]))
    open(sys.argv[2], 'w').write(sql(cat))
    print('ok', sys.argv[2])
