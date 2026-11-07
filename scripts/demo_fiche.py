# Génère la fiche « Exemple » de la visite coach (07/11) : données 100 % FICTIVES (aucun athlète réel),
# passées dans le VRAI moteur (handleGetAppData via .work/audit/replay2.cjs) → assets/demo/fiche-exemple.json.
# Usage : python3 scripts/demo_fiche.py <db_catalogue.json> <sortie_db.json>
import json, sys, datetime as dt, random
random.seed(7)
cat = json.load(open(sys.argv[1]))
EX = {e['exercice']: e for e in cat.get('exercices', [])}
AID, NOM = '__demo__', 'Léo Exemple'
FIN = dt.date(2026, 11, 7)               # samedi : fin des données (décalées à la date du jour à l'affichage)
LUN0 = FIN - dt.timedelta(days=5 + 7 * 5)  # lundi, 6 semaines avant
PROG = {
  'Haut A': (1, [('Développé couché barre', 4, 6, 8, 70, 2.5), ('Rowing barre', 4, 8, 10, 60, 2.5), ('Développé militaire aux haltères', 3, 8, 10, 20, 2), ('Curl barre', 3, 10, 12, 30, 2.5)]),
  'Bas A':  (2, [('Squat', 4, 6, 8, 90, 2.5), ('Leg curl assis', 3, 10, 12, 45, 2.5), ('Presse inclinée', 3, 10, 12, 140, 5), ('Mollets debout', 3, 12, 15, 60, 2.5)]),
  'Haut B': (4, [('Développé couché incliné haltère', 3, 8, 10, 26, 2), ('Tirage vertical prise large', 4, 8, 10, 55, 2.5), ('Élévation latérale haltère', 3, 12, 15, 10, 1), ('Extension poulie corde', 3, 10, 12, 25, 2.5)]),
  'Bas B':  (5, [('Soulevé de terre', 3, 5, 6, 110, 2.5), ('Fente bulgare', 3, 8, 10, 18, 2), ('Leg extension', 3, 10, 12, 50, 2.5), ('Hip thrust', 3, 8, 10, 90, 5)]),
}
for s, (_, ex) in PROG.items():
  for e in ex: assert e[0] in EX, e[0]
perfs, pid = [], 1
for w in range(6):
  for sid, (jour, exs) in PROG.items():
    if w == 5 and sid == 'Bas B': continue            # semaine en cours : 3/4
    d = LUN0 + dt.timedelta(days=7 * w + jour - 1)
    for (nom, n, rmin, rmax, c0, inc) in exs:
      if nom == 'Squat' and w >= 3: charge, base = c0 + inc * 2, rmin  # BLOQUÉ : même charge × reps depuis 3 séances
      else: charge, base = c0 + inc * (w // 2), rmin + (w % 2) * 2
      for k in range(n):
        reps = max(rmin - 1, min(rmax, base - (k // 2)))
        rpe = 9 if (nom == 'Squat' and w >= 3) else 7 + (k >= n - 1)
        perfs.append({'id': pid, 'date': d.isoformat(), 'semaine': d.isocalendar()[1], 'seance_id': sid, 'nom': NOM, 'athlete_id': AID,
          'exercice': nom, 'muscle': EX[nom]['muscle'], 'exercice_id': EX[nom]['exercice_id'], 'serie': k + 1, 'charge': charge, 'reps': reps,
          'rpe': rpe, 'repos': 120, 'volume': charge * reps, 'created_at': d.isoformat() + 'T18:00:00+00:00'}); pid += 1
prog, i = [], 1
for sid, (jour, exs) in PROG.items():
  for (nom, n, rmin, rmax, c0, inc) in exs:
    prog.append({'id': i, 'athlete_id': AID, 'athlete_nom': NOM, 'seance_id': sid, 'exercice': nom, 'series_prevues': n, 'reps_mini': rmin, 'reps_max': rmax,
      'repos_sec': 120, 'groupe_id': '', 'jour': jour, 'charge_pct_1rm': None, 'rpe_cible': None, 'type': 'muscu', 'cardio_cible': None, 'cardio_unite': None, 'schema': None}); i += 1
be = []
for k in range(40):
  d = FIN - dt.timedelta(days=k)
  if d.weekday() == 6 and k > 7: continue
  mauvaise = k <= 5                                      # semaine récente : sommeil moins bon (piste du blocage)
  # Échelles de l'app : sommeil / énergie 1-5 (5 = très bon) ; fatigue, douleur, stress, courbatures 1-5 (1 = aucune).
  be.append({'id': k + 1, 'date': d.isoformat(), 'seance_id': 'Libre', 'athlete_id': AID, 'sommeil': 2 if mauvaise else random.choice([4, 4, 5]),
    'energie': None, 'fatigue_musculaire': 3 if mauvaise else random.choice([1, 2]), 'douleur': 1, 'zone_douloureuse': None, 'ressenti_global': '3' if mauvaise else '4',
    'note': None, 'created_at': d.isoformat() + 'T07:30:00+00:00', 'motivation': None, 'stress': 3 if mauvaise else random.choice([1, 2]), 'courbatures': 2 if mauvaise else 1})
poids = [{'id': k + 1, 'date': (FIN - dt.timedelta(days=7 * k)).isoformat(), 'athlete_id': AID, 'athlete_nom': NOM, 'poids': round(78.4 - 0.2 * k, 1), 'created_at': None} for k in range(6)]
db = {k: [] for k in ['athletes', 'programme', 'poids_historique', 'bien_etre', 'volume_obti', 'contexte_athlete', 'objectif', 'blessures', 'planning', 'exercices', 'performances', 'indicateurs']}
db['athletes'] = [{'id': AID, 'nom': NOM, 'login': '0000', 'sport': 'muscu', 'annees': 3, 'taille': 178, 'sexe': 'H', 'ddn': '1998-04-12', 'coach_id': 'demo', 'created_at': (LUN0 - dt.timedelta(days=10)).isoformat() + 'T08:00:00+00:00'}]
db['programme'], db['performances'], db['bien_etre'], db['poids_historique'], db['exercices'] = prog, perfs, be, poids, cat['exercices']
json.dump(db, open(sys.argv[2], 'w'), ensure_ascii=False)
print(len(perfs), 'séries ·', len(be), 'questionnaires')
