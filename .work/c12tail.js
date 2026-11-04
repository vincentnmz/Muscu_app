
// Audit coach écran 6 : fiche ▸ Programme — Vincent.
await pg.evaluate(() => ouvrirAthleteDepuisSelect('0')); await pg.waitForTimeout(3500);
await pg.evaluate(() => switchCoachDetailTab('programme')); await pg.waitForTimeout(2000);
const H = await pg.evaluate(() => document.documentElement.scrollHeight);
await pg.setViewportSize({ width: 390, height: Math.min(H, 6000) }); await pg.waitForTimeout(400);
await pg.screenshot({ path: ROOT + '/.work/shots/prog6-vin.png' });
const t = await pg.evaluate(() => document.getElementById('cdtab-programme').innerText);
fs.writeFileSync(ROOT + '/.work/shots/prog6-vin.txt', t);
console.log(t.slice(0, 3500));
await pg.setViewportSize({ width: 1280, height: 900 }); await pg.waitForTimeout(900);
await pg.screenshot({ path: ROOT + '/.work/shots/prog6-vin-desk.png', fullPage: true });
await b.close(); srv.close();
