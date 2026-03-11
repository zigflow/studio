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

async function openScriptInspector(page: Page) {
  await page.goto(WORKFLOW);
  await page
    .locator('.svelte-flow__node')
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByText('run-script-demo').click();
  await expect(page.getByRole('heading', { name: 'Run Script' })).toBeVisible({
    timeout: 5_000,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Run Script editor', () => {
  test('selecting a run-script node shows the inspector with correct title', async ({
    page,
  }) => {
    await openScriptInspector(page);

    await expect(page.getByLabel('Language')).toBeVisible();
    await expect(page.getByLabel('Inline code')).toBeVisible();
  });

  test('shows await-locked note', async ({ page }) => {
    await openScriptInspector(page);

    await expect(
      page.getByText('Scripts always await completion.'),
    ).toBeVisible();
  });

  test('code change persists across reload', async ({ page }) => {
    await openScriptInspector(page);

    const codeArea = page.getByLabel('Inline code');
    await codeArea.fill('console.log("updated");');

    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });

    await page.reload();
    await page
      .locator('.svelte-flow__node')
      .first()
      .waitFor({ state: 'visible', timeout: 10_000 });

    await expect(page.getByLabel('Inline code')).toHaveValue(
      'console.log("updated");',
      { timeout: 5_000 },
    );

    // Restore original value.
    await page
      .getByLabel('Inline code')
      .fill("console.log('hello from script');\n");
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });
  });

  test('empty code shows inline error', async ({ page }) => {
    await openScriptInspector(page);

    const codeArea = page.getByLabel('Inline code');
    await codeArea.fill('');

    await expect(page.getByText('Code is required')).toBeVisible();
    await expect(codeArea).toBeEnabled();

    // Restore original value.
    await codeArea.fill("console.log('hello from script');\n");
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });
  });

  test('exported YAML contains run: script with correct shape', async ({
    page,
  }) => {
    await openScriptInspector(page);

    await page.getByRole('button', { name: 'Export YAML' }).click();
    const exportCode = page.locator('.export-code');
    await expect(exportCode).toBeVisible();
    const yamlText = await exportCode.textContent();

    expect(yamlText).toContain('script:');
    expect(yamlText).toContain('language: js');

    await page.getByRole('button', { name: 'Close' }).click();
  });
});
