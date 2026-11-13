/* AUDIT P2.1 — droits d'accès route par route : lance le banc (banc.js) et écrit resultats.json
 * (la matrice du document est construite par matrice.js). Usage : node scripts/audit-droits/audit.js */
const fs = require('fs'), path = require('path');
const { lancerBanc } = require('./banc.js');
const ROUTES = JSON.parse(fs.readFileSync(path.join(__dirname, 'routes.json'), 'utf8'));
(async () => {
  const res = await lancerBanc(ROUTES);
  fs.writeFileSync(path.join(__dirname, 'resultats.json'), JSON.stringify(res, null, 1));
  const nFuite = res.filter((x) => Object.entries(x.sc).some(([k, v]) => !k.startsWith('proprietaire') && k !== 'idInexistant' && (v.fuites.length || v.modifs.length))).length;
  const st = {}; for (const x of res) for (const v of Object.values(x.sc)) st[v.status] = (st[v.status] || 0) + 1;
  console.log('statuts :', JSON.stringify(st));
  if (st['429']) throw new Error('429 présents : résultats invalides');
  console.log(res.length + ' routes testées ; routes avec fuite ou modification dans un scénario d\'attaque : ' + nFuite);
})().catch((e) => { console.error(e); process.exit(1); });
