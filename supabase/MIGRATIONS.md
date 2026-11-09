# Journal des migrations — Novalyz

> **But** : savoir à tout moment ce qui est appliqué sur chaque base, et changer le schéma sans risque.
> Bases : **PROD** = « Novalyz Project » (`jhbrvgguybynzeceeceu`) · **PRÉPROD** = « Novalyz Preprod » (`vqxkeqjaqkkmtzxvqvhi`, démo uniquement).
> Mis en place le **09/11/2026** (audit d'architecture, priorité 1). Vérifié par `tests/migrations-journal.test.js`.

## 1. La règle (à suivre pour TOUT changement de schéma)

1. **Un fichier par changement** dans `supabase/migrations/`, nommé `AAAAMMJJHHMMSS_nom_court.sql` (horodatage UTC), **idempotent** (`if not exists`, `create or replace`…) et **sans aucun secret**.
2. **Préprod d'abord** : appliquer (outil `apply_migration` ou Supabase ▸ SQL Editor du projet *Novalyz Preprod*), tester l'app sur `/dev/` ou l'APK Dev.
3. **Prod ensuite**, **seulement avec l'accord du porteur**, le même fichier, tel quel.
4. **Mettre à jour le tableau §2** (date d'application sur chaque base) dans le même commit.
5. Vérifier que les deux bases sont identiques : `supabase/empreinte-schema.sql` lancé sur chacune → les 3 empreintes doivent être égales.

> Les **données** (comptes démo, etc.) ne sont **pas** des migrations : préprod → `supabase/seed-preprod.sql`.
> Les **jobs pg_cron** contiennent un secret (`CRON_SECRET`) : ils ne sont pas versionnés tels quels, voir §4.

## 2. État des bases

| Migration (`supabase/migrations/`) | Contenu | PRÉPROD | PROD |
|---|---|---|---|
| `20261109120000_schema_initial.sql` | Schéma de référence : 28 tables, clés, index, RLS fermé, buckets privés | ✅ appliquée 09/11/2026 | ✅ **référence** — décrit la prod telle qu'elle est au 09/11 (lu sur la prod, empreintes identiques) : rien à appliquer |
| `20261109150000_rls_auto_enable.sql` | Déclencheur `ensure_rls` : toute nouvelle table naît avec RLS | ✅ appliquée 09/11/2026 | ✅ **déjà présent** (créé hors dépôt avant le 09/11 ; fonction identique, empreinte vérifiée) : rien à appliquer |
| `20261109170000_is_demo.sql` | Colonne `is_demo` (athletes, coachs) : comptes démo/test exclus des envois automatiques | ✅ appliquée 09/11/2026 (+ tous les comptes marqués démo) | ✅ appliquée 09/11/2026 (accord porteur) |
| `20261110090000_envois_recus.sql` | Table `envois_recus` (anti-doublon des envois de séance, UNIQUE athlete_id+envoi_id) + reprise des marqueurs `indicateurs.envoi_id` | ✅ appliquée 10/11/2026 | ✅ appliquée 09/11/2026 (accord porteur ; 4 marqueurs repris, empreintes du reste du schéma inchangées ; anciens marqueurs conservés) |

## 3. Historique avant le 09/11/2026 (prod)

Avant ce journal, le schéma a été construit en trois façons. **Tout ce qui suit est inclus dans `schema_initial`** ; vérifié présent en prod le 09/11/2026.

**a) Tables créées dans le tableau de bord** (migration depuis Google Sheets, aucun script) : `athletes`, `coachs`, `performances`, `indicateurs`, `bien_etre`, `blessures`, `commentaires`, `contexte_athlete`, `exercices`, `google_health_tokens`, `notes`, `objectif`, `objectifs`, `pauses`, `poids_historique`, `programme`, `push_subscriptions`, `tests`, `volume_obti`, `alertes_historique`, `alertes_traitees` + fonction `rls_auto_enable` / déclencheur `ensure_rls`.

**b) Scripts `supabase/*.sql` collés à la main** (SQL Editor) — gardés comme archive, **ne plus les relancer** :

| Fichier | Effet | Vérifié en prod (09/11) |
|---|---|---|
| `activites.sql` | tables `activites`, `activite_sources` | ✅ |
| `athletes_email.sql` | `athletes.email` | ✅ |
| `auth_securite_v1.sql` | `login_echecs`, `sess_depuis`, `email_verifie` | ✅ |
| `beta_inscriptions.sql` | table `beta_inscriptions` + droits retirés | ✅ |
| `bien_etre_hooper.sql` | `bien_etre.stress`, `courbatures` | ✅ |
| `bien_etre_motivation.sql` | `bien_etre.motivation` | ✅ |
| `coach_profil.sql` | `coachs.email`, `club`, `categorie_defaut` | ✅ |
| `coachs_prefs.sql` | `coachs.prefs` | ✅ |
| `cron-alertes.sql` | job `novalyz-alertes-matin` | ✅ (voir §4) |
| `cron-resumes.sql` | jobs `novalyz-resume-hebdo` / `-mensuel` | ⚠️ **obsolète** : remplacés en prod par `novalyz-recaps-auto` (§4) |
| `migration-catalogue-2026-11.sql` | colonnes catalogue + renommages d'exercices | ✅ (noms renommés présents) |
| `migration-exercices-statut-2026-11.sql` | `exercices.statut`, `nom_cle` + index unique + contrôle | ✅ |
| `native_push_tokens.sql` + `_v2.sql` | table + clé (token, athlete_id) | ✅ |
| `password_reset_tokens.sql` | table + index | ✅ |
| `planning.sql` | table `planning` + index | ✅ |
| `programme_jour.sql` / `programme_schemas.sql` | colonnes programme (jour, %1RM, RPE, schéma, séries JSON…) | ✅ |

**c) Migrations enregistrées par Supabase en prod** (table `supabase_migrations.schema_migrations`, via l'outil) : `programme_cardio_items` (22/09), `p0_2_entite_activite` (22/09), `commentaires_media_columns` (30/09), `create_planning_agenda` (24/10), `native_push_tokens_v2_pk_token_athlete` (01/11), `auth_securite_v1` (02/11), `coachs_prefs` (05/11), `exercices_statut_nom_cle` + `exercices_nom_cle_unique` (07/11), `beta_inscriptions_site` + `beta_inscriptions_revoke_public` (07/11).

## 4. Jobs planifiés (pg_cron) — PROD uniquement

Jamais en préprod (ils enverraient des e-mails / notifications). Définition réelle en prod au 09/11/2026 (le secret est remplacé par `<CRON_SECRET>`) :

| Job | Horaire (UTC) | Appel |
|---|---|---|
| `novalyz-alertes-matin` | `0 7 * * *` (tous les jours 7 h) | `POST smooth-service` `{"action":"cronPushAlertes","secret":"<CRON_SECRET>"}` (timeout 120 s) |
| `novalyz-recaps-auto` | `10 7 * * *` (tous les jours 7 h 10) | `POST smooth-service` `{"action":"cronResumesAuto","secret":"<CRON_SECRET>"}` |

Lire l'état : `select jobname, schedule, active from cron.job;`

## 4bis. Opérations de données notables

| Date | Base | Opération | Accord |
|---|---|---|---|
| 09/11/2026 | PROD | `is_demo = true` : athlètes `3` (John), `demo_4_lucas`, `4` (Yann), `5` (zinedine), `6`–`11`, `demo_3_*`, `demo_4_*` (38) ; coachs `2` (ju), `3` (demofoot), `4` (jim), `5` (Test Coach). Restent réels : athlètes 1, 2, 12–17 ; coach 1. | « Garder + marquer démo », comptes de test confirmés par le porteur |
| 09/11/2026 | PRÉPROD | `is_demo = true` sur tous les comptes (préprod = 100 % démo) | — |

## 5. Écarts connus / à traiter plus tard

- `cron-resumes.sql` décrit d'anciens jobs (hebdo/mensuel) qui n'existent plus en prod → archive, ne pas relancer.
- Données de démo en prod : **marquées `is_demo`** (09/11) et gardées pour les démonstrations ; exclues des alertes push et résumés e-mail automatiques.
- Table `indicateurs` fourre-tout → sortie progressive de `pref` / `alerte_*` — audit P1.
