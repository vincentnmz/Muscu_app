# Audit CSS inline & inventaire des composants — préparation refonte visuelle

> But : préparer un **restylage complet piloté par la marque**. Aujourd'hui le style
> vit majoritairement **en dur dans le HTML généré par `js/app.js`**, ce qui rend une
> refonte ingérable. Ce doc chiffre le problème, inventorie les composants récurrents,
> et propose un plan de migration pour que « restyler » = **éditer des tokens + des classes**.

## 1. État des lieux chiffré

| Mesure | app.js | index.html |
|---|---:|---:|
| Lignes | 9 762 | 1 353 |
| Attributs `style="…"` inline | **1 183** | **429** |

Propriétés CSS écrites en dur dans `app.js` (occurrences) :

| Propriété | Occ. | | Propriété | Occ. |
|---|---:|---|---|---:|
| `color` | 677 | | `padding` | 328 |
| `font-size` | 629 | | `background` | 291 |
| `border-radius` | 239 | | `width` | 175 |
| `height` | 138 | | `border` | 91 |

Couleurs : **428 hex en dur** (`#rrggbb`) cohabitent avec 991 `var(--…)`. Objectif refonte : **0 hex en dur**, tout en tokens.

## 2. Le problème central : un même composant, N tailles

La grille de `tokens.css` définit **6 tailles typo** (14/16/20/24/30/36). En réalité `app.js`
utilise **28 tailles différentes**, de 5px à 34px :

```
118× 11px   108× 13px   91× 10px   72× 9px   67× 12px   32× 14px   31× 15px
15× 18px    11× 16px    11× 12.5px 11× 11.5px 9× 17px   … jusqu'à 5px et 34px
```

Idem pour les rayons : `tokens.css` en définit 4, `app.js` en utilise **15** (de 2px à 20px).

**Cause racine** : le même mini-composant est **redéfini inline dans chaque vue**, avec des
valeurs légèrement différentes à chaque fois. Exemple, la « tuile de stat » (un nombre + un
label) existe en au moins **5 versions inline** + 3 classes :

| Défini à | Nom | Taille nombre | Taille label |
|---|---|---:|---:|
| `app.js:1326` | `kpi` (vue équipe) | 20px | 10px |
| `app.js:1591` | `gpsTile` (GPS foot) | 19px | 10px |
| `app.js:1946` | `kpi` (charge joueur) | 22px | 10px |
| `app.js:2352` | `heroPill` (hero coach) | 17px | 8.5px |
| `app.js:5922` | `chip` (poids) | 15px | 8px |
| classe `.dash-stat` | (accueil) | 18px | 9.5px |
| classe `.v2-kpi` | (dashboard) | 20px | 10px |
| classe `.v2-pstat` | (progression) | 22px | 10.5px |

→ **~8 variantes du même objet visuel.** C'est précisément ce que tu vois comme
« plusieurs tailles différentes » entre les vues.

## 3. Inventaire des composants à unifier

Composants récurrents à extraire en **classes uniques** (avec variantes de taille/couleur) :

| Composant | Où / preuve | Cible |
|---|---|---|
| **Tuile stat / KPI** (nombre + label) | 5 helpers inline + `.dash-stat`, `.v2-kpi`, `.v2-pstat` | `.stat` + `.stat--lg/sm` |
| **Carte** | `.card` (41×) mais **19 cartes inline** (surface+border+radius hors classe) | tout en `.card` |
| **Chip / pill** (type, tag, badge) | `border-radius:20px` **49×**, tailles 10–12px variables | `.chip` + variantes couleur |
| **Label de section** (uppercase, muted) | `text-transform:uppercase` **55×** inline + `.card-title`, `.dash-label`, `.saisie-lbl` | `.label` |
| **Bouton** | `.btn` (34×) + nombreux boutons inline (sheets, overlays) | variantes `.btn-*` complètes |
| **Champ / input** | `numField` inline, `.saisie-chip` | `.field`, `.input` |
| **Bottom-sheet / modale de confirmation** | reconstruite inline à chaque fois (suppr. cardio, fin de séance, etc.) | `.sheet` |

## 4. Plan de migration (par ordre de rentabilité)

**Phase 0 — Figer la charte dans `tokens.css`.**
Palette complète (sémantiques comprises), échelle typo **réduite et respectée**, rayons,
ombres, espacements. C'est « le visuel propre à la marque ». Rien d'autre ne commence avant.

**Phase 1 — Bâtir `components.css` (la bibliothèque).**
Écrire les classes uniques : `.stat`, `.chip`, `.label`, `.card`, `.btn-*`, `.field`, `.sheet`.
Chaque classe lit **uniquement des tokens** (0 valeur en dur).

**Phase 2 — Un seul helper JS par composant.**
Remplacer les 5 fabriques inline (`kpi`, `gpsTile`, `heroPill`, `chip`…) par **un** helper
commun qui génère la classe. Gain immédiat et massif : une taille, partout.

**Phase 3 — Migrer écran par écran**, du plus visible au moins visible :
1. Accueil athlète (muscu)
2. Vue joueur foot
3. Espace coach
À chaque écran : remplacer les `style="…"` par des classes, supprimer les hex en dur.

**Phase 4 — Garde-fou.**
Une fois un écran migré, il ne doit plus contenir de `font-size`/`color`/`border-radius`
en dur. Vérifiable par un simple `grep` (compteur qui doit tomber à ~0 par écran).

## 5. Ordre de grandeur de l'effort

Le gros du volume (les ~1 600 styles inline) se concentre sur une poignée de composants
répétés. **Phases 0–2 = ~80 % du bénéfice** (charte + bibliothèque + helper unique) pour une
fraction du volume. La phase 3 (migration écran par écran) est mécanique et étalable dans le
temps, sans bloquer l'usage de l'app.
