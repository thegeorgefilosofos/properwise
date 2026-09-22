import { chromium } from 'playwright-core';
const OUT = '/tmp/claude-0/-home-user-property/fe22d132-56da-5d8b-b87a-58829319f7e4/scratchpad';
const BASE = 'http://127.0.0.1:3312';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const [path, name] of [['/odigos','hub4'],['/odigos/kathari-apodosi-akinitou','guide4']]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1500 }, deviceScaleFactor: 2 });
  await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  await page.close();
  console.log('shot', name);
}
await browser.close(); console.log('done');
