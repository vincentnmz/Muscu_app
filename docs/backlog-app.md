# Backlog Novalyz — à faire & vérifier

> Liste de travail (dump du porteur, sept. 2026), organisée et priorisée.
> Légende statut : ✅ fait · 🟡 en cours · ⏳ à venir · ❓ décision à trancher (section C).
> 🟢 Athlète = priorité (parcours solo) · 🔵 Coach = **phase 2**.
> Voir aussi [`vision-produit.md`](./vision-produit.md) et [`roadmap-beta.md`](./roadmap-beta.md).
> **Dernière passe de statut : 30 sept. 2026.**

---

## A. ATHLÈTE (priorité)

### A1 · Montre & capteurs
- ✅ **Sommeil + BPM** depuis la montre (Health Connect ; fork du plugin `capacitor-health` pour exposer sommeil + FC repos, affichés sur « Forme »).
- ✅ **Graphique pas/jour** interactif (Semaine/Mois/Année) + bouton **« Connecte ta montre »** ; historisation serveur (`saveSante` / `sante_historique`).
- ✅ **Import des sorties montre** par activité (footing/vélo GPS… via `queryWorkouts`, avec FC) — cartes « à importer / déjà importée ».
- ⏳ ❓ **Montre ↔ saisie manuelle sans doublon** (voir C1) — décision pas encore tranchée.

### A2 · Écrans
- 🟡 Écran **Aujourd'hui** — base refondue (design `.tj`, blocs pas / récompenses animées au scroll) ; reste à **affiner / valider**.
- ✅ Écran **Cardio** — sélecteur de sport (Muscu/Cardio/Hyrox) + grille d'activités + import montre + saisie + écran d'analyse.
- ✅ Écran **État → « Forme »** — onglet **Nutrition** (objectifs macros P/G/L calculés depuis poids+objectif, niveau d'activité, saisie, tendance) ; réorg en 3 zones (Aujourd'hui / Mes suivis / Mes tendances) ; **Contexte de reprise**.
- ⏳ **Onboarding / visite guidée** (à faire **à la FIN**, écrans figés) : présentation de démarrage expliquant **écran par écran** où se trouvent les fonctions. Ne pas coder avant d'avoir figé les écrans.

### A3 · Alertes & fiabilité (cœur analyse)
- 🟡 **Notifs d'alerte** pour l'athlète solo — **chantier en cours** ; ❓ placement (voir C2).
- ⏳ Vérifier la **fiabilité des alertes** (pas de fausses alertes).
- ✅ **Contexte de performance** (retour vacances / blessure / deload) — moteur qui pondère les analyses + **auto-déclaration athlète** + **suggestion après ≥14 j sans séance** (voir C3, tranché).

### A4 · Programme & séances
- ✅ **Objectif de séances par semaine** (`objectif.seances_semaine`, affiché « X/Y objectif », utilisé dans la régularité).
- ✅ **Séances hybrides muscu / cardio** (programme hybride : ajout d'items Muscu **ou** Cardio).
- ✅ **Exercices cardio** (catalogue `_CARDIO_CATALOG` : activités pour le programme + l'import + les analyses).
- ⏳ Créer des programmes avec **analyse morphologique IA par photo** (face + dos). ❓ premium + RGPD (voir C4).

### A5 · Monétisation
- ⏳ **Paiement** pour offres **premium** : IA approfondie, analyse morpho, paiement coach. ❓ modèle + prestataire (voir C5).

---

## B. COACH (phase 2 — rendu de la partie coach)

> ⏳ **Reporté en fin de roadmap** (décision du porteur). Détail conservé ci-dessous.

- **Fiabilité** du contexte de performance.
- **Notifs d'alerte** pour le coach.
- **Accueil** = tous ses athlètes.
- Écran **Aujourd'hui** : « Bonjour coach » + détail de l'athlète sélectionné.
- **Bloc « alertes à traiter »**.
- Ce que l'athlète **doit faire** comme séance.
- Son **état & bien-être**.
- Écran **son entraînement** : séances faites (détail série / exo / rep / RPE) + **création / modification de programme**.
- Écran **analyses muscu & cardio**.
- Écran **conversation** (IA + athlète).
- Écran **État** + onglet **Nutrition** (conseils selon objectifs) + vue coach des données santé (sommeil/FC/pas).

---

## C. ❓ Décisions de conception à trancher (avant de coder)

### C1 · Montre ↔ saisie manuelle : éviter les doublons de pas — ⏳ ouvert
**Proposition** (à valider) :
- **Total de pas du jour = la montre fait autorité** (une seule source par jour). On ne ré-additionne jamais.
- **Une marche / activité = un enregistrement séparé** (distance, durée, allure) qui **ne re-compte PAS ses pas** dans le total du jour.
- Chaque donnée porte sa **`source`** (`montre` / `manuel`) — la table `indicateurs` a **déjà** ce champ.
- **Règle anti-doublon** : on saisit à la main **uniquement ce que la montre n'a pas** (ex. sortie vélo sans capteur → distance/temps ; marche non déclenchée → distance/temps). Les **pas** ne viennent que du compteur de la montre.
- Option : dédoublonnage par **chevauchement horaire** (si une activité manuelle recouvre une activité montre → on garde la montre).

### C2 · Placement des alertes — 🟡 en cours
Où l'athlète (et le coach) voit ses alertes : cloche en haut ? bloc dédié sur « Aujourd'hui » / « Forme » ? notification push + rappel dans l'app ? → **chantier en cours**.
> Existant repéré : bouton cloche header (`#btn-alertes-hdr` → `ouvrirCentreAlertes`) + badge, `renderAlertes()`, `alertes_centre` (backend), push natif/web. À câbler/placer proprement côté athlète.

### C3 · Contexte de reprise (vacances / blessure / deload) — ✅ tranché & fait
Décision retenue : **les deux** — l'athlète déclare lui-même son état (modale existante, source `'athlete'`) **et** Novalyz **suggère** un retour après une coupure détectée (≥14 j sans séance, jamais posé d'office). Affiché sur « Forme » (`#et-contexte`). Le moteur pondère (neutralise « régression », ACWR en pause, alertes absence/sous-charge en veille).

### C4 · Analyse morphologique IA par photo (face + dos) — ⏳
Fonction premium probable. ❓ **consentement / RGPD** (photos = données sensibles), stockage, et quel modèle d'analyse.

### C5 · Paiement premium — ⏳
❓ modèle (abonnement mensuel ? à vie ?), **prestataire** (Stripe / RevenueCat pour le natif), et **part reversée au coach**. Impacte l'architecture (comptes, droits).

---

## Ordre suggéré (suivi)
1. ✅ Finir la **structure du parcours solo** (réorg Forme en 3 zones).
2. ✅ **Montre** : sommeil/BPM + graphique pas + import par sport. *(C1 pas encore tranché, non bloquant.)*
3. ✅ **Cardio** complet (exos cardio, séances hybrides, objectif séances/sem).
4. 🟡 **Nutrition** ✅ + **contexte reprise** ✅ + **alertes** 🟡 *(en cours — placement C2)*.
5. ⏳ **IA morpho** (C4) et **paiement premium** (C5) — plus lourds, après une base solide.
6. ⏳ **Partie coach** (section B) — phase 2.
