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

import type { PageLoad } from './$types';

/**
 * Load one workflow through the existing GET /api/workflows/[name] route (which
 * runs `ensureTaskIds`, so every task arrives with a `__zigflow_id`). On failure
 * we return `workflow: null` and let the page render a localized message rather
 * than throwing to the generic error page.
 */
export const load: PageLoad = async ({ params, fetch }) => {
  const res = await fetch(`/api/workflows/${params.name}`);
  if (!res.ok) {
    return { name: params.name, workflow: null };
  }
  const workflow = (await res.json()) as ZigflowWorkflow;
  return { name: params.name, workflow };
};
