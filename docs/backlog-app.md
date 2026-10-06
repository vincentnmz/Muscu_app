# Backlog Novalyz — à faire & vérifier

> Liste de travail (dump du porteur, sept. 2026), organisée et priorisée.
> Légende statut : ✅ fait · 🟡 en cours · ⏳ à venir · ❓ décision à trancher (section C).
> 🟢 Athlète = priorité (parcours solo) · 🔵 Coach = **phase 2**.
> Voir aussi [`vision-produit.md`](./vision-produit.md) et [`roadmap-beta.md`](./roadmap-beta.md).
> **Dernière passe de statut : 5 oct. 2026.**
> **MAJ 5 oct. 2026** : reskin complet de la **partie coach** (section B) livré en **prod** (`main`) ; **questionnaire quotidien « état du jour »** (auto 1×/jour) ; **import nutrition auto Health Connect** ; **correctif critique** de la boucle de permission Health Connect côté athlète (« serveur en démarrage »).

---

## A. ATHLÈTE (priorité)

### A1 · Montre & capteurs
- ✅ **Sommeil + BPM** depuis la montre (Health Connect ; fork du plugin `capacitor-health` pour exposer sommeil + FC repos, affichés sur « Forme »).
- ✅ **Graphique pas/jour** interactif (Semaine/Mois/Année) + bouton **« Connecte ta montre »** ; historisation serveur (`saveSante` / `sante_historique`).
- ✅ **Import des sorties montre** par activité (footing/vélo GPS… via `queryWorkouts`, avec FC) — cartes « à importer / déjà importée ».
- ✅ **Montre ↔ saisie manuelle sans doublon** (voir C1) — tranché : montre = autorité pour le total du jour, jamais additionner ; déjà respecté dans le code (`pasjour_` = fitbit only, pas manuels confinés aux stats cardio).
- ✅ **Import nutrition auto depuis Health Connect** (natif, 1×/jour) : agrège les repas du jour (kcal/P/G/L) et les écrit via `saveNutrition`, en respectant une saisie manuelle existante.
- ✅ **Correctif critique (5 oct. 2026)** : boucle de permission Health Connect côté athlète (`_nutAutoImportHC` + warm-up pas/montre re-demandaient la permission à chaque chargement → écran système → `resume` → re-fetch en boucle → « serveur en démarrage »). Verrou 1 tentative/session + throttle quotidien + flag posé avant la demande ; refetch `resume` throttlé 8 s. **Déployé en prod.**

### A2 · Écrans
- 🟡 Écran **Aujourd'hui** — base refondue (design `.tj`, blocs pas / récompenses animées au scroll) ; reste à **affiner / valider**.
- ✅ Écran **Cardio** — sélecteur de sport (Muscu/Cardio/Hyrox) + grille d'activités + import montre + saisie + écran d'analyse.
- ✅ Écran **État → « Forme »** — onglet **Nutrition** (objectifs macros P/G/L calculés depuis poids+objectif, niveau d'activité, saisie, tendance) ; réorg en 3 zones (Aujourd'hui / Mes suivis / Mes tendances) ; **Contexte de reprise**.
- ✅ **Questionnaire quotidien « État du jour »** (auto à la 1re ouverture du jour, 1×/jour, non bloquant) : sommeil / fatigue / motivation, anti-doublon avec les questionnaires avant/après séance. Alimente la fraîcheur de l'« état du jour » (hero athlète + vigilance bien-être côté coach).
- ⏳ **Onboarding / visite guidée** (à faire **à la FIN**, écrans figés) : présentation de démarrage expliquant **écran par écran** où se trouvent les fonctions. Ne pas coder avant d'avoir figé les écrans. *(Les écrans coach + Forme sont désormais quasi figés → se rapproche.)*

### A3 · Alertes & fiabilité (cœur analyse)
- ✅ **Notifs d'alerte** pour l'athlète solo — cloche header + centre d'alertes + **liste des non-lues sur Aujourd'hui** + push haute-sévérité (voir C2, tranché).
- ✅ Vérifier la **fiabilité des alertes** — audit du moteur ; gardes confirmées (bien-être 7 j glissants, alertes charge bloquées si ACWR non fiable, stagnation avec amnistie contexte) ; faux positif corrigé (plus de « absence » pour un athlète sans historique).
- ✅ **Contexte de performance** (retour vacances / blessure / deload) — moteur qui pondère les analyses + **auto-déclaration athlète** + **suggestion après ≥14 j sans séance** (voir C3, tranché).

### A4 · Programme & séances
- ✅ **Objectif de séances par semaine** (`objectif.seances_semaine`, affiché « X/Y objectif », utilisé dans la régularité).
- ✅ **Séances hybrides muscu / cardio** (programme hybride : ajout d'items Muscu **ou** Cardio).
- ✅ **Exercices cardio** (catalogue `_CARDIO_CATALOG` : activités pour le programme + l'import + les analyses).
- 🟡 **Analyse morphologique IA par photo** (face + dos) — **v1 codée, en veille** (action `analyseMorpho`, vision **Sonnet 5.5**, photos **jamais stockées**, consentement, quota 1/j). Accès : **page dédiée** `#tab-morpho` ouverte depuis le fil « Novalyz IA » (CTA + bouton photo). S'allume avec la clé `ANTHROPIC_API_KEY`.
- 🟡 **Médias athlète → coach (photo + vidéo)** — **v1 codée** : dans le fil « Coach » (athlète lié), bouton joindre une **photo** ou une **vidéo** (revue technique). Upload direct client → **Supabase Storage** (bucket privé `coach-media`, 75 Mo max) via **URL d'upload signée** (pas de base64 → vidéos OK) ; message stocké dans `commentaires` (`media_path`/`media_type`) ; **URL de lecture signée** (TTL 2 h) régénérée à chaque chargement ; **consentement** demandé une fois ; **suppression** = efface aussi le fichier du Storage. Rendu des deux côtés (athlète + coach). ⚠️ **Backend : redéployer `index.ts`.** À venir : **rétention auto** (cron de purge après N jours), légende, photo de profil / avatar, notif push au coach (le canal coach n'est pas encore branché).

### A5 · Monétisation
- 🟡 **Coach IA conversationnel** (fil « Novalyz IA ») — **codé et prêt, en VEILLE** : front (`cvSendIA`) + backend (`action chatIA`, grounding sur le moteur, quota **2 messages/jour/athlète**, modèle Haiku 4.5). **Coût = 0 € tant que le secret Supabase `ANTHROPIC_API_KEY` n'est pas ajouté** — sans clé, l'app répond « pas encore activé », aucun appel facturé. **Pour l'allumer : ajouter `ANTHROPIC_API_KEY` (Supabase → Edge Functions → Secrets) + redéployer `index.ts`.** Freemium : gratuit = quota, au-delà = premium (lié à C5).
- ⏳ **Paiement** pour offres **premium** : IA approfondie (quota + meilleur modèle), analyse morpho, paiement coach. ❓ modèle + prestataire (voir C5).

---

## B. COACH (phase 2 — rendu de la partie coach)

> ✅ **Reskin complet livré en prod le 5 oct. 2026** (refonte UX + fiche athlète « hub »). Statuts détaillés ci-dessous. Reliquats = notifs push coach + fiabilité fine + liaison IA.

- 🟡 **Fiabilité** du contexte de performance — alertes coach fiabilisées (dédoublonnage vs moteur, footer « basé sur N séances · dernier ressenti… », garde « données partielles », hero « état du jour » qui ne passe plus au vert sans ressenti récent). Reste à étendre la fiabilité au contexte de reprise côté coach.
- ✅ **Notifs d'alerte pour le coach** — le coach reçoit un push quand un de ses athlètes déclenche une alerte « haute » (cron). Tokens coach stockés sous `coach:<id>` (réutilise la plomberie push, zéro schéma) ; enregistrement natif à l'ouverture de l'espace coach (`_promptNotifNatifCoach`). ⚠️ `index.ts` à redéployer. *Reliquat v2 : Web Push coach (PWA) + deep-link de la notif vers l'alerte.*
- ✅ **Accueil = tous ses athlètes** — via l'onglet **Équipe** (annuaire + **recherche & filtres** par catégorie). L'accueil « Aujourd'hui » ne liste **volontairement pas** tous les athlètes (action + **résumé équipe**), l'annuaire complet est sur Équipe.
- ✅ Écran **Aujourd'hui** (refonte v2) — hero état équipe + **résumé/distribution**, **messages non lus**, **alertes prioritaires**. (Pas de détail athlète inline : le détail = la fiche.)
- ✅ **Bloc « alertes à traiter »** — `renderAlertesCoach` (bandeau de sévérité, dédoublonnage absence, footer fiabilité).
- 🟡 Ce que l'athlète **doit faire** comme séance — prochaine séance remontée ; à confirmer/compléter côté fiche.
- ✅ Son **état & bien-être** — hero **« État du jour »** coloré + **fraîcheur** (chips datées, « À confirmer » sans ressenti récent) ; **vigilance bien-être** au niveau équipe.
- ✅ Écran **son entraînement** — **séances réalisées en détail** (exo / série / charge / reps / RPE) ; création / modification de programme (préexistant).
- ✅ Écran **analyses muscu & cardio** — **port de « Mes analyses » athlète** dans l'Analyses coach + **Analyses équipe v2** (assiduité, vigilance bien-être, blessures actives, progression/stagnations, **fiabilité des données** — sans tonnage brut).
- ✅ Écran **conversation** — **messagerie pleine page** (athlète lié). Volet **IA** = lié à A5 (en veille tant que `ANTHROPIC_API_KEY` absente).
- ✅ Écran **État / Nutrition** — intégré à la **fiche « hub »** : volume par muscle, dernières séances inline, **macros/nutrition**. Vue coach des données santé (pas/sommeil/FC) **dépend de Health Connect alimenté** côté athlète.
- ✅ **Fiche athlète = hub** — un seul écran : boutons d'action (Message / Entraînement / Analyses / Programme / Son état), alerte, **repères en tuiles** (Régularité / ACWR / Dernière séance / Progression), volume, séances, macros.

---

## C. ❓ Décisions de conception à trancher (avant de coder)

### C1 · Montre ↔ saisie manuelle : éviter les doublons de pas — ✅ tranché (déjà respecté)
**Règle retenue** : **la montre fait autorité pour le total de pas du jour** ; quand elle existe, le total vient d'elle, sinon de la saisie manuelle — on **ne cumule JAMAIS** les deux. L'estimation manuelle de pas (marche) est conservée (utile sans montre) mais **n'entre pas** dans le total montre.
**État vérifié dans le code (30 sept.)** — la règle est **déjà en place** :
- `pas_quotidiens` / `pasjour_YYYYMMDD` = **`source:'fitbit'` uniquement** (import montre ; commenté « pour ne pas polluer les séances cardio »).
- Total du jour (bandeau Forme + objectif « 5 j à 10 000 pas ») = **Health Connect / montre**.
- Les pas d'une **marche manuelle** restent **confinés aux stats cardio** (« Pas totaux / sem. »), jamais additionnés au total du jour.
- Chaque ligne porte sa **`source`** (`fitbit` / `manuel`).
→ Aucun chiffre unique ne double-compte (ni en base, ni à l'affichage). Reste éventuel (plus tard) : dédoublonnage fin par **chevauchement horaire** si une activité manuelle recouvre une sortie montre.

### C2 · Placement des alertes — ✅ tranché & fait
Décision retenue : **cloche header** (historique complet via le centre d'alertes) **+ liste des alertes non-lues en clair sur Aujourd'hui** (titre / preuve / action / « lu ») **+ push** pour la sévérité haute. Marquage « lu » persistant (`marquerAlerteLue`).

### C3 · Contexte de reprise (vacances / blessure / deload) — ✅ tranché & fait
Décision retenue : **les deux** — l'athlète déclare lui-même son état (modale existante, source `'athlete'`) **et** Novalyz **suggère** un retour après une coupure détectée (≥14 j sans séance, jamais posé d'office). Affiché sur « Forme » (`#et-contexte`). Le moteur pondère (neutralise « régression », ACWR en pause, alertes absence/sous-charge en veille).

### C4 · Analyse morphologique IA par photo (face + dos) — 🟡 tranché (v1)
Décisions retenues : **photos JAMAIS stockées** (envoyées à l'IA vision puis jetées, RGPD-minimal) · **consentement explicite** obligatoire (case à cocher) · modèle **Sonnet 5.5** (vision) · cadre **non médical / respectueux / sans jugement corporel / sans chiffre inventé** · premium (quota, en veille sans clé). À trancher plus tard : **stockage opt-in** pour l'historique/comparaison avant-après (nécessaire pour l'envoi au coach et l'avatar profil) + **vidéo** (frames).

### C5 · Paiement premium — ⏳
❓ modèle (abonnement mensuel ? à vie ?), **prestataire** (Stripe / RevenueCat pour le natif), et **part reversée au coach**. Impacte l'architecture (comptes, droits).

---

## Ordre suggéré (suivi)
1. ✅ Finir la **structure du parcours solo** (réorg Forme en 3 zones).
2. ✅ **Montre** : sommeil/BPM + graphique pas + import par sport. *(C1 pas encore tranché, non bloquant.)*
3. ✅ **Cardio** complet (exos cardio, séances hybrides, objectif séances/sem).
4. ✅ **Nutrition** + **contexte reprise** + **alertes** (placement C2 + fiabilité) + **C1** anti-doublon pas (tranché, déjà respecté).
5. ✅ **Partie coach** (section B) — reskin complet livré en prod (5 oct. 2026).
6. ⏳ **Route bêta** (voir [`roadmap-beta.md`](./roadmap-beta.md)) : **P0-1 emails de reset** (domaine Resend) + **P0-3 Play Store** (fiche + déclaration Health Connect) → **P1** (erreurs réseau, accès testeur, **onboarding**).
7. ⏳ **IA morpho** (C4) + **Coach IA** (A5, attend `ANTHROPIC_API_KEY`) + **paiement premium** (C5) — après la base bêta stable.
