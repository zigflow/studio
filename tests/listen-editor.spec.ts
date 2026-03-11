/*
 * Copyright 2025 - 2026 Zigflow authors <https://github.com/zigflow/studio/graphs/contributors>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { type Page, expect, test } from '@playwright/test';

const WORKFLOW = '/workflows/demo-workflow.yaml';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function openListenInspector(page: Page) {
  await page.goto(WORKFLOW);
  await page
    .locator('.svelte-flow__node')
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByText('await-signal').click();
  await expect(page.getByRole('heading', { name: 'Listen' })).toBeVisible({
    timeout: 5_000,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Listen editor', () => {
  test('selecting a listen node shows Event ID and Type fields', async ({
    page,
  }) => {
    await openListenInspector(page);

    await expect(page.getByLabel('Event ID')).toBeVisible();
    await expect(page.getByLabel('Event ID')).toHaveValue('order-shipped');
    await expect(page.getByLabel('Type')).toBeVisible();
    await expect(page.getByLabel('Type')).toHaveValue('signal');
  });

  test('event ID change persists across reload', async ({ page }) => {
    await openListenInspector(page);

    await page.getByLabel('Event ID').fill('order-delivered');
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });

    await page.reload();
    await page
      .locator('.svelte-flow__node')
      .first()
      .waitFor({ state: 'visible', timeout: 10_000 });

    await expect(page.getByLabel('Event ID')).toHaveValue('order-delivered', {
      timeout: 5_000,
    });

    // Restore.
    await page.getByLabel('Event ID').fill('order-shipped');
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });
  });

  test('event type change persists across reload', async ({ page }) => {
    await openListenInspector(page);

    await page.getByLabel('Type').selectOption('query');
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });

    await page.reload();
    await page
      .locator('.svelte-flow__node')
      .first()
      .waitFor({ state: 'visible', timeout: 10_000 });

    await expect(page.getByLabel('Type')).toHaveValue('query', {
      timeout: 5_000,
    });

    // Restore.
    await page.getByLabel('Type').selectOption('signal');
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });
  });

  test('empty event ID shows inline validation error without blocking editing', async ({
    page,
  }) => {
    await openListenInspector(page);

    await page.getByLabel('Event ID').fill('');

    await expect(page.getByText('Event ID is required')).toBeVisible();
    await expect(page.getByLabel('Event ID')).toBeEnabled();

    // Restore.
    await page.getByLabel('Event ID').fill('order-shipped');
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });
  });

  test('exported YAML contains listen with correct shape', async ({ page }) => {
    await openListenInspector(page);

    await page.getByRole('button', { name: 'Export YAML' }).click();
    const exportCode = page.locator('.export-code');
    await expect(exportCode).toBeVisible();
    const yaml = await exportCode.textContent();

    expect(yaml).toContain('listen:');
    expect(yaml).toContain('order-shipped');
    expect(yaml).toContain('type: signal');

    await page.getByRole('button', { name: 'Close' }).click();
  });

  test('accept-if value persists across reload', async ({ page }) => {
    await openListenInspector(page);

    await page.getByLabel('Accept if').fill('${ $input.status == "ready" }');
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });

    await page.reload();
    await page
      .locator('.svelte-flow__node')
      .first()
      .waitFor({ state: 'visible', timeout: 10_000 });

    await expect(page.getByLabel('Accept if')).toHaveValue(
      '${ $input.status == "ready" }',
      { timeout: 5_000 },
    );

    // Restore.
    await page.getByLabel('Accept if').fill('');
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });
  });

  test('can add and remove data entries', async ({ page }) => {
    await openListenInspector(page);

    await page.getByRole('button', { name: '+ Add entry' }).click();
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });

    const keyInputs = page.getByLabel('Key');
    await expect(keyInputs).toHaveCount(1);

    await page.getByRole('button', { name: 'Remove entry' }).click();
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });

    await expect(page.getByLabel('Key')).toHaveCount(0);
  });
});
