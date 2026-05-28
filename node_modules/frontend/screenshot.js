const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText));
  await page.goto('http://localhost:3000/checkout/LNK-101', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const content = await page.textContent('body');
  console.log('BODY TEXT:', content?.slice(0, 500));
  await page.screenshot({ path: 'screenshot.png', fullPage: true });
  await browser.close();
})();
