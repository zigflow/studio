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
import type { ZigflowWorkflow } from '$lib/types/zigflow';

import type { LayoutLoad } from './$types';

/**
 * Load the workflow once per `[name]` (DESIGN.md §6). Scope lives in the child
 * `[...scope]` route, so this load depends only on `name` — SvelteKit does not
 * re-run it when just the scope segments change, which keeps drill-in/breadcrumb
 * navigation from re-fetching (and clobbering unsaved edits held in the page's
 * reactive state). Loads through the existing GET route (which runs
 * `ensureTaskIds`). On failure, `workflow: null` renders a localized message
 * rather than a hard 404.
 */
export const load: LayoutLoad = async ({ params, fetch }) => {
  const res = await fetch(`/api/workflows/${params.name}`);
  if (!res.ok) {
    return { name: params.name, workflow: null };
  }
  const workflow = (await res.json()) as ZigflowWorkflow;
  return { name: params.name, workflow };
};
