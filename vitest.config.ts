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
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Most tests are plain-TypeScript domain logic (no Svelte, no DOM) and run in
// the node environment. A few — notably the task-form registry's exhaustiveness
// test — import `.svelte` modules, so the Svelte and Paraglide plugins and the
// `$lib` alias are wired in to transform/resolve those imports. Components are
// only *imported* here (to assert coverage), never mounted, so no DOM/jsdom is
// needed. Vite resolves the `?raw` schema import natively.
export default defineConfig({
  plugins: [
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/lib/paraglide',
      strategy: ['preferredLanguage', 'baseLocale'],
    }),
    svelte(),
  ],
  resolve: {
    alias: { $lib: path.resolve('./src/lib') },
  },
  test: {
    include: ['src/**/*.{test,spec}.ts'],
    environment: 'node',
  },
});
