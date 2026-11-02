import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT='/home/user/Muscu_app';
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});r.end(d);});}).listen(8765);
const item=(aid,id)=>({lignes:[['02/11/2026',45,'pec epaule','V',aid,'Ecarté machine','Pectoraux','1',1,30,9,9,120,270]],wellness:null,ts:1,envoi_id:id});
async function cas(nom, init, saveStatus, ms=7000){
  const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:390,height:844}});
  let loads=0, saves=0; pg.on('load',()=>loads++);
  await pg.route(/supabase\.co|smooth-service/, async route=>{
    const body=route.request().postData()||''; let a=null; try{a=JSON.parse(body).action;}catch(e){}
    if(a==='saveSeance'){ saves++; return route.fulfill({status:saveStatus,contentType:'application/json',body:JSON.stringify(saveStatus===401?{erreur:'Session expirée',auth:true}:{success:true})}); }
    route.fulfill({status:200,contentType:'application/json',body:'{}'});
  });
  await pg.addInitScript(init);
  await pg.goto('http://localhost:8765/index.html'); await pg.waitForTimeout(ms);
  const q=JSON.parse(await pg.evaluate(()=>localStorage.getItem('novalyz_offline_seances')||'[]'));
  const bar=await pg.evaluate(()=>{var e=document.getElementById('nv-offline-bar');return e&&e.style.display!=='none'?e.textContent:'';});
  console.log(nom.padEnd(46),'chargements',loads,'· envois',saves,'· file',q.map(x=>x.envoi_id).join(',')||'vide', bar?'· bandeau: '+bar:'');
  await b.close();
}
const Q=(items)=>`if(!sessionStorage.getItem('x')){sessionStorage.setItem('x','1');localStorage.setItem('novalyz_offline_seances',${JSON.stringify(JSON.stringify(items))});`;
await cas('1. Déconnecté + séance en file (avant : boucle)', new Function(Q([item('1','e1')])+'}'), 401);
await cas('2. Connecté, session refusée (401)', new Function(Q([item('1','e1')])+"localStorage.setItem('muscu_athlete',JSON.stringify({athlete_id:'1',login:'4821',nom:'V',sport:'muscu'}));localStorage.setItem('nvz_tok','v1.a.MQ.9999999999.x');}"), 401);
await cas('3. Connecté, renvoi OK ; séance d\'un autre gardée', new Function(Q([item('1','e1'),item('7','e7')])+"localStorage.setItem('muscu_athlete',JSON.stringify({athlete_id:'1',login:'4821',nom:'V',sport:'muscu'}));localStorage.setItem('nvz_tok','v1.a.MQ.9999999999.x');}"), 200);
srv.close();
