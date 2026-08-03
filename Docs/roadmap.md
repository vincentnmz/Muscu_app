# Roadmap Novalyz — Document de référence vivant

> **Principe :** chaque phase est livrable, réversible, et ne casse jamais l'existant.
> Phase N+1 ne démarre pas avant que N soit validée en production.
>
> **Mis à jour :** 2026-08 · Remplace `roadmapproduit.md`

---

## Vue d'ensemble — deux tracks parallèles

| Track | Objet | Pilote |
|---|---|---|
| **A — Produit** | Architecture fonctionnelle, entités métier, modèle de données, backend | Roadmap produit (phases 0-6) |
| **B — Frontend** | Code front, CSS, design system, interface | Roadmap technique front (P0-P…) |

Les deux tracks évoluent ensemble mais à des rythmes différents. Un jalon produit peut débloquer un chantier front, et inversement.

---

## Track A — Roadmap Produit

### Tableau de bord

| Phase | Objectif | Risque | Casse ? | Statut |
|---|---|---|---|---|
| **0** | Documentation | Nul | Non | ✅ Terminé |
| **1** | Isoler le noyau | Faible | Non | ✅ Terminé |
| **2** | Entité `Sport` | Faible | Non | ✅ Terminé |
| **3** | UI par profil (hub) | Moyen | Non (feature-flag) | 🔜 Suivant |
| **4** | Indicateurs génériques + modèle collectif | Moyen | Non (double-écriture) | 🔜 |
| **5** | Base relationnelle (Supabase) | Élevé | Non (parallèle) | 🔜 |
| **6** | 2ᵉ sport pilote | — | Non | 🔜 |

---

### Phase 0 — Documentation ✅
**But :** figer les concepts génériques avant d'écrire du code.
**Livrables :** dossier `/Docs` complet (architecture, modèle, moteur, KPI, cahier des charges).
**Critère de sortie :** tout nouveau développeur comprend Novalyz sans lire le code.

---

### Phase 1 — Isoler le noyau ✅
**But :** rendre explicite la frontière noyau ↔ module musculation.
**Réalisé :**
- JS extrait de `index.html` vers `js/app.js` (cf. Track B — P0)
- Sections noyau balisées dans le code (`NovalyzEngine`, `normaliser()`)
- Module muscu identifié : tonnage, 1RM, volume/muscle
**Critère de sortie :** un développeur peut pointer « ça c'est le noyau, ça c'est le module muscu ». ✅

---

### Phase 2 — Introduire l'entité `Sport` ✅
**But :** la musculation devient *un* module, pas *le* produit.
**Réalisé :**
- Colonne `sport` (col E) présente sur `Coachs` — Option A (sport porté par le coach) ✅
- `loginCoach` retourne `coach.sport` (défaut `muscu`) ✅
- `saveSportCoach` / `registerCoach` écrivent en col E ✅
- `register` (athlète) hérite via `lireSportAthlete()` ✅
- `getAppData` retourne `sport` à l'athlète ; `getCoachAthletes` propage le sport ✅
- `getSuiviEquipe` / `getSuiviJoueur` gèrent les sports hors muscu ✅
- `SPORTS` registry dans `app.js` (10 sports) + `sportActif()` + `appliquerLibellesSport()` ✅
- UI `coach-sport-select`, `reg-sport`, `reg-coach-sport` ✅
- Données démo football (`seedDemoFoot`) ✅
**Critère de sortie :** sport porté par le coach, UI muscu inchangée, footprint prêt pour le 2ᵉ sport. ✅

---

### Phase 3 — UI par profil (hub) 🔜
**But :** tableau de bord central + vues adaptées au profil.
**Actions :**
- Construire le hub : profil transversal de l'athlète
- Router l'affichage : sport actif → modules visibles ; profil → niveau de lecture
- Tout derrière feature-flag (l'app actuelle reste le défaut)
**Dépendance Track B :** le design system (nv- + Figma library) doit être en place avant de concevoir les nouveaux écrans.
**Risque :** moyen — nouvelle navigation. Mitigé par le flag.
**Critère de sortie :** basculer entre l'app actuelle et le hub sans perte de fonction.

---

### Phase 4 — Indicateurs génériques + modèle collectif 🔜
**But :** remplacer les colonnes muscu par `Seance` + `Participation` + `Indicateur` typé.
**Actions :**
- Double-écriture : chaque saisie écrit dans `Performances` (ancien) ET le nouveau format
- Introduire `Seance` (équipe) + `Participation` (athlète) ; muscu = équipe de 1
- Vérifier la concordance, puis basculer la lecture sur `Indicateur`
- Alimenter `normaliser()` : volume / progression / charge depuis le module muscu
**Risque :** moyen — mitigé par la double-écriture et le retour arrière permanent.
**Critère de sortie :** le moteur lit des indicateurs génériques ; les règles d'alerte inchangées.

---

### Phase 5 — Base relationnelle 🔜
**But :** Google Sheets → PostgreSQL / Supabase.
**Actions :**
- Créer le schéma relationnel (voir `modele-de-donnees.md`)
- Migrer en parallèle, tester, basculer la source de données
- Le moteur ne lit que via `normaliser()` : il ne change pas
**Risque :** élevé — migration de données. Mitigé par l'exécution en parallèle avant bascule.
**Critère de sortie :** l'app tourne sur Supabase ; fonctions identiques ; Sheets en secours.

---

### Phase 6 — 2ᵉ sport pilote 🔜
**But :** brancher un module sport sans toucher au noyau. C'est la **preuve de l'architecture**.
**Actions :**
- Créer un module minimal (hockey ? football ? → selon le stage)
- Indicateurs GPS/charge, écrans de saisie et d'analyse
- Alimenter `normaliser()` depuis ces indicateurs
**Risque :** faible si phases 1-4 sont faites — c'est justement leur test.
**Critère de sortie :** un sport ajouté sans une seule ligne modifiée dans le noyau.

---

## Track B — Roadmap Technique Frontend

### Tableau de bord

| Phase | Objectif | Statut |
|---|---|---|
| **P0** | Extraction JS + CSS hors `index.html` | ✅ Terminé |
| **P1** | Architecture CSS 4 couches | ✅ Terminé |
| **P2** | Nouvelle charte graphique + migration `nv-` | ✅ Terminé (nv- différé P3) |
| **P3** | Figma design system + atomic split | 🔜 (lors de Phase A-3) |
| **P4** | Dark mode complet | 🔜 (après charte stable) |

---

### P0 — Extraction JS + CSS ✅
**But :** sortir tout le code de `index.html` pour rendre le front maintenable.
**Réalisé :**
- `js/app.js` : tout le JavaScript (NovalyzEngine, vues, logique métier)
- `css/novalyz.css` : tout le CSS
- `sw.js` : service worker (cache `novalyz-shell-v2`)
- `index.html` : structure HTML pure + 4 `<link>` + 1 `<script>`
- `calc.test.js` mis à jour pour lire `js/app.js` en priorité (fallback `index.html`)

---

### P1 — Architecture CSS 4 couches ✅
**But :** éclater `css/novalyz.css` en 4 fichiers responsabilisés.

| Fichier | Rôle | Statut |
|---|---|---|
| `css/tokens.css` | Variables CSS + animations (charte centralisée) | ✅ |
| `css/base.css` | Reset + éléments HTML génériques | ✅ |
| `css/components.css` | Composants UI réutilisables | ✅ |
| `css/layout.css` | Templates de pages + media queries | ✅ |

**Pilote nv- :** classes `login-logo` → `nv-login-logo` et `auth-seg` → `nv-auth-seg` pour valider la convention.

**Note mode sombre/clair :** toggle simplifié pour l'instant — `body.light-mode` commenté dans `tokens.css`, mode light comme défaut de travail jusqu'à P2. Dark mode complet en P4.

---

### P2 — Nouvelle charte graphique + migration `nv-` 🚧

#### P2.1 — Nouvelle palette + typographie + HTML sémantique ✅
**Réalisé :**
- `css/tokens.css` : nouvelle palette Novalyz (marine #070B14, bleu #1A5FFF, polaire #F9FBFF, clair #5C9AFF, violet #F47CE6) avec alphas, ombres teintées, mode clair comme défaut de travail. Dark mode commenté → différé P4.
- `css/base.css` : échelle typographique H1-H6. Michroma (H1-H3, poids 400, line-height 1.2) + Quicksand (H4-H6, poids 600). Google Fonts combinée dans `index.html`.
- `index.html` : 46 `<div class="st">` → `<h2 class="st">` (accessibilité / SEO).
- `css/components.css` : `.v2-sec .st` ajusté → 13px, poids 400, letter-spacing 0.06em (Michroma via h2 base).

#### P2.2 — Migration `nv-` CSS + HTML ⏸ Suspendu
**Raison :** ~70+ classes générées dynamiquement par `app.js` via `innerHTML` (templates). Un renommage CSS seul casse tout le HTML généré. Déposé à P3, quand les composants seront rearchitecturés.

#### P2.3 — Migration `nv-` JS ⏸ Suspendu
**Raison :** couplé à P2.2. Différé à P3.

#### P2.4 — `sw.js` ✅
**Réalisé :** version `novalyz-shell-v1` → `v3` (deux phases rattrapées). ASSETS enrichi : `js/app.js` + `css/tokens.css` + `css/base.css` + `css/components.css` + `css/layout.css` ajoutés au précache.

---

### P3 — Figma design system + atomic split 🔜
**Quand :** lors du démarrage de la Phase A-3 (hub UI par profil).
**But :** concevoir les nouveaux écrans dans Figma avec la charte P2 avant de les coder.
**Actions :**
- Créer la Figma library : tokens, atomes (`nv-btn`, `nv-badge`…), molécules (`nv-card`, `nv-modal`…), organismes (`nv-dash`, `nv-saisie`…)
- Si `components.css` dépasse ~500 lignes : éclater en `atoms.css` / `molecules.css` / `organisms.css`
- Code Connect : mapper composants Figma ↔ classes CSS
**Critère :** un écran hub peut être designé dans Figma et implémenté directement.

---

### P4 — Dark mode complet 🔜
**Quand :** après que P2 (charte stable) soit validée en production.
**But :** implémenter le toggle light/dark proprement.
**Approche :** `@media (prefers-color-scheme: dark)` comme défaut système + `body.dark-mode` / `body.light-mode` pour le toggle manuel. La structure `tokens.css` (direct override) est déjà prête pour ça.

---

## Taxonomie des composants (`nv-`)

Convention adoptée à partir de P2 — le préfixe `nv-` signale le niveau :

| Niveau | Exemples | Fichier cible |
|---|---|---|
| Atome | `nv-btn`, `nv-badge`, `nv-chip`, `nv-ico` | `atoms.css` (P3) |
| Molécule | `nv-card`, `nv-modal`, `nv-toast`, `nv-tabs` | `molecules.css` (P3) |
| Organisme | `nv-dash`, `nv-saisie`, `nv-wq`, `nv-recap` | `organisms.css` (P3) |
| Template | vues, grilles, rails, media queries | `layout.css` (existant) |

Jusqu'à P3, tout reste dans `components.css` — la convention de nommage suffit à signaler le niveau.

---

## Stack actuelle (2026-08)

| Couche | Technologie | Fichiers |
|---|---|---|
| Front | PWA vanilla JS | `index.html`, `js/app.js`, `css/tokens.css`, `css/base.css`, `css/components.css`, `css/layout.css`, `sw.js` |
| Backend | Google Apps Script | `Code.gs` |
| Données | Google Sheets | Onglets Athletes, Coachs, Performances, … |
| CI | GitHub Actions | `.github/workflows/tests.yml` → `calc.test.js` |
| Déploiement | GitHub Pages | `main` → prod · `dev` → préprod `/dev/` |

---

## Règles de décision avant toute fonctionnalité

1. Compatible avec la vision multisport ?
2. Réutilisable dans ≥ 2 sports ? (sinon → module)
3. Respecte l'architecture hub (noyau + modules) ?
4. Documentée ?
5. Ne crée pas de dette technique ?

Si une réponse est « non », on ne développe pas tel quel.

---

## Historique des décisions d'architecture validées

| # | Décision | Conséquence |
|---|---|---|
| 1 | Séance appartient à l'équipe ; athlète a une participation | Collectif-ready |
| 2 | Match = `Seance type="match"` | Réutilise le moteur de charge |
| 3 | `Test` séparé d'`Exercice` | Suivi de progression inter-saison |
| 4 | `poste` + `categorie` sur `AthleteEquipe` | Comparaison à la norme du poste |
| 5 | Entité `Blessure` (réathlétisation) | Suivi santé, cellule de perf |
| 6 | Vocabulaire par sport dans `Sport.config_json` | Zéro modif noyau pour libellés |
| 7 | Option A : `sport` porté par le coach (col E Coachs) | Migration minimale pour Phase 2 |
| 8 | `nv-` comme préfixe CSS universel Novalyz | Namespace clair, migration progressive |
| 9 | Dark mode différé après charte stable (P4) | Évite les bugs de cascade CSS |
| 10 | `calc.test.js` lit `js/app.js` en priorité (fallback `index.html`) | Tests CI compatibles P0 et pré-P0 |
