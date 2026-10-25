# Suivi des points — nouvelle liste (porteur)

> Doc de suivi vivant. Mis à jour à chaque point traité.
> Statuts : ⏳ à faire · 🟡 en cours / maquette · ✅ fait · 🔎 à vérifier.
> Enregistré le 19 oct. 2026. Ancien backlog 19-points : voir [`backlog-app.md`](./backlog-app.md) (reste #14 = **N5** ici).

| # | Point | Zone | Statut | Note |
|---|-------|------|--------|------|
| **N1** | **Lier un athlète** : ajouter le champ **e-mail** dans la création | Coach | ✅ | Champ e-mail (facultatif) dans la modale « Créer », sauvé dans `athletes.email` (backend coachCreerAthlete). |
| **N2** | Vérifier que les **années de pratique évoluent bien dans le temps** | Données | ✅ | Constat : c'était **figé**. Corrigé — `anneesEffectives()` = base + années écoulées depuis `created_at`, appliqué au login, alertes, vue coach, bilans, cron. Backend à redéployer. |
| **N3** | **Onglet Photo** (fiche athlète, coach) : photos avant/après pour voir l'évolution **+ saisie des mensurations** (tour de taille, biceps, ventre, poitrine, etc.) | Coach | ✅ | Fait sur `dev`. **Saisie athlète** (Forme › Mes suivis → écran `#tab-suivi` : photos Face/Profil/Dos avant/après + caméra/galerie ; mensurations poitrine/taille/hanches/épaules/bras G-D/avant-bras G-D/cuisse G-D/mollet/%MG). **Coach consulte** via Progression (onglet « Photo & mensurations », Muscu+Cardio, pas Croisé). Backend : `getAppData` (`mensurations`+`suivi_photos`) + handlers `saveMensuration`/`suiviPhoto*` ; bucket privé `suivi-photos`. ⚠️ Redeploy `index.ts`. Maquettes : `novalyz-photo-mensurations.html`, `novalyz-suivi-placement.html`. |
| **N4** | **Recherche athlète** : la laisser **uniquement dans « Équipe »** (côté coach) | Coach | ✅ | `cs-search` desktop affichée seulement sur la section Équipe (plus sur Aujourd'hui/Analyses). |
| **N5** | **Bloc Récompenses** : revoir les **bugs** + le barème (= ex-#14 « récompenses adaptées à chaque athlète ») | Athlète | ✅ | Fait sur `dev` : **un seul chiffre = solde** partout (accueil + boutique + onglet Objectif), **points permanents** (records à vie `records_total` au lieu de `records_30j` glissant), **transparence** gagné/dépensé + « comment je gagne ». Niveau accueil basé sur le gagné à vie. ⚠️ `index.ts` **à redéployer** (getAppData + handleClaimRecompense). Reste (plus tard) : récompense perso du coach « en vrai » (teaser pour l'instant). |
| **N6** | **Conversation IA athlète (desktop)** : impossible de **faire défiler les phrases pré-préparées** (carousel) | Athlète / desktop | ✅ | Desktop : les suggestions s'affichent toutes (wrap), fini le carousel au doigt + points masqués. (L'historique scrollait déjà.) |
| **N7** | **Barre équilibre charge/récup** : couleurs **pas assez saturées** → gamme cohérente existante | Design | ✅ | Jauge fraîcheur : tokens pleins `var(--warn)`/`var(--text-muted)`/`var(--good)`, zones alignées sur les seuils (−12/+5). |
| **N8** | **Graphiques version desktop trop gros** | Design / desktop | ✅ | `#tab-historique .ma-chart{max-width:640px}` en desktop (les graphes pleine colonne ne s'étirent plus). |
| **N9** | **Régularité** : le graphique actuel n'est **pas très compréhensible** → explorer d'autres solutions | Athlète | ✅ | Maquette 3 options (`mockups/novalyz-regularite-options.html`) → **Option A retenue**. Fait sur `dev` : barres hebdo (12 sem.) **vs objectif** (`seances_prevues`), vert/orange/rouge + ligne objectif + tuiles (série, X/12 à l'objectif, moyenne), **remontées en tête** de Tendances (`_maRegulariteBloc`). Remplace la courbe d'aire. |
| **N10** | **Programmes proposés par Novalyz** : revoir **ce qui est proposé et comment c'est fait** (générateur) | Programme | ✅ | **Générateur v2 construit** (spec `generateur-v2.md`) : moteur blocs+organisations+Force (fonctions pures + tests), UI 2 parcours (galerie débutant / configurateur objectif-organisation-jours-temps), Force custom à listes déroulantes, variantes « ou: » → bouton Remplacer. Sur `dev`. |
| **N11** | **Morpho-anatomie IA** : à **paramétrer** | IA | 🟡 | Dépend de `ANTHROPIC_API_KEY` / réglages (v1 déjà codée, en veille). |
| **N12a** | **Nutrition** : le **bouton d'import MFP** a disparu | Athlète | ✅ | Affichage basé sur « app native » (robuste au chargement tardif du plugin) ; sur web une info s'affiche au lieu de rien. |
| **N12b** | Vérifier que le **coach reçoit bien** les données nutrition MFP importées par l'athlète | Athlète ↔ Coach | ✅ | Chemin vérifié : athlète → saveNutrition → nutri_historique → coach (getAppData) → `renderCoachHubNutrition`. Auto-import HC tagué `source:'health_connect'` → vérifiable en base. (En base : seules données « manuel » pour l'instant, pas encore d'import HC réel.) |
| **N13** | **Fiche athlète (coach) — refonte écran « Aperçu »** : les analyses doivent **parler AU COACH** (bilan entraînement + état, pas les phrases de l'athlète). La **Lecture Novalyz** doit être **en haut** (avec recos/infos d'analyse), pas tout en bas. Garder les blocs : **analyse Novalyz, alerte, ma montre, volume, récup, bien-être, charge, assiduité, dernière séance, nutrition** | Coach | ✅ | Fait sur `dev` : « **Coup d'œil** » coach + « **Lecture Novalyz pour le coach** » **en tête** (`renderCoachCoupDoeil`, charge/reps/RPE + cardio + poids, hero factuel côté coach, reco unique), anciennes phrases athlète masquées. **Organisation de la fiche validée par le porteur** (23 oct.). |

---

## Points ajoutés en cours de route (hors liste N) — sur `dev`
- **Séance · poids/reps par série** : les cases S1/S2/S3 montrent **dernière fois → cible surcharge** (double progression). ✅
- **Fraîcheur** : explications réécrites **grand public** (widget, pop-up, info). ✅
- **Catalogue** : ajout **Ecarté haltéres incliné / décliné** (ids 91/92). ✅

## Regroupements / priorités (à confirmer avec le porteur)
- **Fait & EN PROD** : N1·N2·N4·N5·N6·N7·N8·N9·N10·N12a·N12b·N13 + séance/fraîcheur/écartés. **`index.ts` DÉPLOYÉ** (N2/N3/N5 OK) et **prod promue `dev`→`main` le 24 oct.** — plus de warning redeploy en attente.
- **Gated / en veille** : N11 (morpho IA, clé API).
- **Hors liste N (sur `dev`)** : messagerie — envoi média EN DIRECT (caméra) ✅ ; onglet média dans la conversation (#43, à préciser) ⏳.

## AGENDA daté (planification des séances) — gros chantier du 24-25 oct., sur `dev` ✅
Modèle validé = **vrai agenda daté** (table `planning`, 1 date par séance), à côté de `programme` (semaine type via `programme.jour`). Décisions : plusieurs séances/jour OK · `statut` 'planifie' (fait/manqué plus tard) · bouton « Pré-remplir semaine type ».
- **Backend DÉPLOYÉ** : table `planning` (+ `supabase/planning.sql`), routes `getPlanning`/`planSeance`/`movePlanning`/`unplanPlanning`, `getAppData.planning[]` (athlète J→J+14).
- **Coach** (composant `.cdag`) : sélecteur de semaine + glisser-déposer + « À planifier » + pré-remplir. Emplacements : **onglet Programme** (colonne droite du Builder, desktop ; accordéon mobile), **Progression › Évolution muscu & cardio** (rails). Retiré de l'Aperçu.
- **Athlète** : carte lecture seule « Mes séances prévues » (Accueil).
- Maquette réf. : `mockups/novalyz-rail-agenda.html`.

## Correctifs récents (25 oct., sur `dev`) ✅
- **Croisé athlète — Lecture Novalyz** : recalculée sur la **période affichée** (plus la synthèse backend figée 4 sem.) → n'annonce plus de cardio quand la période n'en a pas.
- **Croisé coach** : rail « Charge combinée » (récap) au lieu du rail vide.
- **Onglet Programme coach** : agenda en colonne droite, **« Jour conseillé » déplacé sur la vue de la séance**, scroll de page (plus de scroll interne).
- **Tendances muscu** : « fréquence par muscle » + « répartition d'intensité » déplacées dans le rail droit.
- **Alertes coach** : bouton « ✓ Traité » vert → **« Marquer traité »** neutre (levée de confusion).
- SW = **v409**. (Rappel : bump SW à chaque modif `js/app.js`.)
