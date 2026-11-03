import pw from '/opt/node22/lib/node_modules/playwright/index.js'; const { chromium } = pw;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1.5 });
await p.goto('file:///home/user/Muscu_app/mockups/coach-fiche-v2.html'); await p.waitForTimeout(1000);
await (await p.$('.ph')).screenshot({ path: '/home/user/Muscu_app/mockups/coach-fiche-v2-vincent.png' });
const ph=await p.$$('.ph'); await ph[1].screenshot({path:'/home/user/Muscu_app/mockups/coach-fiche-v2-alize.png'}); await (await p.$('.desk')).screenshot({ path: '/home/user/Muscu_app/mockups/coach-fiche-v2-desk.png' });
await b.close();
