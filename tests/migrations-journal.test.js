/* Journal des migrations (09/11/2026) — garde-fous :
 *  - chaque fichier de supabase/migrations/ est bien nommé (AAAAMMJJHHMMSS_nom.sql) ;
 *  - chaque migration figure dans supabase/MIGRATIONS.md avec un état PRÉPROD et PROD ;
 *  - aucune migration ne contient de secret ni ne vise la prod/préprod en dur ;
 *  - le fichier de démo refuse de tourner sur une base qui ressemble à la prod. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), DIR = path.join(ROOT, 'supabase', 'migrations');
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (' + JSON.stringify(g) + ')' : '')); } };

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
const journal = fs.readFileSync(path.join(ROOT, 'supabase', 'MIGRATIONS.md'), 'utf8');
eq(files.length >= 2, 'au moins les 2 migrations du 09/11', files);
const versions = new Set();
for (const f of files) {
  eq(/^\d{14}_[a-z0-9_]+\.sql$/.test(f), 'nom conforme : ' + f);
  const v = f.slice(0, 14); eq(!versions.has(v), 'horodatage unique : ' + v); versions.add(v);
  const ligne = journal.split('\n').find((l) => l.includes('`' + f + '`') && l.trim().startsWith('|'));
  eq(!!ligne, 'listée dans MIGRATIONS.md §2 : ' + f);
  if (ligne) { const cols = ligne.split('|').map((s) => s.trim()).filter(Boolean); eq(cols.length >= 4 && cols[2] && cols[3], 'état PRÉPROD et PROD renseignés : ' + f, cols); }
  const sql = fs.readFileSync(path.join(DIR, f), 'utf8'), code = sql.replace(/--.*$/gm, '');
  eq(!/sk-ant-|eyJhbGciOi|service_role_key|BEGIN PRIVATE KEY|re_[A-Za-z0-9]{20,}/i.test(sql), 'aucun secret : ' + f);
  eq(!/jhbrvgguybynzeceeceu|vqxkeqjaqkkmtzxvqvhi/.test(code), 'aucune base visée en dur (hors commentaires) : ' + f);
  eq(!/\bdrop\s+table\b|\btruncate\b/i.test(code), 'pas de suppression de table : ' + f);
}
// Le journal ne cite pas de migration inexistante
for (const m of journal.matchAll(/`(\d{14}_[a-z0-9_]+\.sql)`/g)) eq(files.includes(m[1]), 'migration citée existante : ' + m[1]);
// Les jobs cron documentés sans secret
eq(/<CRON_SECRET>/.test(journal) && !/"secret":"(?!<CRON_SECRET>)[^"]+"/.test(journal), 'journal : cron sans secret');
// Fichier de démo : garde-fou anti-prod
const seed = fs.readFileSync(path.join(ROOT, 'supabase', 'seed-preprod.sql'), 'utf8');
eq(/Refus : cette base ressemble à la PROD/.test(seed), 'seed-preprod refuse une base de prod');
// Empreinte de schéma : lecture seule
const emp = fs.readFileSync(path.join(ROOT, 'supabase', 'empreinte-schema.sql'), 'utf8');
eq(!/\b(insert|update|delete|alter|create|drop|truncate)\b/i.test(emp.replace(/--.*$/gm, '')), 'empreinte-schema.sql en lecture seule');

console.log(`migrations-journal : ${ok} OK / ${ko} KO`);
process.exit(ko ? 1 : 0);
