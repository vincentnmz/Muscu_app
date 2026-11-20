// Parcours navigateur (16/11, audit P2) : la VRAIE app dans Chromium + le VRAI serveur (index.ts) en mémoire.
// Connexion → séance (3 séries saisies à l'écran) → enregistrement → rechargement → Analyses. Échoue sur toute
// erreur JavaScript, tout appel serveur refusé (401/500) ou toute étape qui n'aboutit pas.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { serveur, ROOT } = require('./serveur.cjs');
let chromium; try { ({ chromium } = require('playwright')); } catch (_) { console.log('parcours-navigateur : Playwright absent → ignoré'); process.exit(0); }
const DEBUG = process.argv.includes('--debug'), SHOT = process.argv.includes('--captures');
const ok = [], ko = []; const eq = (c, n, g) => { if (c) ok.push(n); else { ko.push(n); console.log('  ✗ ' + n + (g !== undefined ? ' (obtenu : ' + JSON.stringify(g).slice(0, 300) + ')' : '')); } };

// ── Données fictives ──
const store = { athletes: [], coachs: [], performances: [], programme: [], exercices: [], indicateurs: [], bien_etre: [], objectif: [], planning: [], seances: [] };
const S = serveur(store);
store.exercices.push({ exercice_id: '1', exercice: 'Développé couché barre', muscle: 'Pectoraux', muscle_secondaire: 'Triceps', increment_kg: '2.5', materiel: 'Barre', disciplines: 'muscu', mesure: 'charge_reps', statut: 'valide' });
store.athletes.push({ id: 'T1', login: '4321', nom: 'Test Parcours', password_hash: await S.hashSalted('motdepasse1', '4321'), sport: 'muscu', annees: 2, sexe: 'H', ddn: '1995-01-01', prefs: { onboarding_vu: true } });
store.programme.push({ athlete_id: 'T1', athlete_nom: 'Test Parcours', seance_id: 'Haut A', exercice: 'Développé couché barre', series_prevues: 3, reps_mini: 8, reps_max: 12, repos_sec: 120, jour: null });
store.exercices.push({ exercice_id: '2', exercice: 'Leg extension', muscle: 'Quadriceps', muscle_secondaire: null, increment_kg: '2.5', materiel: 'Machine', disciplines: 'muscu', mesure: 'charge_reps', statut: 'valide' });
store.programme.push({ athlete_id: 'T1', athlete_nom: 'Test Parcours', seance_id: 'Jambes 2', exercice: 'Leg extension', series_prevues: 3, reps_mini: 8, reps_max: 12, repos_sec: 90, jour: null });

// ── Serveur statique local (la vraie app) ──
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const http0 = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => http0.listen(0, r)); const BASE = 'http://127.0.0.1:' + http0.address().port;

const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
// Annonce « Un bug ? Une idée ? » (1 fois par appareil, délai variable 2,5-8 s) marquée déjà vue : test stable.
await ctx.addInitScript(() => { try { localStorage.setItem('nv_annonce_retour_v1', '1'); } catch (e) {} });
const page = await ctx.newPage();
const erreursJS = [], refus = []; let panne = null;   // { action, type: 'reseau' | 'refus' }
page.on('pageerror', (e) => erreursJS.push(e.message));
// Tout appel au serveur Novalyz → le VRAI handler en mémoire. Le reste d'Internet est coupé (polices, CDN…).
await page.route('**/*', async (route) => {
  const u = route.request().url();
  if (u.startsWith(BASE)) return route.continue();
  if (/\/functions\/v1\/smooth-service/.test(u)) {
    const rq = route.request(), init = { method: rq.method(), headers: rq.headers() }; if (rq.method() !== 'GET') init.body = rq.postData() || '';
    const act = init.body ? (JSON.parse(init.body || '{}').action || '') : (new URL(u).searchParams.get('action') || '');
    if (panne && panne.action === act) { if (panne.type === 'reseau') return route.abort('internetdisconnected'); return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ success: false, error: 'base indisponible' }) }); }
    const r = await S.handler(new Request(u, init)); const body = await r.text();
    if (r.status >= 400) refus.push(r.status + ' ' + (init.body ? (JSON.parse(init.body || '{}').action || '') : (new URL(u).searchParams.get('action') || '')) + ' ' + body.slice(0, 120));
    if (DEBUG) console.log('  → ' + (init.body ? JSON.parse(init.body).action : new URL(u).searchParams.get('action')) + ' ' + r.status);
    return route.fulfill({ status: r.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body });
  }
  return route.abort();
});
// Annonces « Nouveau » (une fois par compte) : un vrai utilisateur les ferme → « Compris ».
const fermerAnnonces = async () => { for (let i = 0; i < 3; i++) { const b = page.locator('button:visible:text-is("Compris")'); if (await b.count()) { await b.first().click(); await page.waitForTimeout(300); } else break; } };
const etape = async (nom, fn) => { try { await fermerAnnonces(); await fn(); } catch (e) { eq(false, nom + ' — ' + e.message.split('\n')[0]); } if (SHOT) await page.screenshot({ path: '/tmp/parcours-' + nom.replace(/\W+/g, '-').slice(0, 30) + '.png' }); };

await etape('1 connexion', async () => {
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.fill('#inp-login', '4321'); await page.fill('#inp-password', 'motdepasse1');
  await page.click('button[onclick="seConnecter()"]');
  await page.waitForFunction(() => typeof athlete !== 'undefined' && athlete && typeof dernierAppData !== 'undefined' && dernierAppData && dernierAppData.historique, null, { timeout: 20000 });
  eq(true, 'Connexion : session ouverte et données chargées (getAppData)');
});

await etape('2 demarrer', async () => {
  await page.click('.tj-cta:has-text("Commencer ma séance")');
  await page.waitForSelector('#en-start', { state: 'visible', timeout: 10000 });
  await page.click('#en-start');
  await page.waitForTimeout(1500);
});
await etape('3 etat du jour', async () => {
  await page.click('#wq-sommeil .wq-chip[data-val="4"]'); await page.click('#wq-fatigue .wq-chip[data-val="2"]');
  await page.click('#wq-stress .wq-chip[data-val="1"]'); await page.click('#wq-courbatures .wq-chip[data-val="2"]');
  await page.click('#btn-wellness-valider');
  await page.waitForTimeout(1500);
  eq(store.bien_etre.some((x) => x.athlete_id === 'T1'), 'État du jour : questionnaire enregistré en base (saveBienEtre)', store.bien_etre.length);
});
await etape('4 series', async () => {
  await page.waitForTimeout(800); await fermerAnnonces();
  await page.locator('#liste-exercices-seance').getByText('Développé couché barre').first().click();
  await page.waitForSelector('#inp-charge', { state: 'visible', timeout: 10000 });
  for (const [c, r, rpe] of [[60, 10, 7], [60, 10, 8], [60, 9, 9]]) {
    await page.fill('#inp-charge', String(c)); await page.fill('#inp-reps', String(r));
    await page.click('#rpe-chips >> text="' + rpe + '"').catch(async () => { await page.evaluate((v) => { const b = [...document.querySelectorAll('[onclick*="pickChip(\'rpe\'"]')].find((x) => x.getAttribute('onclick').includes("'" + v + "'")); if (b) b.click(); }, String(rpe)); });
    await page.click('button[onclick="ajouterSerie()"]'); await page.waitForTimeout(400);
  }
  const n = await page.evaluate(() => (typeof exoEnCours !== 'undefined' && exoEnCours && exoEnCours.series) ? exoEnCours.series.length : -1);
  eq(n === 3, 'Saisie : 3 séries ajoutées à l\'écran', n);
});
await etape('5 enregistrement', async () => {
  if (await page.locator('button[onclick="skipTimer()"]:visible').count()) await page.click('button[onclick="skipTimer()"]');
  await page.click('button[onclick="validerSeance()"]');
  await page.click('button[onclick="_validerFinSeance()"]', { timeout: 10000 });
  // Bilan de séance (note globale) : on le remplit si proposé, sinon il est passé.
  const bilan = page.locator('button[onclick="validerBilanSeance()"]:visible');
  await page.waitForTimeout(800);
  if (await page.locator('button[onclick="_bilanSkip()"]:visible').count()) await page.click('button[onclick="_bilanSkip()"]');
  await page.waitForFunction(() => true, null, { timeout: 1000 });
  for (let i = 0; i < 40 && store.performances.filter((x) => x.athlete_id === 'T1').length < 3; i++) await page.waitForTimeout(250);
  const P = store.performances.filter((x) => x.athlete_id === 'T1');
  eq(P.length === 3, 'Enregistrement : 3 séries en base (saveSeance)', P.length);
  eq(P.every((x) => Number(x.charge) === 60 && x.exercice === 'Développé couché barre') && P.map((x) => Number(x.reps)).join(',') === '10,10,9', 'Enregistrement : charge 60 kg, reps 10/10/9, bon exercice', P.map((x) => [x.exercice, x.charge, x.reps, x.rpe]));
  eq(P.map((x) => Number(x.rpe)).join(',') === '7,8,9', 'Enregistrement : RPE 7/8/9 conservés', P.map((x) => x.rpe));
});
// 20/11 (séance perdue de Célia) : 2e séance le même jour, lancée depuis Entraînement SANS « + Nouvelle séance ».
// Avant : le verrou de validation restait actif et le bouton affichait « ⏳ Envoi... » → rien n'était envoyé.
await etape('5b deuxieme seance meme jour', async () => {
  await page.waitForFunction(() => _seanceEnvoyee === true, null, { timeout: 10000 });   // réponse du serveur reçue (récap affiché)
  await page.evaluate(() => fermerSeancePage()); await page.waitForTimeout(500);
  await page.evaluate(() => switchTab('seance')); await page.waitForTimeout(1000); await fermerAnnonces();
  await page.evaluate(() => _enSelectSeance('Jambes 2')); await page.waitForTimeout(300);
  const dialogues = []; const surDialogue = (d) => { dialogues.push(d.message()); d.accept(); }; page.on('dialog', surDialogue);
  await page.click('#en-start'); await page.waitForTimeout(1500); await fermerAnnonces();
  page.off('dialog', surDialogue);
  eq(dialogues.length === 0, '2e séance : pas d\'alerte « tout sera perdu » (la 1re est déjà enregistrée)', dialogues);
  const bouton = await page.evaluate(() => document.getElementById('btn-valider').textContent.trim());
  eq(bouton === 'Valider la séance', '2e séance : le bouton n\'est plus figé sur « Envoi... »', bouton);
  await page.locator('#liste-exercices-seance').getByText('Leg extension').first().click();
  await page.waitForSelector('#inp-charge', { state: 'visible', timeout: 10000 });
  for (const [c, r] of [[40, 12], [40, 11]]) {
    await page.fill('#inp-charge', String(c)); await page.fill('#inp-reps', String(r));
    await page.click('#rpe-chips >> text="8"').catch(async () => { await page.evaluate(() => { const b = [...document.querySelectorAll('[onclick*="pickChip(\'rpe\'"]')].find((x) => x.getAttribute('onclick').includes("'8'")); if (b) b.click(); }); });
    await page.click('button[onclick="ajouterSerie()"]'); await page.waitForTimeout(400);
  }
  if (await page.locator('button[onclick="skipTimer()"]:visible').count()) await page.click('button[onclick="skipTimer()"]');
  await page.click('button[onclick="validerSeance()"]');
  // 20/11 : séance oubliée → « Date de la séance » = hier dans « Terminer la séance ? » (avant : champ date masqué).
  const hier = await page.evaluate(() => { const d = new Date(); d.setHours(12); d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
  const opts = await page.evaluate(() => [...document.querySelectorAll('#_fin-date-sel option')].map((o) => o.value));
  const auj = await page.evaluate(() => _todayLocalStr());
  eq(opts.length === 7 && opts[0] === auj && opts.every((o) => o <= auj), 'Date de la séance : aujourd\'hui + 6 jours passés, aucune date future', opts);
  await page.selectOption('#_fin-date-sel', hier); await page.waitForTimeout(300);
  await page.click('button[onclick="_validerFinSeance()"]', { timeout: 10000 });
  await page.waitForTimeout(800);
  if (await page.locator('button[onclick="_bilanSkip()"]:visible').count()) await page.click('button[onclick="_bilanSkip()"]');
  const J = () => store.performances.filter((x) => x.athlete_id === 'T1' && x.seance_id === 'Jambes 2');
  for (let i = 0; i < 40 && J().length < 2; i++) await page.waitForTimeout(250);
  eq(J().length === 2 && J().map((x) => Number(x.reps)).join(',') === '12,11', '2e séance : enregistrée en base (2 séries Leg extension)', J().map((x) => [x.exercice, x.charge, x.reps]));
  eq(store.performances.filter((x) => x.athlete_id === 'T1' && x.seance_id === 'Haut A').length === 3, '2e séance : la 1re séance n\'est ni doublée ni écrasée');
  eq(J().every((x) => String(x.date).slice(0, 10) === hier), 'Séance oubliée : enregistrée à la date choisie (hier)', J().map((x) => x.date));
  // La séance suivante repart à aujourd'hui (pas la date d'hier héritée).
  await page.waitForFunction(() => _seanceEnvoyee === true, null, { timeout: 10000 });
  await page.evaluate(() => { fermerSeancePage(); _enStart('Haut A'); }); await page.waitForTimeout(1200);
  const d3 = await page.evaluate(() => document.getElementById('inp-date').value);
  eq(d3 === auj, 'Séance suivante : date remise à aujourd\'hui', d3);
  await page.evaluate(() => fermerSeancePage());
});
// 20/11 (retours testeurs : « où est le bouton pour créer une séance ? ») : Entraînement ▸ « Créer une séance »
// ▸ « Push » ▸ 2 exercices cochés ▸ Ajouter → enregistrés en UN envoi, « Mon programme » ouvert sur la nouvelle séance.
await etape('5c creer une seance', async () => {
  await page.evaluate(() => { try { fermerSeancePage(); } catch (e) {} switchTab('seance'); }); await page.waitForTimeout(1200); await fermerAnnonces();
  const envois = []; const surReq = (r) => { if (r.method() === 'POST' && /smooth-service/.test(r.url())) { try { const a = JSON.parse(r.postData() || '{}').action; if (/^saveProgrammeLigne/.test(a)) envois.push(a); } catch (e) {} } };
  page.on('request', surReq);
  await page.click('#tab-seance .en-cree');
  await page.waitForSelector('#cs-sheet .jg-chip', { state: 'visible', timeout: 5000 });
  eq(await page.evaluate(() => _csNomUnique('Haut A')) === 'Haut A 2', 'Créer une séance : un nom déjà pris devient « Haut A 2 » (pas de mélange avec la séance existante)');
  await page.click('#cs-sheet .jg-chip:has-text("Push")');
  await page.waitForSelector('#xp-list .xp-it', { state: 'visible', timeout: 5000 });
  await page.locator('#xp-list .xp-it', { hasText: 'Leg extension' }).first().click().catch(async () => { await page.fill('#xp-q', 'leg'); await page.waitForTimeout(300); await page.locator('#xp-list .xp-it', { hasText: 'Leg extension' }).first().click(); });
  await page.fill('#xp-q', 'développé'); await page.waitForTimeout(300);
  await page.locator('#xp-list .xp-it', { hasText: 'Développé couché barre' }).first().click();
  await page.click('#xp-foot .xp-add');
  for (let i = 0; i < 40 && store.programme.filter((l) => l.seance_id === 'Push').length < 2; i++) await page.waitForTimeout(250);
  page.off('request', surReq);
  const P = store.programme.filter((l) => l.athlete_id === 'T1' && l.seance_id === 'Push');
  eq(P.length === 2 && P.every((l) => Number(l.series_prevues) === 3 && Number(l.reps_mini) === 8 && Number(l.reps_max) === 12), 'Créer une séance : « Push » enregistrée avec ses 2 exercices (3 × 8-12)', P.map((l) => [l.exercice, l.series_prevues, l.reps_mini, l.reps_max]));
  eq(envois.length === 1 && envois[0] === 'saveProgrammeLignes', 'Créer une séance : un seul envoi pour tous les exercices', envois);
  await page.waitForTimeout(1500);
  const tab = await page.evaluate(() => { const t = document.querySelector('#prog-editor-overlay .prog-tab.on'); return t ? t.textContent : ''; });
  eq(/Push/.test(tab), 'Créer une séance : « Mon programme » s\'ouvre sur la nouvelle séance', tab);
  await page.evaluate(() => fermerEditeurProgramme()); await page.waitForTimeout(800);
});
// 20/11 (« quand on ferme l'app, tout disparaît ? ») : séance commencée, app fermée → à la réouverture, la séance
// se rouvre avec ses séries (avant : gardées mais invisibles, retour sur Aujourd'hui avec « Commencer ma séance »).
await etape('5d fermeture en pleine seance', async () => {
  // « Push » (créée en 5c, pas encore faite aujourd'hui).
  await page.evaluate(() => { switchTab('seance'); _enStart('Push'); }); await page.waitForTimeout(1500); await fermerAnnonces();
  await page.locator('#liste-exercices-seance').getByText('Leg extension').first().click();
  await page.waitForSelector('#inp-charge', { state: 'visible', timeout: 10000 });
  await page.fill('#inp-charge', '50'); await page.fill('#inp-reps', '12');
  await page.click('#rpe-chips >> text="7"').catch(() => {});
  await page.click('button[onclick="ajouterSerie()"]'); await page.waitForTimeout(400);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof dernierAppData !== 'undefined' && dernierAppData && dernierAppData.historique, null, { timeout: 20000 });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => ({ n: _seanceEnCoursN(), page: document.body.classList.contains('seance-active'), bandeau: !!document.getElementById('brouillon-banner'), cta: (document.querySelector('#tab-accueil .tj-seance .tj-cta') || {}).textContent || '' }));
  eq(r.n === 1 && r.page && r.bandeau, 'App fermée en pleine séance : à la réouverture, la séance se rouvre avec sa série', r);
  eq(/Reprendre ma séance \(1 série\)/.test(r.cta), 'Aujourd\'hui : « Reprendre ma séance (1 série) » au lieu de « Commencer »', r.cta);
  page.once('dialog', (d) => d.accept());
  await page.evaluate(() => { _abandonnerBrouillon(); fermerSeancePage(); }); await page.waitForTimeout(500);
});
// 20/11 : séance CARDIO en cours (activité + durée + distance saisies) → gardée si l'app est fermée (avant : perdue).
await etape('5e fermeture en plein cardio', async () => {
  await page.evaluate(() => { switchTab('seance'); _enSetMode('cardio'); _enDemarrerNow(); }); await page.waitForTimeout(1200);
  await page.fill('#cardio-duree', '35');
  const type = await page.evaluate(() => document.getElementById('cardio-type').value);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof dernierAppData !== 'undefined' && dernierAppData && dernierAppData.historique, null, { timeout: 20000 });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => ({ page: document.body.classList.contains('seance-active'), mode: _modeSeance, type: (document.getElementById('cardio-type') || {}).value, duree: (document.getElementById('cardio-duree') || {}).value, chrono: !!_seanceChronoT0 }));
  eq(r.page && r.mode === 'cardio' && r.type === type && r.duree === '35' && r.chrono, 'App fermée en plein cardio : séance rouverte (activité, durée, chrono)', r);
  await page.evaluate(() => { fermerSeancePage(); _enSetMode('muscu'); }); await page.waitForTimeout(300);
  eq(await page.evaluate(() => localStorage.getItem('nv_cardio_brouillon_T1')) === null, 'Cardio quitté volontairement : brouillon effacé');
});
// 20/11 : message en cours d'écriture, questionnaire à moitié rempli, Hyrox en cours → gardés si l'app est fermée.
await etape('5f fermeture : message, questionnaire, hyrox', async () => {
  const recharger = async () => { await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => typeof dernierAppData !== 'undefined' && dernierAppData && dernierAppData.historique, null, { timeout: 20000 }); await page.waitForTimeout(2000); };
  // Message au coach (zone toujours présente côté athlète).
  await page.evaluate(() => { const t = document.getElementById('athlete-chat-input'); t.value = 'Question sur le squat'; t.dispatchEvent(new Event('input', { bubbles: true })); });
  // Hyrox : 2 segments faits.
  await page.evaluate(() => { ouvrirHyroxChrono(); _hxStartCircuitGo(); _hxNext(); _hxNext(); });
  await recharger();
  const r = await page.evaluate(() => ({ msg: document.getElementById('athlete-chat-input').value, ov: (document.getElementById('hyrox-chrono-overlay') || { style: {} }).style.display, idx: _hxIdx, splits: _hxSplits.length, timer: !!_hxTimer }));
  eq(r.msg === 'Question sur le squat', 'App fermée : le message en cours d\'écriture au coach est remis', r.msg);
  eq(r.ov === 'block' && r.idx === 2 && r.splits === 2 && r.timer, 'App fermée en pleine Hyrox : chrono rouvert au segment 3, splits gardés', r);
  page.once('dialog', (d) => d.accept());
  await page.evaluate(() => _hxCancel()); await page.waitForTimeout(300);
  eq(await page.evaluate(() => localStorage.getItem('nv_hyrox_brouillon_T1')) === null, 'Hyrox annulée volontairement : brouillon effacé');
  // Message envoyé (zone vidée) → brouillon supprimé.
  await page.evaluate(() => { document.getElementById('athlete-chat-input').value = ''; }); await page.waitForTimeout(1300);
  eq(await page.evaluate(() => localStorage.getItem('nv_txt_athlete-chat-input_aT1')) === null, 'Message parti (zone vidée) : brouillon supprimé');
  // Bilan de séance à moitié rempli → remis quand on le rouvre pour la même séance.
  await page.evaluate(() => { ouvrirBilanSeance('cardio', 'S-test', _todayLocalStr()); selectRPE(document.querySelector('#wq-rpe .wq-cr[data-val="6"]')); document.getElementById('wq-note').value = 'Genou un peu raide'; document.getElementById('wq-note').dispatchEvent(new Event('input', { bubbles: true })); });
  await recharger();
  await page.evaluate(() => ouvrirBilanSeance('cardio', 'S-test', _todayLocalStr())); await page.waitForTimeout(300);
  const q = await page.evaluate(() => ({ rpe: wellnessState.rpe, note: document.getElementById('wq-note').value }));
  eq(q.rpe === 6 && q.note === 'Genou un peu raide', 'App fermée pendant le bilan : réponses et note remises', q);
  await page.evaluate(() => _bilanSkip()); await page.waitForTimeout(300);
  eq(await page.evaluate(() => localStorage.getItem('nv_wq_brouillon_T1')) === null, 'Bilan passé volontairement : brouillon effacé');
});
await etape('6 rechargement', async () => {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof dernierAppData !== 'undefined' && dernierAppData && dernierAppData.historique, null, { timeout: 20000 });
  const r = await page.evaluate(() => { const p = (dernierAppData.historique.progression_par_exo || {})['Développé couché barre'] || []; return { n: p.length, c: p[0] && p[0].charge }; });
  eq(r.n === 1 && Number(r.c) === 60, 'Rechargement : la séance est relue depuis le serveur (session conservée, progression 60 kg)', r);
});
await etape('7 analyses', async () => {
  await page.evaluate(() => switchTab('historique')); await page.waitForTimeout(1500);
  const t = await page.evaluate(() => document.body.innerText);
  eq(/Développé couché barre/.test(t), 'Analyses : l\'exercice de la séance apparaît', t.slice(0, 200));
});
await etape('8 echec ecriture visible', async () => {
  const toast = async () => { for (let i = 0; i < 20; i++) { const t = await page.evaluate(() => { const e = document.getElementById('toast'); return e && e.classList.contains('show') ? e.textContent : ''; }); if (t) return t; await page.waitForTimeout(100); } return ''; };
  const ecrire = () => page.evaluate(() => fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'saveMensuration', athlete_id: 'T1', cle: 'tour_bras', valeur: 35 }) }).then(() => 'ok').catch(() => 'erreur'));
  panne = { action: 'saveMensuration', type: 'reseau' };
  await ecrire(); const t1 = await toast();
  eq(/Pas enregistré : pas de connexion/.test(t1), 'Échec réseau sur une écriture → message « Pas enregistré » affiché (avant : silencieux)', t1);
  await page.waitForTimeout(8200);   // un seul message à la fois (8 s)
  panne = { action: 'saveMensuration', type: 'refus' };
  await ecrire(); const t2 = await toast();
  eq(/Pas enregistré : erreur du serveur/.test(t2), 'Refus du serveur ({ success:false }) sur une écriture silencieuse → message affiché', t2);
  panne = null;
  const j = await page.evaluate(() => _nvzJournalTexte(3));
  eq(/saveMensuration → réseau/.test(j) && /saveMensuration → 200/.test(j), 'Journal technique : les appels et leur issue sont tracés (sans données)', j);
});
await etape('9 file hors-ligne : bilan garde', async () => {
  const jour = await page.evaluate(() => { const d = new Date(); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(); });
  const avant = store.performances.length;
  await page.evaluate((jour) => {
    _seanceEnvoiId = 'test-file-' + Date.now();
    enregistrerSeanceOffline([[jour, 1, 'Haut A', 'Test Parcours', 'T1', 'Développé couché barre', 'Pectoraux', '1', 1, 62.5, 8, 8, 120, 500]],
      { action: 'saveBienEtre', athlete_id: 'T1', date: jour, seance_id: 'Haut A', ressenti: 4, note: 7 });
  }, jour);
  panne = { action: 'saveBienEtre', type: 'reseau' };
  await page.evaluate(() => flushSeancesOffline());
  const q1 = await page.evaluate(() => _lireQueueOffline());
  eq(store.performances.length === avant + 1, 'File : la séance en attente est enregistrée au renvoi', store.performances.length - avant);
  eq(q1.length === 1 && q1[0].bilan_seul === true, 'File : bilan échoué → il RESTE en file (avant : abandonné en silence)', q1);
  eq(await page.evaluate(() => _nbSeancesEnAttente()) === 0, 'File : un bilan seul n\'est pas compté comme « séance en attente »');
  panne = null;
  await page.evaluate(() => flushSeancesOffline());
  const q2 = await page.evaluate(() => _lireQueueOffline());
  const be = store.bien_etre.filter((x) => x.athlete_id === 'T1');
  eq(q2.length === 0 && be.some((x) => Number(x.note) === 7 && String(x.ressenti_global) === '4'), 'File : au renvoi suivant le bilan arrive, la file est vide', { q2, notes: be.map((x) => [x.note, x.ressenti_global]) });
  eq(store.performances.length === avant + 1, 'File : aucune séance renvoyée en double', store.performances.length - avant);
});
console.log('-'.repeat(70));
console.log('parcours-navigateur : ' + ok.length + ' OK / ' + ko.length + ' KO' + (erreursJS.length ? ' · erreurs JS : ' + erreursJS.slice(0, 3).join(' | ') : '') + (refus.length ? ' · refus serveur : ' + refus.slice(0, 3).join(' | ') : ''));
await b.close(); http0.close();
process.exit(ko.length || erreursJS.length || refus.length ? 1 : 0);
