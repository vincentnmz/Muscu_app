// RÉFÉRENCE VALIDÉE (13/11/2026) — implémentation utilisée pour les simulations de docs/sommeil-performance-methode.md. NE PAS MODIFIER : sert à vérifier que js/sommeil-perf.js donne exactement les mêmes résultats.
const TC=[0,12.706,4.303,3.182,2.776,2.571,2.447,2.365,2.306,2.262,2.228,2.201,2.179,2.160,2.145,2.131,2.120,2.110,2.101,2.093,2.086,2.080,2.074,2.069,2.064,2.060,2.056,2.052,2.048,2.045,2.042];
const tcrit=df=>{const k=Math.floor(df);return k<1?TC[1]:k<=30?TC[k]:1.96};
const DAY=864e5, T=i=>typeof i==='number'?i:new Date(i+'T12:00:00').getTime();
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length, med=a=>{a=a.slice().sort((x,y)=>x-y);const k=a.length>>1;return a.length%2?a[k]:(a[k-1]+a[k])/2};
const v=a=>{const m=mean(a);return a.reduce((x,y)=>x+(y-m)**2,0)/(a.length-1)};
// perf: [{d (jour entier), e, f}] ; nuits: {jour: minutes}
function scores(perf){const byE={};perf.forEach(p=>(byE[p.e]=byE[p.e]||[]).push(p));const sc={};
  Object.values(byE).forEach(pts=>pts.forEach(p=>{const ref=pts.filter(q=>q.d!==p.d&&Math.abs(q.d-p.d)<=28);if(ref.length<2)return;const m=mean(ref.map(q=>q.f));(sc[p.d]=sc[p.d]||[]).push((p.f-m)/m*100)}));
  const out={};Object.keys(sc).forEach(d=>out[d]=med(sc[d]));return out}
function delta(ep,no){return mean(no)-mean(ep)}
function methode(perf,nuits){
  const sc=scores(perf);const P=Object.keys(sc).map(Number).filter(d=>nuits[d]>=180).sort((a,b)=>a-b);
  const court=P.filter(d=>nuits[d]<420), norm=P.filter(d=>nuits[d]>=420);
  const eps=[];court.forEach(d=>{const l=eps[eps.length-1];if(l&&d-l[l.length-1]<=2)l.push(d);else eps.push([d])});
  const N=P.length,K=eps.length,M=norm.length;
  if(N<20||K<5||M<5)return{v:'apprentissage',N,K,M};
  const se=eps.map(e=>mean(e.map(d=>sc[d]))), sn=norm.map(d=>sc[d]);
  const D=delta(se,sn), a=v(se)/K, b=v(sn)/M, SE=Math.sqrt(a+b), df=(a+b)**2/(a*a/(K-1)+b*b/(M-1)), tc=tcrit(df);
  const sig=Math.abs(D/SE)>=tc;
  let rob=true;for(let i=0;i<K&&rob;i++){const d2=delta(se.filter((_,j)=>j!==i),sn);if(Math.sign(d2)!==Math.sign(D))rob=false}
  for(let i=0;i<M&&rob;i++){const d2=delta(se,sn.filter((_,j)=>j!==i));if(Math.sign(d2)!==Math.sign(D))rob=false}
  const Y=Math.ceil((tc+0.84)*SE);
  return{v:sig&&rob?'net':'pas_net',D,SE,df,Y,N,K,M,sig,rob};
}
function texte(r){if(r.v==='apprentissage')return 'En apprentissage : '+Math.min(r.N,20)+'/20 séances · '+Math.min(r.K,5)+'/5 épisodes de nuits courtes · '+Math.min(r.M,5)+'/5 séances après nuit normale.';
  const ass=' Association observée, pas une preuve de cause.';
  if(r.v==='net'){const X=Math.abs(r.D)<1?'0,5':String(Math.round(Math.abs(r.D)));return 'Après tes nuits de moins de 7 h, ta force estimée est en moyenne '+X+' % '+(r.D>0?'sous':'au-dessus de')+' ton niveau du moment ('+r.K+' épisodes, '+r.M+' séances après nuit normale).'+ass}
  return 'Pas d\'écart net entre tes nuits de moins de 7 h et les autres. Un écart de moins de '+r.Y+' % ne serait pas détectable avec tes données.'+ass}
module.exports={methode,texte,scores,mean,med,v,DAY,T};
