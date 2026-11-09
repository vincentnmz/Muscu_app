/* Environnement prod / préprod (js/env.js, 09/11/2026).
 * Garanties : par défaut = PROD ; préprod seulement sous /dev/ ou APK Dev (marqueur
 * remplacé au build) ; en préprod web, les clés localStorage sont préfixées
 * (jamais mélangées avec la prod) ; sessionStorage intact ; app.js retombe sur la
 * prod si env.js est absent. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const ENV = fs.readFileSync(path.join(ROOT, 'js', 'env.js'), 'utf8');
const PROD = 'https://jhbrvgguybynzeceeceu.supabase.co/functions/v1/smooth-service';
const PREPROD = 'https://vqxkeqjaqkkmtzxvqvhi.supabase.co/functions/v1/smooth-service';
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };

function run(pathname, src) {
  function Storage() { this._d = {}; }
  Storage.prototype.getItem = function (k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; };
  Storage.prototype.setItem = function (k, v) { this._d[k] = String(v); };
  Storage.prototype.removeItem = function (k) { delete this._d[k]; };
  const ls = new Storage(), ss = new Storage(), body = { kids: [], appendChild(n) { this.kids.push(n); } };
  const document = { readyState: 'complete', body, getElementById: () => null, addEventListener() {},
    createElement: () => ({ style: {}, setAttribute() {} }) };
  const win = { location: { pathname }, localStorage: ls, sessionStorage: ss, Storage };
  win.window = win; win.document = document;
  vm.createContext(win); vm.runInContext(src || ENV, win);
  return { win, ls, ss, body };
}

// 1. Prod par défaut
for (const p of ['/', '/index.html', '/Muscu_app/', '/Muscu_app/index.html', '/devis/', '/mon-dev/x']) {
  const { win, ls, body } = run(p);
  eq(win.NVZ_ENV === 'prod' && win.NVZ_SCRIPT_URL === PROD, 'prod sur ' + p, win.NVZ_ENV);
  ls.setItem('nvz_tok', 'x'); eq(ls._d.nvz_tok === 'x', 'prod : clé localStorage non préfixée (' + p + ')');
  eq(body.kids.length === 0, 'prod : pas de badge PRÉPROD (' + p + ')');
}
// 2. Préprod sous /dev/
for (const p of ['/dev/', '/dev/index.html', '/Muscu_app/dev/', '/Muscu_app/dev/index.html']) {
  const { win, ls, ss, body } = run(p);
  eq(win.NVZ_ENV === 'preprod' && win.NVZ_SCRIPT_URL === PREPROD, 'préprod sur ' + p, win.NVZ_ENV);
  ls.setItem('nvz_tok', 't'); eq(ls._d['nvzpp:nvz_tok'] === 't' && ls._d.nvz_tok === undefined, 'préprod : localStorage préfixé (' + p + ')');
  eq(ls.getItem('nvz_tok') === 't', 'préprod : relecture transparente');
  ls.removeItem('nvz_tok'); eq(ls._d['nvzpp:nvz_tok'] === undefined, 'préprod : suppression préfixée');
  ss.setItem('a', '1'); eq(ss._d.a === '1', 'préprod : sessionStorage non préfixé');
  eq(body.kids.length === 1, 'préprod : badge PRÉPROD affiché');
}
// 3. Préprod : une session prod existante n'est PAS lue (pas de mélange)
{ const { win, ls } = run('/dev/'); ls._d.nvz_tok = 'jeton-prod'; eq(ls.getItem('nvz_tok') === null, 'préprod ne voit pas le jeton de prod'); }
// 4. APK Dev : marqueur remplacé au build → préprod même à la racine
{ const wf = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'build-apk-dev.yml'), 'utf8');
  const m = wf.match(/sed -i "s\/var FORCE = '__NVZ_ENV__'\/var FORCE = 'preprod'\/" www\/js\/env\.js/);
  eq(!!m, 'build-apk-dev.yml remplace le marqueur dans www/js/env.js');
  eq(ENV.includes("var FORCE = '__NVZ_ENV__'"), 'env.js contient le marqueur exact attendu par le workflow');
  const src = ENV.replace("var FORCE = '__NVZ_ENV__'", "var FORCE = 'preprod'");
  const { win } = run('/', src); eq(win.NVZ_ENV === 'preprod' && win.NVZ_SCRIPT_URL === PREPROD, 'APK Dev (marqueur remplacé) → préprod');
}
// 5. Les builds PROD (APK, AAB) ne touchent pas au marqueur
for (const f of ['build-apk.yml', 'build-aab.yml', 'deploy.yml']) {
  const wf = fs.readFileSync(path.join(ROOT, '.github', 'workflows', f), 'utf8');
  eq(!wf.includes('__NVZ_ENV__') && !wf.includes("FORCE = 'preprod'"), f + ' ne bascule jamais en préprod');
}
// 6. app.js : SCRIPT_URL vient d'env.js, secours = prod ; index.html charge env.js en premier
{ const app = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8'), html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const line = app.split('\n').find((l) => /^const SCRIPT_URL\s*=/.test(l));
  eq(!!line && line.includes('window.NVZ_SCRIPT_URL') && line.includes(PROD), 'SCRIPT_URL = env.js sinon prod', line);
  const a = html.indexOf('<script src="js/env.js">'), b = html.indexOf('<script src="js/platform.js">'), c = html.indexOf('<script src="js/app.js">');
  eq(a > 0 && a < b && a < c, 'index.html charge env.js avant les autres scripts');
  eq(!app.includes('vqxkeqjaqkkmtzxvqvhi'), 'app.js ne contient pas d\'URL préprod en dur');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'); eq(sw.includes("'./js/env.js'"), 'sw.js met env.js en cache');
}
// 7. Workflow de déploiement backend : préprod seulement
{ const wf = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'deploy-backend-preprod.yml'), 'utf8');
  eq(/PREPROD_REF: vqxkeqjaqkkmtzxvqvhi/.test(wf) && /--project-ref "\$PREPROD_REF"/.test(wf), 'déploiement backend ciblé préprod');
  eq(/if \[ "\$PREPROD_REF" = "jhbrvgguybynzeceeceu" \]; then echo "Refus : ref de PROD"; exit 1; fi/.test(wf), 'garde-fou anti-prod présent');
  eq(/branches: \[dev\]/.test(wf) && !/branches: \[.*main/.test(wf), 'déclenché sur dev uniquement');
}

console.log(`env-preprod : ${ok} OK / ${ko} KO`);
process.exit(ko ? 1 : 0);
