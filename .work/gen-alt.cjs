const fs=require('fs'),vm=require('vm');const SRC=fs.readFileSync('/home/user/Muscu_app/js/app.js','utf8');
const block=SRC.slice(SRC.indexOf('var _G2_BLOCKS'),SRC.indexOf('// ── Modal onboarding (3 étapes) ──'));
const sb={};vm.createContext(sb);vm.runInContext(block+'\nthis.gen=_genProgramme2;this.vol=_g2VolLignes;this.mus=_g2Mus;this.JL=_G2_JLOGIC;',sb);
const db=JSON.parse(fs.readFileSync('/home/user/Muscu_app/.work/audit/db_v7.json'));
const CAT=db.exercices.map(e=>({exercice:e.exercice||e.nom,muscle:e.muscle,muscle_secondaire:e.muscle_secondaire}));
const G=['Pectoraux','Dos','Quadriceps','Fessier','Ischio'],P=['Epaule','Biceps','Triceps','Mollets'];
const TT={debutant:[[6,12],[6,12],[6,12]],intermediaire:[[10,16],[8,14],[6,12]],avance:[[12,20],[10,18],[8,14]]};
const mk=(n,prio)=>{const T={};const s=(m,a)=>{let [mn,op]=a;if(prio&&prio.includes(m))mn=Math.round((mn+op)/2);T[sb.mus(m)]={min:mn,opt:op}};G.forEach(m=>s(m,TT[n][0]));P.forEach(m=>s(m,TT[n][1]));s('Abdominaux',TT[n][2]);return T};
const sous=(o,j,t,niv,prio)=>{const T=mk(niv,prio);const L=sb.gen('masse',o,j,t,niv,{targets:T,cat:CAT});const V=sb.vol(L,CAT);return Object.keys(T).filter(m=>(V[m]||0)<T[m].min).map(m=>m+' '+(Math.round((V[m]||0)*10)/10)+'/'+T[m].min)};
console.log('JL',JSON.stringify(sb.JL));
for(const [niv,o,j,t,prio] of [['debutant','fb',3,75,['Fessier']],['debutant','fb',2,75,['Fessier']],['intermediaire','ul',4,60,['Pectoraux']],['intermediaire','ul',4,60,null],['intermediaire','fb',3,60,['Fessier']]]){
 console.log(niv,o,j,t,prio,'→',sous(o,j,t,niv,prio).join(', ')||'ok');
 for(const [jj,tt] of [[j,75],[j,90],[j+1,t],[j+1,75],[j+1,90]]){ if(tt===t&&jj===j)continue; if(!(sb.JL[o]||[]).includes(jj))continue; console.log('   ',jj+'j',tt+'min','→',sous(o,jj,tt,niv,prio).join(', ')||'OK');}}
const show=(o,j,t,niv,prio)=>{const T=mk(niv,prio);const L=sb.gen('masse',o,j,t,niv,{targets:T,cat:CAT});const V=sb.vol(L,CAT);const S={};L.forEach(l=>{(S[l.seance_id]=S[l.seance_id]||[]).push(l.exercice+(l.series_prevues!=3?'×'+l.series_prevues:''))});
 console.log('\n'+niv,o,j,t,prio);console.log(Object.keys(T).map(m=>m+' '+(Math.round((V[m]||0)*10)/10)+' ('+T[m].min+'-'+T[m].opt+')').join(' | '));console.log(JSON.stringify(S));};
show('fb',3,75,'debutant',['Fessier']); show('ul',4,60,'intermediaire',['Pectoraux']); show('ul',4,75,'intermediaire',['Pectoraux']);
