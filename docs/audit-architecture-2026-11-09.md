# Novalyz — Audit architecture, qualité et maintenabilité (09/11/2026)

> Rapport livré au porteur le 09/11/2026, **recopié ici le 10/11** (il n'avait pas été enregistré dans le dépôt).
> Le texte de l'audit est **inchangé** (sections 1 à 24). L'**état d'avancement** est tenu à jour juste en dessous.
> Légende : **[V]** vérifié · **[D]** déduction · **[?]** inconnu, à vérifier.

## ▶ État d'avancement du plan (§24) — tenu à jour

| Prio | Point | État | Où / preuve |
|---|---|---|---|
| P0 | Vérifier `AUTH_ENFORCE=1` | ✅ fait 09/11 (vérifié actif en prod) | `docs/etat-en-cours.md` |
| P0 | CI = `npm test` complet, Node 22 | ✅ fait 09/11 | `.github/workflows/tests.yml` |
| P0 | Retirer à `anon` / `authenticated` l'exécution de `rls_auto_enable()` | 🟡 préprod faite 10/11 (`20261110190000_rls_auto_enable_droits.sql`) · prod en attente d'accord. Recensement : c'est la **seule** fonction SECURITY DEFINER exposée à `anon` / `authenticated` (prod et préprod) | `supabase/MIGRATIONS.md` |
| P1 | Préprod séparée | ✅ fait 09/11 | projet `vqxkeqjaqkkmtzxvqvhi`, `js/env.js`, `deploy-backend-preprod.yml` |
| P1 | Migrations versionnées + journal | ✅ fait 09/11 | `supabase/migrations/`, `supabase/MIGRATIONS.md`, `supabase/empreinte-schema.sql` |
| P1 | Données de démo (`is_demo`) | ✅ fait 09/11 | migration `20261109170000`, `_comptesDemo()` |
| P1 | Sortie d'`indicateurs` | 🟡 en cours | ✅ `envoi_id` → `envois_recus` · ✅ `pref` → `athletes.prefs` · ✅ quotas IA/morpho → `quotas_jour` · ⏳ récompenses (préprod, après observation ; preuve du verrou PostgreSQL demandée) · ⏳ `alerte_*` · ⏳ suppression des anciennes lignes après observation |
| P1 | Décision hachage (S4) | ✅ fait 10/11 — option C (`w1` = PBKDF2 600 000 tours sur le s2), 53 comptes convertis | `docs/note-hachage-mdp-2026-11-10.md` ; ⏳ supprimer `password_hash_s2` après observation |
| P2 | Test « chaque route est couverte par les droits » | ⏳ | |
| P2 | Test Playwright de bout en bout en CI | ⏳ | |
| P2 | README + carte d'`app.js` + dictionnaire d'`indicateurs` + CLAUDE.md à jour | ⏳ | |
| P2 | Nouveau code en fichiers séparés (modèle `lecture-v3.js`) | ⏳ (règle à écrire dans CLAUDE.md) | |
| P3 | Une seule fonction réseau (délai max, message, trace) ; plus de `catch {}` vides sur réseau / écriture | ⏳ | |
| P3 | Un seul module de dates ; trancher `_maShortDate` | ⏳ | |
| P3 | Une seule source de seuils ; ACWR côté serveur seulement | ⏳ | |
| P3 | Écriture de séance transactionnelle | ⏳ | |
| P4 | Index `(athlete_id, date)` ; minification ; jeton en en-tête | ⏳ | |
| P5 | Archivage de l'héritage, `Docs/` → `docs/` | ⏳ | |

---

## 1. Résumé exécutif

**Verdict court** : la base est saine sur le fond et fragile sur la forme. Elle reste utilisable pour continuer, à condition de mettre quelques garde-fous en place maintenant.

**Ce qui est solide [V]** : toute la base est fermée au public (RLS actif sur les 28 tables, sans policy ; clé `service_role` seulement dans la fonction serveur ; aucune clé Supabase dans le front) · sessions signées (HMAC), droits contrôlés par athlète, par coach et par ligne · moteur d'analyse déterministe, seuils centralisés · 86 suites de tests qui exécutent le vrai `index.ts` sur une base simulée · documentation de travail abondante.

**Ce qui est fragile [V]** : front dans un seul fichier de 29 168 lignes (`js/app.js`, 2,2 Mo, 1 617 fonctions globales, 449 `onclick` dans des chaînes HTML) · backend dans un seul fichier (`index.ts`, 7 912 lignes, 119 entrées de routage), déployé par copier-coller · 893 `catch {}` vides dans le front · table `indicateurs` fourre-tout (type codé dans un préfixe de `seance_id`) · préprod et prod sur le même backend et la même base · CI qui ne lance qu'un fichier de test.

| Question | Réponse |
|---|---|
| Dette technique | 🟠 Importante, mais pas critique |
| Peut-on continuer avec Claude ? | 🟡 Oui, mais avec des garde-fous (§15) |
| Problème critique confirmé | Aucun. Un seul conditionnel : `AUTH_ENFORCE=1` (§17) |

## 2. Stack technique

| Élément | Constat | Statut |
|---|---|---|
| Front | PWA JavaScript « vanilla » : `index.html` (3 517 l.), `js/app.js` (29 168), `js/lecture-v3.js` (532), `js/notifications.js`, `js/platform.js`, 4 CSS, `sw.js` | [V] |
| Framework | Aucun (pas de bundler, pas de modules ES, portée globale partagée) | [V] |
| Langages | JS (front) · TypeScript/Deno (backend) · SQL · Kotlin/Gradle (coque Android) | [V] |
| Build | `scripts/build-www.mjs` copie dans `www/` (Capacitor). Pas de minification, pas de vérification de types | [V] |
| Natif | Capacitor 8 ; plugins push, app, app-update, capacitor-health (patch-package) | [V] |
| Backend | Une Edge Function `supabase/functions/handler/index.ts` (en ligne : `smooth-service`) ; `npm:@supabase/supabase-js@2` (non figé), `npm:web-push@3.6.7` | [V] |
| Base | Postgres Supabase, 28 tables `public` + schéma `sauvegarde` ; client serveur en `service_role` | [V] |
| Authentification | Maison sur `athletes` / `coachs` ; s2 = SHA-256(login\|PEPPER\|mdp) ; jeton HMAC 30 j dans l'URL (`_t`) ; blocage 5 échecs / 15 min | [V] |
| Stockage | 2 buckets privés (`coach-media`, `suivi-photos`), envoi par URL signée | [V] |
| Services externes | Resend, FCM HTTP v1, Web Push VAPID, Anthropic, Strava / Health Connect | [V] |
| Tâches planifiées | pg_cron `novalyz-alertes-matin` (7 h) et `novalyz-recaps-auto` (7 h 10) via pg_net | [V] |
| Tests | 86 suites node (`npm test`, ≈ 13 s), sans framework | [V] |
| CI | `tests.yml` ne lançait que `calc.test.js` (Node 20) | [V] |
| Déploiement | Front GitHub Pages (`main` = prod, `dev` = `/dev/`) ; backend collé à la main ; Android via Actions | [V] |
| Outils qualité | Aucun (pas de linter, formateur, `tsc` ni `deno check`) | [V] |

## 3. Architecture actuelle

```
index.html (toutes les vues)
   ↕  innerHTML + onclick="fonctionGlobale(...)"
js/app.js — UN fichier, portée globale : rendu (chaînes) + état (369 globales) + calculs + NovalyzEngine
           + appels réseau (≈ 119 fetch(SCRIPT_URL…)) ; window.fetch remplacé une fois (jeton _t, 401)
supabase/functions/handler/index.ts — UN fichier : routeur (119 cases) → authCheck → handlers
   ↓  client service_role
Postgres (RLS fermé, aucune policy)
```

| Question | Réponse |
|---|---|
| Logique métier | Des deux côtés : serveur (agrégats, ACWR, alertes, cibles, récap) ; front (NovalyzEngine, lectures v2/v3, classement, recos) [V] |
| Appels Supabase | Uniquement dans `index.ts` (365 `sb().from(...)`) — bonne séparation [V] |
| Calculs | Dans les deux fichiers, certains en double (ACWR) [V] |
| Validations | Surtout serveur [V] |
| Permissions | Centralisées dans `authCheck` + `ROW_OWNED` — point le mieux conçu [V] |
| Gestion des erreurs | Pas de stratégie commune [V] |

Conclusion [D] : séparation client ↔ serveur ↔ base réelle et saine ; aucune séparation interne dans chacun des deux fichiers (organisation par préfixes `_ma*`, `_cd*`, `_hx*`, `_lv3*`, `_pbc*` et 79 bandeaux de commentaires, rien n'est imposé par le code).

## 4. Base de données

Constats [V] : clés primaires sur les 28 tables ; 13 tables → `athletes(id)` ; vrais types `date` / `numeric` sur les tables principales ; unicités utiles (`athletes.login`, `coachs.login`, `exercices.nom_cle`, `planning`, `activites`, `beta_inscriptions`).

| # | Constat | Statut | Impact |
|---|---|---|---|
| B1 | `indicateurs` fourre-tout (8 721 lignes, 144 clés) ; `seance_id` encode le type (`cardio_*`, `sante_*`, `pasjour_*`, `nutri_*`, `Libre_exo_*`, `pref`, `alerte_push`, `alerte_lue`, `recompense`, `envoi_id`…) | [V] | Erreur de préfixe = lecture cassée sans message ; pas de contraintes ni d'index ciblés ; `valeur` en texte |
| B2 | `athletes.coach_id` sans clé étrangère, un seul coach par athlète | [V] | coach_id orphelin possible ; bloquant pour équipes / staff |
| B3 | Pas de migrations (18 `supabase/*.sql` à la main) ; `rls_auto_enable` absente du dépôt | [V] | Base non recréable |
| B4 | Démo mélangée à la prod (29 athlètes démo / 45, ≈ 58 % d'`indicateurs`) | [V] | Stats, crons, agrégats faussés |
| B5 | `objectif` et `objectifs` | [V] | Confusion |
| B6 | Pas d'index `athlete_id` (performances, indicateurs, bien_etre) | [V] | À prévoir avant la montée en charge |
| B7 | Ids en `text`, `commentaires.date` en texte | [V] | Sans gravité |
| B8 | Dénormalisation (nom / muscle dans `performances` ; séance écrite 2 fois : `performances` + agrégat `indicateurs`) | [V] | Renommage non propagé ; copies divergentes (pas de transaction) |
| B9 | Deux formats de date (ISO et jj/mm/aaaa) | [V] | Héritage Google Sheets |

## 5. Sécurité / RLS

En place [V] : RLS actif sans policy ; aucune clé dans le front ; seule clé committée = clé de TEST APK ; jeton HMAC-SHA256 30 j révoqué au changement de mot de passe ; `authCheck` (athlète ≠ session refusé, `saveSeance` contrôle `[4]`, coach non lié refusé, `ROW_OWNED` relit le propriétaire, liaison = demande + acceptation) ; mots de passe en s2 ; `session-auth.test.js`.

| # | Constat | Statut |
|---|---|---|
| S1 | Tout repose sur `AUTH_ENFORCE=1` | [?] (vérifié actif depuis) |
| S2 | Jeton dans l'URL → copié dans les logs Supabase (réutilisable 30 j) | [V] |
| S3 | Jeton en `localStorage` + 452 `innerHTML` / 449 `onclick` ; `escapeHtml` présent (~570 appels) mais exhaustivité non prouvée | [V] / [?] |
| S4 | Hachage rapide (SHA-256 unique) | [V] (traité le 10/11) |
| S5 | Anti-abus 60 req/min/IP en mémoire par instance (76 redémarrages / 24 h) ; le blocage de connexion en base fonctionne | [V] / [D] |
| S6 | Préprod écrit dans la prod | [V] (traité le 09/11) |
| S7 | `rls_auto_enable()` SECURITY DEFINER exécutable par `anon` ; `pg_net` dans `public` | [V] |
| S8 | CORS `*` — acceptable (jeton, pas de cookie) | [V] |
| S9 | Routes `cron*` protégées par `CRON_SECRET` | [V] |

## 6. Qualité du code

| Duplication | Où | Risque | Recommandation |
|---|---|---|---|
| Seuils en 3 endroits | `SEUILS` (front), `SEUILS` + `CORE_SEUILS` (serveur) | 🟠 verdicts divergents (limités par les tests) | Une seule source |
| ACWR calculé deux fois | `computeACWR` (front) + chaîne serveur | 🟠 | Serveur seulement |
| ≈ 28 fonctions de date, dont 5 « lundi de la semaine » | `app.js` | 🟡 bugs de semaine / fuseau | Un module de dates |
| `_maShortDate` défini deux fois | `app.js` | 🟡 la 2e (ISO seul) remplace la 1re | À trancher |
| `var esc = …` redéfini ~20 fois (parfois sans échappement) | `app.js` | 🟡 | `escapeHtml` partout |
| Exercice → muscle | front et serveur | 🟡 | — |

Complexité [V] : `app.js` sans frontières (tout global) ; `handleGetAppData` 616 lignes ; `index.ts` recollé en entier ; 3 132 `style="…"` et 449 `onclick` dans des chaînes.

| Couplage | Niveau | Pourquoi |
|---|---|---|
| Front ↔ base | 🟢 | Tout passe par la fonction |
| Droits | 🟢 | Centralisés, testés |
| Moteur / `lecture-v3.js` | 🟡 | Isolé et testé, mais dépend de globales d'`app.js` |
| Format `getAppData` ↔ écrans | 🟠 | Un champ renommé casse plusieurs écrans |
| Préfixes `seance_id` | 🔴 | Chaînes magiques ; une faute = donnée absente, sans erreur |
| `onclick="nom(...)"` | 🟠 | Renommer casse un bouton sans erreur ni test |

## 7. Dette technique — 🟠 Importante

Importante : coût d'évolution croissant (deux monolithes), erreurs invisibles (893 `catch {}`), base reposant sur des conventions, pas de migrations / CI réelle / séparation dev-prod. Pas critique : aucune perte ni faille confirmée, droits centralisés et testés, moteur déterministe et testé, tests sur le vrai backend, base correctement typée ; rien n'impose de tout réécrire.

## 8. Risques liés au développement avec IA

| Signe | Observé ? | Commentaire |
|---|---|---|
| Plusieurs façons de faire la même chose | Oui | Dates, échappement, `nvFetchJSON` (8) vs `fetch` direct (119) |
| Anciennes implémentations conservées | Oui | `COCKPIT_ON`, `Code.gs`, route `login` en GET, double format de date |
| Erreurs gérées de façon incohérente | Oui | 893 `catch {}` / 1 119 `try`, 15 `console.*` ; 121 lectures serveur ignorent l'erreur |
| Typage contourné | Oui | 549 `any`, TypeScript jamais vérifié |
| Valeurs en dur | Partiellement | URL backend, préfixes `seance_id`, `_COACH_DEMO_LOGINS` |
| Commentaires | Abondants et utiles | Racontent l'historique plus que l'état |
| Solutions locales hors architecture | Oui | Fiche « Exemple » interceptée dans l'enveloppe réseau |
| Tests qui découpent le code source | Oui | `indexOf('function …')` → freinent le découpage |

Point positif : vraie discipline de vérification (60 audits, règle « vérifié / supposé », tests sur les phrases affichées). Le risque n'est pas l'IA mais l'empilement de couches locales sans refactorisation.

## 9. Maintenabilité — 4/10

Un nouveau développeur comprendrait le produit (CLAUDE.md, etat-en-cours, vision) mais pas le code : pas de carte d'`app.js`, README d'une ligne, conventions implicites, `Docs/` et `docs/`, infos périmées (Capacitor 6, « cache v3 », ligne de `SCRIPT_URL`, « 60 suites »).

## 10. Testabilité — 5/10

Existe : 86 suites (13 s) sur le vrai `index.ts` (droits, sessions, inscription, reset, suppression, RGPD, push, agrégats, alertes, moteur, lectures, hors-ligne, envoi unique) ; tests sur les textes affichés.

| Prio | Manque | Statut |
|---|---|---|
| 1 | CI qui ne lance pas `npm test` | [V] (corrigé 09/11) |
| 2 | Aucun test navigateur E2E | [V] |
| 3 | Aucun test sur la vraie base (RLS, contraintes, SQL) | [V] |
| 4 | Couverture des droits route par route non prouvée (~115 actions) | [D] |
| 5 | Hors-ligne → renvoi → session expirée sur vrai téléphone | [V] (simulation seulement) |
| 6 | ~450 `onclick` : aucun test ne détecte une fonction disparue | [V] |

## 11. Risques de régression (zones à haut risque)

1. **Envoi de séance** (`saveSeance`) : file hors-ligne, `envoi_id`, enveloppe 401, double écriture non transactionnelle.
2. **`getAppData`** (616 l.) et tous les écrans athlète.
3. **Enveloppe `window.fetch`** (session, jeton, 401, démo).
4. **Seuils et moteur partagés** front / serveur.
5. **Préfixes `seance_id`** (lectures par motif `like 'cardio_%'`).
6. **Boutons `onclick`** vers des fonctions globales.

## 12. Performance (audit léger)

| Constat | Statut | Gravité |
|---|---|---|
| `app.js` 2,2 Mo non minifié, analysé en entier au démarrage | [V] / [D] | 🟡 |
| `getAppData` charge tout l'historique (pagination correcte) | [V] | 🟡 |
| 119 `fetch` directs sans délai maximum | [V] | 🟡 |
| Pas d'index `athlete_id` | [V] | 🟢 aujourd'hui |
| Limite 1 000 lignes bien gérée (`_toutLire`) | [V] | ✅ |

## 13. Documentation

Existe : CLAUDE.md, etat-en-cours, vision, roadmaps, 60+ audits, contrat du moteur, activer-ia, publication-play-store. Suffisant pour Claude dans 1 an ; pas pour un autre développeur dans 3 ans.
À créer : README · carte d'`app.js` · référence de l'API (~115 actions) · dictionnaire d'`indicateurs` · schéma de base à jour · règles métier · ADR courts · fusion `Docs/` → `docs/` et correction de CLAUDE.md.

## 14. Évolutivité

| Évolution | Classement | Raison |
|---|---|---|
| Nouvelles fonctionnalités | 🟡 | Chaque ajout grossit les deux fichiers |
| Nouveaux types d'utilisateurs | 🟠 | Rôles `a` / `c` en dur |
| Nouveaux sports | 🟡 | Moteur neutre, foot branché |
| Nouvelles métriques | 🟢 / 🟡 | `indicateurs` le permet, sans contrôle |
| Nouvelles sources | 🟡 | `activites` + `activite_sources` |
| Données de match | 🟡 | « match = type de séance » décidé |
| IA | 🟢 / 🟡 | Couche de langage, quotas serveur, garde-fou |
| Équipes | 🟠 | Un coach par athlète, pas de table équipe |
| Organisations / clubs | 🟠 | Rien n'existe |
| Novalyz Pro | 🟠 | Dépend des équipes, rôles, préprod, migrations |

## 15. Capacité à continuer avec Claude — 🟡 Oui, mais avec des garde-fous

Garde-fous minimum : CI qui lance `npm test` · préprod séparée · règle « chercher avant de créer » + carte d'`app.js` · nouveau code en fichiers séparés (modèle `lecture-v3.js`) · plus aucun `catch {}` vide sur un appel réseau ou une écriture.

## 16. Notes /10

| Domaine | Note |
|---|---|
| Architecture | 4 |
| Qualité du code | 5 |
| Maintenabilité | 4 |
| Testabilité | 5 |
| Sécurité | 6 |
| Base de données | 5 |
| Évolutivité | 5 |
| Documentation | 6 |
| Gestion des erreurs | 3 |
| Préparation à l'évolution avec IA | 5 |

## 17. Problèmes critiques

Aucun confirmé. C1 conditionnel : `AUTH_ENFORCE` (vérifié actif depuis).

## 18. Problèmes importants (🟠)

CI incomplète · préprod = prod · pas de migrations · `indicateurs` fourre-tout · démo en prod · erreurs avalées (893 `catch {}`, 119 `fetch` sans délai, 121 lectures serveur ignorant l'erreur) · `app.js` monolithique + `onclick` · backend collé à la main, TypeScript non vérifié · seuils et ACWR en double · hachage rapide · un seul coach par athlète · écriture de séance non transactionnelle.

## 19. Problèmes modérés (🟡)

Jeton dans l'URL · anti-abus en mémoire · avertissements `rls_auto_enable` / `pg_net` · `_maShortDate` en double · ≈ 28 fonctions de date, deux formats en base · `objectif` / `objectifs` · pas d'index `athlete_id` · `app.js` non minifié · 549 `any` · tests par découpage de texte · doc périmée, README vide, `Docs/` + `docs/` · héritage (`Code.gs`, `site/`, 187 fichiers `mockups/`, `__pycache__`, tests à la racine, `COCKPIT_ON`, route `login` GET, description « essai »).

## 20. Ce qui ne doit PAS être modifié

`hashSalted` / `verifyPwd` / `login` / sessions (montée de version transparente seulement) · base fermée + `service_role` dans la fonction seulement · `authCheck` + `ROW_OWNED` (étendre, jamais contourner) · moteur déterministe et « l'IA n'invente pas de chiffre » · banc de tests sur le vrai `index.ts` · `_toutLire`, `envoi_id`, file hors-ligne · point d'entrée réseau unique · pas de framework pour l'instant.

## 21. Ce qui doit être corrigé (bientôt)

P0 et P1 : `AUTH_ENFORCE`, CI réelle, préprod séparée, journal des migrations, fermer `rls_auto_enable`, plus de `catch {}` vide sur réseau / écriture, décision démo.

## 22. Ce qui peut attendre

Index, minification, jeton en en-tête · regroupement des dates, nettoyage de l'héritage · suppression de `COCKPIT_ON` · hachage (avant Pro).

## 23. À préparer avant Novalyz Pro

Modèle équipes / organisations (organisation, equipe, appartenance avec poste et catégorie, staff multi-coachs) · rôles et permissions au-delà de `a` / `c` · sortir d'`indicateurs` ce qui n'est pas une mesure · environnements séparés et migrations · hachage renforcé · découpage du backend en fichiers (même fonction), déploiement par CLI · découpage du front par domaine (modèle `lecture-v3.js`).

## 24. Plan de correction priorisé

**P0 — sécurité, perte de données, blocage** : vérifier `AUTH_ENFORCE=1` · CI `npm test` sous Node 22 · retirer à `anon` / `authenticated` l'exécution de `rls_auto_enable()`.

**P1 — dette qui compromet les évolutions** : préprod séparée · migrations + journal · données de démo (`is_demo`) · sortie d'`indicateurs` (en commençant par `pref` et `alerte_*`) · décision hachage.

**P2 — tests et maintenabilité** : test « chaque route couverte par les droits » · test Playwright de bout en bout en CI · README + carte d'`app.js` + dictionnaire d'`indicateurs` + CLAUDE.md à jour · nouveau code en fichiers séparés, testés directement.

**P3 — qualité du code** : une seule fonction réseau (délai max, message, trace) remplaçant progressivement les `fetch` directs et les `catch {}` vides · un seul module de dates, trancher `_maShortDate` · une seule source de seuils, ACWR côté serveur · écriture de séance en une transaction (ou rattrapage de l'agrégat à la lecture).

**P4 — performance / UX** : index `(athlete_id, date)` · minification d'`app.js` · jeton en POST / en-tête.

**P5 — facultatif** : archiver `Code.gs`, `site/`, `mockups/` ; supprimer `__pycache__`, `COCKPIT_ON`, route `login` GET ; fusionner `Docs/` dans `docs/`.

**Limites de l'audit** : lecture par recherche et extraits (chiffres par comptage automatique) ; pas d'accès aux secrets ; pas de test XSS réel ; code prod supposé identique au dépôt.
