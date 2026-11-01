# Audit — Novalyz IA (chat) + analyse morpho (01/11/2026)

Méthode : lecture complète du code (backend `handleChatIA`, `_iaContexte`, `handleAnalyseMorpho`, `recoMorphoExercices` ; front fil « Novalyz IA » `cvSendIA`, fil coach `_coachIaSend`), base réelle (quotas), et **contexte réellement envoyé à l'IA** recalculé avec la vraie fonction sur ta copie de données (01/11 et 09/11 simulé).
Légende : ✅ vérifié · ❌ défaut · 🟠 à décider.

## État
- **Jamais utilisée en production** : aucune trace de quota dans la base → la clé `ANTHROPIC_API_KEY` n'est (très probablement) pas posée ; chaque question renvoie « l'assistant n'est pas encore activé ».
- Modèles : chat = Haiku 5.5, morpho = Sonnet 5.5. Quota : 2 questions / jour (+5 contre 150 points), morpho 1 / jour.

## Juste ✅
- Consigne système : répondre **uniquement** depuis les données fournies, pas de diagnostic médical, ne pas contredire le moteur.
- Quota décompté seulement si la réponse a réussi ; historique limité (12 messages, 2 000 caractères chacun).
- Morpho : consentement obligatoire ; photos **jamais stockées** (envoyées pour analyse puis jetées — vérifié dans le code) ; aucun % de masse grasse ni longueur estimée ; recos d'exercices calculées hors IA (règles fixes).

## Défauts

| # | Constat (vérifié) | Correctif proposé |
|---|---|---|
| **I1** ❌ | **Le contexte envoyé à l'IA contredit l'app** (vraie fonction rejouée au 09/11) : « État du jour : **Prêt** » alors que l'app affiche « État non renseigné » ; « Dernier ressenti : sommeil 4/5, fatigue 1/5 » **sans date** (questionnaire du 30/10) ; « Nutrition **récente** (2026-10-02) : **830 kcal** » (un mois, journée incomplète) ; « Charge ACWR : 0 (sous_charge) » (repère que l'app n'affiche plus) ; « énergie —/5 » (champ absent ; stress et courbatures oubliés). L'IA dirait donc des choses fausses **avec de vraies données**. | Contexte reconstruit sur ce que l'app affiche : état affiché (« non renseigné » sans questionnaire ≤ 7 j), **chaque donnée datée** (« questionnaire du 30/10, il y a 10 j »), nutrition seulement si ≤ 7 j, ACWR retiré (fraîcheur à la place), champs réels du questionnaire. |
| **I2** ❌ | **Contexte trop pauvre pour les questions proposées** (« Comment mieux progresser ? », « Analyse ma semaine ») : ni la lecture des exercices (records, progrès, bloqués, sous la fourchette), ni le volume par muscle, ni la séance du jour, ni le cardio. L'IA ne peut répondre que vaguement… ou inventer. | Ajouter la lecture des exercices (même calcul serveur que le mail), le volume de la semaine vs ton minimum, la séance du jour, le cardio 7 j, le contexte de performance. Les cibles du jour (calculées dans l'app) : l'IA renvoie vers « Ce que Novalyz vise ». |
| **I3** ❌ | **Aucun contrôle des chiffres** dans la réponse : la consigne « n'invente aucun chiffre » n'est pas vérifiée. | 🟠 (a) **Recommandé** : garde-fou automatique — tout nombre de la réponse doit exister dans les données envoyées ou la question ; sinon la réponse est **régénérée une fois** avec la consigne de le retirer, puis le passage fautif est supprimé. (b) Pas de contrôle. |
| **I4** ❌ | **Côté coach**, le même chat sert pour un athlète : l'IA **tutoie le coach comme s'il était l'athlète**, et chaque question du coach **consomme le quota de l'athlète** (2/jour). | Mode coach : consigne « tu parles au coach de [prénom] », quota propre au coach. |
| **I5** ❌ | **Confidentialité** : la politique ne mentionne ni l'IA ni l'envoi de données (résumé d'entraînement, bien-être, photos morpho) à **Anthropic** (sous-traitant, hors UE). | Section « Novalyz IA » : quelles données, à qui, pas de stockage des photos, et — selon les conditions commerciales d'Anthropic — pas d'entraînement de leurs modèles sur ces données. |
| **I6** 🟠 | IA **non activée** mais « Demande à Novalyz » est visible partout (bulle, fil, suggestions) → l'utilisateur tombe sur « pas encore activé ». | (a) Masquer la bulle et les suggestions tant que l'IA est inactive (fil marqué « bientôt ») ; (b) activer l'IA (poser la clé, coût à prévoir) ; (c) laisser tel quel. |
| **I7** 🟠 | Morpho : les seuils des recos d'exercices (ex. fémur/tronc ≥ 0,82, envergure ± 3 cm) ne sont **pas sourcés** dans le code. | Les étiqueter « repère indicatif » tant qu'aucune source n'est trouvée (ou les sourcer). |

Non couvert : qualité réelle des réponses (impossible à tester sans clé API — rien n'a été envoyé à Anthropic pendant cet audit).

## Réalisé (01/11, validé porteur : tout, I3 a, I6 « bientôt », I7 indicatif)
- **I1 / I2** Contexte IA reconstruit (serveur) : état **affiché** par l'app (« non renseigné » sans questionnaire ≤ 7 j), chaque donnée **datée** (« le 30/10, il y a 2 j »), questionnaire réel (sommeil, fatigue, stress, courbatures, douleur), nutrition seulement si ≤ 7 j, ACWR remplacé par la fraîcheur ; ajout : lecture des exercices (même calcul que l'app et le mail), volume de la semaine vs minimum, prochaine séance (sans inventer les charges : renvoi vers « Ce que Novalyz vise »), cardio 7 j, contexte, mode vacances, poids daté. Vérifié en rejouant la vraie fonction sur tes données (01/11 et 09/11). Le bloc « Ce que je vois de toi » du fil IA suit les mêmes règles (état affiché, nuit et poids datés, plus d'ACWR).
- **I3 (a)** Garde-fou chiffres : tout nombre > 10 absent des données / de la question → réponse **régénérée une fois**, sinon la phrase fautive est **retirée** (testé avec une API simulée).
- **I4** Mode coach : l'IA parle au coach **de** l'athlète (3e personne) ; quota du coach, plus celui de l'athlète.
- **I5** Politique de confidentialité + fenêtre « Confidentialité » de l'app : Anthropic (IA) et Resend (e-mails) ajoutés ; hébergeur « Google » obsolète remplacé (Supabase / Firebase) ; export mentionné.
- **I6** IA inactive : bulle « Novalyz IA · bientôt », fil avec bandeau « arrive bientôt », saisie et suggestions désactivées (rien ne mène à une impasse).
- **I7** Morpho : badge « Mesuré · repère indicatif » + note « seuils repères, non validés par une étude ».
- Tests : `ia-garde-fou` (7 cas, API simulée — aucun envoi réel). 69 suites vertes.
- Pour activer l'IA : secret Supabase `ANTHROPIC_API_KEY` (à poser par toi ; coût par question à prévoir).
