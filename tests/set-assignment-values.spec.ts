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

/**
 * Open the greet node inspector (it is a Set node in the demo workflow).
 * Waits until the Assignments section is visible.
 */
async function openGreetInspector(page: Page) {
  await page.goto(WORKFLOW);
  await page
    .locator('.svelte-flow__node')
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByText('greet').click();
  await expect(
    page.getByRole('button', { name: '+ Add assignment' }),
  ).toBeVisible({ timeout: 5_000 });
}

/**
 * Add a new assignment row, set its key and value (both cleared and re-typed
 * so the test is idempotent across re-runs), and return the new row locator.
 */
async function addRow(page: Page, key: string, value: string) {
  const addBtn = page.getByRole('button', { name: '+ Add assignment' });
  const rows = page.locator('.assignment-item');
  const countBefore = await rows.count();

  await addBtn.click();
  await expect(rows).toHaveCount(countBefore + 1);

  const newRow = rows.last();
  const keyInput = newRow.getByRole('textbox').first();
  await keyInput.fill(key);

  const valueInput = newRow.getByLabel('Value');
  await valueInput.fill(value);

  return newRow;
}

/**
 * Export YAML and return the full text of the export code block.
 */
async function exportYaml(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Export YAML' }).click();
  const exportCode = page.locator('.export-code');
  await expect(exportCode).toBeVisible();
  const text = await exportCode.textContent();
  // Close the dialog so it doesn't interfere with other assertions.
  await page.getByRole('button', { name: 'Close' }).click();
  return text ?? '';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Set assignment value types', () => {
  test('auto mode: boolean true — YAML emits unquoted true', async ({
    page,
  }) => {
    await openGreetInspector(page);
    await addRow(page, 'pw-bool', 'true');

    const yaml = await exportYaml(page);
    // js-yaml emits boolean true without quotes.
    expect(yaml).toMatch(/pw-bool:\s+true(?!\w)/);
    // Must NOT be quoted.
    expect(yaml).not.toMatch(/pw-bool:\s+'true'/);
    expect(yaml).not.toMatch(/pw-bool:\s+"true"/);
  });

  test('auto mode: number — YAML emits unquoted integer', async ({ page }) => {
    await openGreetInspector(page);
    await addRow(page, 'pw-num', '123');

    const yaml = await exportYaml(page);
    expect(yaml).toMatch(/pw-num:\s+123(?!\d)/);
    // Must NOT be a quoted string.
    expect(yaml).not.toMatch(/pw-num:\s+'123'/);
  });

  test('auto mode: plain string — YAML emits unquoted string', async ({
    page,
  }) => {
    await openGreetInspector(page);
    await addRow(page, 'pw-str', 'hello');

    const yaml = await exportYaml(page);
    expect(yaml).toMatch(/pw-str:\s+hello/);
  });

  test('auto mode: object input — shows validation error, YAML unchanged', async ({
    page,
  }) => {
    await openGreetInspector(page);

    const addBtn = page.getByRole('button', { name: '+ Add assignment' });
    const rows = page.locator('.assignment-item');
    const countBefore = await rows.count();

    await addBtn.click();
    await expect(rows).toHaveCount(countBefore + 1);

    const newRow = rows.last();

    // Set a stable key first.
    await newRow.getByRole('textbox').first().fill('pw-obj');

    // Type an object into the value input.
    const valueInput = newRow.getByLabel('Value');
    await valueInput.fill('{ "a": 1 }');

    // Error message must be visible.
    await expect(
      page.getByText('Objects and arrays are not supported'),
    ).toBeVisible();

    // YAML export must NOT contain pw-obj (row was never persisted with object).
    const yaml = await exportYaml(page);
    expect(yaml).not.toContain('pw-obj:');
  });

  test('string override: "true" is stored as quoted string in YAML', async ({
    page,
  }) => {
    await openGreetInspector(page);

    const addBtn = page.getByRole('button', { name: '+ Add assignment' });
    const rows = page.locator('.assignment-item');
    const countBefore = await rows.count();

    await addBtn.click();
    await expect(rows).toHaveCount(countBefore + 1);

    const newRow = rows.last();
    await newRow.getByRole('textbox').first().fill('pw-strover');

    // Switch override to String before entering the value.
    await newRow
      .getByRole('combobox', { name: /Type for/ })
      .selectOption('string');

    const valueInput = newRow.getByLabel('Value');
    await valueInput.fill('true');

    const yaml = await exportYaml(page);
    // js-yaml must quote the string "true" to distinguish it from boolean.
    expect(yaml).toMatch(/pw-strover:\s+'true'/);
  });

  test('auto mode: float — YAML emits unquoted float', async ({ page }) => {
    await openGreetInspector(page);
    await addRow(page, 'pw-float', '3.14');

    const yaml = await exportYaml(page);
    expect(yaml).toMatch(/pw-float:\s+3\.14/);
  });

  test('auto mode: null — YAML emits null', async ({ page }) => {
    await openGreetInspector(page);
    await addRow(page, 'pw-null-auto', 'null');

    const yaml = await exportYaml(page);
    expect(yaml).toMatch(/pw-null-auto:\s+null/);
  });

  test('null override — value input is disabled and YAML emits null', async ({
    page,
  }) => {
    await openGreetInspector(page);

    const addBtn = page.getByRole('button', { name: '+ Add assignment' });
    const rows = page.locator('.assignment-item');
    const countBefore = await rows.count();

    await addBtn.click();
    await expect(rows).toHaveCount(countBefore + 1);

    const newRow = rows.last();
    await newRow.getByRole('textbox').first().fill('pw-nullov');

    // Switch override to Null.
    await newRow
      .getByRole('combobox', { name: /Type for/ })
      .selectOption('null');

    // Value input must be disabled.
    const valueInput = newRow.getByLabel('Value');
    await expect(valueInput).toBeDisabled();

    const yaml = await exportYaml(page);
    expect(yaml).toMatch(/pw-nullov:\s+null/);
  });
});
