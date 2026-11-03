import pw from '/opt/node22/lib/node_modules/playwright/index.js'; const { chromium } = pw;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1.5 });
await p.goto('file:///home/user/Muscu_app/mockups/coach-equipe-v2.html'); await p.waitForTimeout(1000);
await (await p.$('.ph')).screenshot({ path: '/home/user/Muscu_app/mockups/coach-equipe-v2-mobile.png' });
await (await p.$('.desk')).screenshot({ path: '/home/user/Muscu_app/mockups/coach-equipe-v2-desk.png' });
await b.close();
