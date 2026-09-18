import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

async function signIn(page: Page, username: string) {
  await page.goto('/');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill('Test-only-password-2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A little care.' })).toBeVisible();
}
async function sync(page: Page) {
  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByRole('button', { name: 'Sync now' }).click();
  await expect(page.getByText('Waiting to sync').locator('..').getByText('0', { exact: true })).toBeVisible();
}

test('field inference, offline care, supervisor review, return sync and outcome export', async ({ browser }) => {
  const fieldContext = await browser.newContext({ baseURL: 'http://127.0.0.1:8793' });
  const officerContext = await browser.newContext({ baseURL: 'http://127.0.0.1:8793' });
  const field = await fieldContext.newPage();
  const officer = await officerContext.newPage();
  const errors: string[] = [];
  field.on('pageerror', e => errors.push(e.message));
  officer.on('pageerror', e => errors.push(e.message));
  try {
    await officer.clock.install();
    await signIn(officer, 'officer');
    await sync(officer);
    await officer.getByRole('button', { name: 'Batches', exact: true }).click();
    await signIn(field, 'alice');
    await field.goto('/?deep=1');
    await field.getByLabel('Upload image for backend inference').setInputFiles('artifacts/larval-heldout-parity.png');
    await expect(field.getByText('Executed on: backend')).toBeVisible();
    await field.getByRole('button', { name: 'Use this result in a batch assessment' }).click();
    await field.getByRole('button', { name: 'Add a new batch' }).click();
    await field.getByLabel('Batch name').fill('Complete account workflow');
    await field.getByLabel('Farm code').selectOption('F-A');
    await field.getByLabel('Shed code').fill('S-E2E');
    await field.getByLabel('Larvae brushed (optional)').fill('100');
    await field.getByRole('button', { name: 'Save batch', exact: true }).click();
    await fieldContext.setOffline(true);
    await field.getByLabel('Current instar').selectOption('V');
    await field.getByLabel('Temperature (°C)').fill('29');
    await field.getByLabel('Relative humidity (%)').fill('85');
    await field.getByLabel('Unusual deaths').check();
    await field.getByLabel('Mulberry leaf photo', {exact:true}).setInputFiles('artifacts/mulberry-heldout-parity.png');
    await field.getByLabel('I confirm this is a mulberry leaf from this batch’s feed').check();
    await field.getByRole('button', { name: 'Save & assess' }).click();
    await expect(field.getByRole('heading', { name: 'What can I do next?' })).toBeVisible();
    await field.getByRole('button', { name: 'Open batch & record action' }).click();
    await field.getByRole('tab', { name: 'Care log' }).click();
    await field.getByRole('button', { name: 'Record action', exact: true }).click();
    await field.getByLabel('Action taken or planned').fill('Ventilation checked with officer');
    await field.getByRole('button', { name: 'Save action', exact: true }).click();
    await fieldContext.setOffline(false);
    await sync(field);
    // An already-open supervisor receives new field work without manual refresh.
    await officer.clock.fastForward(16_000);
    await expect(officer.getByRole('button', { name: /Complete account workflow/ })).toBeVisible();
    await officer.getByRole('button', { name: /Complete account workflow/ }).click();
    await officer.getByRole('tab', { name: 'Reviews', exact: true }).click();
    await officer.getByLabel('Reviewer code').fill('OFFICER');
    await officer.getByLabel('Review evidence or correction').fill('Rechecked ventilation; monitor this tray.');
    await officer.getByRole('button', { name: 'Save review', exact: true }).click();
    await officer.getByRole('tab', { name: 'Follow-ups', exact: true }).click();
    await officer.getByRole('button', { name: 'Update follow-up' }).click();
    await officer.getByLabel('Follow-up status').selectOption('acknowledged');
    await officer.getByLabel('Responsible staff code').fill('OFFICER');
    await officer.getByLabel('Follow-up evidence and next step').fill('Review completed; continue observation.');
    await officer.getByRole('button', { name: 'Save follow-up' }).click();
    await sync(officer);
    await field.getByRole('button', { name: 'Batches', exact: true }).click();
    await field.getByRole('button', { name: /Complete account workflow/ }).click();
    await field.getByRole('tab', { name: 'Reviews', exact: true }).click();
    await field.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(field.getByText('Rechecked ventilation; monitor this tray.', { exact: true })).toBeVisible();
    await expect(field.getByText('A supervisor account is required to submit reviews.')).toBeVisible();
    await field.getByRole('tab', { name: 'Follow-ups', exact: true }).click();
    await expect(field.locator('.alert-entry .badge')).toHaveText('Acknowledged');
    await field.getByRole('tab', { name: 'Outcomes', exact: true }).click();
    await field.getByRole('button', { name: 'Record outcome', exact: true }).click();
    await field.getByLabel('Count scope').selectOption('whole-cycle');
    await field.getByLabel('Cocoons harvested').fill('80');
    await field.getByLabel('Total deaths recorded').fill('20');
    await field.getByRole('button', { name: 'Save outcome', exact: true }).click();
    await expect(field.getByText('80.0%')).toBeVisible();
    await sync(field);
    const downloadPromise = field.waitForEvent('download');
    await field.getByRole('button', { name: 'Export', exact: true }).click();
    const exported = JSON.parse(readFileSync((await (await downloadPromise).path())!, 'utf8'));
    const batch = exported.events.find((e: any) => e.kind === 'batch' && e.payload.name === 'Complete account workflow');
    const events = exported.events.filter((e: any) => e.payload.batchId === batch.payload.id);
    expect(events.map((e: any) => e.kind).sort()).toEqual(['assessment', 'followup', 'intervention', 'outcome', 'review']);
    const assessment = events.find((e: any) => e.kind === 'assessment').payload;
    expect(assessment.visual.larval.execution).toBe('backend');
    expect(assessment.visual.leaf.confirmedMulberry).toBe(true);
    expect(assessment.visual.leaf.mediaId).toBeTruthy();
    expect(assessment.visual.leaf.scores).toHaveLength(3);
    expect(errors).toEqual([]);
  } finally {
    await fieldContext.close();
    await officerContext.close();
  }
});

test('queued work retries after a server outage without a browser network toggle', async ({ page }) => {
  await page.clock.install();
  await signIn(page, 'alice');
  await sync(page);
  await page.route('**/api/sync', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary outage' }) }));
  await page.getByRole('button', { name: 'Batches', exact: true }).click();
  await page.getByRole('button', { name: 'Add batch', exact: true }).click();
  await page.getByLabel('Batch name').fill('Recovered after local server restart');
  await page.getByLabel('Farm code').selectOption('F-A');
  await page.getByLabel('Shed code').fill('S-RECOVERY');
  await page.getByRole('button', { name: 'Save batch', exact: true }).click();
  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByRole('button', { name: 'Sync now' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Sync failed (503)' }).first()).toBeVisible();
  await expect(page.getByText('Waiting to sync').locator('..').getByText('1', { exact: true })).toBeVisible();
  // Consume the pending-write debounce while the server is still unavailable.
  await page.clock.fastForward(2_000);
  await expect(page.getByRole('button', { name: 'Sync now' })).toBeEnabled();
  await page.unroute('**/api/sync');
  await page.clock.fastForward(16_000);
  await expect(page.getByText('Waiting to sync').locator('..').getByText('0', { exact: true })).toBeVisible();
  const response = await page.request.post('/api/sync', { data: { events: [], cursor: 0 } });
  expect((await response.json()).events.some((e: any) => e.payload.name === 'Recovered after local server restart')).toBe(true);
});
