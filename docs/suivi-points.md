# Suivi des points — nouvelle liste (porteur)

> Doc de suivi vivant. Mis à jour à chaque point traité.
> Statuts : ⏳ à faire · 🟡 en cours / maquette · ✅ fait · 🔎 à vérifier.
> Enregistré le 19 oct. 2026. Ancien backlog 19-points : voir [`backlog-app.md`](./backlog-app.md) (reste #14 = **N5** ici).

| # | Point | Zone | Statut | Note |
|---|-------|------|--------|------|
| **N1** | **Lier un athlète** : ajouter le champ **e-mail** dans la création | Coach | ✅ | Champ e-mail (facultatif) dans la modale « Créer », sauvé dans `athletes.email` (backend coachCreerAthlete). |
| **N2** | Vérifier que les **années de pratique évoluent bien dans le temps** | Données | ✅ | Constat : c'était **figé**. Corrigé — `anneesEffectives()` = base + années écoulées depuis `created_at`, appliqué au login, alertes, vue coach, bilans, cron. Backend à redéployer. |
| **N3** | **Onglet Photo** (fiche athlète, coach) : photos avant/après pour voir l'évolution **+ saisie des mensurations** (tour de taille, biceps, ventre, poitrine, etc.) | Coach | ⏳ | Nouvel onglet : galerie photos datées + formulaire mensurations historisé. |
| **N4** | **Recherche athlète** : la laisser **uniquement dans « Équipe »** (côté coach) | Coach | ✅ | `cs-search` desktop affichée seulement sur la section Équipe (plus sur Aujourd'hui/Analyses). |
| **N5** | **Bloc Récompenses** : revoir les **bugs** + le barème (= ex-#14 « récompenses adaptées à chaque athlète ») | Athlète | ✅ | Fait sur `dev` : **un seul chiffre = solde** partout (accueil + boutique + onglet Objectif), **points permanents** (records à vie `records_total` au lieu de `records_30j` glissant), **transparence** gagné/dépensé + « comment je gagne ». Niveau accueil basé sur le gagné à vie. ⚠️ `index.ts` **à redéployer** (getAppData + handleClaimRecompense). Reste (plus tard) : récompense perso du coach « en vrai » (teaser pour l'instant). |
| **N6** | **Conversation IA athlète (desktop)** : impossible de **faire défiler les phrases pré-préparées** (carousel) | Athlète / desktop | ✅ | Desktop : les suggestions s'affichent toutes (wrap), fini le carousel au doigt + points masqués. (L'historique scrollait déjà.) |
| **N7** | **Barre équilibre charge/récup** : couleurs **pas assez saturées** → gamme cohérente existante | Design | ✅ | Jauge fraîcheur : tokens pleins `var(--warn)`/`var(--text-muted)`/`var(--good)`, zones alignées sur les seuils (−12/+5). |
| **N8** | **Graphiques version desktop trop gros** | Design / desktop | ✅ | `#tab-historique .ma-chart{max-width:640px}` en desktop (les graphes pleine colonne ne s'étirent plus). |
| **N9** | **Régularité** : le graphique actuel n'est **pas très compréhensible** → explorer d'autres solutions | Athlète | ⏳ | Repenser la visualisation de la régularité (maquette d'options). |
| **N10** | **Programmes proposés par Novalyz** : revoir **ce qui est proposé et comment c'est fait** (générateur) | Programme | ✅ | **Générateur v2 construit** (spec `generateur-v2.md`) : moteur blocs+organisations+Force (fonctions pures + tests), UI 2 parcours (galerie débutant / configurateur objectif-organisation-jours-temps), Force custom à listes déroulantes, variantes « ou: » → bouton Remplacer. Sur `dev`. |
| **N11** | **Morpho-anatomie IA** : à **paramétrer** | IA | 🟡 | Dépend de `ANTHROPIC_API_KEY` / réglages (v1 déjà codée, en veille). |
| **N12a** | **Nutrition** : le **bouton d'import MFP** a disparu | Athlète | ✅ | Affichage basé sur « app native » (robuste au chargement tardif du plugin) ; sur web une info s'affiche au lieu de rien. |
| **N12b** | Vérifier que le **coach reçoit bien** les données nutrition MFP importées par l'athlète | Athlète ↔ Coach | ✅ | Chemin vérifié : athlète → saveNutrition → nutri_historique → coach (getAppData) → `renderCoachHubNutrition`. Auto-import HC tagué `source:'health_connect'` → vérifiable en base. (En base : seules données « manuel » pour l'instant, pas encore d'import HC réel.) |
| **N13** | **Fiche athlète (coach) — refonte écran « Aperçu »** : les analyses doivent **parler AU COACH** (bilan entraînement + état, pas les phrases de l'athlète). La **Lecture Novalyz** doit être **en haut** (avec recos/infos d'analyse), pas tout en bas. Garder les blocs : **analyse Novalyz, alerte, ma montre, volume, récup, bien-être, charge, assiduité, dernière séance, nutrition** | Coach | 🟡 | **En cours (sur `dev`)** : bloc « **Coup d'œil** » coach + « **Lecture Novalyz pour le coach** » **en tête** (`renderCoachCoupDoeil`, charge/reps/RPE + cardio + poids, hero factuel côté coach, reco unique), anciennes phrases athlète masquées. **Reste** : finir la réorganisation/contrôle de TOUS les blocs demandés (montre, volume, charge, assiduité, dernière séance, nutrition) dans l'ordre voulu + valider le wording coach. |

---

## Points ajoutés en cours de route (hors liste N) — sur `dev`
- **Séance · poids/reps par série** : les cases S1/S2/S3 montrent **dernière fois → cible surcharge** (double progression). ✅
- **Fraîcheur** : explications réécrites **grand public** (widget, pop-up, info). ✅
- **Catalogue** : ajout **Ecarté haltéres incliné / décliné** (ids 91/92). ✅

## Regroupements / priorités (à confirmer avec le porteur)
- **Fait** : N1·N2·N4·N5·N6·N7·N8·N10·N12a·N12b + séance/fraîcheur/écartés (tout sur `dev`, à valider puis `dev`→`main`). ⚠️ N2 **et** N5 nécessitent un **redeploy `index.ts`** sur Supabase.
- **En cours** : N13 (refonte aperçu coach — Coup d'œil + Lecture Novalyz en tête faits ; reste la réorganisation complète des blocs).
- **Reste — maquette d'abord** : N3 (photo/mensurations), N9 (régularité).
- **Gated / en veille** : N11 (morpho IA, clé API).
