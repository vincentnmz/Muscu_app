# Animations Novalyz — inspiration & plan (à faire plus tard)

> Note de travail pour la **future session animations**. Rien n'est encore
> implémenté. Source d'inspiration : article Justinmind « Meilleurs exemples
> d'animations web » (résumé + traduction en applications concrètes Novalyz).
>
> **Principe directeur** (repris de l'article) : une animation doit **servir un
> but** (guider, rassurer, donner un retour), pas décorer pour décorer. Style
> visé pour Novalyz = **sobre et premium (type Stripe)**, pas « site vitrine
> spectaculaire » — l'athlète ne doit jamais être distrait de ses données.

## Règles techniques à respecter (pour tout ce qui suit)

- **Aucune dépendance** : tout se fait en CSS pur, SVG, ou JS natif
  (`IntersectionObserver`, `requestAnimationFrame`). Pas de librairie
  (GSAP, Framer…) → on n'alourdit pas la PWA.
- **`prefers-reduced-motion`** : toujours prévoir la version « sans animation »
  pour les utilisateurs qui l'ont désactivé (accessibilité + confort).
- **Perf mobile** : n'animer que `transform` et `opacity` (pas `top`, `width`,
  `height`, `margin` → ça fait ramer). GPU-friendly.
- **Multisport** : l'app connaît déjà le sport de l'athlète → les animations
  « par sport » (ballon, etc.) se branchent dessus, le noyau reste neutre.
- **Discrétion** : 2-3 effets bien placés > 10 effets partout. On teste sur
  `dev` avant `main`.

## Les 6 familles d'animation (article) → application Novalyz

### 1. Micro-interactions (retour au clic / bascule)
*Article : bouton liste↔grille, boutons de navigation avec effet de glissement.*

Pour Novalyz :
- **Validation d'une série** : petit ✓ animé + léger rebond quand on valide.
- **Bascule liste/grille** sur les listes (exercices, séances) si on l'ajoute.
- **Onglet actif** : l'indicateur (soulignement/pastille) qui **glisse** vers
  l'onglet cliqué au lieu de sauter.
- **Bouton pressé** : effet d'enfoncement / ondulation au tap.
- Technique : **CSS** (`transition`, `:active`, keyframes courtes).

### 2. Animations de chargement (rassurer pendant l'attente)
*Article : barre de progression formulaire multi-étapes, spinner sur bouton
d'envoi, indicateur de recherche.*

Pour Novalyz :
- **Spinner sur bouton** pendant login / sauvegarde de séance / sync montre
  (« quelque chose se passe »).
- **Barre de progression** dans le **formulaire bien-être** (multi-étapes) :
  « étape 2/4 » qui se remplit.
- **Écran de chargement au lancement** : logo Novalyz animé + (idée user)
  **ballon du sport qui rebondit** pendant le chargement des données.
- Technique : **CSS** pour spinner/barre ; **SVG** pour le logo animé.

### 3. Transitions entre pages / vues (flux fluide)
*Article : passage d'écran fluide, fondu + glissement (ex. MakeReign).*

Pour Novalyz :
- **Changement d'onglet** (Progression / Conseils / Cardio…) : léger
  fondu-glissé au lieu d'un remplacement brut.
- **Ouverture d'une fiche** (athlète, séance) : la carte qui s'agrandit vers
  la vue détail (« hero transition »).
- Technique : **CSS** (`transition` opacity+transform) ; JS pour orchestrer
  l'ordre (sortie → entrée).

### 4. Animations au défilement (scroll reveal / parallaxe)
*Article : révélation progressive au scroll (Stripe/Apple), parallaxe en
couches (Dropbox, BGSPROD).*

Pour Novalyz (le plus « premium ») :
- **Reveal au scroll** : les cartes du cockpit / blocs d'analyse **apparaissent
  en fondu + montent légèrement** quand elles entrent à l'écran
  (`IntersectionObserver`). C'est LE gros effet « pro ».
- **Barres de stats qui se remplissent** quand le bloc devient visible
  (tonnage, ACWR, jauges bien-être).
- **Parallaxe très légère** en fond (dégradé/illustration sport) — à doser,
  risque « gadget » si trop fort.
- Technique : **JS** (`IntersectionObserver` déclenche une classe CSS).

### 5. Survol / focus (desktop surtout)
*Article : bouton qui s'illumine, cartes qui se soulèvent au survol (Abron).*

Pour Novalyz (surtout sur la version **ordi/PWA**, le survol n'existe pas au
doigt) :
- **Cartes qui se soulèvent** (ombre + `translateY`) au survol.
- **Boutons** qui s'illuminent / changent au survol.
- Technique : **CSS** (`:hover`, `:focus-visible`). Prévoir un équivalent tap
  sur mobile.

### 6. Illustrations & icônes animées (personnalité)
*Article : illustrations 3D, logos/icônes animés.*

Pour Novalyz :
- **Logo Novalyz animé** à la connexion (tracé qui se dessine, ou pulsation).
- **Icône par sport animée** (idée user) : ballon foot/basket qui rebondit,
  balle de tennis, palet de hockey qui glisse — au chargement et/ou en
  filigrane décoratif discret.
- **Compteurs animés** (idée user) : les chiffres clés (tonnage, nb séances,
  streak, KPIs) qui **comptent de 0 jusqu'à la valeur**. ~30 lignes de JS
  réutilisables (`requestAnimationFrame`), à déclencher au scroll-reveal.
- Technique : **SVG animé** (logo/ballons) + **JS** (compteurs).

## CSS vs JS (rappel de l'article)

- **CSS/SVG** = mouvements simples, rapides, déclenchés par état (`:hover`,
  `:active`, classe ajoutée). → spinners, transitions, hover, barres.
- **JS** = animations qui **réagissent à l'action** (scroll, clic complexe,
  valeur qui compte). → scroll-reveal (`IntersectionObserver`), compteurs,
  orchestration de transitions.

## Priorisation proposée (quand on s'y mettra)

**Salve 1 — « premium sobre », impact max / risque min :**
1. Compteurs animés sur les KPIs (JS).
2. Scroll-reveal des cartes (fondu + montée) (JS + CSS).
3. Onglet actif qui glisse + feedback au tap sur les boutons (CSS).
4. Spinner sur les boutons d'envoi (login / save) (CSS).

**Salve 2 — identité / fun :**
5. Écran de lancement : logo animé + ballon du sport qui rebondit (SVG).
6. Barre de progression du formulaire bien-être (CSS).
7. Transitions de vues / ouverture de fiches (CSS+JS).

**Salve 3 — desktop & finitions :**
8. Hover cartes/boutons (PWA ordi) (CSS).
9. Parallaxe de fond très légère (JS), si on la juge pertinente.

## Références citées dans l'article (pour ré-inspiration)

- **Stripe** — scroll reveal sobre décomposant l'info (le modèle pour Novalyz).
- **Apple** — révélation des features au scroll (élégant mais lourd).
- **Dropbox / BGSPROD** — parallaxe en couches.
- **Stryve** — animations qui guident la navigation.
- Dribbble : hover boutons, cartes qui se soulèvent, illustrations 3D animées.
