/* « TA NORMALE » — UNE SEULE RÈGLE (audit moteur 13/11, P0-3).
 * L'écran (js/app.js _beNormale) comparait dès 1 saisie récente ; le moteur (index.ts ressentiConcordant, règle
 * charge + ressenti) exige 3 saisies récentes (≤ 7 j) et ≥ 7 saisies de base (≤ 35 j). Ici : même verdict des deux côtés. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const TS = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8');
const APP = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
function extract(SRC, name) {
  const m = SRC.match(new RegExp('function\\s+' + name + '\\s*\\(')); if (!m) throw new Error('fn introuvable : ' + name);
  const eol = SRC.indexOf('\n', m.index), i = SRC[eol - 1] === '{' ? eol - 1 : SRC.indexOf('{', m.index); let d = 0, j = i;
  for (; j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return SRC.slice(m.index, j);
}
const B = {}; vm.createContext(B);
vm.runInContext(stripTypeScriptTypes(['fmtYMD', 'minus', 'parseFR', 'normDate', 'ressentiConcordant'].map((n) => extract(TS, n)).join('\n')) + '\nthis.rc = ressentiConcordant;', B);
const F = {}; vm.createContext(F);
vm.runInContext(['_dYmd', '_fmt1', '_beNormale', '_beNormaleTxt'].map((n) => extract(APP, n)).join('\n') + '\nthis.bn = _beNormale; this.txt = _beNormaleTxt;', F);

let ok = 0, ko = 0;
const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };
const NOW = new Date(2026, 10, 13, 12);
const iso = (n) => { const d = new Date(NOW.getTime() - n * 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
// Base : 10 saisies fatigue 2 (jours 8 à 26) ; récentes : `nRec` saisies fatigue 4 (jours 0, 1, 2…).
const jeu = (nRec) => { const r = []; for (let i = 0; i < nRec; i++) r.push({ date: iso(i), fatigue_musculaire: 4, fatigue: 4, sommeil: 4 }); for (let i = 8; i < 28; i += 2) r.push({ date: iso(i), fatigue_musculaire: 2, fatigue: 2, sommeil: 4 }); return r; };
for (const nRec of [1, 2, 3]) {
  const rows = jeu(nRec);
  const srv = B.rc(rows, [], NOW, [], true).raisons.includes('fatigue');
  const fa = F.bn({ bien_etre: rows }, NOW.getTime()).find((x) => x.key === 'fatigue');
  const ecran = fa && fa.etat === 'haut';
  eq(ecran === srv, nRec + ' saisie(s) récente(s) : écran = moteur (fatigue au-dessus de la normale : ' + srv + ')', { ecran, srv, etat: fa && fa.etat });
  if (nRec < 3) {
    eq(fa.etat === 'nd' && fa.ndRaison === 'recentes', nRec + ' saisie(s) : pas de comparaison (pas d\'orange)', fa);
    eq(/comparaison à ta normale dès 3 saisies sur 7 jours/.test(F.txt(fa, 'ta')) && !/E07800/.test(F.txt(fa, 'ta')), nRec + ' saisie(s) : texte « dès 3 saisies », sans orange', F.txt(fa, 'ta'));
  }
}
eq(F.bn({ bien_etre: jeu(3) }, NOW.getTime()).find((x) => x.key === 'fatigue').etat === 'haut', '3 saisies récentes à +2 → au-dessus de la normale (écran)');
eq(/sa normale/.test(F.txt(F.bn({ bien_etre: jeu(1) }, NOW.getTime()).find((x) => x.key === 'fatigue'), 'sa')), 'vue coach : « sa normale »');

console.log(`normale-regle-unique : ${ok} OK / ${ko} KO`);
process.exit(ko ? 1 : 0);
