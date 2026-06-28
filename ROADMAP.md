# Roadmap — Muscu App

Objectif : transformer l'application d'un simple suivi d'athlète en un **outil d'aide à la décision pour coach**.
L'app **assiste** le coach (constats, alertes, suggestions), elle ne le **remplace pas** (le coach prescrit).

> Légende statut : ✅ fait · 🔜 à faire · 🚧 en cours

---

## 1. Fonctions déjà présentes

### Côté athlète
- ✅ Connexion (login 4 chiffres) + inscription autonome
- ✅ Tableau de bord : régularité semaine, poids + évolution, muscle en retard, progression de la semaine, dernière séance, récupération (RPE/charge/volume), prochaine séance
- ✅ Séance guidée (programme) + séance libre, saisie charge/reps/RPE/repos, timer de repos
- ✅ Surcharge progressive par palier d'expérience (débutant → expert)
- ✅ Objectif, suivi du poids, régularité
- ✅ Historique : calendrier, progression par exercice (tableau), volume par muscle vs cibles, tendances 4/8 semaines
- ✅ Onglet Conseils (réception, badge non-lus, historique limité)

### Côté coach
- ✅ Espace coach séparé
- ✅ Liste des athlètes + bandeau "à surveiller" priorisé, bouton "Traité" (remise à zéro hebdo)
- ✅ Moteur d'alertes : stagnation (par palier), irrégularité (7j), fatigue (RPE + charge)
- ✅ Détail athlète : onglets Aperçu / Progression / Volume / Agenda / Conseils
- ✅ Conseils coach → athlète (envoi, suppression, statut lu/non lu)
- ✅ Suggestion auto "à valider par le coach"

### Backend (Google Sheets + Apps Script)
- ✅ Login, inscription, données app, exercices, dernières perfs, sauvegarde séance, objectif/poids/note
- ✅ Login coach, liste athlètes avec alertes + score de priorité
- ✅ Commentaires (création, lecture, marquage lu, suppression)

---

## 2. Fonctions manquantes / à améliorer

### 🔴 Critiques (fiabilité / passage à l'échelle)
- 🔜 **Sécurité** : mots de passe hachés (logins en clair aujourd'hui) — bloquant pour de vrais clients (RGPD, données de santé)
- 🔜 **Sauvegarde / versioning** des données (une fausse manip dans le Sheet = perte)
- 🔜 **Synchro multi-appareils du "Traité"** (aujourd'hui stocké localement par navigateur)

### 🟠 Cœur métier coach (forte valeur)
- 🔜 **Création / édition de programme** par le coach depuis l'app (manuel dans le Sheet aujourd'hui)
- 🔜 **Historique / récurrence des alertes** (une alerte qui revient 3 semaines ≠ une nouvelle)
- 🔜 **Vue comparative** entre athlètes (cohorte)
- 🔜 **Rapports exportables** (bilan PDF par athlète)
- 🔜 **Conversation bidirectionnelle** (l'athlète peut répondre)

### 🟡 Analyse / crédibilité scientifique
- ✅ **1RM estimé** (formule Epley) — comparer la force réelle indépendamment des reps
- ✅ **Explication des alertes** (pourquoi, sur quel seuil)
- 🔜 **Analyse fine par exercice** (volume, tendance RPE par exo)
- 🔜 **Détection de deload / surmenage** sur la durée

### 🟢 Confort / expérience
- ✅ **Courbes graphiques** (1RM, athlète + coach)
- 🔜 **Supersets / exercices enchaînés** (commencer par le superset simple à 2 exos)
- 🔜 **Notifications** (email coach, push)
- 🔜 **Mode hors-ligne** (PWA, utile en salle)
- 🔜 **Inscription coach autonome**

---

## 3. Roadmap par priorité

### Phase 1 — Crédibiliser l'analyse (rapide, fort impact, peu de risque)
1. ✅ 1RM estimé par exercice (formule Epley)
2. ✅ Explication des alertes (seuils, bouton "Pourquoi ?")
3. ✅ Courbes graphiques de progression (1RM, athlète + coach)

### Phase 2 — Donner les commandes au coach
4. 🔜 Création / édition de programme par le coach
5. 🔜 Historique & récurrence des alertes
6. 🔜 Synchro backend du "Traité" (multi-appareils)

### Phase 3 — Sécuriser avant d'ouvrir à de vrais clients
7. 🔜 Mots de passe hachés
8. 🔜 Sauvegarde automatique des données

### Phase 4 — Enrichir
9. 🔜 Rapports exportables (bilan PDF)
10. 🔜 Vue comparative cohorte
11. 🔜 Conversation bidirectionnelle + notifications
12. 🔜 Supersets, PWA hors-ligne

---

## Principes de développement
- **Par étape** : une fonctionnalité validée à la fois, jamais tout d'un coup.
- **L'app constate, le coach prescrit** : pas de prescription automatique à l'athlète.
- **Honnêteté scientifique** : distinguer les concepts reconnus (paliers d'expérience) des choix d'implémentation pratiques (valeurs de seuils).
