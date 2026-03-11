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

async function openWorkflowInspector(page: Page) {
  await page.goto(WORKFLOW);
  await page
    .locator('.svelte-flow__node')
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByText('run-workflow-demo').click();
  await expect(page.getByRole('heading', { name: 'Run Workflow' })).toBeVisible(
    { timeout: 5_000 },
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Run Workflow editor', () => {
  test('selecting a run-workflow node shows the inspector with correct title', async ({
    page,
  }) => {
    await openWorkflowInspector(page);

    await expect(page.getByLabel('Workflow name')).toBeVisible();
    await expect(page.getByLabel('Workflow name')).toHaveValue(
      'child-workflow',
    );
    await expect(page.getByLabel('Namespace')).toHaveValue('default');
    await expect(page.getByLabel('Version')).toHaveValue('0.0.1');
  });

  test('workflow name change persists across reload', async ({ page }) => {
    await openWorkflowInspector(page);

    const nameInput = page.getByLabel('Workflow name');
    await nameInput.fill('updated-workflow');

    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });

    await page.reload();
    await page
      .locator('.svelte-flow__node')
      .first()
      .waitFor({ state: 'visible', timeout: 10_000 });

    await expect(page.getByLabel('Workflow name')).toHaveValue(
      'updated-workflow',
      { timeout: 5_000 },
    );

    // Restore original value.
    await page.getByLabel('Workflow name').fill('child-workflow');
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });
  });

  test('empty workflow name shows inline error', async ({ page }) => {
    await openWorkflowInspector(page);

    const nameInput = page.getByLabel('Workflow name');
    await nameInput.fill('');

    await expect(page.getByText('Workflow name is required')).toBeVisible();
    await expect(nameInput).toBeEnabled();

    // Restore original value.
    await nameInput.fill('child-workflow');
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });
  });

  test('exported YAML contains run: workflow with correct shape', async ({
    page,
  }) => {
    await openWorkflowInspector(page);

    await page.getByRole('button', { name: 'Export YAML' }).click();
    const exportCode = page.locator('.export-code');
    await expect(exportCode).toBeVisible();
    const yamlText = await exportCode.textContent();

    expect(yamlText).toContain('workflow:');
    expect(yamlText).toContain('name: child-workflow');
    expect(yamlText).toContain('namespace: default');
    expect(yamlText).toContain('version: 0.0.1');

    await page.getByRole('button', { name: 'Close' }).click();
  });

  test('unchecking await shows help text', async ({ page }) => {
    await openWorkflowInspector(page);

    const awaitCheckbox = page.getByLabel('Await result');
    await awaitCheckbox.uncheck();

    await expect(
      page.getByText(
        'When disabled, the child workflow starts and the parent continues immediately',
      ),
    ).toBeVisible();

    // Restore: check it again.
    await awaitCheckbox.check();
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });
  });
});
