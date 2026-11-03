import pw from '/opt/node22/lib/node_modules/playwright/index.js'; const { chromium } = pw;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 1000 }, deviceScaleFactor: 1.5 });
await p.goto('file:///home/user/Muscu_app/mockups/coach-aujourdhui-v2.html'); await p.waitForTimeout(1000);
const ph = await p.$$('.ph'); for (let i = 0; i < ph.length; i++) await ph[i].screenshot({ path: '/home/user/Muscu_app/mockups/coach-aujourdhui-v2-' + (i + 1) + '.png' });
await b.close();
