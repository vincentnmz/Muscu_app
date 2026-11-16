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
const erreursJS = [], refus = [];
page.on('pageerror', (e) => erreursJS.push(e.message));
// Tout appel au serveur Novalyz → le VRAI handler en mémoire. Le reste d'Internet est coupé (polices, CDN…).
await page.route('**/*', async (route) => {
  const u = route.request().url();
  if (u.startsWith(BASE)) return route.continue();
  if (/\/functions\/v1\/smooth-service/.test(u)) {
    const rq = route.request(), init = { method: rq.method(), headers: rq.headers() }; if (rq.method() !== 'GET') init.body = rq.postData() || '';
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
console.log('-'.repeat(70));
console.log('parcours-navigateur : ' + ok.length + ' OK / ' + ko.length + ' KO' + (erreursJS.length ? ' · erreurs JS : ' + erreursJS.slice(0, 3).join(' | ') : '') + (refus.length ? ' · refus serveur : ' + refus.slice(0, 3).join(' | ') : ''));
await b.close(); http0.close();
process.exit(ko.length || erreursJS.length || refus.length ? 1 : 0);
