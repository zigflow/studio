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
import type { PageLoad } from './$types';

/** One entry in the project list: routing name + resolved display name (§6). */
export interface WorkflowListItem {
  /** The on-disk/routing name — used to build the link URL, not shown as the name. */
  name: string;
  /** `document.title || document.workflowType` (DESIGN.md §6 display-naming rule). */
  displayName: string;
}

/**
 * List every stored workflow for the `/workflows` landing page (DESIGN.md §6).
 * Uses the existing GET /api/workflows route, which resolves each workflow's
 * display name. On failure it renders an empty list rather than a hard error —
 * the page is the app's entry point, so a bare list beats a dead end.
 */
export const load: PageLoad = async ({ fetch }) => {
  const res = await fetch('/api/workflows');
  if (!res.ok) {
    return { workflows: [] as WorkflowListItem[] };
  }
  const { workflows } = (await res.json()) as { workflows: WorkflowListItem[] };
  return { workflows };
};
