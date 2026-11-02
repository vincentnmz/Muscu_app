# Audit — Connexion, inscription, mot de passe oublié (02/11/2026)

Méthode : code (backend `handleLogin`, `handleRegister`, `handleLoginCoach`, `handleRegisterCoach`, `handleChangePassword`, `handleRequestPasswordReset`, `handleResetPassword`, `handleCoachResetAthlete`, sessions signées ; front `seConnecter`, `sInscrire`, `sInscrireCoach`, flux « mot de passe oublié ») + **base réelle** (comptes, e-mails, jetons de réinitialisation ; aucun hash affiché).
Légende : ✅ vérifié · ❌ défaut · 🟠 à décider · 🔍 à vérifier.

## Juste ✅
- Hachage `s2$` (sel = login + PEPPER) : 100 % des comptes athlètes et coachs sont au format actuel (0 ancien format, 0 compte sans mot de passe).
- Identifiants envoyés dans le corps de la requête (pas dans l'URL).
- Lien de réinitialisation : jeton aléatoire de 32 octets, seul son hash est stocké, valable 1 h, usage unique, réponse identique que le compte existe ou non, 3 demandes max par compte et par fenêtre.
- Changer son mot de passe exige l'ancien ; changer / réinitialiser annule les liens de réinitialisation encore actifs.
- Sessions signées (HMAC), valables 30 jours.

## Défauts
| # | Constat | Correctif proposé |
|---|---|---|
| **C1** 🔍 bloquant | **Les e-mails ne partent peut-être qu'à toi** : sans le secret `RESEND_FROM` (domaine vérifié dans Resend), l'expéditeur est le bac à sable `onboarding@resend.dev`, qui ne délivre qu'au propriétaire du compte Resend (roadmap bêta P0-1). Concerne le reset, le récap, l'export… et le futur mail de bienvenue. Je ne peux pas lire les secrets. | À confirmer : as-tu vérifié un domaine dans Resend et posé `RESEND_FROM` ? Sinon : acheter / vérifier un domaine (DNS SPF + DKIM). |
| **C2** 🔍 | Le lien « mot de passe oublié » pointe par défaut vers la **préprod** (`…/Muscu_app/dev/`) si le secret `APP_BASE_URL` n'est pas posé. | Défaut = prod (`…/Muscu_app/`). |
| **C3** ❌ | **Réinitialisation impossible** pour 3 de tes 6 vrais athlètes (**aucun e-mail** : inscrits avant qu'il soit obligatoire). Et **1 adresse e-mail est partagée par 2 comptes** → la recherche attend un seul compte, échoue, **aucun mail n'est envoyé** (message « tu vas recevoir un lien » quand même). La recherche respecte aussi la casse (`Lea@…` ≠ `lea@…`). | Recherche sans casse ; si plusieurs comptes ont la même adresse : un mail avec un lien par login. Bandeau dans l'app pour les comptes sans e-mail : « Ajoute ton e-mail pour pouvoir récupérer ton mot de passe ». |
| **C4** ❌ | **Coach : aucun « mot de passe oublié »** (le flux n'existe que pour les athlètes) ; les 4 comptes coach n'ont **pas d'e-mail** en base. | Même flux pour le coach (lien sur l'écran de connexion coach) ; demande d'e-mail dans les Réglages coach s'il manque. |
| **C5** ❌ sécurité | **Aucune limite de tentatives de connexion**. Le login athlète = 4 chiffres (10 000 possibilités) et l'inscription répond « Login déjà utilisé » → on peut repérer les logins existants puis essayer des mots de passe sans fin. | Après 5 échecs sur un même login en 15 min : connexion bloquée 15 min (message clair). Petite table en base (migration). |
| **C6** ❌ | Le minimum de **6 caractères** n'est contrôlé que par l'app à l'inscription : le serveur accepte un mot de passe d'1 caractère (athlète et coach). | Contrôle serveur à l'inscription (comme au changement / reset). |
| **C7** ❌ | **Espaces** : la connexion retire les espaces autour du mot de passe, mais le changement et la réinitialisation les gardent → un mot de passe choisi avec un espace final ne permet plus de se connecter. | Même traitement partout (espaces retirés aux deux bouts). Les mots de passe existants ne changent pas. |
| **C8** 🟠 | Changer ou réinitialiser son mot de passe **ne déconnecte pas** les autres appareils (session valable 30 j) : un téléphone perdu / volé reste connecté. | (a) Toute session ouverte avant le changement est refusée (1 lecture en base par appel) ; (b) laisser tel quel pour l'instant. |

## Demandes du porteur (02/11)
| # | Demande | Proposition |
|---|---|---|
| **C9** | Mail de confirmation d'inscription avec le login et le mot de passe. | ⚠️ **Pas de mot de passe dans le mail** (accepté par le porteur) : il reste lisible indéfiniment dans la boîte mail, et un mot de passe ne doit pas être transmis en clair par e-mail (recommandation CNIL 2022-100, d'après des résumés secondaires ; texte officiel non lu, site CNIL inaccessible depuis la session). Mail de **bienvenue** : login + rappel « mot de passe oublié ». Athlète et coach. 🟠 (a) bienvenue seul ; (b) + bouton « Confirmer mon adresse » (une adresse mal tapée rend le reset impossible). Maquette : `mockups/mail-bienvenue.html`. |
| **C10** | Nouveau logo dans les mails, fond nid d'abeille aux couleurs Novalyz, fond noir. | En-tête en **une seule image** (`assets/mail-header.png`, 1200×400 affichée en 600×200) : nid d'abeille bleu sur fond bleu nuit, **bloc noir arrondi derrière** le logo blanc + bleu, logotype « NOVALYZ » officiel + « Analyze · Plan · Perform » (depuis les SVG de `assets/logo`). Une image plutôt qu'un fond CSS, que certains logiciels de mail n'affichent pas. Appliqué à **tous** les mails (reset, récap, export, bienvenue). |
| **C11** | Icône Google Play : fond noir, logo blanc et bleu. | `store/play-icon-512.png` : 512×512, PNG, carré plein (Google arrondit lui-même — ne pas envoyer la version aux coins arrondis), généré depuis le SVG (net). 🟠 Aligner aussi l'**icône de l'app sur le téléphone** (lanceur Android) ? |
