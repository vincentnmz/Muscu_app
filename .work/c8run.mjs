import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT='/home/user/Muscu_app', A='/home/user/Muscu_app/.work/audit/';
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});r.end(d);});}).listen(8766);
const J=f=>JSON.parse(fs.readFileSync(A+f));
const vin=J('out_vinc.json'), ali=J('out_aliz.json'); [vin,ali].forEach(x=>{ if(x.recompenses) x.recompenses.ia_active=false; });   // clé IA absente en prod
// John / Yann : pas rejoués (stub) — seules les dates réelles comptent ici.
const john={dashboard:{derniere_seance:{date:'17/09/2026',seance_id:'Push',nb_series:20},regularite:{seances_prevues:4,seances_faites:0}},historique:{},programme:[]};
const yann={dashboard:{regularite:{seances_prevues:0}},historique:{},programme:[]};
const map=x=>(x.alertes_centre||[]).map(a=>({type:a.type,severite:a.severity,message:(a.evidence&&a.evidence!==a.title)?a.title+' — '+a.evidence:a.title}));
const ath=[{athlete_id:'1',id:1,nom:'Vincent',sport:'muscu',annees_pratique:4,niveau:'intermediaire',alertes:map(vin)},
 {athlete_id:'2',id:2,nom:'Alizé',sport:'muscu',annees_pratique:2,niveau:'debutant',alertes:map(ali)},
 {athlete_id:'3',id:3,nom:'John',sport:'muscu',annees_pratique:4,alertes:[{type:'absence',severite:'haute',message:'Aucune séance depuis 47 jours'}]},
 {athlete_id:'4',id:4,nom:'Yann',sport:'muscu',annees_pratique:0,alertes:[]}];
const byId={1:vin,2:ali,3:john,4:yann};
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:Number(process.env.W||390),height:844},deviceScaleFactor:1});
await pg.route(/supabase\.co|smooth-service/, async route=>{
  const u=route.request().url(); const a=(u.match(/action=([^&]+)/)||[])[1]; const id=(u.match(/athlete_id=([^&]+)/)||[])[1];
  let res={success:true};
  if(a==='getCoachAthletes') res={ok:true,athletes:ath};
  else if(a==='getAppData') res=byId[id]||{};
  else if(a==='getCommentaires') res={commentaires: id==='2'?[{auteur:'athlete',texte:'Coucou',date:'01/11/2026 10:00',comment_id:1}]:[]};
  route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(res)});
});
pg.on('pageerror',e=>console.log('PAGEERR',e.message));
await pg.addInitScript(()=>{localStorage.setItem('muscu_coach',JSON.stringify({coach_id:'1',login:'coach',nom:'Vincent',sport:'muscu'}));});
await pg.goto('http://localhost:8766/index.html'); await pg.waitForTimeout(3500);

await pg.evaluate(() => ouvrirAthleteDepuisSelect('0')); await pg.waitForTimeout(3500);
await pg.evaluate(() => switchCoachDetailTab('prog')); await pg.waitForTimeout(1200); await pg.evaluate(() => maVoirPourquoi('Développé incliné à la Smith')); await pg.waitForTimeout(1500);
const vis = await pg.evaluate(() => { const out = []; document.querySelectorAll('#cdtab-prog *').forEach(e => { const tx = (e.childNodes[0] && e.childNodes[0].nodeType === 3) ? e.childNodes[0].textContent.trim() : ''; if (/Records de l|Tendance mensuelle|Volume hebdo|Choisis un exercice/.test(tx)) { const r = e.getBoundingClientRect(); out.push(tx.slice(0, 30) + ' h=' + Math.round(r.height) + ' vis=' + (e.offsetParent !== null)); } }); return out; });
console.log(vis.join(' || '));
const H = await pg.evaluate(() => document.documentElement.scrollHeight); await pg.setViewportSize({ width: 390, height: Math.min(H, 6000) }); await pg.waitForTimeout(300);
await pg.screenshot({ path: ROOT + '/.work/shots/prog-smith.png' });
const t2 = await pg.evaluate(() => document.getElementById('ma-muscu-detail').innerText); const k = t2.toLowerCase().indexOf('pourquoi'); console.log('DIAG', k >= 0 ? t2.slice(Math.max(0, k - 300), k + 1000) : 'pas de carte Pourquoi');
await b.close(); srv.close();
