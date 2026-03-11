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

async function openFetchDataInspector(page: Page) {
  await page.goto(WORKFLOW);
  await page
    .locator('.svelte-flow__node')
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByText('fetch-data').click();
  // Wait until the Call HTTP section is visible.
  await expect(page.getByRole('heading', { name: 'Call HTTP' })).toBeVisible({
    timeout: 5_000,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Call HTTP editor', () => {
  test('selecting a call-http node shows the Call HTTP section', async ({
    page,
  }) => {
    await openFetchDataInspector(page);

    // Method dropdown is visible and defaults to GET.
    await expect(page.getByRole('combobox', { name: 'Method' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Method' })).toHaveValue(
      'get',
    );

    // URL input is visible and shows the configured endpoint.
    await expect(page.getByLabel('URL')).toBeVisible();
    await expect(page.getByLabel('URL')).toHaveValue('https://example.com/api');
  });

  test('method change persists across reload', async ({ page }) => {
    await openFetchDataInspector(page);

    const methodSelect = page.getByRole('combobox', { name: 'Method' });

    // Change method to POST.
    await methodSelect.selectOption('post');

    // Wait for auto-save.
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });

    // Reload — URL carries ?selected=... so the inspector reopens.
    await page.reload();
    await page
      .locator('.svelte-flow__node')
      .first()
      .waitFor({ state: 'visible', timeout: 10_000 });

    // Inspector should reopen on the same node.
    await expect(page.getByRole('combobox', { name: 'Method' })).toHaveValue(
      'post',
      { timeout: 5_000 },
    );

    // Restore GET so the workflow is left in a clean state.
    await page.getByRole('combobox', { name: 'Method' }).selectOption('get');
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });
  });

  test('clearing URL shows a validation error and does not update IR', async ({
    page,
  }) => {
    await openFetchDataInspector(page);

    const urlInput = page.getByLabel('URL');
    await urlInput.fill('');

    // Validation error must appear.
    await expect(page.getByText('URL is required')).toBeVisible();

    // Export YAML: the original endpoint must still be present.
    await page.getByRole('button', { name: 'Export YAML' }).click();
    const exportCode = page.locator('.export-code');
    await expect(exportCode).toBeVisible();
    const yaml = await exportCode.textContent();
    expect(yaml).toContain('example.com/api');
    await page.getByRole('button', { name: 'Close' }).click();
  });
});
