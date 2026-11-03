import fs from 'fs';
let src = fs.readFileSync(new URL('./c1.mjs', import.meta.url), 'utf8');
src = src.slice(0, src.indexOf("if(process.env.W)"));
src += `
await pg.evaluate(()=>ouvrirAthleteDepuisSelect('0')); await pg.waitForTimeout(3500);
await pg.evaluate(()=>switchCoachDetailTab('prog')); await pg.waitForTimeout(1500);
const dump = async (name, fn) => {
  await pg.evaluate(fn); await pg.waitForTimeout(900);
  const H = await pg.evaluate(()=>document.documentElement.scrollHeight);
  await pg.setViewportSize({width:390,height:Math.min(H,6000)}); await pg.waitForTimeout(300);
  await pg.screenshot({path:ROOT+'/.work/shots/prog-'+name+'.png'});
  const t = await pg.evaluate(()=>document.getElementById('cdtab-prog').innerText);
  fs.writeFileSync(ROOT+'/.work/shots/prog-'+name+'.txt', t);
  const tu = t.split('\\n').filter(l=>/\\b(tu|ta|ton|tes|toi|te|t'|ton|vise|choisis)\\b/i.test(l)).slice(0,40);
  console.log('== '+name+' ('+t.length+' car.) — lignes adressées à l\\'athlète : '+tu.length+'\\n  '+tu.join('\\n  ').slice(0,2500));
  await pg.setViewportSize({width:390,height:844});
};
await dump('resume', ()=>{ maSetDisc('muscu'); maSetTab('resume'); });
await dump('evolution', ()=>{ maSetTab('detail'); });
await dump('tendances', ()=>{ maSetTab('tendances'); });
await dump('cardio', ()=>{ maSetDisc('cardio'); });
await dump('croise', ()=>{ maSetDisc('croise'); });
await b.close(); srv.close();`;
fs.writeFileSync(new URL('./c7run.mjs', import.meta.url), src);
