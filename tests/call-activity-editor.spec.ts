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

async function openActivityInspector(page: Page) {
  await page.goto(WORKFLOW);
  await page
    .locator('.svelte-flow__node')
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByText('run-activity').click();
  // Wait until the Call Activity section is visible.
  await expect(
    page.getByRole('heading', { name: 'Call Activity' }),
  ).toBeVisible({ timeout: 5_000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Call Activity editor', () => {
  test('selecting a call-activity node shows Activity name and Task queue inputs', async ({
    page,
  }) => {
    await openActivityInspector(page);

    // Activity name is visible and shows the configured value.
    await expect(page.getByLabel('Activity name')).toBeVisible();
    await expect(page.getByLabel('Activity name')).toHaveValue('ProcessOrder');

    // Task queue is visible and shows the configured value.
    await expect(page.getByLabel('Task queue')).toBeVisible();
    await expect(page.getByLabel('Task queue')).toHaveValue('order-processing');
  });

  test('activity name change persists across reload', async ({ page }) => {
    await openActivityInspector(page);

    const nameInput = page.getByLabel('Activity name');

    // Change activity name.
    await nameInput.fill('ShipOrder');

    // Wait for auto-save.
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });

    // Reload — URL carries ?selected=... so the inspector reopens.
    await page.reload();
    await page
      .locator('.svelte-flow__node')
      .first()
      .waitFor({ state: 'visible', timeout: 10_000 });

    // Inspector should reopen on the same node with the updated value.
    await expect(page.getByLabel('Activity name')).toHaveValue('ShipOrder', {
      timeout: 5_000,
    });

    // Restore original value so the workflow is left in a clean state.
    await page.getByLabel('Activity name').fill('ProcessOrder');
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });
  });

  test('task queue change persists across reload', async ({ page }) => {
    await openActivityInspector(page);

    const queueInput = page.getByLabel('Task queue');

    // Change task queue.
    await queueInput.fill('shipping-queue');

    // Wait for auto-save.
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });

    // Reload.
    await page.reload();
    await page
      .locator('.svelte-flow__node')
      .first()
      .waitFor({ state: 'visible', timeout: 10_000 });

    // Inspector should reopen with the updated task queue.
    await expect(page.getByLabel('Task queue')).toHaveValue('shipping-queue', {
      timeout: 5_000,
    });

    // Verify the exported YAML contains the new task queue.
    await page.getByRole('button', { name: 'Export YAML' }).click();
    const exportCode = page.locator('.export-code');
    await expect(exportCode).toBeVisible();
    const yaml = await exportCode.textContent();
    expect(yaml).toContain('shipping-queue');
    await page.getByRole('button', { name: 'Close' }).click();

    // Restore original value.
    await page.getByLabel('Task queue').fill('order-processing');
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });
  });

  test('empty activity name shows inline warning without blocking editing', async ({
    page,
  }) => {
    await openActivityInspector(page);

    const nameInput = page.getByLabel('Activity name');

    // Clear the activity name.
    await nameInput.fill('');

    // Warning should appear.
    await expect(page.getByText('Activity name is required')).toBeVisible();

    // The field should still be editable (not disabled).
    await expect(nameInput).toBeEnabled();

    // Restore original value.
    await nameInput.fill('ProcessOrder');
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });
  });

  test('empty task queue shows inline warning', async ({ page }) => {
    await openActivityInspector(page);

    const queueInput = page.getByLabel('Task queue');

    // Clear the task queue.
    await queueInput.fill('');

    // Warning should appear.
    await expect(page.getByText('Task queue is required')).toBeVisible();

    // Restore original value.
    await queueInput.fill('order-processing');
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });
  });

  test('exported YAML contains call: activity with correct shape', async ({
    page,
  }) => {
    await openActivityInspector(page);

    await page.getByRole('button', { name: 'Export YAML' }).click();
    const exportCode = page.locator('.export-code');
    await expect(exportCode).toBeVisible();
    const yaml = await exportCode.textContent();

    // Must use call: activity discriminator.
    expect(yaml).toContain('call: activity');

    // Must include the activity name and task queue.
    expect(yaml).toContain('name: ProcessOrder');
    expect(yaml).toContain('taskQueue: order-processing');

    await page.getByRole('button', { name: 'Close' }).click();
  });

  test('can add and remove arguments', async ({ page }) => {
    await openActivityInspector(page);

    // Click "+ Add argument".
    await page.getByRole('button', { name: '+ Add argument' }).click();

    // Wait for save.
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });

    // There should now be 4 argument value inputs (3 existing + 1 new).
    const argInputs = page.getByLabel('Value');
    await expect(argInputs).toHaveCount(4);

    // Remove the newly added argument (last one).
    const removeButtons = page.getByLabel('Remove argument');
    await removeButtons.last().click();
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });

    // Back to 3 arguments.
    await expect(page.getByLabel('Value')).toHaveCount(3);
  });
});
