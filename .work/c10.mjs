import fs from 'fs';
let src = fs.readFileSync(new URL('./c1.mjs', import.meta.url), 'utf8');
src = src.slice(0, src.indexOf("if(process.env.W)"));
src += fs.readFileSync(new URL('./c10tail.js', import.meta.url), 'utf8');
fs.writeFileSync(new URL('./c10run.mjs', import.meta.url), src);
