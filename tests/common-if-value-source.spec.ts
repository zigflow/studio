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
// Tests for ValueSourceSelector integration in the Common "if" condition field.
//
// All rendering tests provision an inline workflow via the PUT API — no disk reads.
import {
  type APIRequestContext,
  type Page,
  expect,
  test,
} from '@playwright/test';

// ---------------------------------------------------------------------------
// Inline workflow — one Set node so the inspector is easy to open.
// Input schema exposes a `userId` field to verify input-path mode.
// ---------------------------------------------------------------------------

const IF_TEST_ID = 'if-vss-test.yaml';

const ifTestWorkflow = {
  document: {
    dsl: '1.0.0',
    namespace: 'test',
    name: 'if-vss-test',
    version: '0.0.1',
  },
  input: {
    schema: {
      format: 'json',
      document: {
        type: 'object',
        properties: { userId: { type: 'string' } },
      },
    },
  },
  workflows: {
    main: {
      id: 'main',
      name: 'main',
      root: {
        nodes: {
          'node-1': {
            id: 'node-1',
            type: 'task',
            name: 'step',
            config: { kind: 'set', assignments: { x: 'hello' } },
          },
        },
        order: ['node-1'],
      },
    },
  },
  order: ['main'],
};

async function provisionWorkflow(request: APIRequestContext): Promise<void> {
  const res = await request.put(`/api/workflows/${IF_TEST_ID}`, {
    data: { workflowFile: ifTestWorkflow },
  });
  expect(res.ok()).toBeTruthy();
}

/** Navigate to the workflow and open the inspector for the only node. */
async function openNodeInspector(page: Page): Promise<void> {
  await page.goto(`/workflows/${IF_TEST_ID}`);
  await page
    .locator('.svelte-flow__node')
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByText('step').click();
  // Wait for the Common section heading to confirm inspector is open.
  await expect(page.getByText('Common')).toBeVisible({ timeout: 5_000 });
}

/** Export YAML and return its text, then close the dialog. */
async function exportYaml(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Export YAML' }).click();
  const exportCode = page.locator('.export-code');
  await expect(exportCode).toBeVisible();
  const text = await exportCode.textContent();
  await page.getByRole('button', { name: 'Close' }).click();
  return text ?? '';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('common if: ValueSourceSelector', () => {
  test.beforeEach(async ({ request }) => {
    await provisionWorkflow(request);
  });

  test('if field renders ValueSourceSelector', async ({ page }) => {
    await openNodeInspector(page);

    // The VSS source dropdown must appear in the Common section.
    // The label row contains "Condition (if)" — scope to the field-row.
    const commonSection = page.locator('.common-fields');
    await expect(commonSection.locator('.vss-source').first()).toBeVisible();
    await expect(commonSection.locator('.vss-value').first()).toBeVisible();
  });

  test('selecting input path stores ${ $input.userId }', async ({ page }) => {
    await openNodeInspector(page);

    const commonSection = page.locator('.common-fields');
    const sourceSelect = commonSection.locator('.vss-source').first();

    // Switch to input mode.
    await sourceSelect.selectOption('input');

    // The input-path dropdown must show 'userId' (from the schema).
    const pathSelect = commonSection.locator('.vss-value--select').first();
    await pathSelect.selectOption('userId');

    const yaml = await exportYaml(page);
    expect(yaml).toContain('if: ${ $input.userId }');
  });

  test('expression mode stores raw expression unchanged', async ({ page }) => {
    await openNodeInspector(page);

    const commonSection = page.locator('.common-fields');
    await commonSection
      .locator('.vss-source')
      .first()
      .selectOption('expression');

    const textInput = commonSection.locator('.vss-value--text').first();
    await textInput.fill('${ $input.userId != null }');

    const yaml = await exportYaml(page);
    expect(yaml).toContain('if: ');
    expect(yaml).toContain('$input.userId != null');
  });

  test('reload preserves existing ${ $input.userId } value', async ({
    page,
    request,
  }) => {
    // Provision a workflow that already has an if value set.
    const workflowWithIf = {
      ...ifTestWorkflow,
      workflows: {
        main: {
          ...ifTestWorkflow.workflows.main,
          root: {
            nodes: {
              'node-1': {
                id: 'node-1',
                type: 'task',
                name: 'step',
                config: { kind: 'set', assignments: { x: 'hello' } },
                if: '${ $input.userId }',
              },
            },
            order: ['node-1'],
          },
        },
      },
    };
    const res = await request.put(`/api/workflows/${IF_TEST_ID}`, {
      data: { workflowFile: workflowWithIf },
    });
    expect(res.ok()).toBeTruthy();

    await page.goto(`/workflows/${IF_TEST_ID}`);
    await page
      .locator('.svelte-flow__node')
      .first()
      .waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByText('step').click();
    await expect(page.getByText('Common')).toBeVisible({ timeout: 5_000 });

    // VSS must detect input mode and show the path dropdown.
    const commonSection = page.locator('.common-fields');
    await expect(commonSection.locator('.vss-source').first()).toHaveValue(
      'input',
    );
    await expect(
      commonSection.locator('.vss-value--select').first(),
    ).toHaveValue('userId');
  });
});

// ---------------------------------------------------------------------------
// Type hint tests
// ---------------------------------------------------------------------------
// Uses a separate workflow with a richer schema so paths with known types
// (string, boolean) can be selected and the rendered hint verified.

const TYPE_HINT_ID = 'type-hint-test.yaml';

const typeHintWorkflow = {
  document: {
    dsl: '1.0.0',
    namespace: 'test',
    name: 'type-hint-test',
    version: '0.0.1',
  },
  input: {
    schema: {
      format: 'json',
      document: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          hello: {
            type: 'object',
            properties: {
              world: { type: 'boolean' },
            },
          },
        },
      },
    },
  },
  workflows: {
    main: {
      id: 'main',
      name: 'main',
      root: {
        nodes: {
          'node-1': {
            id: 'node-1',
            type: 'task',
            name: 'step',
            config: { kind: 'set', assignments: { x: 'hello' } },
          },
        },
        order: ['node-1'],
      },
    },
  },
  order: ['main'],
};

test.describe('common if: type hint', () => {
  test.beforeEach(async ({ request }) => {
    const res = await request.put(`/api/workflows/${TYPE_HINT_ID}`, {
      data: { workflowFile: typeHintWorkflow },
    });
    expect(res.ok()).toBeTruthy();
  });

  test('shows (string) hint when input path resolves to string', async ({
    page,
  }) => {
    await page.goto(`/workflows/${TYPE_HINT_ID}`);
    await page
      .locator('.svelte-flow__node')
      .first()
      .waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByText('step').click();
    await expect(page.getByText('Common')).toBeVisible({ timeout: 5_000 });

    const commonSection = page.locator('.common-fields');
    await commonSection.locator('.vss-source').first().selectOption('input');
    await commonSection
      .locator('.vss-value--select')
      .first()
      .selectOption('userId');

    await expect(commonSection.locator('.vss-type-hint').first()).toBeVisible();
    await expect(commonSection.locator('.vss-type-hint').first()).toContainText(
      '(string)',
    );
  });

  test('shows (boolean) hint for nested path hello.world', async ({ page }) => {
    await page.goto(`/workflows/${TYPE_HINT_ID}`);
    await page
      .locator('.svelte-flow__node')
      .first()
      .waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByText('step').click();
    await expect(page.getByText('Common')).toBeVisible({ timeout: 5_000 });

    const commonSection = page.locator('.common-fields');
    await commonSection.locator('.vss-source').first().selectOption('input');
    await commonSection
      .locator('.vss-value--select')
      .first()
      .selectOption('hello.world');

    await expect(commonSection.locator('.vss-type-hint').first()).toBeVisible();
    await expect(commonSection.locator('.vss-type-hint').first()).toContainText(
      '(boolean)',
    );
  });

  test('type hint is hidden when source is literal', async ({ page }) => {
    await page.goto(`/workflows/${TYPE_HINT_ID}`);
    await page
      .locator('.svelte-flow__node')
      .first()
      .waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByText('step').click();
    await expect(page.getByText('Common')).toBeVisible({ timeout: 5_000 });

    const commonSection = page.locator('.common-fields');
    await commonSection.locator('.vss-source').first().selectOption('literal');

    await expect(
      commonSection.locator('.vss-type-hint').first(),
    ).not.toBeVisible();
  });

  test('type hint is hidden when source is expression', async ({ page }) => {
    await page.goto(`/workflows/${TYPE_HINT_ID}`);
    await page
      .locator('.svelte-flow__node')
      .first()
      .waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByText('step').click();
    await expect(page.getByText('Common')).toBeVisible({ timeout: 5_000 });

    const commonSection = page.locator('.common-fields');
    await commonSection
      .locator('.vss-source')
      .first()
      .selectOption('expression');

    await expect(
      commonSection.locator('.vss-type-hint').first(),
    ).not.toBeVisible();
  });
});
