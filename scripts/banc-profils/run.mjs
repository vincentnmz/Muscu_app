// Banc de profils (14/11/2026) — filet anti « phrase fausse » : pour chaque profil fictif, TOUT le texte affiché sur
// Aujourd'hui, Analyses ▸ Résumé (muscu) et Forme est comparé à un fichier attendu relu par un humain.
//   node scripts/banc-profils/run.mjs              → compare (échec + différences si une phrase change)
//   node scripts/banc-profils/run.mjs --maj [id…]  → réécrit les fichiers attendus (après relecture des phrases !)
// Chaîne réelle : profil (base en mémoire) → VRAI handleGetAppData (index.ts, date figée) → VRAIE app (index.html +
// js/*, Chromium, horloge figée, hasard figé, réseau coupé) → texte des écrans.
import { createRequire } from 'module';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const ICI = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.join(ICI, '..', '..');
const ATT = path.join(ROOT, 'tests', 'banc-profils');
const { NOW, PROFILS, equipe } = require('./profils.js');
const { getAppData, equipeData } = require('./serveur.js');
const { verifier } = require('./coherence.js');
const { verifier: verifierCalculs } = require('../verif-coherence/verif.cjs');   // 18/11 : chiffres recalculés depuis les séries brutes
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) { try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (e) { console.log('banc-profils : Playwright absent → ignoré'); process.exit(0); } }

const args = process.argv.slice(2), MAJ = args[0] === '--maj', QUI = (MAJ ? args.slice(1) : args).filter(Boolean);
const ids = Object.keys(PROFILS).filter((id) => !QUI.length || QUI.includes(id));
const COACH = !QUI.length || QUI.includes('coach_equipe');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!f.startsWith(ROOT)) { r.writeHead(403); r.end(); return; } fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
await new Promise((res) => srv.listen(0, '127.0.0.1', res));
const URL0 = 'http://127.0.0.1:' + srv.address().port + '/index.html';

const ECRANS = [['Aujourd\'hui', 'tab-accueil'], ['Analyses ▸ Résumé (muscu)', 'tab-historique'], ['Forme', 'tab-etat']];
function normaliser(t) { return t.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n'); }

const browser = await chromium.launch();
let ko = 0;
try {
  for (const id of ids) {
    const st = PROFILS[id]();
    const T0 = st._now || NOW;   // 21/11 : un profil peut fixer sa propre date (passage d'année)
    const data = await getAppData(st, st._aid, T0);
    const a = st.athletes[0];
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: 'Europe/Paris', locale: 'fr-FR', serviceWorkers: 'block' });
    const pg = await ctx.newPage();
    const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
    await pg.clock.install({ time: T0 }); await pg.clock.pauseAt(T0);
    await pg.addInitScript(() => { let s = 20261114; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; });
    await pg.route((u) => !u.href.startsWith(URL0.replace('/index.html', '')), (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await pg.goto(URL0);
    await pg.clock.runFor(1500);
    const txt = await pg.evaluate(({ data, a, ECRANS, EVO }) => {
      athlete = { athlete_id: String(a.id), nom: a.nom, annees_pratique: a.annees, sport: 'muscu', login: a.login };
      _appliquerAppData(data);
      try { maResetNav(); } catch (e) {}
      ['onb-overlay', 'nvt-ov', 'annonce-retour'].forEach((x) => { const e = document.getElementById(x); if (e) e.remove(); });
      try { const rb = document.getElementById('et-rb-body'); if (rb && rb.style.display !== 'flex') _etFoldRB(); } catch (e) {}   // Forme : bloc Ressenti déplié (14/11)
      return ECRANS.map(([nom, idEl]) => { const el = document.getElementById(idEl); if (!el) return '== ' + nom + ' ==\n(absent)';
        document.querySelectorAll('[id^="tab-"]').forEach((t) => { t.style.display = 'none'; });
        for (let n = el; n && n !== document.documentElement; n = n.parentElement) { if (getComputedStyle(n).display === 'none') n.style.display = 'block'; }
        return '== ' + nom + ' ==\n' + el.innerText; }).join('\n\n')
        + (function () { try { maSetDisc('croise'); } catch (e) { return ''; }   // 14/11 : Analyses ▸ Croisé (cohérence charge ↔ récup)
          var el = document.getElementById('tab-historique'); if (!el) return '';
          document.querySelectorAll('[id^="tab-"]').forEach((t) => { t.style.display = 'none'; });
          for (let n = el; n && n !== document.documentElement; n = n.parentElement) { if (getComputedStyle(n).display === 'none') n.style.display = 'block'; }
          return '\n\n== Analyses ▸ Croisé ==\n' + el.innerText; })()
        + (function () { try { maSetDisc('muscu'); maSetTab('tendances'); } catch (e) { return ''; }   // 21/11 : Tendances (régularité, tonnage, fréquence, intensité)
          var el = document.getElementById('tab-historique'); if (!el) return '';
          document.querySelectorAll('[id^="tab-"]').forEach((t) => { t.style.display = 'none'; });
          for (let n = el; n && n !== document.documentElement; n = n.parentElement) { if (getComputedStyle(n).display === 'none') n.style.display = 'block'; }
          return '\n\n== Analyses ▸ Tendances ==\n' + el.innerText; })()
        + (EVO || []).map(function (x) { try { maSetTab('detail'); maSetExo(x); } catch (e) { return ''; }   // 21/11 : Évolution ▸ exercice (profils qui le demandent)
          var el = document.getElementById('tab-historique'); return el ? '\n\n== ÉVOLUTION ▸ ' + x + ' ==\n' + el.innerText : ''; }).join('');
    }, { data, a, ECRANS, EVO: st._evolution || [] });
    await pg.clock.runFor(2500);
    // R8b (H, 14/11) — même décision : un exercice dont la cible athlète dit « pas de progression aujourd'hui » (mode vigilance)
    // n'a aucune action active du plan ni levier qui l'augmente (séries, charge, RPE 9-10). Calcul sur les VRAIES fonctions de l'app.
    const r8b = await pg.evaluate(() => { const out = [];
      try {
        const rows = _tjCibles(dernierAppData, dernierAppData.programme || []);
        const vig = rows.filter((r) => r.mode === 'vigilance').map((r) => r.exo.trim());
        const mus = (e) => { try { return _lv3MuscleExo(dernierAppData, e); } catch (x) { return null; } };
        const P = _lv3Plan(dernierAppData); const act = P ? P.actions.filter((a) => !a.gene && !a.fait && (a.type === 'series' || a.type === 'cible' || a.type === 'charge')) : [];
        vig.forEach((e) => {
          act.forEach((a) => { if ((a.exo && a.exo.trim() === e && a.type !== 'charge') || (a.type === 'series' && a.muscle && mus(e) && _musKey(a.muscle) === _musKey(mus(e)))) out.push('plan « ' + a.titre + ' » actif alors que la cible de ' + e + ' dit « pas de progression »'); });
          _lv3Diags(dernierAppData).filter((d) => d.exo.trim() === e).forEach((d) => { if (/\+\d+ séries? de |RPE 9-10|ajoute 1 série/i.test(d.levier || '')) out.push('levier « ' + d.levier.slice(0, 70) + '… » sur ' + e + ' (cible : pas de progression)'); });
        });
      } catch (e) { out.push('R8b non calculable : ' + e.message); }
      return out; });
    if (r8b.length) { ko++; console.error('  ✗ ' + id + ' : décision athlète ≠ plan / levier'); r8b.forEach((e) => console.error('      ⚠ R8b ' + e)); }
    const sortie = normaliser(txt) + (erreurs.length ? '\n\n== Erreurs JavaScript ==\n' + erreurs.join('\n') : '') + '\n';
    if (erreurs.length) { ko++; console.error('  ✗ ' + id + ' : erreur JavaScript — ' + erreurs[0]); }   // bloquant même en --maj (14/11)
    const inc = verifier(normaliser(txt), data);   // cohérence inter-écrans (14/11) : bloquant même en --maj
    if (inc.length) { ko++; console.error('  ✗ ' + id + ' : écrans incohérents avec le moteur'); inc.forEach((e) => console.error('      ⚠ ' + e)); }
    // 18/11 (fiabilité des calculs, décision porteur) : chaque chiffre servi / affiché est RECALCULÉ depuis les données brutes
    // par un code indépendant du moteur (scripts/verif-coherence) — bloquant même en --maj.
    const _jour = new Date(T0).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
    const cal = verifierCalculs({ store: st, appdata: data, ecrans: normaliser(txt).split('\n').map((l) => (/^== .+ ==$/.test(l) ? l : l)).join('\n'), now: _jour });
    if (cal.length) { ko++; console.error('  ✗ ' + id + ' : calcul ≠ recalcul indépendant'); cal.forEach((e) => console.error('      ⚠ [' + e.code + '] ' + e.message)); }
    const f = path.join(ATT, id + '.txt');
    if (MAJ) { fs.mkdirSync(ATT, { recursive: true }); fs.writeFileSync(f, sortie); console.log('  ✎ ' + id + ' : attendu réécrit (' + sortie.split('\n').length + ' lignes)'); }
    else if (!fs.existsSync(f)) { ko++; console.error('  ✗ ' + id + ' : pas de fichier attendu (lancer --maj ' + id + ' après relecture)'); }
    else {
      const att = fs.readFileSync(f, 'utf8');
      if (att === sortie) console.log('  ✓ ' + id);
      else {
        ko++; console.error('  ✗ ' + id + ' : le texte affiché a changé');
        const A1 = att.split('\n'), B1 = sortie.split('\n'), sa = new Set(A1), sb = new Set(B1);
        A1.filter((l) => !sb.has(l)).slice(0, 15).forEach((l) => console.error('      − ' + l));
        B1.filter((l) => !sa.has(l)).slice(0, 15).forEach((l) => console.error('      + ' + l));
      }
    }
    await ctx.close();
  }
  // ── Espace COACH (14/11) : accueil coach + fiche de chaque athlète de l'équipe ──
  if (COACH) {
    const E = equipe(), D = await equipeData(E.store, E.coachId, E.athleteIds, NOW);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: 'Europe/Paris', locale: 'fr-FR', serviceWorkers: 'block' });
    const pg = await ctx.newPage();
    const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
    await pg.clock.install({ time: NOW }); await pg.clock.pauseAt(NOW);
    await pg.addInitScript(() => { let s = 20261114; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; });
    await pg.route((u) => !u.href.startsWith(URL0.replace('/index.html', '')), (r) => {
      const u = new URL(r.request().url()), act = u.searchParams.get('action');
      const body = act === 'getCoachAthletes' ? D.liste : act === 'getAppData' ? (D.fiches[u.searchParams.get('athlete_id')] || {}) : {};
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await pg.goto(URL0);
    await pg.clock.runFor(1500);
    const lire = (sel) => pg.evaluate((sel) => {
      ['onb-overlay', 'nvt-ov', 'annonce-retour'].forEach((x) => { const e = document.getElementById(x); if (e) e.remove(); });
      const el = document.getElementById(sel); if (!el) return '(absent)';
      document.querySelectorAll('.view').forEach((v) => { if (v !== el) v.classList.remove('active'); });
      el.classList.add('active'); for (let n = el; n && n !== document.documentElement; n = n.parentElement) { if (getComputedStyle(n).display === 'none') n.style.display = 'block'; }
      return el.innerText;
    }, sel);
    await pg.evaluate(async () => { coach = { coach_id: 'C1', login: '0808', nom: 'Coach Banc', role: 'coach', sport: 'muscu' }; await ouvrirEspaceCoach(); });
    for (let i = 0; i < 20; i++) { await pg.clock.runFor(1000); if (await pg.evaluate(() => { const t = (document.getElementById('view-coach') || {}).innerText || ''; return /athlètes suivis/.test(t) && !/Analyse des athlètes…/.test(t); })) break; }
    let txt = '== Coach ▸ Accueil ==\n' + await lire('view-coach');
    // Accueil coach (14/11) : la ligne « Entraînement à regarder » de chaque athlète est contrôlée contre SON moteur.
    for (const aid of E.athleteIds) {
      const ligne = await pg.evaluate((d) => { try { const L = _coachEntrLigne(d); return L ? L.txt.replace(/<[^>]+>/g, '') : ''; } catch (e) { return 'ERREUR ' + e.message; } }, D.fiches[aid]);
      const incA = ligne ? verifier(ligne, D.fiches[aid]) : [];
      if (incA.length) { ko++; console.error('  ✗ coach ▸ accueil, athlète ' + aid + ' : ' + incA.join(' | ')); }
    }
    for (const aid of E.athleteIds) {
      await pg.evaluate(async (aid) => { const a = athletesCoach.find((x) => String(x.athlete_id) === aid); if (a) await ouvrirDetailAthleteCoach(a); }, aid);
      await pg.clock.runFor(2500);
      const fiche = await lire('view-coach-detail');
      const indic = await pg.evaluate(() => { const el = document.getElementById('cd-indicateurs'); if (!el) return '';   // bloc #cd-indicateurs : MASQUÉ à l'écran (mobile + ordi), contrôlé quand même s'il réapparaît
        for (let n = el; n && n !== document.documentElement; n = n.parentElement) { if (getComputedStyle(n).display === 'none') n.style.display = 'block'; }
        return el.innerText; });
      const croise = await pg.evaluate((d) => { try { _maCoachAttach(d); maSetDisc('croise'); } catch (e) { return '(croisé indisponible : ' + e.message + ')'; }
        const el = document.getElementById('tab-historique'); if (!el) return '';
        for (let n = el; n && n !== document.documentElement; n = n.parentElement) { if (getComputedStyle(n).display === 'none') n.style.display = 'block'; }
        const t = el.innerText; try { maSetDisc('muscu'); } catch (e) {} return t; }, D.fiches[aid]);
      txt += '\n\n== Coach ▸ Fiche athlète ' + aid + ' ==\n' + fiche + '\n-- Indicateurs (bloc masqué à l\'écran, contrôlé quand même) --\n' + indic + '\n-- Analyses ▸ Croisé (coach) --\n' + croise;
      const inc = verifier(normaliser(fiche + '\n' + indic + '\n' + croise), D.fiches[aid]);
      if (inc.length) { ko++; console.error('  ✗ coach ▸ fiche ' + aid + ' : écrans incohérents avec le moteur'); inc.forEach((e) => console.error('      ⚠ ' + e)); }
    }
    const sortie = normaliser(txt) + (erreurs.length ? '\n\n== Erreurs JavaScript ==\n' + erreurs.join('\n') : '') + '\n';
    if (erreurs.length) { ko++; console.error('  ✗ coach_equipe : erreur JavaScript — ' + erreurs[0]); }
    const f = path.join(ATT, 'coach_equipe.txt');
    if (MAJ) { fs.writeFileSync(f, sortie); console.log('  ✎ coach_equipe : attendu réécrit (' + sortie.split('\n').length + ' lignes)'); }
    else if (!fs.existsSync(f)) { ko++; console.error('  ✗ coach_equipe : pas de fichier attendu (lancer --maj coach_equipe après relecture)'); }
    else {
      const att = fs.readFileSync(f, 'utf8');
      if (att === sortie) console.log('  ✓ coach_equipe');
      else { ko++; console.error('  ✗ coach_equipe : le texte affiché a changé'); const A1 = att.split('\n'), B1 = sortie.split('\n'), sa = new Set(A1), sb = new Set(B1);
        A1.filter((l) => !sb.has(l)).slice(0, 15).forEach((l) => console.error('      − ' + l)); B1.filter((l) => !sa.has(l)).slice(0, 15).forEach((l) => console.error('      + ' + l)); }
    }
    await ctx.close();
  }
} finally { await browser.close(); srv.close(); }
console.log('banc-profils : ' + (ids.length + (COACH ? 1 : 0) - ko) + ' OK / ' + ko + ' KO');
process.exit(ko ? 1 : 0);
