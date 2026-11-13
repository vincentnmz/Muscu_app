/* PAUSE (mode vacances) — retour client 13/11/2026.
 * Avant : une pause programmée pour plus tard n'était pas renvoyée par le serveur (l'écran la vidait), deux lignes
 * du même jour sortaient dans un ordre aléatoire, une pause « fin seule » était enregistrée comme une annulation,
 * le front affichait « activé » même en cas d'échec, la fiche coach et les agendas n'affichaient rien. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const TS = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8');
const APP = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function extract(SRC, name) {
  const m = SRC.match(new RegExp('function\\s+' + name + '\\s*\\(')); if (!m) throw new Error('fn introuvable : ' + name);
  // le « { » du corps termine la ligne de signature (le type de retour TS peut contenir des accolades).
  const eol = SRC.indexOf('\n', m.index), i = SRC[eol - 1] === '{' ? eol - 1 : SRC.indexOf('{', m.index); let d = 0, j = i;
  for (; j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return SRC.slice(m.index, j);
}
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };

// ── Backend : pausePrevue ──
const B = {}; vm.createContext(B);
vm.runInContext(stripTypeScriptTypes(['fmtYMD', 'parseFR', 'normDate', 'pausePrevue'].map(n => extract(TS, n)).join('\n')) + '\nthis.pp = pausePrevue;', B);
const NOW = new Date('2026-11-13T10:00:00Z');
let r = B.pp({ valeur: '2026-11-20', unite: '2026-11-27' }, NOW);
eq(r && r.debut === '2026-11-20' && r.fin === '2026-11-27' && r.active === false, 'pause future renvoyée (non active)', r);
r = B.pp({ valeur: '2026-11-10', unite: '2026-11-20' }, NOW);
eq(r && r.active === true, 'pause en cours : active', r);
eq(B.pp({ valeur: '2026-11-01', unite: '2026-11-05' }, NOW) === null, 'pause terminée : rien');
eq(B.pp({ valeur: 'fin', unite: '' }, NOW) === null, 'annulation (valeur « fin ») : rien');
eq(B.pp(null, NOW) === null, 'aucune ligne : rien');
r = B.pp({ valeur: '2026-11-13', unite: '' }, NOW);
eq(r && r.active === true && r.fin === null, 'pause commencée aujourd\'hui sans fin : active, fin null', r);
eq(/pause_prevue: pausePrevue\(pauseRow, now\)/.test(TS), 'getAppData renvoie pause_prevue');
eq(/eq\('cle', 'pause'\)\.order\('date', \{ ascending: false \}\)\.order\('id', \{ ascending: false \}\)\.limit\(1\)/.test(TS), 'getAppData : dernière ligne du jour (tri date puis id)');

// ── Front ──
const F = { document: null, dernierAppData: null }; vm.createContext(F);
vm.runInContext(['_dateISOtoLocal', 'estEnPause', '_jourEnPause', '_pauseAffichee', '_pauseFmt'].map(n => extract(APP, n)).join('\n') +
  '\nthis.jep = _jourEnPause; this.pa = _pauseAffichee; this.pf = _pauseFmt;', F);
eq(F.pa({ pause: null, pause_prevue: { debut: '2026-11-20' } }).debut === '2026-11-20', 'écran Réglages : pause à venir affichée');
eq(F.pa({ pause: { debut: 'a' }, pause_prevue: { debut: 'b' } }).debut === 'a', 'pause en cours prioritaire');
eq(F.pa(null) === null, 'sans données : rien');
eq(F.pf('2026-11-20') === '20/11/2026', 'format date FR');
const P = { debut: '2026-11-20', fin: '2026-11-27' };
eq(F.jep(P, 2026, 10, 20) && F.jep(P, 2026, 10, 27) && F.jep(P, 2026, 10, 23), 'agenda : jours de la pause colorés (bornes incluses)');
eq(!F.jep(P, 2026, 10, 19) && !F.jep(P, 2026, 10, 28), 'agenda : jours hors pause non colorés');
eq(F.jep({ debut: '2026-11-20', fin: null }, 2026, 11, 31), 'agenda : pause sans fin colorée jusqu\'au bout');
eq(!F.jep(null, 2026, 10, 20), 'agenda : sans pause, rien');

const enr = extract(APP, 'enregistrerPause'), ann = extract(APP, 'annulerPause');
eq(/if \(!debut\) \{ const t = new Date\(\); debut =/.test(enr), 'fin seule : début = aujourd\'hui (plus enregistrée comme annulation)');
eq(/j\.ok !== true\) \{ showToast\('Pause non enregistrée/.test(enr), 'échec serveur affiché (plus de faux « activé »)');
eq(/j\.ok !== true\) \{ showToast\('Annulation non enregistrée/.test(ann), 'échec d\'annulation affiché');
eq(/renderCarteContexte\(data\.contexte, coachAthleteCourant[^;]*'cd-contexte', 'muscu', data\.pause\)/.test(APP), 'fiche coach : pause transmise à la carte contexte');
eq(/_jourEnPause\(_pauseAffichee\(typeof coachAthleteData/.test(APP) && /_jourEnPause\(_pauseAffichee\(typeof dernierAppData/.test(APP), 'agendas coach et athlète colorent la pause');
eq((HTML.match(/>Vacances<\/span>/g) || []).length === 2, 'légende « Vacances » dans les 2 agendas');

console.log(`pause-vacances : ${ok} OK / ${ko} KO`);
process.exit(ko ? 1 : 0);
