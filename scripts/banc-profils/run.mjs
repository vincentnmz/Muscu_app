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
const { NOW, PROFILS } = require('./profils.js');
const { getAppData } = require('./serveur.js');
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) { try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (e) { console.log('banc-profils : Playwright absent → ignoré'); process.exit(0); } }

const args = process.argv.slice(2), MAJ = args[0] === '--maj', QUI = (MAJ ? args.slice(1) : args).filter(Boolean);
const ids = Object.keys(PROFILS).filter((id) => !QUI.length || QUI.includes(id));
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
    const data = await getAppData(st, st._aid, NOW);
    const a = st.athletes[0];
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: 'Europe/Paris', locale: 'fr-FR', serviceWorkers: 'block' });
    const pg = await ctx.newPage();
    const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
    await pg.clock.install({ time: NOW }); await pg.clock.pauseAt(NOW);
    await pg.addInitScript(() => { let s = 20261114; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; });
    await pg.route((u) => !u.href.startsWith(URL0.replace('/index.html', '')), (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await pg.goto(URL0);
    await pg.clock.runFor(1500);
    const txt = await pg.evaluate(({ data, a, ECRANS }) => {
      athlete = { athlete_id: String(a.id), nom: a.nom, annees_pratique: a.annees, sport: 'muscu', login: a.login };
      _appliquerAppData(data);
      try { maResetNav(); } catch (e) {}
      ['onb-overlay', 'nvt-ov', 'annonce-retour'].forEach((x) => { const e = document.getElementById(x); if (e) e.remove(); });
      return ECRANS.map(([nom, idEl]) => { const el = document.getElementById(idEl); if (!el) return '== ' + nom + ' ==\n(absent)';
        document.querySelectorAll('[id^="tab-"]').forEach((t) => { t.style.display = 'none'; });
        for (let n = el; n && n !== document.documentElement; n = n.parentElement) { if (getComputedStyle(n).display === 'none') n.style.display = 'block'; }
        return '== ' + nom + ' ==\n' + el.innerText; }).join('\n\n');
    }, { data, a, ECRANS });
    await pg.clock.runFor(2500);
    const sortie = normaliser(txt) + (erreurs.length ? '\n\n== Erreurs JavaScript ==\n' + erreurs.join('\n') : '') + '\n';
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
} finally { await browser.close(); srv.close(); }
console.log('banc-profils : ' + (ids.length - ko) + ' OK / ' + ko + ' KO');
process.exit(ko ? 1 : 0);
