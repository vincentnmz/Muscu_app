# Audit — Mode hors-ligne (02/11/2026)

Méthode : code (brouillon de séance, file d'attente `novalyz_offline_seances`, `flushSeancesOffline`, `_envoyerSeance`, cache `nv_cache_<id>`, catalogue d'exercices, envois des autres saisies) + serveur (`envoi_id` anti-doublon) + **simulation navigateur** (file d'attente sans session valide) + base réelle.
Légende : ✅ vérifié · ❌ défaut · 🟠 à décider · 🔍 à vérifier sur téléphone.

## Juste ✅
- **Séance jamais perdue** : brouillon enregistré pendant la saisie (repris au retour) ; sans réseau ou si l'envoi échoue → **file d'attente** sur le téléphone, renvoyée au retour du réseau, au démarrage et au réveil de l'app ; retirée de la file **seulement** quand le serveur confirme.
- **Pas de doublon au renvoi** : chaque séance porte un identifiant d'envoi ; le serveur ignore un 2ᵉ envoi du même identifiant (nouvel identifiant à chaque nouvelle séance).
- Bilan de séance mis en file avec la séance (depuis S4, note comprise).
- Données affichées depuis le cache du téléphone au démarrage (environ 220 Ko pour toi, loin de la limite).

## Défauts
| # | Constat (vérifié) | Correctif proposé |
|---|---|---|
| **H1** ❌ grave | **Boucle de rechargement** : s'il reste une séance en file et que la session n'est plus valide (déconnexion, session de 30 j expirée, ou mot de passe changé sur un autre appareil — C8), le renvoi au démarrage reçoit « session expirée » → l'app se déconnecte et **recharge la page… indéfiniment** (simulation : **6 rechargements en 9 s**, même sur l'écran de connexion — impossible de se reconnecter). La file n'est pas liée à un compte (un autre athlète sur le même téléphone hériterait de la séance). | La file est rangée **par athlète** et renvoyée seulement quand **cet athlète est connecté** ; un refus de session pendant le renvoi **ne déconnecte pas** et ne recharge pas : la séance reste en file et part après la reconnexion. |
| **H2** ❌ | **Catalogue d'exercices non gardé** : il est rechargé à chaque démarrage, jamais mis en cache. Si l'app démarre sans réseau, il est vide → les séries partent **sans muscle** (volume par muscle faux), l'ajout d'un exercice hors programme ne propose rien. (Jamais arrivé en base : 0 série sans muscle.) | Catalogue gardé sur le téléphone ; le serveur complète le muscle depuis le catalogue si une série arrive sans. |
| **H3** ❌ régression M5 | **Message au coach perdu sans réseau** : depuis l'anti-doublon (M5), le champ est vidé à l'envoi ; si l'envoi échoue, le texte a disparu. La réponse du serveur n'est pas vérifiée (« Message envoyé ! » même si refusé). Idem côté coach. | En cas d'échec, le texte est **remis dans le champ** avec « Pas de réseau — message non envoyé » ; réponse du serveur vérifiée. |
| **H4** | **Aucune indication hors-ligne** : au démarrage sans réseau, les données en cache s'affichent mais avec un toast rouge « Erreur de connexion » ; rien ne dit de quand datent les données ni qu'une séance attend d'être envoyée (Aujourd'hui peut reproposer la même séance). | Bandeau discret « Hors-ligne · données du 02/11 à 18:40 » et « 1 séance en attente d'envoi » (disparaît à la synchronisation). |
| **H5** | Si la mémoire du téléphone pour l'app était pleine, l'écriture de la file échouerait **sans prévenir**. Peu probable (≈ 220 Ko utilisés), mais la séance serait perdue en silence. | Si l'écriture échoue : on libère le cache des données (rechargeable) et on réessaie ; sinon message clair. |

🔍 À vérifier sur téléphone après correction : mode avion pendant une séance → validation → réseau rétabli → séance visible dans Analyses.
