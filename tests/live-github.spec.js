import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

test.skip(!process.env.LIVE_GITHUB, 'Set LIVE_GITHUB=1 to run live GitHub smoke checks');

const scriptPath = new URL('../github-sortout.user.js', import.meta.url);

async function installScript(page) {
  const script = await readFile(scriptPath, 'utf8');

  await page.evaluate((source) => {
    window.GM_addStyle = (css) => {
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
    };

    eval(source);
  }, script);
}

for (const url of [
  'https://github.com/microsoft/playwright/issues/40889',
  'https://github.com/microsoft/playwright/pull/40866',
]) {
  test(`shows sort bar on ${url}`, async ({ page }) => {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    await installScript(page);
    await expect(page.locator('#ghs-sort-bar')).toBeVisible();
  });
}
