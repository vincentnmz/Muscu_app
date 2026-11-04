
// Saisie de séance par le coach (présentiel) — Vincent.
await pg.evaluate(() => ouvrirAthleteDepuisSelect('0')); await pg.waitForTimeout(3500);
await pg.evaluate(() => coachSaisirSeance()); await pg.waitForTimeout(2000);
await pg.screenshot({ path: ROOT + '/.work/shots/saisie-coach-1.png' });
console.log('ECRAN 1\n' + (await pg.evaluate(() => document.body.innerText)).slice(0, 1500));
await pg.evaluate(() => { const c = [...document.querySelectorAll('#tab-seance *')].find(x => x.children.length < 6 && /^dos jambes/.test((x.innerText || '').trim())); if (c) c.click(); });
await pg.waitForTimeout(600);
await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Démarrer la séance/.test(x.textContent) && x.offsetParent); if (b) b.click(); });
await pg.waitForTimeout(2000);
const H = await pg.evaluate(() => document.documentElement.scrollHeight);
await pg.setViewportSize({ width: 390, height: Math.min(H, 4000) }); await pg.waitForTimeout(300);
await pg.screenshot({ path: ROOT + '/.work/shots/saisie-coach-2.png' });
const t = await pg.evaluate(() => document.body.innerText);
const k = t.indexOf('Saisie pour'); console.log('ECRAN 2\n' + t.slice(0, 2200));
console.log('TON :\n  ' + t.split('\n').filter(l => /\b(tu|ta|ton|tes|toi|te)\b/i.test(l)).slice(0, 25).join('\n  '));
await b.close(); srv.close();
