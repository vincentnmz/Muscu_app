/* Audit coach écran 1 « Aujourd'hui » (03/11/2026) — absence muscu + cardio (A1), libellé d'alerte (A2). */
const fs = require('fs'), path = require('path'), vm = require('vm');
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const pick = (n) => { const i = src.indexOf('function ' + n + '('); if (i < 0) throw new Error('absent : ' + n); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } };
const NOW = new Date(2026, 10, 3, 10, 0).getTime();
class FD extends Date { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } }
const sb = { Date: FD, Math, String, Number, Array, JSON, Object, alerteEstTraitee: () => false, escapeHtml: (x) => String(x), synthAlertesActivesCoach: () => [], COACH_PRIO_WARN: '#f59f00', COACH_PRIO_BAD: '#f0505a' };
vm.createContext(sb);
vm.runInContext(['parseChatDate', '_coachIsoTs', '_coachAbsence', 'alertesActives', 'labelAlerteCourt', '_coachDerniereDouleur', '_coachJourTxt', '_coachAlerteTxt', '_coachPrio', '_coachEtatEquipe', '_coachTonTxt'].map(pick).join('\n'), sb);
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
// 05/11 : la date de l'id (« douleur|2026-11-02 ») est le lundi de la semaine de l'alerte → on affiche la date RÉELLE du dernier signalement.
eq(sb._coachAlerteTxt(a, { alertes_centre: [{ type: 'douleur', title: 'Gêne légère signalée', id: 'douleur|2026-11-02' }], bien_etre: [{ date: '30/10/2026', douleur: 2 }, { date: '26/10/2026', douleur: 2 }] }) === 'Gêne légère signalée · 30/10', 'A2 : date réelle de la douleur (pas le lundi de l\'alerte)', sb._coachAlerteTxt(a, { alertes_centre: [{ type: 'douleur', title: 'Gêne légère signalée', id: 'douleur|2026-11-02' }], bien_etre: [{ date: '30/10/2026', douleur: 2 }] }));
eq(sb._coachAlerteTxt(a, { alertes_centre: [{ type: 'douleur', title: 'Gêne légère signalée', id: 'douleur|2026-11-02' }] }) === 'Gêne légère signalée', 'A2 : sans signalement daté → pas de date inventée');
eq(sb._coachAlerteTxt(a, {}) === 'Douleur', 'A2 : repli = type avec majuscule', sb._coachAlerteTxt(a, {}));
// E1/E2 (écran Équipe) — même règle que l'accueil : filtre + étiquette.
const E = (m, al, d) => sb._coachEtatEquipe({ a: { athlete_id: '1', alertes: al || [] }, m, enPause: false }, d || {});
eq(E({ derniere: { date: '07/10/2026' }, statut: { rank: 1 } }, [], { moteur: { derniere_activite: '2026-10-25' } }).court === '27 j sans muscu', 'E2 : Alizé « 27 j sans muscu » (filtre Inactifs)');
eq(E({ derniere: { date: '07/10/2026' }, statut: { rank: 1 } }, [], { moteur: { derniere_activite: '2026-10-25' } }).cat === 'inactifs', 'E1 : absence → Inactifs');
const vin = E({ derniere: { date: '02/11/2026' }, statut: { rank: 0 } }, [{ type: 'douleur', severite: 'basse' }], { alertes_centre: [{ type: 'douleur', title: 'Gêne légère signalée', id: 'douleur|2026-11-02' }] });
eq(vin.cat === 'surveiller' && vin.court === 'Gêne légère', 'E1/E2 : Vincent « Gêne légère » → À surveiller (comme l\'accueil ; plus de date de semaine prise pour la date de la douleur)', vin);
eq(E({ derniere: null, statut: { rank: 1 } }, [], { dashboard: { regularite: { seances_prevues: 0 } }, programme: [] }).court === 'Pas de programme', 'E2 : sans séance ni programme → « Pas de programme »');
eq(E({ derniere: { date: '02/11/2026' }, statut: { rank: 0 } }).court === 'Prêt' && E({ derniere: { date: '02/11/2026' }, statut: { rank: 0 } }).cat === 'prets', 'E2 : rien à signaler → « Prêt »');
eq(sb._coachTonTxt({ j7: 12, evol_pct: -41 }).txt === '12 t · −41 %', 'E4 : « 12 t · −41 % »');
console.log('-'.repeat(70)); console.log('coach-accueil : ' + ok + ' OK / ' + ko + ' KO'); if (ko) process.exitCode = 1;
