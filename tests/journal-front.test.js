/* JOURNAL DES DÉCISIONS — côté app (P1-1, 13/11/2026). Le moteur reste unique (_lv3Plan) : l'app FIGE ce qu'il a produit.
 * - _lv3Realise = SEULE règle « fait » (coche du plan ET statut des décisions passées), bornée à la semaine ;
 * - statuts : objectif atteint / pas atteint / pas tenté / non évaluable ;
 * - la charge utile envoyée passe le contrôle de forme du VRAI serveur (index.ts _decisionLigne) ;
 * - envoi seulement : session athlète, en ligne, données complètes, une fois par semaine et par appareil ;
 * - wording : « résultat observé après la recommandation », « association observée, pas une preuve de cause ». */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const ROOT = path.join(__dirname, '..');
const LV3 = fs.readFileSync(path.join(ROOT, 'js', 'lecture-v3.js'), 'utf8');
const APP = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');
const TS = fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'handler', 'index.ts'), 'utf8');
function ex(SRC, n) { const m = SRC.match(new RegExp('function\\s+' + n + '\\s*\\(')); const eol = SRC.indexOf('\n', m.index); let i = SRC[eol - 1] === '{' ? eol - 1 : SRC.indexOf('{', m.index), d = 0, j = i; for (; j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } } return SRC.slice(m.index, j); }
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };

const ENVOIS = [], LS = {};
const S = { console, Date, Math, JSON, String, Number, Object, Array, isFinite, setTimeout,
  localStorage: { getItem: (k) => (k in LS ? LS[k] : null), setItem: (k, v) => { LS[k] = String(v); } }, navigator: { onLine: true },
  SCRIPT_URL: 'https://srv', athlete: { athlete_id: 'A1' }, fetch: (u, o) => { ENVOIS.push({ u, body: o && o.body ? JSON.parse(o.body) : null }); return Promise.resolve({ json: () => Promise.resolve({ success: true }) }); } };
vm.createContext(S);
vm.runInContext(ex(APP, '_normTxt') + '\n' + ex(APP, '_musKey') + '\n' + ex(APP, '_cdFmtKg') + '\nfunction _maE(x){return String(x);}\nfunction ouvrirInfoGenerique(){}\n' + LV3, S);
// Contrôle de forme du serveur (vraie fonction).
const B = {}; vm.createContext(B);
vm.runInContext(stripTypeScriptTypes((TS.match(/const DECISION_TYPES = [^\n]*/)[0]) + '\n' + (TS.match(/const DECISION_CRITERE_BORNES[^\n]*/)[0]) + '\n' + ex(TS, '_decisionLigne')) + '\nthis.f = _decisionLigne;', B);

const lundi = S._lv3Ymd(S._lv3Lundi(Date.now()));
const jour = (base, n) => { const t = new Date(base + 'T12:00:00'); t.setDate(t.getDate() + n); return S._lv3Ymd(t); };
const L1 = jour(lundi, -7), L2 = jour(lundi, -14);   // semaine dernière, celle d'avant
const data = { programme: [], historique: {
  progression_par_exo: {
    'Dev': [{ date: jour(L1, 2), charge: 75, reps: 6, series: [{ charge: 75, reps: 6, rpe: 9 }, { charge: 75, reps: 5, rpe: 9 }] }, { date: jour(L2, 1), charge: 80, reps: 4, series: [{ charge: 80, reps: 4, rpe: 10 }] }],
    'Leg curl': [{ date: jour(L1, 3), charge: 40, reps: 10, series: [{ charge: 40, reps: 10, rpe: 9.5 }] }],
    'Rowing': [{ date: jour(lundi, 0), charge: 62.5, reps: 8, series: [{ charge: 62.5, reps: 8, rpe: 8 }] }],
  },
  daily_muscu: { [jour(L1, 2)]: { spm: { Quadriceps: 4 } }, [jour(L1, 4)]: { spm: { Quadriceps: 2 } }, [jour(lundi, 0)]: { spm: { Quadriceps: 3 } } } } };

// _lv3Realise borné à la semaine
eq(S._lv3Realise({ type: 'series', muscle: 'Quadriceps', min: 8 }, data, L1, lundi).tot === 6, 'séries : 6 la semaine dernière (celles de cette semaine exclues)');
eq(S._lv3Realise({ type: 'series', muscle: 'Quadriceps', min: 8 }, data, lundi, null).tot === 3, 'séries : 3 cette semaine (plan en cours)');
eq(S._lv3Realise({ type: 'cible', exo: 'Rowing', charge: 62.5, reps: 8 }, data, L1, lundi).tente === false, 'Rowing fait cette semaine → pas compté pour la semaine dernière');

// Statuts d'une décision passée
const dec = (o) => Object.assign({ semaine: L1, critere: {} }, o);
let e = S._lv3JournalEvaluer(dec({ type_action: 'charge', exercice: 'Dev', cle: 'Dev', critere: { charge: 75, alt: 70, reps: 6 } }), data);
eq(e.statut === 'atteint' && /75 kg × 6/.test(e.detail), 'charge 75 (ou 70) × 6 → objectif atteint, détail réalisé', e);
e = S._lv3JournalEvaluer(dec({ type_action: 'series', muscle: 'Quadriceps', cle: 'Quadriceps', critere: { min: 8 } }), data);
eq(e.statut === 'pas_atteint' && /6 séries \(objectif 8\)/.test(e.detail), 'séries 6/8 → pas atteint', e);
e = S._lv3JournalEvaluer(dec({ type_action: 'rpe', exercice: 'Leg curl', cle: 'Leg curl', critere: { charge: 40 } }), data);
eq(e.statut === 'pas_atteint', 'RPE 8 visé, fait à 9,5 → pas atteint', e);
e = S._lv3JournalEvaluer(dec({ type_action: 'cible', exercice: 'Élévation latérale', cle: 'Élévation latérale', critere: { charge: 7.5, reps: 11 } }), data);
eq(e.statut === 'pas_tente' && /pas refait/.test(e.detail), 'exercice pas refait → pas tenté', e);
e = S._lv3JournalEvaluer(dec({ type_action: 'cible', exercice: 'Dev', cle: 'Dev', critere: {} }), data);
eq(e.statut === 'non_evaluable', 'critère incomplet → non évaluable', e);
eq(S._lv3JournalEvaluer(dec({ type_action: 'reprise', cle: 'reprise' }), {}).statut === 'non_evaluable', 'sans données de séances → non évaluable');
eq(S._lv3JournalEvaluer(dec({ type_action: 'reprise', cle: 'reprise', critere: { seances: 1 } }), data).statut === 'atteint', 'reprise : séance faite → atteint');

// Semaines passées seulement ; résumé « semaine dernière »
const rows = [dec({ type_action: 'charge', exercice: 'Dev', cle: 'Dev', titre: 'Dev : proposé 75 kg (ou 70 kg)', critere: { charge: 75, alt: 70, reps: 6 } }),
  dec({ type_action: 'series', muscle: 'Quadriceps', cle: 'Quadriceps', titre: 'Quadriceps : 8 séries', critere: { min: 8 } }),
  dec({ type_action: 'cible', exercice: 'Élévation latérale', cle: 'Élévation latérale', titre: 'Élévation', critere: { charge: 7.5, reps: 11 } }),
  { semaine: lundi, type_action: 'cible', exercice: 'Rowing', cle: 'Rowing', titre: 'Rowing (semaine en cours)', critere: { charge: 62.5, reps: 8 } }];
const sem = S._lv3JournalSemaines(rows, data);
eq(sem.length === 1 && sem[0].semaine === L1 && sem[0].lignes.length === 3, 'la semaine en cours n\'est pas dans l\'historique (c\'est le plan affiché)', sem.map((x) => x.semaine));
eq(sem[0].tentes === 2 && sem[0].atteints === 1, 'semaine dernière : 2 réalisées, 1 objectif atteint', sem[0]);
const res = S._lv3JournalResumeHtml(rows, data);
eq(/3 actions proposées · 2 réalisées · <b>1 objectif atteint<\/b>/.test(res), 'résumé « Semaine dernière » (maquette)', res);
const hist = S._lv3JournalHtml(rows, data);
eq(/Résultat observé après la recommandation/.test(hist) && /Association observée, pas une preuve de cause/.test(hist), 'historique : wording prudent');
const bil = S._lv3JournalBilanCoachHtml(rows, data);
eq(/3 actions proposées · 2 réalisées · <b>1 objectif atteint<\/b> · 1 pas atteint/.test(bil) && /pas une preuve de cause/.test(bil), 'coach : bilan + mention de prudence', bil);
eq(S._lv3TitrePasse('Dos : 10 séries cette semaine') === 'Dos : 10 séries', 'semaine passée : « cette semaine » retiré à l\'affichage');
eq(/Déjà proposé/.test(S._lv3JournalDejaPropose(rows, data, 'Dev')) && S._lv3JournalDejaPropose(rows, data, 'Squat') === '', 'coach : « Déjà proposé » seulement sur l\'exercice concerné');
eq(!/grâce à/i.test(LV3.slice(LV3.indexOf('// ── E. Journal')).split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')), 'aucun « grâce à » dans les textes du journal (hors commentaires)');

// Charge utile → acceptée par le contrôle de forme du serveur
const P = { lundi, actions: [
  { type: 'charge', exo: 'Dev', titre: 'Dev : proposé 75 kg (ou 70 kg)', raison: 'Pour revenir dans ta fourchette.', charge: 75, alt: 70, reps: 6 },
  { type: 'series', exo: 'Belt squat', muscle: 'Quadriceps', titre: '★ Quadriceps : 8 séries cette semaine', raison: 'Moyenne 5,5…', min: 8, add: 3, parSem: 5.5, recul: 4 },
  { type: 'rpe', exo: 'Leg curl', titre: 'Leg curl : garde 40 kg, vise RPE 8', raison: 'RPE 8 → 9,5', charge: 40 }] };
const pl = S._lv3PlanPourJournal(P, data);
eq(pl.semaine === lundi && pl.actions.length === 3, 'charge utile : semaine courante, 3 actions');
eq(pl.actions.every((a) => !B.f(a, 'A1', lundi, 'plan-2026-11-13').err), 'chaque action passe le contrôle de forme du VRAI serveur', pl.actions.map((a) => B.f(a, 'A1', lundi, 'plan-2026-11-13').err));
eq(pl.actions[1].titre.indexOf('★') < 0 && pl.actions[1].critere.min === 8, 'titre nettoyé (★), critère séries = min');
eq(pl.actions[0].donnees_entree.c === 75 && pl.actions[0].donnees_entree.r === 6, 'données d\'entrée = dernière séance AVANT la semaine', pl.actions[0].donnees_entree);
const rep = S._lv3PlanPourJournal({ lundi, actions: [{ type: 'reprise', titre: 'Reprendre : 1 séance', derniere: L2 }] }, data).actions[0];
eq(!B.f(rep, 'A1', lundi, 'plan-2026-11-13').err && rep.critere.seances === 1, 'action « reprise » acceptée par le serveur');

// Envoi : garde-fous côté app
S._lv3Plan = () => P;
const tokA = 'v1.a.QTE.9999999999.sig', tokC = 'v1.c.QzE.9999999999.sig';
const essai = (lib, prep, attendu) => { ENVOIS.length = 0; for (const k of Object.keys(LS)) delete LS[k]; S.navigator.onLine = true; LS.nvz_tok = tokA; const d = { historique: data.historique, programme: [] }; prep && prep(d); const r = S._lv3JournalEnvoyer(d); eq(r === attendu && ENVOIS.length === (attendu ? 1 : 0), lib, { r, n: ENVOIS.length }); return ENVOIS[0]; };
const env = essai('session athlète, en ligne, données complètes → envoi', null, true);
eq(env && env.body.action === 'enregistrerPlan' && env.body.donnees_completes === true && env.body.regle_version === 'plan-2026-11-13' && env.body.semaine === lundi, 'corps : action, données complètes, version, semaine', env && env.body);
essai('session COACH → aucun envoi', () => { LS.nvz_tok = tokC; }, false);
essai('sans session → aucun envoi', () => { delete LS.nvz_tok; }, false);
essai('hors ligne → aucun envoi', () => { S.navigator.onLine = false; }, false);
essai('historique absent (données incomplètes) → aucun envoi', (d) => { delete d.historique; }, false);
essai('programme absent (données incomplètes) → aucun envoi', (d) => { delete d.programme; }, false);
S._nvPropsAthlete = (d) => !(d && d.propositions_novalyz === false);
essai('propositions Novalyz coupées par le coach (plan non montré) → aucun envoi', (d) => { d.propositions_novalyz = false; }, false);
essai('propositions actives → envoi', (d) => { d.propositions_novalyz = true; }, true);
essai('déjà envoyé cette semaine sur cet appareil → aucun envoi', () => { LS['nv_journal_A1_' + lundi] = '1'; }, false);

// Branchement : envoi seulement après une réponse réseau complète (pas le cache) ; refus sans déconnexion.
const ch = ex(APP, 'chargerAppData'), iCache = ch.indexOf('_appliquerAppData(_parsed)'), iEnv = ch.indexOf('_lv3JournalEnvoyer(data)'), iFetch = ch.indexOf('await fetch(');
eq(iEnv > iFetch && iEnv > iCache && ch.indexOf('_lv3JournalEnvoyer') > iFetch && ch.indexOf('!data.historique') < iEnv, 'chargerAppData : envoi uniquement après la réponse réseau validée (jamais depuis le cache)');
eq(/_NVZ_401_SANS_DECO = \{[^}]*enregistrerPlan: 1[^}]*getDecisions: 1/.test(APP), 'un refus du journal ne déconnecte pas');

console.log(`journal-front : ${ok} OK / ${ko} KO`);
process.exit(ko ? 1 : 0);
