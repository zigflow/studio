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
import { defineConfig, devices } from '@playwright/test';

// The e2e suite drives the *real* app in a browser — its reason for existing is
// the class of interactive canvas/reactivity bug that "should work by reasoning"
// review keeps missing (see DESIGN.md's "reasoning-only guarantee" note).
//
// The dev server is pointed at a committed, read-only fixture store
// (`e2e/fixtures/storage`) rather than the developer's own `./workflows`, so the
// tests are hermetic and never depend on or mutate ambient on-disk data. A
// dedicated port keeps it clear of a `npm run dev` already running on 5173.
const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: {
      PORT: String(PORT),
      ZIGFLOW_STORAGE_DIR: 'e2e/fixtures/storage',
    },
  },
});
