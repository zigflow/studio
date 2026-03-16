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
import { expect, test } from '@playwright/test';

const WORKFLOW = '/workflows/demo-workflow.yaml';

test.describe('Workflow deletion', () => {
  test('can delete a workflow and sidebar updates immediately', async ({
    page,
  }) => {
    await page.goto(WORKFLOW);

    // Add a second workflow so we have two.
    await page.getByRole('button', { name: '+ Add workflow' }).click();

    // Wait for the save to complete before continuing.
    const saveStatus = page.getByTestId('save-status');
    await expect(saveStatus).toContainText('Saved', { timeout: 5000 });

    // Sidebar should now show two workflow entries.
    const workflowItems = page.locator('.workflow-list-item');
    await expect(workflowItems).toHaveCount(2);

    // Hover over the second workflow item to reveal the delete button, then click it.
    const secondItem = workflowItems.nth(1);
    await secondItem.hover();
    await secondItem.getByRole('button', { name: 'Delete workflow' }).click();

    // Confirmation dialog should appear.
    const dialog = page.getByRole('dialog', { name: 'Delete workflow' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(
      'Are you sure you want to delete this workflow?',
    );

    // Confirm the deletion.
    await dialog.getByRole('button', { name: 'Delete' }).click();

    // Dialog should close and sidebar should show only one workflow entry.
    await expect(dialog).not.toBeVisible();
    await expect(workflowItems).toHaveCount(1);

    // Wait for the save triggered by the deletion to complete.
    await expect(saveStatus).toContainText('Saved', { timeout: 5000 });
  });

  test('deleted workflow does not reappear after reload', async ({ page }) => {
    await page.goto(WORKFLOW);

    // Add a second workflow.
    await page.getByRole('button', { name: '+ Add workflow' }).click();
    const saveStatus = page.getByTestId('save-status');
    await expect(saveStatus).toContainText('Saved', { timeout: 5000 });

    // Record the name of the second workflow before deleting it.
    const workflowItems = page.locator('.workflow-list-item');
    const secondItem = workflowItems.nth(1);
    const secondName = await secondItem.locator('.workflow-item').textContent();

    // Delete the second workflow.
    await secondItem.hover();
    await secondItem.getByRole('button', { name: 'Delete workflow' }).click();
    await page
      .getByRole('dialog', { name: 'Delete workflow' })
      .getByRole('button', { name: 'Delete' })
      .click();

    // Wait for save.
    await expect(saveStatus).toContainText('Saved', { timeout: 5000 });

    // Reload the page and confirm the deleted workflow is gone.
    await page.reload();
    await expect(workflowItems).toHaveCount(1);
    if (secondName) {
      await expect(page.locator('.workflow-item')).not.toContainText(
        secondName.trim(),
      );
    }
  });

  test('delete is blocked when only one workflow remains', async ({ page }) => {
    await page.goto(WORKFLOW);

    // With only one workflow, the delete button should be disabled.
    const workflowItems = page.locator('.workflow-list-item');
    await expect(workflowItems).toHaveCount(1);

    const soleItem = workflowItems.first();
    await soleItem.hover();

    const deleteBtn = soleItem.getByRole('button', { name: 'Delete workflow' });
    await expect(deleteBtn).toBeDisabled();

    // No confirmation dialog should open.
    await deleteBtn.click({ force: true });
    await expect(
      page.getByRole('dialog', { name: 'Delete workflow' }),
    ).not.toBeVisible();
  });

  test('cancelling deletion leaves the workflow intact', async ({ page }) => {
    await page.goto(WORKFLOW);

    // Add a second workflow.
    await page.getByRole('button', { name: '+ Add workflow' }).click();
    const saveStatus = page.getByTestId('save-status');
    await expect(saveStatus).toContainText('Saved', { timeout: 5000 });

    const workflowItems = page.locator('.workflow-list-item');

    // Open the delete dialog for the second workflow.
    const secondItem = workflowItems.nth(1);
    await secondItem.hover();
    await secondItem.getByRole('button', { name: 'Delete workflow' }).click();

    const dialog = page.getByRole('dialog', { name: 'Delete workflow' });
    await expect(dialog).toBeVisible();

    // Click Cancel.
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    // Dialog is gone, both workflows still present.
    await expect(dialog).not.toBeVisible();
    await expect(workflowItems).toHaveCount(2);
  });

  test('deleting the active workflow navigates to another', async ({
    page,
  }) => {
    await page.goto(WORKFLOW);

    // Add a second workflow and select it.
    await page.getByRole('button', { name: '+ Add workflow' }).click();
    const saveStatus = page.getByTestId('save-status');
    await expect(saveStatus).toContainText('Saved', { timeout: 5000 });

    const workflowItems = page.locator('.workflow-list-item');
    // Select the second workflow.
    await workflowItems.nth(1).locator('.workflow-item').click();

    // Delete the currently-selected second workflow.
    const secondItem = workflowItems.nth(1);
    await secondItem.hover();
    await secondItem.getByRole('button', { name: 'Delete workflow' }).click();
    await page
      .getByRole('dialog', { name: 'Delete workflow' })
      .getByRole('button', { name: 'Delete' })
      .click();

    // App should have navigated to the first (remaining) workflow.
    await expect(workflowItems).toHaveCount(1);
    await expect(workflowItems.first().locator('.workflow-item')).toHaveClass(
      /workflow-item--selected/,
    );
  });
});
