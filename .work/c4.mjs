import fs from 'fs';
let src = fs.readFileSync(new URL('./c1.mjs', import.meta.url), 'utf8');
src = src.slice(0, src.indexOf("if(process.env.W)"));
src += `
for (const [idx,nm] of [['0','vin'],['1','ali']]) {
  await pg.setViewportSize({width:390,height:844});
  await pg.evaluate((i)=>ouvrirAthleteDepuisSelect(i), idx); await pg.waitForTimeout(3500);
  const H=await pg.evaluate(()=>document.documentElement.scrollHeight);
  await pg.setViewportSize({width:390,height:Math.min(H,5200)}); await pg.waitForTimeout(400);
  await pg.screenshot({path:ROOT+'/.work/shots/fiche-'+nm+'.png'});
  fs.writeFileSync(ROOT+'/.work/shots/fiche-'+nm+'.txt', await pg.evaluate(()=>document.getElementById('cdtab-overview').innerText));
  await pg.setViewportSize({width:1280,height:1000}); await pg.waitForTimeout(900);
  await pg.screenshot({path:ROOT+'/.work/shots/fiche-'+nm+'-desk.png', fullPage:true});
  await pg.evaluate(()=>{ try{ fermerDetailAthleteCoach && fermerDetailAthleteCoach(); }catch(e){} try{ retourListeCoach && retourListeCoach(); }catch(e){} });
  await pg.waitForTimeout(500);
}
await b.close(); srv.close();`;
fs.writeFileSync(new URL('./c4run.mjs', import.meta.url), src);
