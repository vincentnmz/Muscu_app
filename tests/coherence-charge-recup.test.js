/* Cohérence charge ↔ récupération (14/11/2026, audit A-D validé porteur).
 * 1) Le contrôle inter-écrans du banc (scripts/banc-profils/coherence.js) attrape bien chaque contradiction connue.
 * 2) A : la synthèse Croisé du serveur applique la MÊME règle que la reco du moteur (« tu encaisses bien » seulement si
 *    la charge monte ET que le ressenti est évalué sans être dégradé). Vrai code d'index.ts. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const { verifier } = require('../scripts/banc-profils/coherence.js');
let ok = 0, ko = 0;
const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (obtenu ' + JSON.stringify(g) + ')' : '')); } };

// ── 1) Contrôle inter-écrans ──
const pret = { disponibilite: { niveau: 'Prêt' }, alertes: [], surcharge: 'Faible', acwr_fiable: true, charge_ressenti: { evaluable: true, degrade: false } };
const D = (m) => ({ moteur: Object.assign({}, pret, m) });
eq(verifier('Tu as plus chargé que d\'habitude et tu encaisses bien (ressenti stable).', D({})).length === 0, 'R1 : ressenti évalué → « encaisses bien » permis');
eq(verifier('Ta récupération est excellente — tu encaisses bien ta charge actuelle.', D({ charge_ressenti: { evaluable: false } }))[0].startsWith('R1'), 'R1 : non évalué → contradiction');
eq(verifier('Charge globale en hausse, forme tenue → bonne assimilation pour l\'instant.', D({ charge_ressenti: { evaluable: true, degrade: true } }))[0].startsWith('R1'), 'R1 : dégradé → contradiction');
eq(verifier('ACWR\n0,97\nzone optimale', D({})).some((e) => e.startsWith('R2')), 'R2 : zone ACWR (tuile coach) détectée');
eq(verifier('1,49\nACWR', D({ acwr_fiable: false })).some((e) => e.startsWith('R3')), 'R3 : ACWR non fiable affiché (tuile valeur → libellé)');
eq(verifier('ACWR 1,00 · indice secondaire (à interpréter avec prudence)', D({})).length === 0, 'R3 : ACWR fiable, sans zone → permis');
eq(verifier('CHARGE\nHabituelle', D({ surcharge: 'Élevé' })).some((e) => e.startsWith('R4')), 'R4 : « Habituelle » vs moteur Élevé');
eq(verifier('Tu es reposé — bon moment pour pousser.', D({ alertes: [{ type: 'absence' }] }))[0].startsWith('R5'), 'R5 : absence → pas de « pousser »');
eq(verifier('Tu es reposé — bon moment pour pousser.', D({ disponibilite: { niveau: 'Vigilance' } }))[0].startsWith('R5'), 'R5 : vigilance → pas de « pousser »');
eq(verifier('Tu es reposé — bon moment pour pousser.', D({})).length === 0, 'R5 : prêt sans alerte → permis');
eq(verifier('Tu es reposé.', D({ alertes: [{ type: 'absence' }] })).length === 0, 'R5 : « Tu es reposé. » toujours permis');

// ── 2) A : synthèse Croisé du serveur ──
let js = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase/functions/handler/index.ts'), 'utf8'));
js = js.split('\n').filter((l) => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { buildSyntheseCroise };';
const sb = { createClient: () => ({}), webpush: { setVapidDetails() {} }, Deno: { env: { get: () => 'x' }, serve: () => {} }, Response, Request, URL, URLSearchParams, TextEncoder, TextDecoder, crypto, console, setTimeout, clearTimeout, fetch: async () => ({}) };
vm.createContext(sb); vm.runInContext(js, sb);
const { buildSyntheseCroise } = sb.__api;
const now = new Date('2026-11-12T17:00:00Z'), cmp = { j28_vs_j28prec: { tonnage: { j28: 20000 } } };
const txt = (m) => buildSyntheseCroise(cmp, { history: [] }, Object.assign({ recup: 'Excellent', disponibilite: { niveau: 'Prêt' } }, m), now).constats.map((c) => c.texte).join(' | ');
const t1 = txt({ surcharge: 'Élevé', charge_ressenti: { evaluable: false, degrade: false } });
eq(!/encaisses bien/.test(t1) && /renseigne ton état/.test(t1), 'A : charge haute + ressenti non évalué → pas de « encaisses bien »', t1);
const t2 = txt({ surcharge: 'Modéré', charge_ressenti: { evaluable: true, degrade: false } });
eq(/tu encaisses bien pour l'instant/.test(t2), 'A : charge haute + ressenti évalué stable → « encaisses bien »', t2);
const t3 = txt({ surcharge: 'Élevé', charge_ressenti: { evaluable: true, degrade: true } });
eq(!/encaisses bien/.test(t3) && /ressenti baisse/.test(t3), 'A : ressenti dégradé → alerte, pas « encaisses »', t3);
const t4 = txt({ surcharge: 'Faible', charge_ressenti: { evaluable: false } });
eq(!/encaisses/.test(t4) && /récupération est excellente ces 7 derniers jours/.test(t4), 'A : charge habituelle → récup seule, sans lien charge', t4);
console.log('-'.repeat(70));
console.log('cohérence charge ↔ récup : ' + ok + ' OK / ' + ko + ' KO');
if (ko) process.exit(1);
