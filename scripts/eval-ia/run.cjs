// Usage : NODE_USE_ENV_PROXY=1 node scripts/eval-ia/run.cjs  — PRÉPROD uniquement, compte de démo (aucune donnée réelle). Consomme le quota IA du compte (2 questions/jour).
// Test de l'IA (préprod, compte démo John) : chaque chiffre de chaque réponse doit figurer dans le contexte envoyé à l'IA.
const fs = require('fs'), path = require('path'), vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const ROOT = path.join(__dirname, '..', '..');
const URL0 = 'https://vqxkeqjaqkkmtzxvqvhi.supabase.co/functions/v1/smooth-service';
const QUESTIONS = [
  'Comment s\'est passée ma dernière séance ?',
  'Pourquoi je bloque ?',
  'Est-ce que je peux augmenter ma charge la prochaine fois ?',
  'Combien de séances j\'ai fait cette semaine ?',
  'Mon volume par muscle est suffisant ?',
  'Quels sont mes records récents ?',
  'Je suis fatigué en ce moment ?',
  'Qu\'est-ce que je dois travailler en priorité ?',
  'Combien de séries de dos j\'ai fait cette semaine ?',
  'Mon RPE moyen est bon ?',
  'J\'ai mal à l\'épaule, je fais quoi ?',
  'Fais-moi un bilan de mon mois.',
];
(async () => {
  const post = async (body, tok) => (await fetch(URL0 + (tok ? '?_t=' + encodeURIComponent(tok) : ''), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })).json();
  const lg = await post({ action: 'login', login: '0101', password: 'demo2026' });
  const tok = lg.token, aid = String((lg.athlete || {}).athlete_id || '3');
  const ad = await (await fetch(URL0 + '?action=getAppData&athlete_id=' + aid + '&_t=' + encodeURIComponent(tok))).json();
  // Contexte : même fonction que le serveur (_iaContexte), sur les mêmes données.
  let js = stripTypeScriptTypes(fs.readFileSync(path.join(ROOT, 'supabase/functions/handler/index.ts'), 'utf8')).split('\n').filter((l) => !/^import\s/.test(l)).join('\n') + '\n;this.__api = { _iaContexte };';
  const sb = { createClient: () => ({}), webpush: { setVapidDetails() {} }, Deno: { env: { get: () => undefined }, serve: () => {} }, Response, Request, URL, URLSearchParams, TextEncoder, TextDecoder, crypto, console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout, fetch };
  vm.createContext(sb); vm.runInContext(js, sb);
  const ctx = sb.__api._iaContexte(ad, new Date());
  fs.writeFileSync(path.join(require('os').tmpdir(), 'ia-contexte.txt'), ctx);
  const nums = (t) => (t.match(/\d+(?:[,.]\d+)?/g) || []).map((x) => x.replace('.', ','));
  const ctxNums = new Set(nums(ctx));
  const out = [];
  for (const q of QUESTIONS) {
    const r = await post({ action: 'chatIA', athlete_id: aid, messages: [{ role: 'user', content: q }] }, tok);
    const rep = String(r.reply || r.error || JSON.stringify(r));
    const inconnus = [...new Set(nums(rep))].filter((n) => !ctxNums.has(n) && !/^(1|2|3|4|5|6|7|8|9|10|0)$/.test(n));
    out.push({ q, rep, inconnus, disabled: !!r.disabled, limited: !!r.limited });
    console.log('Q: ' + q + '\nR: ' + rep.replace(/\n+/g, ' ') + '\n→ chiffres absents du contexte : ' + (inconnus.join(', ') || 'aucun') + '\n');
    if (r.disabled || r.limited) break;
  }
  fs.writeFileSync(path.join(require('os').tmpdir(), 'eval-ia.json'), JSON.stringify(out, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
