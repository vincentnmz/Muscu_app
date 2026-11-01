/* =============================================================================
 * Audit Notifications (01/11/2026) :
 *  N1 — un même téléphone reçoit les notifs ATHLÈTE et COACH : la façade renvoie le
 *       token quand le rôle change (VRAI js/notifications.js, plugin simulé) ;
 *  N3 — rythme des rappels d'absence J7, J10, J14, J21, J28 puis stop (VRAIE
 *       fonction _rythmeAbsence d'index.ts).
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');

let ok = 0, ko = 0;
function eq(c, l) { if (c) ok++; else { ko++; console.error('  ✗ ' + l); } }
const tick = () => new Promise((r) => setTimeout(r, 0));

// ── N3 : _rythmeAbsence ──
const SRC = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8');
function extractFn(name) {
  const m = SRC.match(new RegExp('function\\s+' + name + '\\s*\\('));
  let i = SRC.indexOf('{', SRC.indexOf(')', m.index)), d = 0, j = i;
  for (; j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return SRC.slice(m.index, j);
}
const S = {}; vm.createContext(S);
vm.runInContext(stripTypeScriptTypes(['fmtYMD', '_rythmeAbsence'].map(extractFn).join('\n')) + '\nthis.R=_rythmeAbsence;', S);
const D = (n) => new Date(Date.UTC(2026, 9, 1) + n * 864e5);   // J0 = 01/10
const ymd = (n) => D(n).toISOString().slice(0, 10);
// Simulation jour par jour : dernière activité J0, cron chaque jour.
let last = null; const jours = [];
for (let n = 0; n <= 40; n++) { if (S.R(ymd(0), last, D(n))) { jours.push(n); last = ymd(n); } }
eq(JSON.stringify(jours) === '[7,10,14,21,28]', 'rappels d\'absence à J7, J10, J14, J21, J28 puis stop (obtenu ' + JSON.stringify(jours) + ')');
eq(S.R(ymd(0), ymd(7), D(9)) === false, 'J9 après un rappel J7 : pas de rappel');
eq(S.R(ymd(20), ymd(7), D(27)) === true, 'nouvelle activité puis 7 j d\'absence : le rappel repart (ancien rappel ignoré)');
eq(S.R(null, null, D(10)) === false, 'aucune activité connue : pas de rappel');
// Cron manqué un jour : le rappel part le lendemain, sans doublon.
eq(S.R(ymd(0), ymd(7), D(11)) === true && S.R(ymd(0), ymd(11), D(13)) === false && S.R(ymd(0), ymd(11), D(14)) === true, 'jour manqué (J10) : envoyé J11, la suite reste à J14');
eq(S.R(ymd(0), ymd(28), D(29)) === false && S.R(ymd(0), ymd(21), D(35)) === false, 'au-delà de 4 semaines : plus de rappel');

// ── N1 : un téléphone, deux rôles ──
const PLATFORM = fs.readFileSync(path.join(__dirname, '..', 'js', 'platform.js'), 'utf8');
const NOTIFS = fs.readFileSync(path.join(__dirname, '..', 'js', 'notifications.js'), 'utf8');
function ctx() { const s = {}; s.globalThis = s; s.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' }; vm.createContext(s); vm.runInContext(PLATFORM, s); vm.runInContext(NOTIFS, s); return s; }
function mockPush() { const L = {}; return { async checkPermissions() { return { receive: 'granted' }; }, async requestPermissions() { return { receive: 'granted' }; }, async register() {}, addListener(e, cb) { (L[e] = L[e] || []).push(cb); return { remove() {} }; }, _emit(e, d) { (L[e] || []).forEach((cb) => cb(d)); } }; }
function mockFetch() { const b = []; const f = async (u, i) => { b.push(JSON.parse(i.body)); return { ok: true, json: async () => ({}) }; }; f.bodies = b; return f; }
(async () => {
  const s = ctx(), P = mockPush(), f = mockFetch();
  await s.NovalyzNotifications.activer({ plugin: P, fetchImpl: f, athleteId: '1', scriptUrl: 'x' });
  P._emit('registration', { value: 'TOK' }); await tick();
  await s.NovalyzNotifications.activer({ plugin: P, fetchImpl: f, athleteId: 'coach:1', scriptUrl: 'x' });
  await tick();
  P._emit('registration', { value: 'TOK' }); await tick();   // le plugin refire avec le même token
  const ids = f.bodies.filter((b) => b.action === 'saveNativePushToken').map((b) => b.athlete_id);
  eq(ids.length === 2 && ids[0] === '1' && ids[1] === 'coach:1', 'même token envoyé pour l\'athlète PUIS pour le coach, sans doublon (obtenu ' + JSON.stringify(ids) + ')');
  // Désactiver côté coach ne retire que le rôle coach.
  await s.NovalyzNotifications.desactiver({ fetchImpl: f, athleteId: 'coach:1', scriptUrl: 'x' });
  const del = f.bodies.filter((b) => b.action === 'deleteNativePushToken');
  eq(del.length === 1 && del[0].athlete_id === 'coach:1' && del[0].token === 'TOK', 'désactivation coach : seul le rôle coach est retiré');
  console.log('-'.repeat(70));
  console.log('notif rôles + rythme : ' + ok + ' OK / ' + ko + ' KO');
  if (ko) process.exitCode = 1;
})();
