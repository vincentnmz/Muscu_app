# Novalyz — Roadmap produit & journal de livraison

> Fichier de suivi **durable** (le contexte de session peut être compacté).
> Source : la roadmap envoyée par le porteur + les décisions prises en session.
> Voir aussi [`vision-produit.md`](./vision-produit.md), [`backlog-app.md`](./backlog-app.md),
> [`roadmap-beta.md`](./roadmap-beta.md).

Boussole (ne pas dériver) : **① comment m'entraîner · ② est-ce bien fait ·
③ comment progresser** (données + ressenti). La boucle : Objectif → Programme →
Exécution → Données → Moteur → Analyse → Contexte → Recommandation → Action → Progression.

Méthode de travail : Audit → Plan → Valider → Implémenter (isolé) → Tester
(`npm test`, `node --check`, `build:www`) → 1 commit → APK Dev. `index.ts` =
déploiement **manuel** sur Supabase (ou via l'outillage Supabase avec accord).

---

## ✅ Livré (branche `claude/novalyz-player-profile-mockups-g4bock`)

**Analyses & fiabilité**
- Lecture Novalyz (synthèse en phrases) muscu · cardio · croisé, fenêtre fixe 4 sem.
- Centre d'alertes athlète (modèle unifié, état « lu » durable).
- Calibrage de la sévérité du verdict (moteur) : fatigue en moyenne récente.
- Période « Semaine » = semaine **calendaire** (reset lundi) + réglage calendaire/glissante.
- Progression fiable : tendance robuste (moyenne début vs fin, fini le « +282% »),
  « Par exercice » filtré par période, ressenti « Par séance » (repli par date).

**Écrans**
- Accueil « Aujourd'hui » : état → séance → point d'attention → action.
- Entraînement : suivi séances (prévu/réalisé) fusionné dans le sélecteur ; détail
  des séances en pastilles (composant partagé avec l'historique Analyses).

**Programme (le cadre — ①)**
- Builder athlète complet : séances, exos, supersets, séries/reps/repos,
  **jour conseillé** (non pénalisant), **charge cible % du 1RM**, **RPE cible**.
- **Onboarding 1re connexion** : explication de l'app + parcours par profil
  (Novalyz me construit un programme / je gère le mien / j'ai un coach — détecté
  via `coach_id`). Déclenché **instantanément à l'inscription**. Drapeaux
  `onboarding_vu` / `prog_auto_off` (indicateurs). « Revoir l'intro » dans Réglages.
- **Programme proposé** (génération déterministe : objectif + jours + niveau →
  vrais exercices du catalogue, avec jours + cibles).

**Est-ce bien fait — ②**
- Exécution vs cible (charge %1RM tol ±5% · RPE ±1) : en fin de séance + bloc
  « Exécution vs cible » dans les Analyses.

**Régularité**
- Objectif séances/semaine **dérivé du programme** (nb de séances distinctes) →
  l'adhérence « X/N » reflète le vrai programme.

---

## 🔜 Suite (priorisée, à ajuster avec le porteur)

1. **Notifs d'alerte pour l'athlète** — push proactif depuis le centre d'alertes
   (infra FCM native déjà en place). *(en cours)*
2. **Lecture Novalyz enrichie** — intégrer « exécution vs cible » dans la synthèse
   en phrases (backend).
3. **Montre & capteurs (Google Health)** — sommeil / BPM / pas → nourrit le moteur
   (⚠️ doublons de pas à gérer, cf. backlog C1).
4. **Objectif de séances explicite** (override) + séances hybrides muscu/cardio +
   catalogue d'exos cardio.
5. **État ▸ onglet Nutrition** (conseils IA selon objectif).
6. **Contexte de performance** (retour vacances / blessure / deload) fiabilisé.

## 🚚 Distribution / MAJ auto
- **Play Store — test interne** = vraie solution d'auto-update (compte dev en
  validation d'identité Google). Quand validé : build **release signé (AAB)** + fiche.
- En attendant : **PWA** (web, auto via Service Worker) ou **bannière « MAJ dispo »**
  in-app (compare la version installée à la Release `novalyz-apk-dev`).

## 🔵 Coach (phase 2)
Rendu complet de la partie coach (accueil = tous ses athlètes, alertes à traiter,
séance à faire, état/bien-être, analyses, conversation). Voir `backlog-app.md` B.

---
_Journal maintenu au fil des livraisons. Cocher/mettre à jour à chaque lot._
