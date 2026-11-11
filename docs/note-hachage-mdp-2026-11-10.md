# Note — hachage des mots de passe (audit P1, dernier point) — 10/11/2026

> Note de décision. **Aucun code modifié.** Le porteur choisit une option ; ensuite préprod → tests → prod avec accord.
> Rappel des règles : auth maison sur `athletes` / `coachs` (pas de Supabase Auth), hachage côté serveur uniquement, ne jamais casser `hashSalted` / `verifyPwd` / `login`.

## 1. Ce qui existe (vérifié dans le code et en base le 10/11)

| Point | État | Source |
|---|---|---|
| Format stocké | `'s2$' + SHA-256(login + '\|' + PEPPER + '\|' + mot de passe)` | `index.ts` `hashSalted` |
| Sel | le **login** (pas aléatoire) | idem |
| Poivre (`PEPPER`) | variable d'env Supabase, **hors base** | idem |
| Ancien format (SHA-256 nu) | encore accepté et converti en `s2` à la connexion ; **0 compte concerné** en prod | `verifyPwd` + requête prod |
| Comptes | 47 athlètes (10 réels) + 6 coachs (2 réels), **tous en `s2`** ; 1 compte démo sans mot de passe | requête prod (agrégats, aucun hash lu) |
| Mot de passe minimum | 6 caractères | `MDP_MIN` |
| Essais de connexion | 5 échecs / 15 min par login, puis blocage | `_loginBloqueMin` (C5) |
| Comparaison | `===` (pas en temps constant) | `verifyPwd` |
| `PEPPER` sert aussi | à dériver la clé des jetons de session (HMAC, préfixe distinct) | `_sessKey` |

## 2. Le risque, concrètement

Le hachage ne sert que **si la base fuit** (copie de la table, clé `service_role` volée…). Deux cas :

- **La base fuit, pas les variables d'env** : sans `PEPPER`, les hash sont inexploitables. **Aujourd'hui = protégé.**
- **La base ET `PEPPER` fuient** (ex. accès au tableau de bord Supabase) : SHA-256 est **très rapide** (des milliards d'essais / s sur une carte graphique). Un mot de passe de 6 caractères minuscules + chiffres (≈ 2 milliards de combinaisons) tombe en **secondes** ; 8 caractères variés en heures ou jours. Les gens réutilisent leurs mots de passe ailleurs → c'est ce cas qu'il faut couvrir.

Défauts secondaires : sel = login (deux comptes athlète / coach avec même login et même mot de passe → même hash) ; comparaison non constante (risque très théorique à distance).

## 3. Options

| | Option | Protection si base + PEPPER fuient | Coût | Migration | Avis |
|---|---|---|---|---|---|
| A | **Ne rien changer** | faible (SHA-256 rapide) | 0 | — | acceptable tant qu'il y a peu d'utilisateurs, à ne pas garder pour l'ouverture |
| B | **PBKDF2-SHA256, 600 000 tours** (recommandation OWASP), **sel aléatoire** 16 octets + `PEPPER`, nouveau format `p1$` | forte (×600 000 plus lent à attaquer) | ≈ 75 ms / connexion mesurés ici (Node) ; sur Supabase probablement 150-250 ms → **à mesurer en préprod** (limite 2 s de calcul / requête) | **progressive** : chaque compte passe en `p1` à sa prochaine connexion réussie ; ceux qui ne se reconnectent pas restent en `s2` | bien, mais les comptes dormants restent faibles |
| C | **B + « enveloppe » immédiate** : on applique PBKDF2 **au hash `s2` existant** (`w1$ = PBKDF2(s2)`), pour **tous les comptes d'un coup**, sans connaître les mots de passe ; à la connexion, le serveur recalcule `s2` puis l'enveloppe | forte **pour tous les comptes dès la migration** | idem B | une opération sur la base (serveur, pas de mot de passe nécessaire) ; personne n'est déconnecté, rien à refaire côté utilisateur | **recommandée** |
| D | Argon2id / bcrypt (bibliothèque externe) | la meilleure en théorie (Argon2id résiste aussi aux cartes graphiques) | dépendance + WebAssembly + mémoire sur la fonction Edge, temps de démarrage | comme C | pas maintenant : PBKDF2 est intégré à WebCrypto (Deno), sans dépendance |

## 4. Recommandation : option C

- **Format** : `w1$<tours>$<sel base64>$<hash base64>` où hash = PBKDF2-SHA256(clé = `s2` actuel, sel aléatoire, 600 000 tours). Le nombre de tours est **stocké** → on pourra l'augmenter plus tard sans casser les anciens.
- **Vérification** : `w1$` → recalcul de `s2` puis PBKDF2, comparaison **en temps constant** ; `s2$` encore accepté (comptes non migrés / retour arrière) et converti en `w1` à la connexion ; ancien SHA-256 nu inchangé (0 compte).
- **Écriture** (inscription, changement / réinitialisation de mot de passe, création de comptes démo) : directement en `w1`.
- **Migration des comptes existants** : script serveur qui enveloppe chaque `s2` en `w1` (53 comptes), rejouable, préprod d'abord.
- **Point d'attention vérifié dans le code** : la création d'une **équipe de démo** hache 14 comptes d'un coup (`hashSalted` dans une boucle) → 14 × 150-250 ms risque de dépasser la limite de calcul. À traiter : comptes démo en `s2` (mot de passe de démo public, aucun enjeu), ou hachage du mot de passe démo **une seule fois** puis réutilisé (sel unique pour la démo).
- **Inchangé** : `PEPPER` (le changer invaliderait tous les mots de passe et toutes les sessions), auth maison, jetons de session, limite d'essais.
- **Retour arrière** : garder les `s2` d'origine dans une colonne temporaire `password_hash_s2` le temps de l'observation (sinon impossible de revenir à l'ancien serveur, qui ne lit pas `w1`), puis la supprimer.

## 5. Tests prévus (avant toute prod)

Connexion OK / KO pour chaque format (`s2`, `w1`, ancien nu) ; conversion à la connexion ; inscription / changement / réinitialisation en `w1` ; enveloppe des comptes existants puis connexion de chacun en préprod (John, Lucas, jim) ; comparaison en temps constant ; **temps mesuré sur la vraie fonction Supabase de préprod** (connexion, équipe de démo) ; ancien serveur + base en `w1` = refus (d'où la colonne de retour arrière) ; aucune régression sur `login` / sessions / limite d'essais.

## 6. Décision attendue du porteur

1. Option (**C recommandée**, B, A, D) ;
2. si C : accord pour la colonne temporaire de retour arrière ;
3. optionnel : passer le minimum de 6 à **8 caractères** pour les **nouveaux** mots de passe (n'impacte pas les comptes existants).
