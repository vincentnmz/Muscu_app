/* Audit coach écran 1 « Aujourd'hui » (03/11/2026) — absence muscu + cardio (A1), libellé d'alerte (A2). */
const fs = require('fs'), path = require('path'), vm = require('vm');
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const pick = (n) => { const i = src.indexOf('function ' + n + '('); if (i < 0) throw new Error('absent : ' + n); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } };
const NOW = new Date(2026, 10, 3, 10, 0).getTime();
class FD extends Date { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } }
const sb = { Date: FD, Math, String, Number, Array, JSON, Object, alerteEstTraitee: () => false, escapeHtml: (x) => String(x) };
vm.createContext(sb);
vm.runInContext(['parseChatDate', '_coachIsoTs', '_coachAbsence', 'alertesActives', 'labelAlerteCourt', '_coachAlerteTxt'].map(pick).join('\n'), sb);
// A1 — Alizé : muscu le 07/10, cardio le 25/10 → 27 j sans muscu, activité il y a 9 j (orange, pas rouge).
const ali = sb._coachAbsence({ moteur: { derniere_activite: '2026-10-25' } }, { derniere: { date: '07/10/2026' } });
eq(Math.floor(ali.muscuAge) === 27 && Math.floor(ali.actAge) === 9 && ali.autreRecente && ali.actAge <= 14, 'A1 : 27 j sans muscu · cardio il y a 9 j', ali);
// John : rien depuis le 17/09 → 47 j, rouge.
const jo = sb._coachAbsence({ moteur: { derniere_activite: '2026-09-17' } }, { derniere: { date: '17/09/2026' } });
eq(Math.floor(jo.actAge) === 47 && !jo.autreRecente && jo.actAge > 14, 'A1 : 47 j sans séance → rouge', jo);
// Serveur pas encore redéployé (pas de moteur) → repli sur la dernière séance muscu.
const old = sb._coachAbsence({}, { derniere: { date: '30/10/2026' } });
eq(Math.floor(old.actAge) === 4 && old.connue, 'A1 : sans moteur → dernière séance muscu', old);
eq(!sb._coachAbsence({}, null).connue, 'A1 : aucune séance → inconnue');
// A2 — titre du moteur + date au lieu du type brut.
const a = { athlete_id: '1', alertes: [{ type: 'douleur', severite: 'basse', message: 'Gêne légère signalée' }] };
eq(sb._coachAlerteTxt(a, { alertes_centre: [{ type: 'douleur', title: 'Gêne légère signalée', id: 'douleur|2026-11-02' }] }) === 'Gêne légère signalée · 02/11', 'A2 : « Gêne légère signalée · 02/11 »');
eq(sb._coachAlerteTxt(a, {}) === 'Douleur', 'A2 : repli = type avec majuscule', sb._coachAlerteTxt(a, {}));
console.log('-'.repeat(70)); console.log('coach-accueil : ' + ok + ' OK / ' + ko + ' KO'); if (ko) process.exitCode = 1;
