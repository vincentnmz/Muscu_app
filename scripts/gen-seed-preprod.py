"""Génère supabase/seed-preprod.sql (données de DÉMO pour la base de préprod).

Source : instantané local des comptes FICTIFS du coach démo 0202 (« jim »),
John et Lucas Moreau (aucune donnée réelle). Les dates sont décalées au
chargement (multiple de 7 jours → mêmes jours de la semaine) pour que la
dernière séance tombe dans la semaine en cours.
Usage : python3 scripts/gen-seed-preprod.py <db_demo4.json>  (écrit le .sql)
"""
import json, sys, hashlib, collections, re, datetime

SRC = sys.argv[1]
OUT = 'supabase/seed-preprod.sql'
MDP_TEST = 'demo2026'  # mot de passe de TEST (préprod uniquement, comptes fictifs)
d = json.load(open(SRC, encoding='utf8'))

def q(v):
    if v is None: return 'null'
    if isinstance(v, bool): return 'true' if v else 'false'
    if isinstance(v, (int, float)): return ('%g' % v) if isinstance(v, float) else str(v)
    if isinstance(v, (dict, list)): return "'" + json.dumps(v, ensure_ascii=False).replace("'", "''") + "'::jsonb"
    return "'" + str(v).replace("'", "''") + "'"
def n(v): return '' if v is None else ('%g' % v)
def ymd(s): return s.replace('-', '')[2:]

out = []
W = out.append
W("""-- =============================================================================
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
""")

# --- décalage de dates (multiple de 7 j) ---
last = max(r['date'] for r in d['performances'])
W("create temp table _seed_off on commit drop as select (7 * floor(((current_date - 1) - date '%s') / 7.0))::int as j;" % last)
SH = "(%s::date + (select j from _seed_off))"

ids = ['3', 'demo_4_lucas']
W("-- Nettoyage des comptes démo (rejouable)")
for t in ['activite_sources']:
    W("delete from public.activite_sources where activity_id in (select id from public.activites where athlete_id in ('3','demo_4_lucas'));")
for t in ['activites', 'performances', 'indicateurs', 'bien_etre', 'programme', 'poids_historique', 'objectif', 'contexte_athlete', 'planning', 'commentaires', 'blessures', 'objectifs', 'tests', 'pauses', 'notes', 'alertes_historique']:
    W("delete from public.%s where athlete_id in ('3','demo_4_lucas');" % t)
W("delete from public.athletes where id in ('3','demo_4_lucas');")
W("delete from public.coachs where coach_id = '4';")

# --- catalogue ---
W("\n-- Catalogue d'exercices (identique à la prod au 09/11/2026)")
cols = ['exercice_id', 'exercice', 'muscle', 'muscle_secondaire', 'increment_kg', 'materiel', 'disciplines', 'mesure', 'cree_par', 'statut', 'nom_cle']
W("insert into public.exercices (%s) values" % ','.join(cols))
W(',\n'.join('(' + ','.join(q(r.get(c)) for c in cols) + ')' for r in sorted(d['exercices'], key=lambda r: r['exercice_id'])) + "\non conflict (exercice_id) do nothing;")
W("delete from public.volume_obti;")
W("insert into public.volume_obti (muscle, series_min_semaine, series_opt_semaine, series_max_semaine) values")
W(',\n'.join('(%s,%s,%s,%s)' % (q(r['muscle']), q(r['series_min_semaine']), q(r['series_opt_semaine']), q(r['series_max_semaine'])) for r in sorted(d['volume_obti'], key=lambda r: r['id'])) + ';')

# --- comptes ---
h = hashlib.sha256(MDP_TEST.encode()).hexdigest()
c = d['coachs'][0]
W("\n-- Comptes démo (mot de passe de test, ancien format → salé à la 1re connexion)")
W("insert into public.coachs (coach_id, login, nom, password_hash, sport, role, prefs) values (%s,%s,%s,%s,%s,%s,'{}'::jsonb);" % (q(c['coach_id']), q(c['login']), q(c['nom']), q(h), q(c['sport']), q(c['role'])))
acols = ['id', 'login', 'login_coach', 'nom', 'ddn', 'taille', 'annees', 'strategie', 'coach_id', 'sport', 'poste', 'jambe_dominante', 'poids', 'antecedents', 'sexe', 'club', 'categorie', 'discipline']
for a in d['athletes']:
    W("insert into public.athletes (%s, password_hash) values (%s, %s);" % (','.join(acols), ','.join(q(a.get(k)) for k in acols), q(h)))

# --- performances (encodées) ---
P = d['performances']
combos = sorted(set((r['seance_id'], r['nom'], r['exercice'], r['muscle'], r['exercice_id'], r['repos']) for r in P), key=str)
ci = {x: i for i, x in enumerate(combos)}
sess = collections.OrderedDict()
for r in sorted(P, key=lambda r: (r['athlete_id'], r['date'], r['seance_id'], r['exercice'], r['serie'])):
    k = ci[(r['seance_id'], r['nom'], r['exercice'], r['muscle'], r['exercice_id'], r['repos'])]
    sess.setdefault((r['athlete_id'], r['date']), collections.OrderedDict()).setdefault(k, []).append(r)
lines = []
for (a, dt), ex in sess.items():
    parts = []
    for k, v in ex.items():
        assert [x['serie'] for x in v] == list(range(1, len(v) + 1))
        assert len(set(x['charge'] for x in v)) == 1
        rpe = '/'.join(n(x['rpe']) for x in v)
        parts.append('%d:%s:%s%s' % (k, n(v[0]['charge']), '/'.join(n(x['reps']) for x in v), '' if rpe == '7/8/9' else ':' + rpe))
    lines.append(('J' if a == '3' else 'L') + ymd(dt) + '=' + ' '.join(parts))
W("\n-- Séances : combinaisons (séance, exercice, muscle, id, repos) puis séries encodées")
W("create temp table _combo (k int, seance_id text, nom text, exercice text, muscle text, exercice_id text, repos int) on commit drop;")
W("insert into _combo values " + ','.join('(%d,%s,%s,%s,%s,%s,%s)' % (i, q(x[0]), q(x[1]), q(x[2]), q(x[3]), q(x[4]), q(x[5])) for i, x in enumerate(combos)) + ';')
W("create temp table _perf_txt (t text) on commit drop;")
W("insert into _perf_txt values ($perf$\n" + '\n'.join(lines) + "\n$perf$);")
W("""with l as (select regexp_split_to_table(t, E'\\n') s from _perf_txt), s as (
  select case left(s,1) when 'J' then '3' else 'demo_4_lucas' end aid,
         to_date('20' || substr(s,2,6), 'YYYYMMDD') d, split_part(s,'=',2) body from l where s like '_%=%'),
e as (select aid, d, regexp_split_to_table(body, ' ') ex from s),
p as (select aid, d, split_part(ex,':',1)::int k, nullif(split_part(ex,':',2),'')::numeric charge,
             string_to_array(split_part(ex,':',3), '/') reps,
             string_to_array(coalesce(nullif(split_part(ex,':',4),''), '7/8/9'), '/') rpe from e)
insert into public.performances (date, semaine, seance_id, nom, athlete_id, exercice, muscle, exercice_id, serie, charge, reps, rpe, repos, volume)
select p.d + (select j from _seed_off), extract(week from p.d + (select j from _seed_off))::int, c.seance_id, c.nom, p.aid, c.exercice, c.muscle, c.exercice_id,
       i, p.charge, p.reps[i]::int, p.rpe[i]::numeric, c.repos, round(coalesce(p.charge,0) * p.reps[i]::int)
from p join _combo c on c.k = p.k, generate_subscripts(p.reps, 1) i;""")

# --- bien-être ---
bcols = ['sommeil', 'energie', 'fatigue_musculaire', 'douleur', 'zone_douloureuse', 'ressenti_global', 'note', 'motivation', 'stress', 'courbatures']
bl = []
for r in sorted(d['bien_etre'], key=lambda r: (r['athlete_id'], r['date'])):
    assert r['seance_id'] is None
    vals = [('' if r[c] is None else (n(r[c]) if isinstance(r[c], (int, float)) else str(r[c]))) for c in bcols]
    assert all(',' not in v for v in vals)
    bl.append(('J' if r['athlete_id'] == '3' else 'L') + ymd(r['date']) + '=' + ','.join(vals))
W("\n-- Bien-être (sommeil,energie,fatigue,douleur,zone,ressenti,note,motivation,stress,courbatures)")
W("create temp table _be_txt (t text) on commit drop;")
W("insert into _be_txt values ($be$\n" + '\n'.join(bl) + "\n$be$);")
W("""with l as (select regexp_split_to_table(t, E'\\n') s from _be_txt), s as (
  select case left(s,1) when 'J' then '3' else 'demo_4_lucas' end aid, to_date('20' || substr(s,2,6), 'YYYYMMDD') d,
         string_to_array(split_part(s,'=',2), ',') v from l where s like '_%=%')
insert into public.bien_etre (date, athlete_id, sommeil, energie, fatigue_musculaire, douleur, zone_douloureuse, ressenti_global, note, motivation, stress, courbatures)
select d + (select j from _seed_off), aid, nullif(v[1],'')::numeric, nullif(v[2],'')::numeric, nullif(v[3],'')::numeric, nullif(v[4],'')::numeric,
       nullif(v[5],''), nullif(v[6],''), nullif(v[7],'')::numeric, nullif(v[8],'')::smallint, nullif(v[9],'')::smallint, nullif(v[10],'')::smallint from s;""")

# --- indicateurs (cardio + Hyrox + préférence) ---
I = d['indicateurs']
units = {}
for r in I:
    units.setdefault(r['cle'], set()).add(r['unite'] or '')
assert all(len(v) == 1 for v in units.values()), {k: v for k, v in units.items() if len(v) > 1}
assert all((r['source'] or '') in ('saisie', 'app') for r in I)
grp = collections.OrderedDict()
for r in sorted(I, key=lambda r: (r['athlete_id'], r['date'], r['seance_id'], r['cle'])):
    grp.setdefault((r['athlete_id'], r['date'], r['seance_id'], r['source']), []).append(r)
il = []
for (a, dt, sid, src), rows in grp.items():
    for r in rows: assert all(ch not in str(r['valeur']) for ch in ',=|')
    il.append(('J' if a == '3' else 'L') + ymd(dt) + '|' + sid + '|' + src + '=' + ','.join(r['cle'] + ':' + str(r['valeur']) for r in rows))
W("\n-- Indicateurs (cardio, Hyrox, préférences) : séance|source=cle:valeur,…  (unités par clé)")
W("create temp table _unite (cle text primary key, unite text) on commit drop;")
W("insert into _unite values " + ','.join('(%s,%s)' % (q(k), q(list(v)[0])) for k, v in sorted(units.items())) + ';')
W("create temp table _ind_txt (t text) on commit drop;")
W("insert into _ind_txt values ($ind$\n" + '\n'.join(il) + "\n$ind$);")
W("""with l as (select regexp_split_to_table(t, E'\\n') s from _ind_txt), s as (
  select case left(s,1) when 'J' then '3' else 'demo_4_lucas' end aid, to_date('20' || substr(s,2,6), 'YYYYMMDD') d,
         split_part(split_part(s,'=',1),'|',2) sid, split_part(split_part(s,'=',1),'|',3) src, split_part(s,'=',2) body from l where s like '_%=%'),
kv as (select aid, d, sid, src, regexp_split_to_table(body, ',') x from s)
insert into public.indicateurs (date, athlete_id, seance_id, cle, valeur, unite, source)
select d + (select j from _seed_off), aid, sid, split_part(x,':',1), substr(x, length(split_part(x,':',1)) + 2), u.unite, src
from kv join _unite u on u.cle = split_part(x,':',1);""")
W("""-- Activités (journal unifié) dérivées des séances cardio, comme à la saisie
insert into public.activites (athlete_id, seance_id, type, debut, duree_s, distance_m, source_primaire, statut)
select athlete_id, seance_id, max(valeur) filter (where cle = 'type_cardio'), min(date)::timestamptz,
       round(max(valeur) filter (where cle = 'duree')::numeric * 60)::int,
       round(max(valeur) filter (where cle = 'distance')::numeric * 1000),
       'manual', 'complete'
from public.indicateurs where athlete_id in ('3','demo_4_lucas') and seance_id like 'cardio%' group by athlete_id, seance_id;
insert into public.activite_sources (activity_id, source, source_ref)
select id, 'manual', seance_id from public.activites where athlete_id in ('3','demo_4_lucas');""")

# --- programme, poids, objectif ---
pcols = ['athlete_id', 'athlete_nom', 'seance_id', 'exercice', 'series_prevues', 'reps_mini', 'reps_max', 'repos_sec', 'groupe_id', 'jour', 'charge_pct_1rm', 'rpe_cible', 'type', 'cardio_cible', 'cardio_unite', 'schema', 'backoff_pct', 'series_json']
W("\n-- Programme")
W("insert into public.programme (%s) values\n" % ','.join(pcols) + ',\n'.join('(' + ','.join(q(r.get(c)) for c in pcols) + ')' for r in sorted(d['programme'], key=lambda r: r['id'])) + ';')
W("\n-- Poids (John + Lucas) et objectif")
poids = [(r['athlete_id'], r['date'], r['poids']) for r in d['poids_historique']]
LUCAS = "2026-03-08:71.0 2026-03-22:71.6 2026-04-05:71.3 2026-04-19:71.8 2026-05-03:72.3 2026-05-17:72.1 2026-05-31:72.5 2026-06-14:73.1 2026-06-28:72.8 2026-07-12:73.3 2026-07-26:73.8 2026-08-09:73.6 2026-08-23:74.0 2026-09-06:74.6 2026-09-20:74.3 2026-10-04:74.8 2026-10-18:75.3 2026-11-01:75.1"
if not any(a == 'demo_4_lucas' for a, _, _ in poids):
    poids += [('demo_4_lucas', x.split(':')[0], float(x.split(':')[1])) for x in LUCAS.split()]
W("insert into public.poids_historique (date, athlete_id, poids) values\n" + ',\n'.join('(%s, %s, %s)' % (SH % q(dt), q(a), q(p)) for a, dt, p in sorted(poids)) + ';')
for o in d['objectif']:
    W("insert into public.objectif (athlete_id, nom, poids_kg, date_poids, objectif, seances_semaine) values (%s,%s,%s,%s,%s,%s);" % tuple(q(o.get(k)) for k in ['athlete_id', 'nom', 'poids_kg', 'date_poids', 'objectif', 'seances_semaine']))

W("""
-- Préprod = 100 % démo : tous les comptes marqués is_demo (si la colonne existe)
do $demo$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='athletes' and column_name='is_demo') then
    update public.athletes set is_demo = true; update public.coachs set is_demo = true;
  end if;
end $demo$;""")
W("\n-- Contrôle final")
W("""do $chk$
declare np int; nb int; ni int;
begin
  select count(*) into np from public.performances where athlete_id in ('3','demo_4_lucas');
  select count(*) into nb from public.bien_etre where athlete_id in ('3','demo_4_lucas');
  select count(*) into ni from public.indicateurs where athlete_id in ('3','demo_4_lucas');
  if np <> %d or nb <> %d or ni <> %d then raise exception 'Seed incomplet : perf %%, bien-être %%, indicateurs %%', np, nb, ni; end if;
end $chk$;""" % (len(P), len(d['bien_etre']), len(I)))

open(OUT, 'w', encoding='utf8').write('\n'.join(out) + '\n')
print(OUT, sum(len(x) for x in out), 'caractères')
