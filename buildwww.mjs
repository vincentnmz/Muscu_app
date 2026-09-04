/* Novalyz — assemblage du dossier `www/` pour Capacitor.
 *
 * Novalyz est un site statique servi tel quel (racine du repo) par GitHub Pages.
 * Capacitor a besoin d'un `webDir` ne contenant QUE les fichiers expédiés dans
 * l'app : on recopie la « coquille » web à l'identique dans `www/`, sans toucher
 * au code source ni à la logique métier. La source de vérité reste la racine.
 *
 * Aucune transformation : simple copie. Le même index.html/js/css tourne donc
 * en PWA web ET dans la WebView Capacitor (« un seul cœur, deux enveloppes »).
 */
import { cp, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'www');

// Fichiers/dossiers réellement servis à l'utilisateur (identiques à GitHub Pages).
const ASSETS = [
  'index.html',
  'manifest.json',
  'sw.js',
  'logo novalyz.png',
  'js',
  'css',
];

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  for (const rel of ASSETS) {
    const src = join(ROOT, rel);
    if (!existsSync(src)) {
      console.error(`✗ introuvable: ${rel}`);
      process.exit(1);
    }
    await cp(src, join(OUT, rel), { recursive: true });
    console.log(`✓ ${rel}`);
  }
  console.log(`\nwww/ assemblé (${ASSETS.length} entrées).`);
}

main();
