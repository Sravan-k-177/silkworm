import { chromium, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/home/sravan/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
  headless: true,
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:8787/');
  await expect(page.getByRole('heading', { name: 'A little care.' })).toBeVisible();
  expect((await page.request.get(new URL('/api/health', page.url()).href)).ok()).toBe(true);
  expect((await page.request.get(new URL('/api/model/health', page.url()).href)).ok()).toBe(true);

  // Read the local credential without putting it in console output or evidence files.
  const access = readFileSync('.data/accounts-local/ACCESS.txt', 'utf8');
  const username = access.match(/^Username: (.+)$/m)?.[1];
  const password = access.match(/^Password: (.+)$/m)?.[1];
  if (!username || !password) throw new Error('Local account credentials are missing.');
  await page.goto('http://127.0.0.1:8790/');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A little care.' })).toBeVisible();
  expect((await page.request.get(new URL('/api/model/health', page.url()).href)).ok()).toBe(true);
  await page.goto('http://127.0.0.1:8790/?deep=1');
  await page.getByLabel('Upload image for backend inference').setInputFiles('artifacts/larval-heldout-parity.png');
  await expect(page.getByText('Executed on: backend')).toBeVisible();
  await page.goto('http://127.0.0.1:8790/');
  await page.getByRole('button', { name: 'Experimental feed-leaf check' }).click();
  await page.getByLabel('Run leaf model on').selectOption('backend');
  await page.getByLabel('Choose mulberry leaf photo').setInputFiles('tests/fixtures/mulberry-rust.png');
  await expect(page.getByText('Leaf model executed on: backend', { exact: true })).toBeVisible();
  await page.getByText('Inspect leaf execution evidence', { exact: true }).click();
  await expect(page.getByRole('table', { name: 'Measured leaf masking results' }).locator('tbody tr')).toHaveCount(16);
  await page.screenshot({path:'artifacts/leaf-execution-verified.png',fullPage:true});
  await page.getByLabel('Language / భాష').selectOption('te');
  await expect(page.locator('html')).toHaveAttribute('lang', 'te');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel('Language / భాష').selectOption('en');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to SilkSense' })).toBeVisible();
  expect((await page.request.post(new URL('/api/sync', page.url()).href, { data: { events: [], cursor: 0 } })).status()).toBe(401);
  expect(errors).toEqual([]);
  writeFileSync('artifacts/local-deployment-verification.json', JSON.stringify({
    checkedAt: new Date().toISOString(), demo: 'http://127.0.0.1:8787/', accounts: 'http://127.0.0.1:8790/',
    login: true, telugu: true, mobileOverflow: false, authenticatedModelHealth: true,
    authenticatedInference: true, authenticatedLeafInference: true, logoutDeniesSync: true, browserErrors: errors, publicDeployment: false,
  }, null, 2) + '\n');
  console.log('Local app, account login, neural inference, Telugu layout and logout verified.');
} finally {
  await browser.close();
}
