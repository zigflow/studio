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

// Regression coverage for the click-selection-highlight bug (DESIGN.md §6):
// clicking a node updated the URL (`?selected=`) but not the card highlight,
// because `selectedId` was derived from `page.url` and SvelteKit's shallow
// `replaceState` never moves the reactive `page.url`. The fix made `selectedId`
// a directly-set `$state`. This bug shipped twice on reasoning-only review with
// no headless browser to catch it — hence an actual browser drives it here.
//
// The `orderProcessing` scope is entered directly (it's a `do` container whose
// body holds three sibling tasks), which gives multiple cards to move the
// highlight between — the exact motion the bug broke.
const SCOPE_URL = '/workflows/order-processing/orderProcessing';

/** A task card locator, matched by the task name it renders. */
function card(page: Page, name: string) {
  return page.locator('.task-node').filter({ hasText: name });
}

/** Click a card without hitting its inline controls (they stop propagation). */
async function selectCard(page: Page, name: string) {
  await card(page, name).locator('.name').click();
}

/**
 * The inspector's name field — the first input in the pane, ahead of any
 * task-kind form inputs (Method/Endpoint/key-value), so it identifies the
 * selected task regardless of its kind.
 */
function inspectorName(page: Page) {
  return page.locator('.inspector input').first();
}

test.describe('node selection highlight', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SCOPE_URL);
    // Wait for the canvas to project the scope's nodes before interacting.
    await expect(card(page, 'validateOrder')).toBeVisible();
  });

  test('starts with nothing selected', async ({ page }) => {
    await expect(page.locator('.task-node.selected')).toHaveCount(0);
    await expect(page.locator('.inspector-empty')).toBeVisible();
    expect(new URL(page.url()).searchParams.has('selected')).toBe(false);
  });

  test('clicking a node highlights it and syncs the URL + inspector', async ({
    page,
  }) => {
    await selectCard(page, 'validateOrder');

    await expect(card(page, 'validateOrder')).toHaveClass(/selected/);
    await expect(page.locator('.task-node.selected')).toHaveCount(1);
    await expect(page).toHaveURL(/selected=validateOrder/);
    await expect(inspectorName(page)).toHaveValue('validateOrder');
  });

  test('clicking a second node moves the highlight (the regression)', async ({
    page,
  }) => {
    await selectCard(page, 'validateOrder');
    await expect(card(page, 'validateOrder')).toHaveClass(/selected/);

    // The core of the bug: selecting another node must move the highlight to it
    // (and off the first) without a page reload — previously the URL changed but
    // the highlight stayed stuck on the first node.
    await selectCard(page, 'waitForPayment');

    await expect(card(page, 'waitForPayment')).toHaveClass(/selected/);
    await expect(card(page, 'validateOrder')).not.toHaveClass(/selected/);
    await expect(page.locator('.task-node.selected')).toHaveCount(1);
    await expect(page).toHaveURL(/selected=waitForPayment/);
    await expect(inspectorName(page)).toHaveValue('waitForPayment');
  });

  test('selection survives a reload via the URL', async ({ page }) => {
    await selectCard(page, 'fulfilOrder');
    await expect(page).toHaveURL(/selected=fulfilOrder/);

    await page.reload();

    // The deep-link path: on a real load the selection is re-resolved from the
    // URL, so the highlight and inspector come back without another click.
    await expect(card(page, 'fulfilOrder')).toHaveClass(/selected/);
    await expect(inspectorName(page)).toHaveValue('fulfilOrder');
  });
});
