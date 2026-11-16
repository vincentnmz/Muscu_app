/* Parcours navigateur (16/11, audit P2 « test de bout en bout ») : la VRAIE app dans Chromium + le VRAI serveur
 * (index.ts, sessions exigées) sur une base en mémoire. Connexion → état du jour → 3 séries saisies à l'écran →
 * enregistrement → rechargement → Analyses. Échoue sur toute erreur JavaScript ou tout appel refusé par le serveur.
 * Sans Playwright (machine sans navigateur) : signalé « ignoré » ; tourne toujours en CI (tests.yml installe Playwright).
 * Captures d'écran de chaque étape : node scripts/parcours-navigateur/run.mjs --captures (→ /tmp/parcours-*.png). */
const { spawnSync } = require('child_process'), path = require('path');
const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'parcours-navigateur', 'run.mjs')], { encoding: 'utf8', timeout: 300000 });
process.stdout.write((r.stdout || '').split('\n').filter((l) => !/Experimental|trace-warnings/.test(l)).join('\n'));
process.stderr.write((r.stderr || '').split('\n').filter((l) => !/Experimental|trace-warnings/.test(l)).join('\n'));
process.exit(r.status === 0 ? 0 : 1);
