
// Audit coach écran 5 : fiche ▸ Séances (Entraînement) — Vincent puis Alizé.
for (const [idx, nm] of [['0', 'vin'], ['1', 'ali']]) {
  await pg.setViewportSize({ width: 390, height: 844 });
  await pg.evaluate((i) => ouvrirAthleteDepuisSelect(i), idx); await pg.waitForTimeout(3500);
  await pg.evaluate(() => switchCoachDetailTab('seances')); await pg.waitForTimeout(1500);
  await pg.evaluate(() => { try { toggleSeanceCoach(2); toggleSeanceCoach(4); } catch (e) {} }); await pg.waitForTimeout(400);
  const H = await pg.evaluate(() => document.documentElement.scrollHeight);
  await pg.setViewportSize({ width: 390, height: Math.min(H, 6000) }); await pg.waitForTimeout(400);
  await pg.screenshot({ path: ROOT + '/.work/shots/seances-' + nm + '.png' });
  const t = await pg.evaluate(() => document.getElementById('cdtab-seances').innerText);
  fs.writeFileSync(ROOT + '/.work/shots/seances-' + nm + '.txt', t);
  console.log('== ' + nm + '\n' + t.split('\n').filter(l => /Bilan|douleur|Proposé par|Commenter|Voir \d+|Tout|Muscu|Cardio|· \d\d\/\d\d\/2026/.test(l)).slice(0, 30).join('\n'));
}
await b.close(); srv.close();
