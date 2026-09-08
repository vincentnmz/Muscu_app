# Novalyz — Vision produit & architecture fonctionnelle (réflexion de fond)

> Note de fond, **à retravailler avant d'ajouter des fonctionnalités**. Rien à
> coder tout de suite. Objectif : figer la promesse et l'organisation de l'app
> pour qu'un utilisateur comprenne en quelques secondes à quoi elle sert.

---

## ⭐ LA BOUSSOLE (garde-fou anti-dérive)

**Novalyz est une aide pour :**
1. **Comment s'entraîner** — donner / cadrer le plan d'entraînement.
2. **Si c'est bien fait** — dire si l'entraînement est correctement mené.
3. **Comment s'améliorer** — en **analysant les données ET le ressenti**.

> Règle : toute fonctionnalité qu'on envisage doit servir 1, 2 ou 3.
> Si ça ne sert aucune des trois → on ne le fait pas (ou plus tard).

Le différenciateur n'est **PAS** la bibliothèque de programmes (ça existe
partout). C'est **l'interprétation adaptative** : *« compte tenu de tes données
et de ton ressenti, voilà ce que tu dois faire / améliorer »*.

---

## Le problème actuel (constat)

L'app peut sembler « mal organisée » non pas parce qu'il **manque** des
fonctionnalités, mais parce que la valeur (l'analyse) est **noyée dans des
cartes de statistiques**. L'utilisateur voit des chiffres, pas un parcours.

Deux causes, deux natures de travail :
1. **Organisation / récit** → travail d'**architecture de l'information** (pas
   de moteur à refaire).
2. **UNE brique manquante** → l'entité **Programme** (voir plus bas).

---

## Ce qui est DÉJÀ construit (≈70 % du moteur)

À NE PAS refaire — c'est notre socle, exactement ce qu'il faut pour la promesse :
- `NovalyzEngine` + `évaluerEtatAthlete` (état → interprétation).
- Chaîne **ACWR** multisport (charge aiguë / chronique, fiabilité).
- **Bien-être** (sommeil, énergie, fatigue, douleur, ressenti).
- **Tendances**, progression, historique, volume, charges.
- **Cadrage coach/solo** (message adapté selon présence d'un coach).
- Lien **coach ↔ athlète**, messages, notifications.

➡️ Conclusion : c'est une **réorganisation + une entité Programme + un
onboarding autonome**, PAS une réécriture. Moins lourd qu'il n'y paraît.

---

## La brique manquante : l'entité PROGRAMME

Aujourd'hui le modèle a des **séances** et des **performances**, mais pas de
notion de **plan prévu**. Or c'est elle qui permet la boucle clé :

```
PROGRAMME → SÉANCE DU JOUR → EXÉCUTION → DONNÉES + RESSENTI → ANALYSE → ADAPTATION
```

C'est ce qui permet à Novalyz de dire :
- *« Tu avais prévu ça aujourd'hui. »*
- *« Voilà ce que tu as réalisé. »*
- *« Voilà comment ton état évolue. »*
- *« Compte tenu de ton état, voici ce que tu devrais faire / améliorer. »*

---

## Les 3 niveaux d'utilisateur (un seul moteur derrière)

- 🟢 **Niveau 1 — Pas de programme.** Novalyz demande objectif / jours dispos /
  niveau / matériel → propose un **programme de départ**. (Quelques structures
  bien conçues suffisent — PAS une bibliothèque de 500.)
- 🔵 **Niveau 2 — J'ai mon programme.** L'utilisateur crée / importe le sien.
  Novalyz ne lui impose rien, il l'analyse.
- 🟠 **Niveau 3 — J'ai un coach.** Le coach crée/attribue le programme.
  Novalyz fait le lien : Coach → Programme → Athlète → Séances → Données →
  Analyse → Retour coach.

Le **programme autonome (niveau 1-2) côté athlète muscu est à ajouter** : sans
lui, un utilisateur seul se retrouve devant l'app sans savoir quoi faire.

---

## Architecture d'information proposée (5 sections)

Remplacer « accueil = empilement de dashboards » par un **parcours** :

- 🏠 **Aujourd'hui** — « Qu'est-ce que je dois faire ? » Accueil très
  personnalisé : séance prévue, état du jour (favorable / à surveiller),
  objectif du jour, bouton *Commencer ma séance*. Après la séance : analyse
  courte (ce qui a progressé, ce qui est à surveiller, la priorité).
- 🏋️ **Mon entraînement** — mon programme + mes séances (prévu ↔ réalisé).
- 📊 **Mes analyses** — Est-ce que je progresse ? Est-ce que je m'entraîne
  correctement ? Quels sont mes points faibles ? *(les stats deviennent le
  moteur de l'analyse, pas l'objet affiché)*.
- 🧠 **Mon état** — récupération, fatigue, douleurs, ressenti + recommandations.
- 👤 **Profil** — objectifs, préférences, paramètres, compte.

**Principe d'affichage** (point 3 de la boussole) : ne pas montrer
`Volume pec : 12 450 kg`, mais :
> 💪 Tes pectoraux progressent bien — charge en hausse depuis 4 semaines.
> ⚠️ À améliorer : ton volume est devenu irrégulier sur 2 semaines.
> 👉 Maintiens 2 séances pec/semaine avant d'augmenter la charge.

---

## La question à trancher AVANT de coder

**« Quelle promesse Novalyz fait-il à un athlète qui arrive sans coach ? »**

Réponse de travail (à affiner) — dérivée de la boussole :
> *Novalyz te dit **comment t'entraîner**, si tu **t'entraînes bien**, et
> **comment progresser**, en analysant tes **données** et ton **ressenti**.*

Une fois cette promesse figée, l'organisation de l'app en découle presque
mécaniquement.

---

## Inspiration (quoi voler dans chaque app)

| App | Ce qu'elle fait de génial | Ce que Novalyz en prend |
|---|---|---|
| **Whoop / Oura** | Jamais de donnée brute → « Récupération 34 %, vas-y doucement » | LA réf pour « stat → phrase actionnable » (boussole pt 3) |
| **RP Hypertrophy** | Programme qui s'auto-régule selon le feedback | Modèle « programme = cadre, l'app adapte » (le + proche) |
| **Juggernaut AI** | Séance ajustée selon RPE / readiness du jour | Boucle prévu → réalisé → ajustement |
| **Fitbod** | Séance générée selon la fatigue par muscle | Onboarding niveau 1 (objectif+jours+matériel→programme) |
| **TrainingPeaks** | Modèle Forme/Fatigue/Fraîcheur + coach↔athlète | Philo de l'ACWR aboutie ; volet coach |
| **Duolingo** | Accueil = UNE action claire, un chemin lisible | Le « 🏠 Aujourd'hui » (« je fais quoi ? ») |
| **Hevy / Strong** | Log de séance ultra-fluide | Juste l'UX de saisie |

**Si 2 apps seulement : Whoop** (stat→phrase) **+ RP Hypertrophy**
(programme adaptatif).

---

## Bloc IA — assistant / coach numérique (décision de direction)

**But** : pour l'athlète **sans coach** (surtout muscu), une IA intégrée qui
répond à ses questions et le guide — grounded sur SES données. C'est la réponse
concrète à « quelle promesse pour un athlète sans coach ». Aussi utilisable par
un club / prépa / coach pour interroger les données recueillies.

**Architecture (règle forte) :**
- Le **moteur déterministe** (ACWR, seuils, tendances, `NovalyzEngine`) reste la
  **source de vérité** — fiable, gratuit, explicable.
- L'**IA = couche langage** branchée sur les sorties du moteur. Elle *explique*
  et *répond*, elle **n'invente jamais un chiffre** qu'elle n'a pas reçu.

**Technique :** front → **edge function Supabase** (qui détient la clé API IA,
jamais le front) → construit un contexte = données déjà calculées de l'athlète
+ system prompt « coach Novalyz » → appelle l'IA → renvoie la réponse.

**Deux usages :**
1. **Conversationnel** : l'athlète pose ses questions (« pourquoi je stagne ? »,
   « je dors mal, je fais quand même les jambes ? »).
2. **Enrichir les blocs analyse** : explication en langage naturel générée à
   partir des signaux du moteur (au lieu d'une phrase figée).

**3 contraintes à anticiper :**
- 💶 **Coût** par appel → prévoir des **limites** (ex. X questions/jour en
  gratuit, illimité en payant).
- 🔒 **RGPD** : l'IA = nouveau sous-traitant → **à ajouter à la politique de
  confidentialité**.
- 🎯 **Garde-fou** : pas de chiffre inventé, pas de conseil médical, reste dans
  entraînement / récupération.

## Segmentation marché : muscu (grand public) vs sports (pro)

Décision : **dissocier la muscu du reste des sports** — mais **même socle
technique** (un seul moteur, noyau neutre déjà figé). Dissocier les *marchés*,
PAS faire deux apps.

| | **Muscu** | **Autres sports (foot, hockey…)** |
|---|---|---|
| Cible | grand public, amateurs, tout le monde | pros : clubs, prépa physique, fédérations |
| Moteur d'usage | l'**IA-coach** pour l'athlète solo | coach / analyste, cellule perf, vidéo |
| Modèle | B2C, freemium (Play Store) | B2B, vente à des structures |
| Rôle du porteur | peut **être le coach** (niveau 3) | axe reconversion (DU haute perf → fédé) |

Conséquence pratique : **même codebase / moteur**, mais **deux parcours
d'entrée** — l'onboarding muscu met l'IA-coach en avant ; l'onboarding pro met
les outils coach/club en avant.

## Prochaines étapes (quand on s'y mettra — rien maintenant)

1. Figer **la promesse** (question ci-dessus).
2. Dessiner la **carte d'architecture fonctionnelle** en vrai schéma visuel.
3. **Teardown** Whoop + RP (comment ils organisent accueil + onboarding).
4. En déduire les écrans, PUIS coder — en commençant par l'entité **Programme**
   et l'**onboarding autonome** (niveau 1-2).

> ⚠️ Ne pas ajouter de nouvelles fonctionnalités tant que cette architecture
> n'est pas posée : le risque est d'empiler encore des cartes de stats.
