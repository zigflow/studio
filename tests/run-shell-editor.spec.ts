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

async function openShellInspector(page: Page) {
  await page.goto(WORKFLOW);
  await page
    .locator('.svelte-flow__node')
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByText('run-shell-demo').click();
  await expect(page.getByRole('heading', { name: 'Run Shell' })).toBeVisible({
    timeout: 5_000,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Run Shell editor', () => {
  test('selecting a run-shell node shows the inspector with correct title', async ({
    page,
  }) => {
    await openShellInspector(page);

    await expect(page.getByLabel('Command')).toBeVisible();
    await expect(page.getByLabel('Command')).toHaveValue('echo hello');
  });

  test('command change persists across reload', async ({ page }) => {
    await openShellInspector(page);

    const commandInput = page.getByLabel('Command');
    await commandInput.fill('ls -la');

    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });

    await page.reload();
    await page
      .locator('.svelte-flow__node')
      .first()
      .waitFor({ state: 'visible', timeout: 10_000 });

    await expect(page.getByLabel('Command')).toHaveValue('ls -la', {
      timeout: 5_000,
    });

    // Restore original value.
    await page.getByLabel('Command').fill('echo hello');
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });
  });

  test('empty command shows inline error', async ({ page }) => {
    await openShellInspector(page);

    const commandInput = page.getByLabel('Command');
    await commandInput.fill('');

    await expect(page.getByText('Command is required')).toBeVisible();
    await expect(commandInput).toBeEnabled();

    // Restore original value.
    await commandInput.fill('echo hello');
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });
  });

  test('exported YAML contains run: shell with correct shape', async ({
    page,
  }) => {
    await openShellInspector(page);

    await page.getByRole('button', { name: 'Export YAML' }).click();
    const exportCode = page.locator('.export-code');
    await expect(exportCode).toBeVisible();
    const yamlText = await exportCode.textContent();

    expect(yamlText).toContain('shell:');
    expect(yamlText).toContain('command: echo hello');

    await page.getByRole('button', { name: 'Close' }).click();
  });

  test('can add and remove arguments', async ({ page }) => {
    await openShellInspector(page);

    await page.getByRole('button', { name: '+ Add argument' }).first().click();
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });

    // Remove the newly added argument.
    const removeButtons = page.getByLabel('Remove argument');
    await removeButtons.last().click();
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });
  });
});
