# Audit coach — écran 6 : Fiche ▸ Programme + « qui a la main » (04/11/2026)

Décision porteur (04/11) : **les propositions Novalyz vont à l'athlète seulement s'il n'a pas de coach** ; avec un coach, elles vont **au coach**, qui décide (option a) ; le coach peut **laisser Novalyz proposer aussi à l'athlète** (option b) ; plus tard, le coach **valide** une proposition qui arrive chez l'athlète « Ton coach propose » (option c).
Code : `renderProgrammeCoach`, `cdAgInit`, `renderCoachZones`, générateur (`ouvrirGenProgramme`, `_genCtx` coach), côté athlète : `_lv3PlanHtml`, `_tjCiblesHtml`, `_progDecision` / `_progWhy`, `_lxRecos`, `_lv3DiagCardHtml`, mail récap (`out.recos`, index.ts).
Capture : `mockups/audit-coach-programme-avant.png` (Vincent).

## Juste ✅ (vérifié)
- Zones prioritaires modifiables, agenda de la semaine (« glisse une séance sur un jour », « pré-remplir semaine type »), 4 séances du programme modifiables, « + Nouvelle séance ».

## Constats — onglet Programme (coach)
| # | Constat | Proposition |
|---|---|---|
| **P1** | **Aucun bouton « Novalyz propose » côté coach** (mobile et bureau) alors que le texte des zones y renvoie. Le générateur sait pourtant travailler pour un athlète du coach. | Bouton « ✦ Novalyz propose un programme » en tête (niveau + zones de l'athlète ; le coach relit avant de créer). |
| **P2** | **Rien ne dit qui a la main.** | Bloc en tête : « Propositions Novalyz pour Vincent : ◉ au coach seulement (défaut) · ○ aussi à Vincent » (option b). |
| **P3** | Le coach ne voit pas ici **ce que Novalyz propose cette semaine** pour ce programme (Pendulum +4 séries, Leg curl +4, Smith 75 kg) — seulement dans l'Aperçu. | Encart « Novalyz propose cette semaine » sous les séances concernées (lecture ; l'appliquer en un clic = option c, plus tard). |
| **P4** | **Modifications non signalées** : le coach et l'athlète peuvent modifier le même programme sans que l'autre le sache ; « régénérer » remplace tout. | Garder la date et l'auteur de la dernière modification (serveur) : chez l'athlète « Programme mis à jour par ton coach le 04/11 » ; chez le coach « Vincent a modifié son programme le … » (+ ce qui a changé : séance, exercice). |
| **P5** | Droits de l'athlète qui a un coach : aujourd'hui tout (y compris régénérer). | Il garde les petits ajustements (remplacer un exercice indisponible, une charge) — signalés au coach (P4) ; **plus de « Régénérer avec Novalyz »** ni de génération. |

## Inventaire — ce que l'athlète **avec coach** ne verra plus (si le coach ne l'autorise pas)
| # | Écran athlète | Proposition Novalyz aujourd'hui | Avec coach |
|---|---|---|---|
| **D1** | Aujourd'hui | Plan de la semaine (compact), « Ce que Novalyz vise » (cibles), levier du « Pourquoi » | Cibles = **celles du programme du coach** + « dernière fois » ; plan et leviers masqués |
| **D2** | Saisie de séance | Cible Novalyz par série, message « sous la fourchette → 75 kg ou 70 kg », bouton « Comment Novalyz te fait progresser » | Cible du programme (séries × reps) + dernière fois ; pas de charge proposée |
| **D3** | Analyses | Plan de la semaine, recos, levier du « Pourquoi » | Faits gardés (records, force estimée, causes) ; plan / recos / leviers masqués |
| **D4** | Évolution | « Ce que Novalyz vise la prochaine fois », levier de la carte « Pourquoi ça bloque » | Masqués ; faits gardés |
| **D5** | Entraînement / onboarding | « Novalyz me propose un programme », « Régénérer avec Novalyz » | Remplacés par « Ton programme est géré par ton coach » |
| **D6** | Mail récap (serveur) | 3 recos | Recos remplacées par les faits (→ redéploiement `index.ts`) |

**Gardé dans tous les cas** (sécurité, pas des prescriptions) : alertes douleur / fatigue / charge trop élevée, état du jour, « reco du jour » de vigilance, records, force estimée, volume, régularité. Le coach voit tout.

## Décisions porteur (04/11)
Validé : P1-P5 (P5 = petits ajustements gardés, signalés au coach) et D1-D6. Réglage par défaut **« au coach seulement »** pour tous, Vincent compris (il cochera « aussi à Vincent » lui-même pour tester).
Maquette : `mockups/coach-programme-v2.html` (+ `-1.png` coach ▸ Programme, `-2.png` athlète avec coach ▸ Aujourd'hui, `-3.png` saisie + Entraînement + mail). « Dernière fois » = séance réelle du 27/10 (dos jambes).
