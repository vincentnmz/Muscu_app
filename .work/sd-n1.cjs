const d=require('/home/user/Muscu_app/.work/audit/sd_vinc.json');const S=d.seances;
const t=x=>{const p=x.split('/');return new Date(+p[2],p[1]-1,+p[0]).getTime()};
S.sort((a,b)=>t(b.date)-t(a.date));
const best=e=>e.series.reduce((a,b)=>(b.charge>a.charge||(b.charge===a.charge&&b.reps>a.reps))?b:a,e.series[0]);
for (const s of S.slice(0,2)) { console.log('== '+s.date+' '+s.seance_id);
 for (const e of s.exos){ const b=best(e); let prev=null; for(const q of S){ if(t(q.date)>=t(s.date)) continue; const pe=q.exos.find(x=>x.exo===e.exo); if(pe){prev={d:q.date,b:best(pe)};break;} }
  console.log('  '+e.exo+' : '+e.series.map(x=>x.charge+'x'+x.reps+'@'+x.rpe).join(' ')+' | best '+b.charge+'x'+b.reps+(prev?' | prev '+prev.d+' '+prev.b.charge+'x'+prev.b.reps+'@'+prev.b.rpe:' | prev -')); } }
