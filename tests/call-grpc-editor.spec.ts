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

async function openGrpcCallInspector(page: Page) {
  await page.goto(WORKFLOW);
  await page
    .locator('.svelte-flow__node')
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByText('grpc-call').click();
  // Wait until the Call gRPC section is visible.
  await expect(page.getByRole('heading', { name: 'Call gRPC' })).toBeVisible({
    timeout: 5_000,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Call gRPC editor', () => {
  test('selecting a call-grpc node shows the Call gRPC section', async ({
    page,
  }) => {
    await openGrpcCallInspector(page);

    // Proto endpoint is visible and shows the configured value.
    await expect(page.getByLabel('Endpoint')).toBeVisible();
    await expect(page.getByLabel('Endpoint')).toHaveValue(
      'api.example.com:8080',
    );

    // Service name is visible and shows the configured value.
    await expect(page.getByLabel('Service name')).toBeVisible();
    await expect(page.getByLabel('Service name')).toHaveValue('ExampleService');

    // Host is visible and shows the configured value.
    await expect(page.getByLabel('Host')).toBeVisible();
    await expect(page.getByLabel('Host')).toHaveValue('grpc.example.com');

    // Port is visible and shows the configured value.
    await expect(page.getByLabel('Port')).toBeVisible();
    await expect(page.getByLabel('Port')).toHaveValue('50051');

    // Method is visible and shows the configured value.
    await expect(page.getByLabel('Method')).toBeVisible();
    await expect(page.getByLabel('Method')).toHaveValue('GetData');
  });

  test('method change persists across reload', async ({ page }) => {
    await openGrpcCallInspector(page);

    const methodInput = page.getByLabel('Method');

    // Change method.
    await methodInput.fill('CreateItem');

    // Wait for auto-save.
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });

    // Reload — URL carries ?selected=... so the inspector reopens.
    await page.reload();
    await page
      .locator('.svelte-flow__node')
      .first()
      .waitFor({ state: 'visible', timeout: 10_000 });

    // Inspector should reopen on the same node.
    await expect(page.getByLabel('Method')).toHaveValue('CreateItem', {
      timeout: 5_000,
    });

    // Restore original value so the workflow is left in a clean state.
    await page.getByLabel('Method').fill('GetData');
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });
  });

  test('invalid port shows a validation error and does not update IR', async ({
    page,
  }) => {
    await openGrpcCallInspector(page);

    const portInput = page.getByLabel('Port');

    // Enter an invalid port.
    await portInput.fill('abc');

    // Validation error must appear.
    await expect(
      page.getByText('Port must be a positive integer'),
    ).toBeVisible();

    // Export YAML: the original port must still be present.
    await page.getByRole('button', { name: 'Export YAML' }).click();
    const exportCode = page.locator('.export-code');
    await expect(exportCode).toBeVisible();
    const yaml = await exportCode.textContent();
    expect(yaml).toContain('50051');
    await page.getByRole('button', { name: 'Close' }).click();
  });

  test('clearing port auto-sets to default 50051 and saves correctly', async ({
    page,
  }) => {
    await openGrpcCallInspector(page);

    const portInput = page.getByLabel('Port');

    // Enter a custom port first.
    await portInput.fill('9090');
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });

    // Clear the port — should default to 50051.
    await portInput.fill('');

    // No validation error.
    await expect(
      page.getByText('Port must be a positive integer'),
    ).not.toBeVisible();

    // Wait for auto-save.
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });

    // Export YAML: port should be 50051 (the default).
    await page.getByRole('button', { name: 'Export YAML' }).click();
    const exportCode = page.locator('.export-code');
    await expect(exportCode).toBeVisible();
    const yaml = await exportCode.textContent();
    expect(yaml).toContain('50051');
    await page.getByRole('button', { name: 'Close' }).click();

    // Field now shows 50051.
    await expect(portInput).toHaveValue('50051');
  });
});
