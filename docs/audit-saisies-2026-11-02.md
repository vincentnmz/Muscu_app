# Audit — Saisies : cardio manuel, questionnaire du jour, bilan de séance (02/11/2026)

Méthode : code (front `ouvrirEtatDuJour` / `enregistrerEtatDuJour`, `ouvrirBilanSeance` / `_envoyerBilan` / `validerBilanSeance`, `sauvegarderCardio`, `sauvegarderHyrox`, `_saveCardioPrevu` ; serveur `handleSaveBienEtre`, `handleSaveBilanSeance`, `handleSaveCardio`, lecture `analyses.rpe_*`) + **base réelle** (indicateurs, bien_etre) + captures (questionnaire, bilan).
Légende : ✅ vérifié · ❌ défaut · 🟠 à décider.

## Juste ✅
- **Questionnaire du jour** : 4 questions Hooper (sommeil, fatigue, stress, courbatures, 1-5), une seule ligne par jour, **fusion** avec la douleur du bilan (l'un n'efface pas l'autre) ; « fait » seulement si au moins une réponse readiness ; prérempli si déjà rempli.
- **Bilan muscu** : RPE de séance 0-10 (CR-10), douleur 1-4 + zone, **durée mesurée** par le chrono (depuis le correctif du 31/10 : enregistrée aujourd'hui). Depuis le 22/10 : **7 séances, 7 bilans** remplis.
- Base saine : 0 bilan en double, 0 ligne bien-être vide, 0 valeur cardio aberrante (durée > 5 h, distance > 150 km, FC > 220).

## Défauts
| # | Constat (vérifié) | Correctif proposé |
|---|---|---|
| **S1** ❌ | **RPE cardio demandé deux fois** (cardio manuel et Hyrox : dans le formulaire, puis dans le bilan qui s'ouvre juste après), rangé sous **2 clés** : formulaire → charge interne + historique cardio ; bilan → graphique « Effort des séances ». Conséquence base réelle : **18 de tes 20 séances cardio avec RPE n'apparaissent pas dans le graphique Effort** (pas de bilan). Le cardio **prévu dans une séance muscu** n'ouvre jamais de bilan → son RPE n'y apparaît jamais. | **Un seul RPE**, dans le bilan (aussi pour le cardio prévu) ; le serveur calcule la charge interne depuis ce RPE × la durée de la séance ; les anciens RPE du formulaire sont lus par le graphique quand il n'y a pas de bilan (tes 18 séances réapparaissent). |
| **S2** ❌ | **Note du bilan perdue sans coach** : elle est envoyée comme message au coach ; sans coach, le message est enregistré sans destinataire et n'est visible **nulle part**. Le libellé dit « remonte à ton coach » même sans coach. | La note est rangée **avec la séance** (visible dans Évolution ▸ Par séance) ; envoyée en plus au coach s'il y en a un ; libellé adapté. |
| **S3** ❌ | **Questionnaire du jour** : « Enregistrer » sans rien cocher → « État du jour enregistré » alors que rien n'est enregistré ; la réponse du serveur n'est jamais vérifiée (message de succès même en cas de refus). | Bouton actif seulement quand les réponses sont données ; message d'erreur si le serveur refuse. 🟠 (a) **les 4 réponses obligatoires** (l'indice Hooper se calcule sur les 4) ; (b) au moins 1. |
| **S4** ❌ | **Bilan muscu envoyé AVANT la séance** : si l'envoi de la séance échoue et que tu réessaies, le bilan part deux fois (le serveur ajoute sans remplacer). Cardio : « Bilan enregistré » s'affiche même si l'envoi a échoué. | Bilan envoyé **après** la séance réussie ; le serveur **remplace** le bilan existant (même séance, même jour) ; message d'erreur réel. |
| **S5** | **Cardio manuel** : pas d'alerte « doublon possible » (le cardio prévu et l'import montre l'ont) ; date **future** acceptée ; valeurs non bornées côté serveur (une durée négative passerait). | Même alerte doublon ; date ≤ aujourd'hui ; bornes serveur : durée 1-600 min, distance 0-300 km, FC 30-230, calories 0-5 000. |

Non vérifié en capture : le formulaire cardio (il n'apparaît qu'après le chrono « Démarrer la séance ») — S1 et S5 sont vérifiés dans le code.
