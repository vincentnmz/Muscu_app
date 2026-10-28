/* Seuils de niveau validés le 28/10/2026 : débutant 0-3 · intermédiaire 4-7 ·
 * avancé 8-10 · expert 11+. Même fonction côté backend (index.ts) et front (app.js). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const ROOT = path.join(__dirname, '..');
const grab = (src, name) => { const i = src.indexOf('function ' + name + '('); return src.slice(i, src.indexOf('\n}', i) + 2); };
const back = stripTypeScriptTypes(grab(fs.readFileSync(path.join(ROOT, 'supabase/functions/handler/index.ts'), 'utf8'), 'getNiveauExperience'));
const front = grab(fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8'), 'getNiveauExperience');
let ok = 0, ko = 0;
const ATT = { 0: 'debutant', 3: 'debutant', 4: 'intermediaire', 7: 'intermediaire', 8: 'avance', 10: 'avance', 11: 'expert', 20: 'expert' };
for (const [nom, code] of [['backend', back], ['front', front]]) {
  const sb = {}; vm.createContext(sb); vm.runInContext(code + ';this.f=getNiveauExperience;', sb);
  for (const [a, n] of Object.entries(ATT)) { if (sb.f(Number(a)) === n) ok++; else { ko++; console.error('  ✗ ' + nom + ' ' + a + ' ans → ' + sb.f(Number(a)) + ' (attendu ' + n + ')'); } }
}
console.log('-'.repeat(70));
console.log('niveau expérience : ' + ok + ' OK / ' + ko + ' KO');
if (ko) process.exit(1);
