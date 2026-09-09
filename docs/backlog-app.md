# Backlog Novalyz — à faire & vérifier

> Liste de travail (dump du porteur, sept. 2026), organisée et priorisée.
> Légende : 🟢 Athlète = priorité (chantier parcours solo en cours) ·
> 🔵 Coach = **phase 2** (rendu de la partie coach) · ❓ = décision de
> conception à trancher **avant** de coder (voir section C).
> Voir aussi [`vision-produit.md`](./vision-produit.md) et [`roadmap-beta.md`](./roadmap-beta.md).

---

## A. ATHLÈTE (priorité)

### A1 · Montre & capteurs
- **Sommeil + BPM** depuis la montre (Google Health).
- **Graphique pas/jour**, avec un bouton **« Connecte ta montre »** intégré dedans.
- Bouton **« Connecte ta montre »** par sport dans l'écran Cardio (footing, marche, Hyrox, natation… + **compteur vélo** et autres).
- ❓ **Montre ↔ saisie manuelle sans doublon** (voir C1) : la montre compte les pas + BPM (+ distance **seulement si une activité est déclenchée**). Une marche sans activité déclenchée → données manquantes. Une saisie manuelle risque de **compter 2× les pas** de la même marche.

### A2 · Écrans
- Écran **Aujourd'hui** — affiner / valider.
- Écran **Cardio** — sélecteur de sport + boutons « connecte montre » (ci-dessus).
- Écran **État** — ajouter un **onglet Nutrition** (aide + conseils IA selon les objectifs).

### A3 · Alertes & fiabilité (cœur analyse)
- **Notifs d'alerte** pour l'athlète solo — ❓ où les placer (quel écran) ? (voir C2)
- Vérifier la **fiabilité des alertes** (pas de fausses alertes).
- **Contexte de performance** après **retour de vacances / blessure / deload** — le moteur doit en tenir compte pour ne pas fausser les analyses. ❓ fiabilité + où l'afficher (voir C3).

### A4 · Programme & séances
- **Objectif de séances par semaine**.
- **Séances hybrides muscu / cardio**.
- **Ajouter les exercices cardio** (catalogue d'exos).
- Créer des programmes avec **analyse morphologique IA par photo** (face + dos). ❓ premium + consentement RGPD (voir C4).

### A5 · Monétisation
- **Paiement** pour offres **premium** : accès approfondi à l'IA, analyse morphologique, et paiement avec le coach. ❓ modèle + prestataire (voir C5).

---

## B. COACH (phase 2 — rendu de la partie coach)

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
- Écran **État** + onglet **Nutrition** (conseils selon objectifs).

---

## C. ❓ Décisions de conception à trancher (avant de coder)

### C1 · Montre ↔ saisie manuelle : éviter les doublons de pas
**Proposition** (à valider) :
- **Total de pas du jour = la montre fait autorité** (une seule source par jour). On ne ré-additionne jamais.
- **Une marche / activité = un enregistrement séparé** (distance, durée, allure) qui **ne re-compte PAS ses pas** dans le total du jour.
- Chaque donnée porte sa **`source`** (`montre` / `manuel`) — la table `indicateurs` a **déjà** ce champ.
- **Règle anti-doublon** : on saisit à la main **uniquement ce que la montre n'a pas** (ex. sortie vélo sans capteur → distance/temps ; marche non déclenchée → distance/temps). Les **pas** ne viennent que du compteur de la montre.
- Option : dédoublonnage par **chevauchement horaire** (si une activité manuelle recouvre une activité montre → on garde la montre).

### C2 · Placement des alertes
Où l'athlète (et le coach) voit ses alertes : cloche en haut ? bloc dédié sur « Aujourd'hui » / « Mon état » ? notification push + rappel dans l'app ? → à décider.

### C3 · Contexte de reprise (vacances / blessure / deload)
Le moteur doit **pondérer** les analyses après une coupure (ne pas crier « régression » après 3 semaines de vacances). Lien avec la **fiabilité ACWR** déjà existante. ❓ comment le déclarer (auto vs déclaré par l'athlète) + où l'afficher.

### C4 · Analyse morphologique IA par photo (face + dos)
Fonction premium probable. ❓ **consentement / RGPD** (photos = données sensibles), stockage, et quel modèle d'analyse.

### C5 · Paiement premium
❓ modèle (abonnement mensuel ? à vie ?), **prestataire** (Stripe / RevenueCat pour le natif), et **part reversée au coach**. Impacte l'architecture (comptes, droits).

---

## Ordre suggéré (à valider)
1. Finir la **structure du parcours solo** (maquettes → code), en réutilisant l'existant.
2. **Montre** : sommeil/BPM + graphique pas + connexion par sport (C1 tranché d'abord).
3. **Cardio** complet (exos cardio, séances hybrides, objectif séances/sem).
4. **Nutrition** (onglet État) + **alertes** (placement C2) + **contexte reprise** (C3).
5. **IA morpho** (C4) et **paiement premium** (C5) — plus lourds, après une base solide.
6. **Partie coach** (section B) — phase 2.
