/* Banc de profils (14/11) : tout le texte d'Aujourd'hui, Analyses ▸ Résumé et Forme pour 8 profils fictifs, comparé aux
 * fichiers relus de tests/banc-profils/. Lance scripts/banc-profils/run.mjs (Chromium via Playwright). Sans Playwright
 * (machine sans navigateur), le banc est signalé « ignoré » ; il tourne toujours en CI (tests.yml installe Playwright).
 * Une phrase change volontairement → relire puis `node scripts/banc-profils/run.mjs --maj <profil>`. */
const { spawnSync } = require('child_process'), path = require('path');
const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'banc-profils', 'run.mjs')], { encoding: 'utf8', timeout: 600000 });
process.stdout.write((r.stdout || '').split('\n').filter((l) => !/Experimental|trace-warnings/.test(l)).join('\n'));
process.stderr.write((r.stderr || '').split('\n').filter((l) => !/Experimental|trace-warnings/.test(l)).join('\n'));
process.exit(r.status === 0 ? 0 : 1);
