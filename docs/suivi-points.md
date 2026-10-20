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
| **N5** | **Bloc Récompenses** : revoir les **bugs** + le barème (= ex-#14 « récompenses adaptées à chaque athlète ») | Athlète | ⏳ | Fusion avec l'ancien #14. Maquette d'abord (barème + UX). |
| **N6** | **Conversation IA athlète (desktop)** : impossible de **faire défiler les phrases pré-préparées** (carousel) | Athlète / desktop | ✅ | Desktop : les suggestions s'affichent toutes (wrap), fini le carousel au doigt + points masqués. (L'historique scrollait déjà.) |
| **N7** | **Barre équilibre charge/récup** : couleurs **pas assez saturées** → gamme cohérente existante | Design | ✅ | Jauge fraîcheur : tokens pleins `var(--warn)`/`var(--text-muted)`/`var(--good)`, zones alignées sur les seuils (−12/+5). |
| **N8** | **Graphiques version desktop trop gros** | Design / desktop | ✅ | `#tab-historique .ma-chart{max-width:640px}` en desktop (les graphes pleine colonne ne s'étirent plus). |
| **N9** | **Régularité** : le graphique actuel n'est **pas très compréhensible** → explorer d'autres solutions | Athlète | ⏳ | Repenser la visualisation de la régularité (maquette d'options). |
| **N10** | **Programmes proposés par Novalyz** : revoir **ce qui est proposé et comment c'est fait** (générateur) | Programme | 🟡 | Audité (`_genProgramme`/`_GEN_*`). Constats + pistes remis au porteur (cf. ci-dessous). Décision méthode en attente. |
| **N11** | **Morpho-anatomie IA** : à **paramétrer** | IA | 🟡 | Dépend de `ANTHROPIC_API_KEY` / réglages (v1 déjà codée, en veille). |
| **N12a** | **Nutrition** : le **bouton d'import MFP** a disparu | Athlète | ✅ | Affichage basé sur « app native » (robuste au chargement tardif du plugin) ; sur web une info s'affiche au lieu de rien. |
| **N12b** | Vérifier que le **coach reçoit bien** les données nutrition MFP importées par l'athlète | Athlète ↔ Coach | ✅ | Chemin vérifié : athlète → saveNutrition → nutri_historique → coach (getAppData) → `renderCoachHubNutrition`. Auto-import HC tagué `source:'health_connect'` → vérifiable en base. (En base : seules données « manuel » pour l'instant, pas encore d'import HC réel.) |
| **N13** | **Fiche athlète (coach) — refonte écran « Aperçu »** : les analyses doivent **parler AU COACH** (bilan entraînement + état, pas les phrases de l'athlète). La **Lecture Novalyz** doit être **en haut** (avec recos/infos d'analyse), pas tout en bas. Garder les blocs : **analyse Novalyz, alerte, ma montre, volume, récup, bien-être, charge, assiduité, dernière séance, nutrition** | Coach | ⏳ | Gros morceau → **maquette d'abord**. Réécrire le wording côté coach + réordonner (Lecture Novalyz en tête). |

---

## Regroupements / priorités (à confirmer avec le porteur)
- **Rapides / bugs** : N1 (e-mail), N4 (recherche), N6 (scroll IA desktop), N7 (couleurs barre), N8 (graphes desktop), N12a (bouton MFP).
- **À vérifier (données)** : N2 (années de pratique), N10 (générateur programme), N12b (MFP → coach).
- **Maquette d'abord** : N3 (photo/mensurations), N5 (récompenses), N9 (régularité), N13 (refonte aperçu coach).
- **Gated / en veille** : N11 (morpho IA, clé API).
