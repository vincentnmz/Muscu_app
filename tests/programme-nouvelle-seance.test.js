/* PROGRAMME — création de séance (retour client 13/11/2026).
 * Avant : côté athlète, « Push / Pull / Jambes… » ajoutait une carte vide en bas de page sans rien ouvrir ;
 * côté coach, le bouton remplissait seulement le champ du nom. Après : un clic crée la séance ET ouvre le choix
 * des exercices (athlète : _jgAjouterExos ; coach : _cdNouvelleSeanceOk → cdAjouterExercice). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(__dirname, '..', 'css', 'components.css'), 'utf8');
function extract(name) {
  const m = SRC.match(new RegExp('function\\s+' + name + '\\s*\\(')); if (!m) throw new Error('fn introuvable : ' + name);
  let i = SRC.indexOf('{', m.index), d = 0, j = i;
  for (; j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return SRC.slice(m.index, j);
}
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };
const S = { ouverts: [], rendus: 0 }; vm.createContext(S);
vm.runInContext(extract('_jgAddSeance') + '\nvar _jg = { seances: [], lignes: [], autre: true };\nfunction _jgRender() { rendus++; }\nfunction _jgAjouterExos(n) { ouverts.push(n); }\nthis.add = _jgAddSeance; this.jg = function () { return _jg; };', S);

S.add('Push');
eq(S.jg().seances.join() === 'Push' && S.ouverts.join() === 'Push' && S.jg().autre === false, 'athlète : « Push » crée la séance et ouvre le choix des exercices', { s: S.jg().seances, o: S.ouverts });
S.add('Push');
eq(S.jg().seances.join() === 'Push,Push 2' && S.ouverts[1] === 'Push 2', 'deuxième « Push » : séance « Push 2 », choix ouvert sur « Push 2 »', { s: S.jg().seances, o: S.ouverts });
S.add('   ');
eq(S.jg().seances.length === 2 && S.ouverts.length === 2, 'nom vide : rien créé, rien ouvert');

const coach = SRC.slice(SRC.indexOf('async function cdAjouterSeance'), SRC.indexOf('async function _cdNouvelleSeanceOk'));
eq(/class="jg-chip cta" onclick="document\.getElementById\(\\'cd-ns-in\\'\)\.value=\\'' \+ n \+ '\\';_cdNouvelleSeanceOk\(\)"/.test(coach), 'coach : un clic sur un nom crée la séance et ouvre le choix des exercices');
eq(/_jgAddSeance\(\\'' \+ js\(n\) \+ '\\'\)">\+ ' \+ esc\(n\)/.test(SRC) && /class="jg-chip cta"/.test(SRC), 'athlète : boutons « + Push… » en style action');
eq(/\.jg-chip\.cta \{[^}]*color:var\(--accent\)/.test(CSS), 'CSS : style action défini (.jg-chip.cta)');

console.log(`programme-nouvelle-seance : ${ok} OK / ${ko} KO`);
process.exit(ko ? 1 : 0);
