import fs from 'fs';
let src = fs.readFileSync(new URL('./c1.mjs', import.meta.url), 'utf8');
src = src.slice(0, src.indexOf("if(process.env.W)"));
src += `
await pg.evaluate(()=>ouvrirAthleteDepuisSelect('0')); await pg.waitForTimeout(3500);
console.log('cartes avant', await pg.evaluate(()=>document.querySelectorAll('#cd-decider-diags > .dash-card').length));
await pg.evaluate(()=>{ [...document.querySelectorAll('#cd-decider-diags button')].find(b=>/Marquer traité/.test(b.textContent)).click(); }); await pg.waitForTimeout(300);
console.log('cartes après traité', await pg.evaluate(()=>document.querySelectorAll('#cd-decider-diags > .dash-card').length), await pg.evaluate(()=>document.getElementById('cd-decider-diags').innerText.slice(0,80)));
await pg.evaluate(()=>{ [...document.querySelectorAll('#cd-decider-diags button')].find(b=>/Écrire/.test(b.textContent)).click(); }); await pg.waitForTimeout(1500);
console.log('message', await pg.evaluate(()=>document.getElementById('cd-comment-input').value));
await b.close(); srv.close();`;
fs.writeFileSync(new URL('./c5run.mjs', import.meta.url), src);
