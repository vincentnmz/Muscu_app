# Novalyz — Cahier des charges (interne / technique)

> **Nature** : document de cadrage technique consolidé. Rassemble l'existant
> (`vision-produit.md`, `roadmap-produit.md`, `roadmap-beta.md`, `backlog-app.md`,
> `bases-scientifiques.md`, `premium.md`, `CLAUDE.md`) et formalise les parties
> non écrites ailleurs : périmètre, exigences non-fonctionnelles, critères
> d'acceptation.
> **Le code reste la source de vérité** : en cas d'écart, c'est le code (et les
> tests) qui fait foi, ce document est mis à jour.
> Dernière mise à jour : **26 oct. 2026**. Rédigé pour un usage interne/dev.

---

## 1. Présentation & objectifs

**Novalyz** = plateforme d'analyse et d'aide à la décision pour le sport.
Transforme les **données d'entraînement + le ressenti** en **décisions**.

**Boussole produit (garde-fou anti-dérive)** — l'app aide à :
1. **Comment s'entraîner** (cadrer/donner le plan) ;
2. **Si c'est bien fait** (dire si l'entraînement est correctement mené) ;
3. **Comment progresser** (via **données ET ressenti**).

**Différenciateur** : l'**interprétation adaptative** (moteur déterministe) + une
**couche IA-coach** *grounded* sur les données (ne produit aucun chiffre).
Positionnement : commence par la **musculation**, ambition **multisport**
(foot, hockey…) sur **un seul moteur** sport-agnostique.

**Segmentation marché** : **muscu = B2C grand public** · **autres sports = B2B pro**
(clubs, centres de formation, fédérations).

Réf. : `docs/vision-produit.md`, `docs/roadmap-produit.md`.

---

## 2. Cibles / personas

| Persona | Besoin principal | Priorité produit |
|---|---|---|
| **Athlète muscu solo** (B2C) | Suivi, savoir si c'est bien fait, progresser sans coach | **P1 — parcours principal** |
| **Coach** (muscu puis multisport) | Suivre plusieurs athlètes, bâtir des programmes, lire des analyses « qui parlent au coach » | **P2** |
| **Club / centre / fédération** (B2B) | Suivi d'équipe, charge, blessures, décision collective | Vision long terme |

Réf. : `docs/vision-produit.md`, `docs/roadmap-produit.md`, `docs/site-vitrine-brief.md`.

---

## 3. Périmètre

### 3.1 Inclus (socle actuel, en prod/préprod)
- Comptes athlète & coach (auth maison), profil, objectif, données de santé de base.
- Saisie de séance muscu (charge/reps/RPE/repos), « dernière fois → cible » (surcharge).
- **État du jour** (readiness : sommeil/énergie/fatigue, auto 1×/jour) + bilan post-séance (douleur/ressenti).
- Écran **Forme** : nutrition (objectifs + saisie + import Health Connect/MFP), **montre** (pas/sommeil/FC via Health Connect en natif, historique serveur en web).
- **Générateur de programme v2** (déterministe) : débutant (presets) / configurateur (objectif, organisation fb/ul/ppl/split/custom, jours, temps) + force (powerlifting éditable). Ordre d'exécution gros muscles d'abord garanti.
- **Analyses / Lecture Novalyz** (athlète & coach) : volume, charge, ACWR (prudence), records/progression/stagnation, récupération.
- **Morpho-anatomie v2** : questionnaire fiabilité + saisie segments (schéma corps H/F) + photos + **recommandations d'exercices déterministes** + export mail/PDF. *(front livré ; backend à redéployer — cf. §9.)*
- **Agenda daté** (planification des séances, table `planning`).
- **Coach** : équipe, fiche athlète, **Aperçu « coup d'œil » v3**, builder de programme, agenda, messagerie (photo/vidéo), export bilan.
- **Récompenses** (gamification).
- **PWA** (hors-ligne partiel) + **app Android native** (Capacitor, push FCM, Health Connect).

### 3.2 Hors périmètre (pour l'instant)
- Paywall / badges premium (découpage **décidé** mais **non construit** — `docs/premium.md`).
- Site vitrine marketing (`novalyz.com`) — projet séparé (`docs/site-vitrine-brief.md`).
- iOS natif (PWA seulement).
- Migration vers Supabase Auth (**interdit** : auth maison conservée).

### 3.3 À venir / parqué
- **Programme sur-mesure à partir de l'analyse morpho** (parqué — maquette `mockups/novalyz-programme-sur-mesure.html`).
- Sports non-muscu branchés sur le moteur (foot déjà partiellement : vue joueur).
- Play Store (test interne → MAJ auto).

Réf. : `docs/backlog-app.md`, `docs/roadmap-beta.md`.

---

## 4. Architecture technique

- **Front** : `index.html` (PWA) + `js/app.js` (logique) + `css/{tokens,base,components,layout}.css` + `sw.js` (cache, réseau-first) + modules natifs `js/platform.js` / `js/notifications.js`.
- **Backend** : **Supabase Edge Function** (Deno/TypeScript) `supabase/functions/handler/index.ts`, en ligne sur `…/functions/v1/smooth-service`. **Déploiement MANUEL** (coller tout le fichier → Deploy).
- **Données** : Supabase (Postgres) via `SERVICE_ROLE_KEY`. Schémas `supabase/*.sql`.
- **Natif Android** : Capacitor 6 (`appId com.novalyz.app`), push **FCM HTTP v1**, **Health Connect**. APK via GitHub Actions. **Service Worker désactivé en natif**.
- **Déploiement front** : GitHub Pages auto — `main` → prod, `dev` → préprod `/dev/`, branches `claude/*` non déployées. ⚠️ le workflow ne copie que les fichiers **listés**.
- **Secrets** (env Supabase, jamais dans le front/git) : `PEPPER`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FCM_SERVICE_ACCOUNT`, VAPID, `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `BETA_INVITE_CODE`.

Réf. : `CLAUDE.md` (section Stack).

---

## 5. Modèle de données (tables Supabase)

Tables principales : `athletes`, `coachs`, `performances`, `indicateurs`
(multisport, clé/valeur), `bien_etre`, `tests`, `objectifs`/`objectif`,
`blessures`, `programme`, `planning`, `poids_historique`, `commentaires`,
`contexte_athlete`, `native_push_tokens`, `password_reset_tokens`,
`coach_profil`, `athletes_email`. Colonnes détaillées : `CLAUDE.md` + `supabase/*.sql`.

Conventions notables :
- Santé montre historisée dans `indicateurs` `seance_id 'sante_<date>'` (clés `pas`/`sommeil_min`/`fc_repos`) ; nutrition `'nutri_<date>'` ; pas ambiants `'pasjour_%'`.
- Programme lu ordonné `groupe_id, id` (ordre d'insertion préservé).

---

## 6. Exigences fonctionnelles (par module)

> Convention : **EF-x.y**. « Doit » = exigence ferme. Chaque EF est traçable au code.

### 6.1 Authentification & comptes
- **EF-1.1** Inscription athlète : prénom, taille, **poids**, login (4 chiffres), DDN, email, mot de passe (≥6), sport, consentement données de santé. *(Code bêta requis si `BETA_INVITE_CODE` défini.)*
- **EF-1.2** Auth maison sur table `athletes` : hash `'s2$' + SHA-256(login|PEPPER|password)`. **Ne pas migrer vers Supabase Auth, ne pas casser le hachage.**
- **EF-1.3** Récupération de mot de passe par email (token), changement de mot de passe connecté (preuve = mdp actuel).
- **EF-1.4** Comptes coach séparés ; lien athlète↔coach via login.

### 6.2 Athlète
- **EF-2.1 Onboarding** : intro (explication app) → choix « Novalyz me construit / Je gère / J'ai un coach » → **tour guidé** (quel que soit le chemin).
- **EF-2.2 Séance muscu** : saisie charge/reps/RPE/repos par série ; affichage « dernière fois → cible » (double progression) ; file d'attente hors-ligne.
- **EF-2.3 État du jour** : readiness avant séance (auto 1×/jour) ; douleur/ressenti après.
- **EF-2.4 Forme** : nutrition (objectif Mifflin-St Jeor + saisie + import HC/MFP) ; montre (pas/sommeil/FC). **Isolation par compte** : pas natifs lus/synchronisés **seulement** pour un compte ayant connecté sa montre.
- **EF-2.5 Programme** : générateur v2 déterministe ; **objectif** à la création (Prise de masse / Sèche / Maintien / Force) ; éditable ; ordre **gros muscles d'abord**.
- **EF-2.6 Morpho** : questionnaire fiabilité + segments + photos (suppression possible) → **reco exercices déterministes** (badges Mesuré/À nuancer/Antécédent) + export mail/PDF.
- **EF-2.7 Analyses** : « Lecture Novalyz » narrative, **fidèle aux données** (règle 6bis).
- **EF-2.8 Agenda** : « Mes séances prévues » (lecture).
- **EF-2.9 Récompenses** : gamification (coûts côté serveur font foi).

### 6.3 Coach
- **EF-3.1** Équipe (liste, recherche dans Équipe uniquement), fiche athlète (Aperçu + sous-onglets).
- **EF-3.2 Aperçu « coup d'œil » v3** : Entraînement (charge/reps/RPE réels) + État/récup + **Lecture Novalyz pour le coach** (analyse, pas recopie).
- **EF-3.3** Builder de programme (vue semaine, agenda daté, drag-drop), messagerie (photo/vidéo), export bilan à la demande.

### 6.4 Moteur d'analyse (cœur)
- **EF-4.1** **Déterministe et sport-agnostique** (`NovalyzEngine`/`evaluerEtatAthlete`, chaîne ACWR, `SEUILS`, `normaliser()`). Pour brancher un sport : alimenter `normaliser()`, **ne pas réécrire le moteur**.
- **EF-4.2** Le moteur est la **source de vérité**. Aucune valeur affichée ne doit contredire son calcul.

### 6.5 Couche IA
- **EF-5.1** L'IA (chat, rédaction morpho) est une **couche langage branchée sur le moteur** : elle **n'invente aucun chiffre**, elle met en mots des résultats déterministes.
- **EF-5.2** Gated par `ANTHROPIC_API_KEY` ; sans clé, le déterministe continue de fonctionner.

---

## 7. Exigences non-fonctionnelles

### 7.1 Fiabilité des affirmations (règle 6bis — CRITIQUE)
- **ENF-1** Toute phrase affichée qui affirme un fait (analyse, verdict, %, tendance, niveau de fiabilité) doit être **traçable au code** et **exacte vs le comportement réel du moteur**. Chercher activement le cas où elle serait fausse (peu de données, base de comparaison faible, contexte actif, données manquantes). Ce qui est scientifiquement débattu est présenté comme **indice**, pas verdict (cf. `docs/bases-scientifiques.md`).
- **ENF-2** Vérification UI **au rendu** (screenshot Playwright relu) avant livraison.

### 7.2 Sécurité
- **ENF-3** Mots de passe hachés (SHA-256 salé login + PEPPER). Jamais de hash/secret côté front.
- **ENF-4** Secrets uniquement en variables d'env Supabase ; jamais dans front/git/tests. `google-services.json` injecté via secret GitHub.
- **ENF-5** Accès données backend **filtré par `athlete_id`** systématiquement.

### 7.3 Données de santé / RGPD
- **ENF-6** Consentement explicite à l'inscription (traitement données de santé : poids, ressenti, douleurs). Lien politique de confidentialité (`privacy.html`).
- **ENF-7** Export de ses données **gratuit** (norme marché). Suppression de compte/données : *à formaliser* (point à trancher §11).
- **ENF-8** Isolation stricte des données entre comptes, y compris données d'appareil (montre) sur un téléphone partagé.

### 7.4 Performance & disponibilité
- **ENF-9** PWA : chargement réseau-first avec cache de secours (SW), **mode hors-ligne** pour la saisie de séance (file d'attente).
- **ENF-10** Bump du cache SW (`sw.js`) à chaque modif front, sinon anciens fichiers servis.

### 7.5 Compatibilité
- **ENF-11** Cible : navigateurs modernes (PWA) + Android natif (Capacitor). Responsive mobile **et** desktop (coach surtout).

### 7.6 Qualité
- **ENF-12** Avant tout push : `node --check js/app.js` + `node scripts/run-tests.mjs` (**46 suites vertes** à maintenir).
- **ENF-13** `index.ts` livré toujours **complet** (l'utilisateur remplace tout le contenu de la fonction).

---

## 8. Contraintes & dépendances

- **Déploiement backend manuel** (pas de CI backend) → risque de prod qui tourne une ancienne version ; toujours rappeler le redeploy.
- Dépendances externes : Supabase (DB + Edge), Resend (emails), Anthropic (IA), Firebase/FCM (push), Google Health Connect (natif).
- Workflow front ne copie que les fichiers listés (ajouter un fichier racine = l'ajouter à la liste).

---

## 9. Jalons / roadmap (synthèse)

- **Fait (prod/préprod)** : socle athlète+coach, moteur v2, agenda, aperçu coach v3, nutrition, récompenses. *(détail : `docs/etat-en-cours.md`)*
- **En attente utilisateur (bloquants)** : **redéployer `index.ts`** (poids inscription + morpho v2) ; poser **`ANTHROPIC_API_KEY`**.
- **Court terme** : programme sur-mesure depuis morpho (parqué) ; finaliser morpho IA (N11) ; reste backlog.
- **Route beta** : régler les **bloquants P0 fiabilité** avant d'ouvrir aux testeurs (`docs/roadmap-beta.md`).
- **Long terme** : Play Store, multisport branché, B2B structures.

Réf. canonique : `docs/roadmap-produit.md`, `docs/roadmap-beta.md`, `docs/etat-en-cours.md`.

---

## 10. Critères d'acceptation (génériques)

Une fonctionnalité est « livrable » quand :
1. `node --check` + `npm test` (46 suites) **verts** ;
2. l'UI a été **vérifiée au rendu** (screenshot relu) sur mobile **et** desktop le cas échéant ;
3. chaque **affirmation affichée** est tracée au code et vraie (règle 6bis) ;
4. le front↔backend est croisé (chaque `action` appelée a une route) ;
5. si `index.ts` touché : rappel du **redeploy** à l'utilisateur ;
6. `sw.js` bumpé si front modifié ;
7. poussé sur `dev` (préprod) pour validation avant `main`.

---

## 11. Risques & points à trancher

- **❓ Suppression de compte/données (RGPD)** : parcours à formaliser (droit à l'effacement).
- **❓ ACWR** : critiqué dans la littérature (couplage mathématique) → maintenu comme **indice prudent**, jamais seul pour décider (déjà cadré `bases-scientifiques.md`).
- **❓ Premium / paywall** : découpage décidé (`premium.md`) mais non construit — quand l'activer ?
- **⚠️ Déploiement backend manuel** : principal risque opérationnel (prod désynchronisée).
- **⚠️ Données de santé sur appareil partagé** : couvert par l'isolation par compte (26 oct), à garder en tête pour tout nouvel accès capteur.
