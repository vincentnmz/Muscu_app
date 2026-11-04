const fs=require('fs'),path=require('path'),vm=require('vm');const {stripTypeScriptTypes}=require('node:module');
const ROOT='/home/user/Muscu_app';
const T=fs.readFileSync(ROOT+'/tests/e2e-parcours.test.js','utf8');
const mk=T.slice(T.indexOf('function makeEngine'),T.indexOf('// ── Chargement du VRAI backend'));
eval(mk);
const store=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
let js=stripTypeScriptTypes(fs.readFileSync(ROOT+'/supabase/functions/handler/index.ts','utf8')).split('\n').filter(l=>!/^import\s/.test(l)).join('\n');
js+='\n;this.__api={handleGetAppData,handleGetSeancesDetail};';
const client=makeEngine(store);
const sb={createClient:()=>client,webpush:{setVapidDetails(){},sendNotification:async()=>{}},Deno:{env:{get:()=>'x'},serve:()=>{}},Response,Request,URLSearchParams,TextEncoder,TextDecoder,crypto,console,setTimeout,clearTimeout,fetch:async()=>({ok:false,status:0,text:async()=>'',json:async()=>({})})};
if(process.argv[5]){const F=new Date(process.argv[5]).getTime();const RD=Date;class FD extends RD{constructor(...a){if(a.length)super(...a);else super(F)}static now(){return F}}sb.Date=FD;js='var Date=this.Date;\n'+js;}
vm.createContext(sb);vm.runInContext(js,sb);
(async()=>{const r=await sb.__api[process.argv[6]||'handleGetAppData'](new URLSearchParams({athlete_id:process.argv[3]}));const d=await r.json();fs.writeFileSync(process.argv[4],JSON.stringify(d,null,1));console.log(Object.keys(d).join(', '));})();
