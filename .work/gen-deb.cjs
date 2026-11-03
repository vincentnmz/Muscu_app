const fs=require('fs'),vm=require('vm');const SRC=fs.readFileSync('/home/user/Muscu_app/js/app.js','utf8');
const block=SRC.slice(SRC.indexOf('var _G2_BLOCKS'),SRC.indexOf('// ── Modal onboarding (3 étapes) ──'));
const sb={};vm.createContext(sb);vm.runInContext(block+'\nthis.gen=_genProgramme2;this.vol=_g2VolLignes;this.mus=_g2Mus;',sb);sb.P=[{org:'fb',jours:2,nm:'Full Body découverte 2j'},{org:'fb',jours:3,nm:'Full Body 3j'},{org:'ppl',jours:3,nm:'PPL 3j'},{org:'ul',jours:4,nm:'Upper/Lower 4j'},{org:'split',jours:5,nm:'Split 5j'}];
const db=JSON.parse(fs.readFileSync('/home/user/Muscu_app/.work/audit/db_v7.json'));
const CAT=db.exercices.map(e=>({exercice:e.exercice||e.nom,muscle:e.muscle,muscle_secondaire:e.muscle_secondaire}));
const T={};['Pectoraux','Dos','Epaule','Biceps','Triceps','Quadriceps','Ischio','Fessier','Mollets','Abdominaux'].forEach(m=>{T[sb.mus(m)]={min:6,opt:12}});
const order=['Pectoraux','Dos','Epaule','Biceps','Triceps','Quadriceps','Ischio','Fessier','Mollets','Abdominaux'];
console.log('Programme'.padEnd(26)+order.map(m=>m.slice(0,6).padStart(7)).join(''));
for(const p of sb.P){const L=sb.gen('masse',p.org,p.jours,75,'debutant',{targets:T,cat:CAT});const V=sb.vol(L,CAT);
 const n=new Set(L.map(l=>l.seance_id)).size;console.log((p.nm+' ('+n+' séances, '+L.length+' exos)').padEnd(26).slice(0,26)+order.map(m=>String(Math.round((V[m]||0)*10)/10).padStart(7)).join(''));}
console.log('séries/exo débutant:', [...new Set(sb.gen('masse','fb',3,75,'debutant',{targets:T,cat:CAT}).map(l=>l.series_prevues))]);
for(const p of sb.P){const L=sb.gen('masse',p.org,p.jours,75,'debutant',{targets:T,cat:CAT});const S={};L.forEach(l=>{(S[l.seance_id]=S[l.seance_id]||[]).push(l.exercice+'×'+l.series_prevues)});console.log(p.nm, JSON.stringify(Object.fromEntries(Object.entries(S).map(([k,v])=>[k,v.length+' exos, '+v.reduce((a,x)=>a+Number(x.split('×')[1]),0)+' séries']))));}
// intermédiaire inchangé ?
const Ti={};[['Pectoraux',10,16],['Dos',10,16],['Quadriceps',10,16],['Fessier',10,16],['Ischio',10,16],['Epaule',8,14],['Biceps',8,14],['Triceps',8,14],['Mollets',8,14],['Abdominaux',6,12]].forEach(([m,a,b])=>Ti[sb.mus(m)]={min:a,opt:b});
const Li=sb.gen('masse','ul',4,60,'intermediaire',{targets:Ti,cat:CAT});console.log('interm UL4 60', JSON.stringify(sb.vol(Li,CAT)));
