import fs from 'fs';
let src = fs.readFileSync(new URL('./c1.mjs', import.meta.url), 'utf8');
src = src.slice(0, src.indexOf("if(process.env.W)"));
src = src.replace("ali=J('out_aliz.json')", "ali=J('out_aliz_zp.json')");
src += `
await pg.evaluate(()=>ouvrirAthleteDepuisSelect('1')); await pg.waitForTimeout(3500);
console.log('HERO', await pg.evaluate(()=>document.getElementById('cd-hero').innerText.split('\\n').slice(0,3).join(' | ')));
console.log('VOL7', await pg.evaluate(()=>{const e=document.getElementById('cd-hub-volume');return e?e.innerText.replace(/\\n/g,' | ').slice(0,200):'-'}));
await pg.evaluate(()=>switchCoachDetailTab('programme')); await pg.waitForTimeout(800);
console.log('ZONES', await pg.evaluate(()=>document.getElementById('cd-zones').innerText.replace(/\\n/g,' | ')));
await pg.evaluate(()=>document.getElementById('cd-zones').scrollIntoView({block:'start'})); await pg.waitForTimeout(200);
await pg.screenshot({path:ROOT+'/.work/shots/zp-coach.png'});
await b.close(); srv.close();`;
fs.writeFileSync(new URL('./c6run.mjs', import.meta.url), src);
