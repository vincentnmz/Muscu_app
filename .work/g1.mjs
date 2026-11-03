import { open } from './harness.mjs'; import fs from 'fs';
const data = JSON.parse(fs.readFileSync(new URL('./audit/out_aliz.json', import.meta.url)));
const { pg, close } = await open({ programme: [], onboarding_vu: true, tourVu: true }, { width: 390, height: 844 });
await pg.evaluate((d) => { athlete.nom = 'Alizé'; _onbChecked = true; _etatAutoChecked = true; _appliquerAppData(d); try{_etatSkip()}catch(e){} }, data);
for (const niv of ['debutant','intermediaire']) {
  await pg.evaluate((n)=>{ ouvrirGenProgramme(); _genState.niv=n; _genRender(); }, niv); await pg.waitForTimeout(700);
  const H = await pg.evaluate(()=>document.getElementById('gen-prog-overlay').scrollHeight);
  await pg.setViewportSize({width:390,height:Math.min(H,3200)}); await pg.waitForTimeout(300);
  await pg.screenshot({ path: '/home/user/Muscu_app/.work/shots/gen-'+niv+'.png' });
  console.log(niv, await pg.evaluate(()=>document.getElementById('gen-prog-sheet').innerText.slice(0,1500)));
  await pg.evaluate(()=>fermerGenProgramme()); await pg.setViewportSize({width:390,height:844});
}
await close();
