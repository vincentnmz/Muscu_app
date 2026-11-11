// Extrait du VRAI index.ts : chaque route (GET / POST) → traitement → clés lues (body.x / params.get('x')).
import fs from 'node:fs';
const S = fs.readFileSync(new URL('../../supabase/functions/handler/index.ts', import.meta.url), 'utf8');
const iGet = S.indexOf("if (req.method === 'GET')"), iPost = S.indexOf("if (req.method === 'POST')"), iEnd = S.indexOf("return jsonResp({ erreur: 'Méthode non supportée' }, 405)");
const routes = [];
const lire = (bloc, methode) => { for (const m of bloc.matchAll(/case '([^']+)':\s*return ([^\n]+)/g)) {
  const h = (m[2].match(/\b(handle\w+)\(/) || [])[1] || null; routes.push({ action: m[1], methode, handler: h, appel: m[2].trim() }); } };
lire(S.slice(iGet, iPost), 'GET'); lire(S.slice(iPost, iEnd), 'POST');
const corps = (nom) => { const i = S.indexOf('async function ' + nom + '('); if (i < 0) return ''; let j = S.indexOf('\n}\n', i); return S.slice(i, j); };
for (const r of routes) {
  const c = r.handler ? corps(r.handler) : '';
  const cles = new Set();
  for (const m of c.matchAll(/\bbody\.(\w+)/g)) cles.add(m[1]);
  for (const m of c.matchAll(/params\.get\('(\w+)'\)/g)) cles.add(m[1]);
  for (const m of c.matchAll(/const \{([^}]+)\} = body/g)) m[1].split(',').map(x => x.trim().split(':')[0].split('=')[0].trim()).filter(Boolean).forEach(x => cles.add(x));
  r.cles = [...cles].filter(k => !['action', '_t', '_sessRole', '_sessId'].includes(k));
  r.sessRole = /_sessRole|_sess_role/.test(c);
  r.lignes = c.split('\n').length;
}
fs.writeFileSync(new URL('./routes.json', import.meta.url), JSON.stringify(routes, null, 1));
console.log(routes.length + ' entrées (' + routes.filter(r => r.methode === 'GET').length + ' GET, ' + routes.filter(r => r.methode === 'POST').length + ' POST), actions distinctes : ' + new Set(routes.map(r => r.action)).size);
for (const r of routes) console.log(r.methode.padEnd(4), r.action.padEnd(26), (r.handler || '-').padEnd(30), r.cles.join(','));
