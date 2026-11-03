// Écran Équipe (coach) — réutilise le montage de c1 jusqu'au chargement.
import fs from 'fs';
let src = fs.readFileSync(new URL('./c1.mjs', import.meta.url), 'utf8');
src = src.slice(0, src.indexOf("if(process.env.W)"));
src += `
await pg.evaluate(()=>coachBandeauGo('equipe')); await pg.waitForTimeout(600);
const H2=await pg.evaluate(()=>document.documentElement.scrollHeight);
await pg.setViewportSize({width:390,height:Math.min(H2,2400)}); await pg.waitForTimeout(300);
await pg.screenshot({path:ROOT+'/.work/shots/coach-equipe.png'});
console.log(await pg.evaluate(()=>document.getElementById('coach-sec-equipe').innerText));
for (const f of ['surveiller','prets','inactifs']) { await pg.evaluate((f)=>{const b=[...document.querySelectorAll('.coach-eq-chip')].find(x=>x.getAttribute('onclick').includes("'"+f+"'")); b.click();},f); await pg.waitForTimeout(200);
  console.log(f, await pg.evaluate(()=>[...document.querySelectorAll('#coach-sec-equipe .coach-athlete-row')].filter(x=>x.style.display!=='none').map(x=>x.dataset.nom).join(','))); }
await pg.setViewportSize({width:1280,height:900}); await pg.waitForTimeout(800);
await pg.evaluate(()=>{ try{coachDeskGo('equipe')}catch(e){console.log(e)} }); await pg.waitForTimeout(800);
await pg.screenshot({path:ROOT+'/.work/shots/coach-equipe-desk.png'});
await b.close(); srv.close();`;
fs.writeFileSync(new URL('./c3run.mjs', import.meta.url), src);
