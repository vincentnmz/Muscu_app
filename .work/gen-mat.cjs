const fs=require('fs'),vm=require('vm');const SRC=fs.readFileSync('/home/user/Muscu_app/js/app.js','utf8');
const block=SRC.slice(SRC.indexOf('var _G2_BLOCKS'),SRC.indexOf('// ── Modal onboarding (3 étapes) ──'));
const sb={};vm.createContext(sb);vm.runInContext(block+'\nthis.gen=_genProgramme2;this.vol=_g2VolLignes;this.mus=_g2Mus;',sb);
const db=JSON.parse(fs.readFileSync('/home/user/Muscu_app/.work/audit/db_v7.json'));
const CAT=db.exercices.map(e=>({exercice:e.exercice||e.nom,muscle:e.muscle,muscle_secondaire:e.muscle_secondaire}));
const G=['Pectoraux','Dos','Quadriceps','Fessier','Ischio'],P=['Epaule','Biceps','Triceps','Mollets'];
const TT={debutant:[[6,12],[6,12],[6,12]],intermediaire:[[10,16],[8,14],[6,12]],avance:[[12,20],[10,18],[8,14]]};
const mk=n=>{const T={};G.forEach(m=>T[sb.mus(m)]={min:TT[n][0][0],opt:TT[n][0][1]});P.forEach(m=>T[sb.mus(m)]={min:TT[n][1][0],opt:TT[n][1][1]});T[sb.mus('Abdominaux')]={min:TT[n][2][0],opt:TT[n][2][1]};return T};
for(const niv of ['debutant','intermediaire','avance']){const T=mk(niv);
 const combos= niv==='debutant'?[['fb',2,75],['fb',3,75],['ppl',3,75],['ul',4,75],['split',5,75]]:[['fb',3,60],['fb',3,90],['ul',4,60],['ul',4,90],['ppl',3,60],['ppl',6,60],['split',5,60],['split',5,90]];
 for(const [o,j,t] of combos){const L=sb.gen('masse',o,j,t,niv,{targets:T,cat:CAT});const V=sb.vol(L,CAT);
  const sous=Object.keys(T).filter(m=>(V[m]||0)<T[m].min).map(m=>m+' '+(Math.round((V[m]||0)*10)/10)+'/'+T[m].min);
  console.log(niv.padEnd(13),(o+' '+j+'j '+t+'min').padEnd(16),sous.length?'SOUS: '+sous.join(', '):'ok');}}
