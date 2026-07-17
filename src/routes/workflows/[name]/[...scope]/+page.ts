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
import { ScopeResolutionError, resolveUrlSegments } from '$lib/graph/scope';

import type { PageLoad } from './$types';

/**
 * Turn the `[...scope]` URL segments into a `ScopePath` (DESIGN.md §6). Runs on
 * scope change only (the workflow itself is loaded by the parent `[name]` layout,
 * reached via `parent()`), so scope navigation is a cheap client-side resolve
 * with no re-fetch.
 *
 * `scopePath`/`scopeError` here are the server-resolved, no-flash values for the
 * first paint of a deep link. The page component re-resolves the same segments
 * against its live (reactive, possibly-edited) workflow at runtime so that
 * unsaved additions/renames within the open path still resolve — see the page.
 */
export const load: PageLoad = async ({ params, parent }) => {
  const { workflow } = await parent();
  const segments = (params.scope ?? '').split('/').filter(Boolean);

  if (!workflow) {
    return { scopeSegments: segments, scopePath: [], scopeError: false };
  }

  try {
    const scopePath = resolveUrlSegments(workflow, segments);
    return { scopeSegments: segments, scopePath, scopeError: false };
  } catch (err) {
    if (err instanceof ScopeResolutionError) {
      // A stale/typo deep link: fall back to root, flag it for a notice. An
      // empty scope is the root and never an error.
      return {
        scopeSegments: segments,
        scopePath: [],
        scopeError: segments.length > 0,
      };
    }
    throw err;
  }
};
