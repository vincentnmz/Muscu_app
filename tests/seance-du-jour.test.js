/* 04/11/2026 — séance du jour selon les JOURS CONSEILLÉS du programme (retour porteur : « dos jambes »
 * manquée mardi restait proposée mercredi). Jour sans séance prévue → repos ; séance manquée → rattrapage doux. */
const fs = require('fs'), path = require('path'), vm = require('vm');
let ok = 0, ko = 0; const eq = (c, n) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n); } };
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const pick = (n) => { const i = src.indexOf('function ' + n + '('); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } };
const sb = { _PROG_JOURS_LONG: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] };
vm.createContext(sb); vm.runInContext(pick('_seanceDuJour') + ';' + pick('_manqueesTxt') + '; this.SJ = _seanceDuJour; this.MQ = _manqueesTxt;', sb);
const prog = [['pec epaule', 1], ['dos jambes', 2], ['pec epaule 2', 4], ['dos jambe 2', 5]].map(([s, j]) => ({ seance_id: s, jour: j, exercice: 'x' }));
const faite = (s, d) => ({ seance_id: s, date: d });
const T = (iso) => new Date(iso + 'T10:00:00').getTime();
// Semaine du lundi 02/11/2026 : lundi « pec epaule » faite, mardi « dos jambes » pas faite.
const data = { programme: prog, seances_detail: [faite('pec epaule', '2026-11-02')] };
let r = sb.SJ(data, T('2026-11-04'));   // mercredi
eq(r.aujourdhui === null, 'mercredi (jour sans séance) → repos, rien de proposé');
eq(r.suivante === 'pec epaule 2' && r.jourSuivante === 4, 'mercredi → prochaine = pec epaule 2 (jeudi)');
eq(r.manquees.length === 1 && r.manquees[0].sid === 'dos jambes', 'mercredi → dos jambes signalée manquée');
eq(sb.MQ(r.manquees) === 'Dos jambes (prévue mardi) pas faite · à rattraper si tu veux', 'texte de rattrapage doux');
r = sb.SJ(data, T('2026-11-05'));       // jeudi
eq(r.aujourdhui === 'pec epaule 2', 'jeudi → séance prévue jeudi proposée');
r = sb.SJ(data, T('2026-11-03'));       // mardi
eq(r.aujourdhui === 'dos jambes' && !r.manquees.length, 'mardi → dos jambes, rien de manqué');
// Séance faite un autre jour que prévu (séance du programme déplacée) → plus comptée manquée.
r = sb.SJ({ programme: prog, seances_detail: [faite('pec epaule', '2026-11-02'), faite('Dos Jambes ', '2026-11-04')] }, T('2026-11-05'));
eq(!r.manquees.length, 'séance rattrapée un autre jour → plus signalée');
// Séance faite la semaine d'avant → ne compte pas pour cette semaine.
r = sb.SJ({ programme: prog, seances_detail: [faite('dos jambes', '2026-10-27')] }, T('2026-11-03'));
eq(r.aujourdhui === 'dos jambes', 'faite la semaine précédente → reproposée cette semaine');
// Programme sans jours conseillés → null (comportement d'avant : prochaine non faite).
eq(sb.SJ({ programme: prog.map(p => ({ seance_id: p.seance_id })) }, T('2026-11-04')) === null, 'programme sans jours → règle inchangée');
console.log('-'.repeat(70)); console.log('seance-du-jour : ' + ok + ' OK / ' + ko + ' KO'); if (ko) process.exitCode = 1;
