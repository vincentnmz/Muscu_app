/* Novalyz — lanceur des suites de tests.
 *
 * Les tests sont de simples scripts node (pas node:test) : chacun sort en code 0
 * s'il passe, ≠0 s'il échoue. On les exécute tous et on agrège le résultat.
 * Aucun framework, aucune dépendance : cohérent avec le reste du projet.
 */
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const files = [
  ...readdirSync(join(ROOT, 'tests')).filter(f => f.endsWith('.test.js')).map(f => join('tests', f)),
  ...readdirSync(ROOT).filter(f => f.endsWith('.test.js')),
];

let pass = 0, fail = 0;
const failed = [];
for (const rel of files) {
  const r = spawnSync('node', [rel], { cwd: ROOT, encoding: 'utf8' });
  if (r.status === 0) { pass++; }
  else { fail++; failed.push(rel); process.stdout.write(`✗ ${rel}\n${(r.stdout || '') + (r.stderr || '')}\n`); }
}

console.log(`\n${pass} OK / ${fail} KO (${files.length} suites)`);
if (fail) { console.log('Échecs:\n  ' + failed.join('\n  ')); process.exit(1); }
