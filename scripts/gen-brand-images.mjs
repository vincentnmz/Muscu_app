// Génère assets/mail-header.png (en-tête des mails) et .work/play-icon-512.png (icône Play Store) depuis les SVG de assets/logo.
import pw from '/opt/node22/lib/node_modules/playwright/index.js'; const {chromium}=pw; import fs from 'fs';
const svg=f=>'data:image/svg+xml;base64,'+fs.readFileSync('assets/logo/'+f).toString('base64');
// Motif nid d'abeille (hexagones « pointe en haut », traits bleus fins)
const hexPat=(op)=>{const r=26,w=Math.sqrt(3)*r,h=3*r;const hx=(cx,cy)=>{let p=[];for(let i=0;i<6;i++){const a=Math.PI/180*(60*i-90);p.push((cx+r*Math.cos(a)).toFixed(1)+','+(cy+r*Math.sin(a)).toFixed(1));}return `<polygon points="${p.join(' ')}"/>`;};
 return `<svg xmlns='http://www.w3.org/2000/svg' width='${w.toFixed(1)}' height='${h}'><g fill='none' stroke='#1A5FFF' stroke-opacity='${op}' stroke-width='1.4'>${hx(w/2,r)}${hx(0,2.5*r)}${hx(w,2.5*r)}${hx(w/2,4*r)}${hx(0,-0.5*r)}${hx(w,-0.5*r)}</g></svg>`;};
const pat=op=>"url('data:image/svg+xml;base64,"+Buffer.from(hexPat(op)).toString('base64')+"')";
const wm='data:image/svg+xml;base64,'+Buffer.from(fs.readFileSync('assets/logo/novalyz-tagline.svg','utf8').replace(/#070B14/g,'#FFFFFF')).toString('base64');
const font=`<link href="https://fonts.googleapis.com/css2?family=Michroma&family=Quicksand:wght@500;700&display=swap" rel="stylesheet">`;
const b=await chromium.launch();
// 1) Bandeau d'en-tête mail (PNG 1200x400, affiché à 600x200)
let p=await b.newPage({viewport:{width:1200,height:400}});
await p.setContent(`${font}<body style="margin:0"><div style="width:1200px;height:400px;background:radial-gradient(ellipse at 50% 45%,#13204a 0%,#0a1020 55%,#070B14 100%);position:relative;overflow:hidden">
<div style="position:absolute;inset:0;background-image:${pat(.5)};background-size:auto;-webkit-mask-image:radial-gradient(ellipse at 50% 50%,rgba(0,0,0,.5) 0%,#000 70%);mask-image:radial-gradient(ellipse at 50% 50%,rgba(0,0,0,.5) 0%,#000 70%)"></div>
<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><div style="background:#000;border-radius:28px;padding:34px 56px;display:flex;flex-direction:column;align-items:center;gap:26px;box-shadow:0 0 0 1px rgba(26,95,255,.35),0 10px 40px rgba(0,0,0,.6)">
<img src="${svg('logo-blanc-bleu.svg')}" style="height:135px;">
<img src="${wm}" style="width:480px"></div></div></div></body>`);
await p.waitForTimeout(1200); await p.screenshot({path:'assets/mail-header.png'});
// 2) Icône Play Store 512x512 plein cadre (Google applique lui-même l'arrondi)
p=await b.newPage({viewport:{width:512,height:512}});
await p.setContent(`<body style="margin:0"><div style="width:512px;height:512px;background:#070B14;display:grid;place-items:center"><img src="${svg('logo-blanc-bleu.svg')}" style="height:330px"></div></body>`);
await p.waitForTimeout(300); await p.screenshot({path:'.work/play-icon-512.png'});
await b.close();
