
await pg.evaluate(() => ouvrirAthleteDepuisSelect('0')); await pg.waitForTimeout(3500);
await pg.evaluate(() => switchCoachDetailTab('prog')); await pg.waitForTimeout(1200); await pg.evaluate(() => maVoirPourquoi('Développé incliné à la Smith')); await pg.waitForTimeout(1500);
const vis = await pg.evaluate(() => { const out = []; document.querySelectorAll('#cdtab-prog *').forEach(e => { const tx = (e.childNodes[0] && e.childNodes[0].nodeType === 3) ? e.childNodes[0].textContent.trim() : ''; if (/Records de l|Tendance mensuelle|Volume hebdo|Choisis un exercice/.test(tx)) { const r = e.getBoundingClientRect(); out.push(tx.slice(0, 30) + ' h=' + Math.round(r.height) + ' vis=' + (e.offsetParent !== null)); } }); return out; });
console.log(vis.join(' || '));
const H = await pg.evaluate(() => document.documentElement.scrollHeight); await pg.setViewportSize({ width: 390, height: Math.min(H, 6000) }); await pg.waitForTimeout(300);
await pg.screenshot({ path: ROOT + '/.work/shots/prog-smith.png' });
const t2 = await pg.evaluate(() => document.getElementById('ma-muscu-detail').innerText); const k = t2.toLowerCase().indexOf('pourquoi'); console.log('DIAG', k >= 0 ? t2.slice(Math.max(0, k - 300), k + 1000) : 'pas de carte Pourquoi');
await b.close(); srv.close();
